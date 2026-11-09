// Toast state for src/components/ui/toast.tsx and toaster.tsx (the standard shadcn/ui hook). MODE's everyday
// confirmations still use components/Toast (verb echo); this queue serves the Radix toast where a screen needs
// an action button inside the toast.
import * as React from 'react';
import type { ToastActionElement, ToastProps } from '@/components/ui/toast';

const TOAST_LIMIT = 3;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & { id: string; title?: React.ReactNode; description?: React.ReactNode; action?: ToastActionElement };
type State = { toasts: ToasterToast[] };
type Action =
  | { type: 'ADD_TOAST'; toast: ToasterToast }
  | { type: 'UPDATE_TOAST'; toast: Partial<ToasterToast> }
  | { type: 'DISMISS_TOAST'; toastId?: string }
  | { type: 'REMOVE_TOAST'; toastId?: string };

let count = 0;
const genId = () => { count = (count + 1) % Number.MAX_SAFE_INTEGER; return count.toString(); };
const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

const queueRemove = (toastId: string) => {
  if (timeouts.has(toastId)) return;
  timeouts.set(toastId, setTimeout(() => { timeouts.delete(toastId); dispatch({ type: 'REMOVE_TOAST', toastId }); }, TOAST_REMOVE_DELAY));
};

export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'ADD_TOAST': return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) };
    case 'UPDATE_TOAST': return { ...state, toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)) };
    case 'DISMISS_TOAST': {
      const { toastId } = action;
      if (toastId) queueRemove(toastId); else state.toasts.forEach((t) => queueRemove(t.id));
      return { ...state, toasts: state.toasts.map((t) => (t.id === toastId || toastId === undefined ? { ...t, open: false } : t)) };
    }
    case 'REMOVE_TOAST':
      return { ...state, toasts: action.toastId === undefined ? [] : state.toasts.filter((t) => t.id !== action.toastId) };
  }
};

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((l) => l(memoryState));
}

type Toast = Omit<ToasterToast, 'id'>;
function toast({ ...props }: Toast) {
  const id = genId();
  const update = (p: ToasterToast) => dispatch({ type: 'UPDATE_TOAST', toast: { ...p, id } });
  const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });
  dispatch({ type: 'ADD_TOAST', toast: { ...props, id, open: true, onOpenChange: (open) => { if (!open) dismiss(); } } });
  return { id, dismiss, update };
}

function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => { const i = listeners.indexOf(setState); if (i > -1) listeners.splice(i, 1); };
  }, []);
  return { ...state, toast, dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }) };
}

export { useToast, toast };
