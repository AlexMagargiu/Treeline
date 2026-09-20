import { TrailPlaceholder } from '@/components/massif/trail-placeholder';

/**
 * The third rest of the sheet, with nothing in it yet.
 *
 * The trail page is the next piece of work. This route exists now for one reason: it sits
 * under the map layout, so opening a trail row keeps the same MapLibre instance. Routing a
 * row at a page that does not exist would land on Next's not-found, which renders under the
 * root layout, and the map the whole screen is built around would be torn down and rebuilt
 * on every row a reader opened.
 *
 * It reads no route data and prints no figures. The next prompt replaces this file.
 */
export default async function TrailPage({
  params,
}: {
  params: Promise<{ massifId: string; routeId: string }>;
}) {
  const { massifId } = await params;
  return <TrailPlaceholder massifId={massifId} />;
}
