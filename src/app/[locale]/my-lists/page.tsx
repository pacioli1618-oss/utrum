import type {Metadata} from 'next';
import {getTranslations} from 'next-intl/server';
import {MyListsScreen} from './MyListsScreen';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('MyLists');
  return {title: `${t('title')} · Utrum`};
}

// /my-lists · Every list this phone has opened, as host and/or participant.
export default function MyListsPage() {
  return <MyListsScreen />;
}
