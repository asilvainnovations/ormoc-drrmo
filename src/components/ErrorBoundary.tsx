import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { detailsText, isChunkLoadError, reportError } from '@/lib/errors';
import { Button, Notice } from '@/components/ui';

const RELOADED_KEY = 'drrm:reloaded-after-update';

interface Props { children: ReactNode; resetKey?: string; whole?: boolean }
interface State { error: unknown | null; copied: boolean }

/**
 * A crash shows a plain-language recovery screen instead of a white page (audit #19), and
 * sends a short report. Saved work is in IndexedDB, so reloading never loses it.
 * A page left open across a deploy asks for code that no longer exists: it reloads once.
 */
class Boundary extends Component<Props, State> {
  state: State = { error: null, copied: false };
  static getDerivedStateFromError(error: unknown): Partial<State> { return { error }; }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error)) {
      let again = false;
      try { again = sessionStorage.getItem(RELOADED_KEY) === '1'; sessionStorage.setItem(RELOADED_KEY, '1'); } catch { again = true; }
      if (!again) { window.location.reload(); return; }
    }
    const e = error instanceof Error ? error : new Error(String(error));
    if (info.componentStack && e.stack) e.stack = `${e.stack}\nComponent stack:${info.componentStack}`;
    void reportError('render', e);
  }
  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, copied: false });
  }
  render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    const update = isChunkLoadError(error);
    const copy = async () => {
      try { await navigator.clipboard.writeText(detailsText(error)); this.setState({ copied: true }); } catch { /* clipboard blocked */ }
    };
    return (
      <div className={this.props.whole ? 'page min-h-dvh' : 'page'} role="alert">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold"><AlertTriangle className="h-7 w-7 text-bad" aria-hidden />
          {update ? 'A new version is ready' : 'This screen stopped working'}</h1>
        <p className="mt-2 max-w-prose text-lg">
          {update ? 'The app was updated while this page was open. Reload to get the new version.'
            : 'What you saved is still on this device and will send when there is a connection. Reloading does not delete it.'}
        </p>
        {!update && <Notice tone="bad" title="What went wrong">{error instanceof Error ? error.message : String(error)}</Notice>}
        {!update && <p className="mb-4 max-w-prose text-sm text-muted">A short report (screen, app version and the error, never what you typed) was sent to the City's administrator.</p>}
        <div className="flex flex-wrap gap-3">
          <Button tip="Reload the app. Saved work stays on this device" icon={RefreshCw} onClick={() => window.location.reload()}>Reload</Button>
          {!this.props.whole && <Button tip="Go back to the Today screen" variant="secondary" onClick={() => { window.location.assign('/today'); }}>Go to Today</Button>}
          {!update && <Button tip="Copy the error details to send to the administrator" variant="quiet" onClick={copy}>{copied ? 'Copied' : 'Copy details'}</Button>}
        </div>
      </div>
    );
  }
}

/** Around the whole app: last line of defence (no router needed). */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <Boundary whole>{children}</Boundary>;
}

/** Around each screen: the menu keeps working, and moving to another screen clears the error. */
export function ScreenErrorBoundary({ children }: { children: ReactNode }) {
  const loc = useLocation();
  return <Boundary resetKey={loc.pathname}>{children}</Boundary>;
}
