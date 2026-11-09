// Light, Dark or System appearance (1.11.0). The choice is kept on this device (local storage key "theme") by
// components/theme-provider.tsx, which sets .light or .dark on <html>; tokens.css and `dark:` utilities follow it.
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { tip } from '@/components/Tooltip';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun, tip: 'Light screens, best outdoors and in daylight' },
  { value: 'dark', label: 'Dark', icon: Moon, tip: 'Dark screens, easier on the eyes at night and on battery' },
  { value: 'system', label: 'Same as this device', icon: Monitor, tip: 'Follow the light or dark setting of this phone or computer' },
] as const;

export function ThemeToggle({ className, withLabel = false }: { className?: string; withLabel?: boolean }) {
  const { theme, setTheme } = useTheme();
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[2];
  const Icon = current.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger {...tip(`Appearance: ${current.label}. Change to light, dark or the device setting`)} aria-label="Appearance"
        className={cn('inline-flex min-h-tap min-w-tap items-center justify-center gap-2 rounded-control px-2 font-semibold hover:bg-sky-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus', className)}>
        <Icon className="h-5 w-5" aria-hidden />{withLabel && <span>Appearance</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value} {...tip(o.tip)} className="min-h-tap gap-2">
              <o.icon className="h-4 w-4" aria-hidden />{o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
