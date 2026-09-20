'use client';

import { useEffect, useState } from 'react';

import { THEMES, type ThemeName } from '@/lib/shading';

function read(): ThemeName {
  const value = document.documentElement.dataset.theme;
  return THEMES.includes(value as ThemeName) ? (value as ThemeName) : 'light';
}

/**
 * Which theme is on, for the things CSS cannot reach.
 *
 * The theme is an attribute on `<html>` that `ThemeControl` writes directly and a boot
 * script sets before first paint, so there is no React state holding it. Everything on a
 * page follows it through the tokens. The map cannot: MapLibre paints to a canvas and its
 * style carries literal colours, so it has to be told. Nor can the legend swatch, which
 * mixes a ramp step over the basemap's own ground colour. Watching the attribute keeps the
 * one source of truth where it already is rather than adding a second.
 *
 * It starts at `light` on purpose, even though the real value is readable on the client at
 * this point. Reading it in the initialiser makes the first client render disagree with the
 * server, and React does not repair every mismatched attribute: it keeps the server's DOM,
 * and the effect below then calls `setTheme` with the value the state already holds, so
 * React bails out and the stale colours stay on screen forever. Measured on 2026-09-20,
 * with `html[data-theme]` reading dark and the legend swatches still painting the light
 * ramp. Agreeing with the server and correcting in the effect gives React a real change to
 * commit.
 */
export function useThemeName(): ThemeName {
  const [theme, setTheme] = useState<ThemeName>('light');

  useEffect(() => {
    setTheme(read());

    const observer = new MutationObserver(() => setTheme(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}
