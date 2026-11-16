'use client';

import {useTranslations} from 'next-intl';
import {StatusScreen} from '@/components/list/StatusScreen';
import {useStoredList} from '@/hooks/use-stored-list';
import {JoinView} from './JoinView';
import {PersonalView} from './PersonalView';

/** /l/<slug>: the person's own page when this phone has their link, the join form otherwise. */
export function ListScreen({slug}: {slug: string}) {
  const common = useTranslations('Common');
  const stored = useStoredList(slug);

  if (stored === null) return <StatusScreen message={common('loading')} />;
  if (stored?.participantToken) {
    return <PersonalView slug={slug} participantToken={stored.participantToken} hasHostToken={Boolean(stored.hostToken)} />;
  }
  return <JoinView slug={slug} hasHostToken={Boolean(stored?.hostToken)} />;
}
