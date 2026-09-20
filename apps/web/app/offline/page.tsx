import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline',
};

/*
 * What the service worker serves when a navigation fails with no network.
 *
 * It states the situation and nothing else. No route, no distance, no season: offline
 * data is phase 9, and a cached figure about a mountain that has since been corrected
 * would be a lie told at the worst possible moment.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-center px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">No connection</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Treeline needs the network to show a route. Nothing is stored on this phone yet, so
        there is nothing to read until the signal comes back.
      </p>
    </main>
  );
}
