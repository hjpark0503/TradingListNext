'use client';

import dynamic from 'next/dynamic';

const TradesPage = dynamic(() => import('@/components/TradesPage'), { ssr: false });

export default function Page() {
  return <TradesPage />;
}
