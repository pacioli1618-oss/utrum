'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {StatusScreen} from '@/components/list/StatusScreen';
import {useRpcErrorMessage} from '@/i18n/errors';
import {useRouter} from '@/i18n/navigation';
import {getListAsHost} from '@/lib/api';
import {rememberList} from '@/lib/device-store';
import {readTokenFromHash} from '@/lib/share-links';

/**
 * Reads the host token from the #fragment, checks it against the database, saves it on this
 * device and opens the host panel. The token is never stored before the database accepts it.
 */
export function ManageScreen({slug}: {slug: string}) {
  const t = useTranslations('Manage');
  const rpcErrorMessage = useRpcErrorMessage();
  const router = useRouter();
  const [failure, setFailure] = useState<'missing-token' | {error: unknown} | null>(null);

  useEffect(() => {
    let isCancelled = false;
    const hostToken = readTokenFromHash(window.location.hash);

    async function openAsHost() {
      if (!hostToken) {
        setFailure('missing-token');
        return;
      }
      try {
        const list = await getListAsHost(slug, hostToken);
        if (isCancelled) return;
        rememberList({slug, title: list.title, hostToken});
        // Drop the token from the address bar and history before moving on.
        window.history.replaceState(null, '', window.location.pathname);
        router.replace(`/l/${slug}/host`);
      } catch (error) {
        if (!isCancelled) setFailure({error});
      }
    }

    void openAsHost();
    return () => {
      isCancelled = true;
    };
  }, [slug, router]);

  if (failure === null) return <StatusScreen message={t('checking')} />;
  return <StatusScreen isError message={failure === 'missing-token' ? t('missingToken') : rpcErrorMessage(failure.error)} />;
}
