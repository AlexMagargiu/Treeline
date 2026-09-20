import type { Metadata } from 'next';

import { CountrySheet } from '@/components/country/country-sheet';

export const metadata: Metadata = { title: 'Treeline' };

export default function CountryPage() {
  return <CountrySheet />;
}
