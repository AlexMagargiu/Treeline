import { MassifSheet } from '@/components/massif/massif-sheet';

export default async function MassifPage({
  params,
}: {
  params: Promise<{ massifId: string }>;
}) {
  const { massifId } = await params;
  return <MassifSheet massifId={massifId} />;
}
