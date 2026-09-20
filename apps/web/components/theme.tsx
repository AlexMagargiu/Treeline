'use client';

import * as React from 'react';
import { Contrast, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const THEME_STORAGE_KEY = 'treeline-theme';

const THEMES = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'contrast', label: 'High contrast', Icon: Contrast },
] as const;

type Theme = (typeof THEMES)[number]['value'];

/**
 * Runs in <head> before the first paint, so the page is never drawn in the wrong theme
 * and then corrected. A stored choice wins; with nothing stored the system preference
 * decides, which is what a phone set to dark at 05:00 expects.
 */
export const themeBootScript = `
try {
  var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
  var theme = stored === 'light' || stored === 'dark' || stored === 'contrast'
    ? stored
    : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
`.trim();

/**
 * Three explicit choices rather than two and a system preference. The high contrast theme
 * exists for reading a phone in direct sun, and a mode nobody can turn on is not a mode.
 */
export function ThemeControl() {
  const [theme, setTheme] = React.useState<Theme | null>(null);

  // The real value lives on <html>, written by the boot script above. Reading it after
  // mount rather than rendering from state keeps the server and client markup identical.
  React.useEffect(() => {
    const current = document.documentElement.dataset.theme;
    setTheme(current === 'dark' || current === 'contrast' ? current : 'light');
  }, []);

  function choose(value: Theme) {
    document.documentElement.dataset.theme = value;
    setTheme(value);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // A browser with storage blocked still gets the theme for this page view.
    }
  }

  return (
    <div>
      <h2 id="theme-label" className="text-base font-medium text-foreground">
        Theme
      </h2>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-labelledby="theme-label">
        {THEMES.map(({ value, label, Icon }) => (
          <Button
            key={value}
            type="button"
            variant="outline"
            aria-pressed={theme === value}
            onClick={() => choose(value)}
            className={cn(
              'w-auto flex-1 basis-32 justify-start',
              theme === value &&
                'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            <Icon aria-hidden="true" strokeWidth={1.75} />
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}
