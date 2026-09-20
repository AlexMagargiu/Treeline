import { LogoutButton } from '@/components/logout-button';
import { ThemeControl } from '@/components/theme';

/*
 * Home is the country map in the finished product, and the map does not exist yet: the
 * basemap tiles are section 4 of docs/phase-1.md and the map screen is the prompt after
 * it. The spec's other three home states all need sessions, plans or visits, which are
 * phase 4 and later.
 *
 * So this says what is coming and links nowhere. There is no placeholder map image and no
 * div shaped like one. An honest empty state is not a failure; a fabricated screenshot of
 * a mountain range would be.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">Treeline</h1>
      <p className="mt-3 text-base text-muted-foreground">
        The country map opens here, with the massifs shaded. It is not built yet.
      </p>

      <div className="mt-10 border-t border-border pt-8">
        <ThemeControl />
      </div>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </main>
  );
}
