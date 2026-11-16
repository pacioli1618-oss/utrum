import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {LegalPage} from '@/components/legal/LegalPage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('About');
  return {title: `${t('title')} · Utrum`, description: t('intro')};
}

// /about · What Utrum is, how the comparisons work, how to tell a real link from a scam, who makes it, the source code.
export default function AboutPage() {
  return <LegalPage namespace="About" sections={['how', 'visibility', 'safety', 'who', 'code']} />;
}
