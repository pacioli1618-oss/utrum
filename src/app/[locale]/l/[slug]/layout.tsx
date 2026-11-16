import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {getListPreview} from '@/lib/list-preview';

// Link preview for every page under /l/<slug>, including personal links. Written in the
// list's language (lists.locale), not the visitor's: the crawler that builds the preview
// sends no cookie, and everyone should see the same card. Never shows names or rankings.
export async function generateMetadata({params}: LayoutProps<'/[locale]/l/[slug]'>): Promise<Metadata> {
  const {slug} = await params;
  const preview = await getListPreview(slug);
  // List links are private by nature: keep them out of search engines.
  const robots = {index: false, follow: false};
  if (!preview) return {robots};

  const {locale} = preview;
  const t = await getTranslations({locale, namespace: 'Preview'});
  const description = `${preview.criterion} ${t('cta')}.`;
  const title = `${preview.title} · Utrum`;
  const image = {url: `/api/og/${slug}`, width: 1200, height: 630, alt: t('alt', {title: preview.title})};

  return {
    title,
    description,
    openGraph: {title: preview.title, description, siteName: 'Utrum', type: 'website', locale: locale.replace('-', '_'), images: [image]},
    twitter: {card: 'summary_large_image', title: preview.title, description, images: [image]},
    robots,
  };
}

export default function ListLayout({children}: LayoutProps<'/[locale]/l/[slug]'>) {
  return children;
}
