'use client';

import {useEffect, useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {ListSummary} from '@/components/list/ListSummary';
import {StatusScreen} from '@/components/list/StatusScreen';
import {Button} from '@/components/ui/Button';
import {TextField} from '@/components/ui/TextField';
import {useLoader} from '@/hooks/use-loader';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link} from '@/i18n/navigation';
import {getList, joinList} from '@/lib/api';
import {getDeviceId, rememberList} from '@/lib/device-store';
import styles from './Join.module.css';

/** First visit through the list link: the person writes their name and starts comparing. */
export function JoinView({slug, hasHostToken}: {slug: string; hasHostToken: boolean}) {
  const t = useTranslations('Join');
  const common = useTranslations('Common');
  const rpcErrorMessage = useRpcErrorMessage();
  const {data: list, error, isLoading, refresh} = useLoader(slug, () => getList(slug));

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (list) document.title = `${list.title} · Utrum`;
  }, [list]);

  if (isLoading) return <StatusScreen message={common('loading')} />;
  if (!list) return <StatusScreen isError message={rpcErrorMessage(error)} />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('nameRequired'));
      return;
    }
    setNameError(null);
    setIsSubmitting(true);
    try {
      const joined = await joinList(slug, trimmed, getDeviceId());
      // Saving the token switches /l/<slug> to the personal page (ListScreen listens to the store).
      rememberList({slug, title: list!.title, participantToken: joined.participantToken});
    } catch (joinError) {
      setNameError(rpcErrorMessage(joinError));
      setIsSubmitting(false);
      void refresh();
    }
  }

  return (
    <main className={screen.screen}>
      <AppHeader />
      {hasHostToken && (
        <Link href={`/l/${slug}/host`} className={screen.shortcut}>
          <span>
            {t('hostShortcut')} {t('openHost')}
          </span>
          <ChevronRight />
        </Link>
      )}

      <ListSummary list={list} label={t('invitedLabel')} showDetails />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={screen.sectionHint}>{t('howItWorks')}</p>
        <TextField
          label={t('whoAreYou')}
          placeholder={t('namePlaceholder')}
          hint={t('nameHint')}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(null);
          }}
          error={nameError}
          maxLength={60}
          autoComplete="given-name"
        />
        <Button type="submit" size="cta" isFullWidth isLoading={isSubmitting}>
          {t('submit')}
        </Button>
        <p className={styles.trust}>{t('trust')}</p>
      </form>

      <footer className={screen.footer}>
        <LegalLinks />
      </footer>
    </main>
  );
}
