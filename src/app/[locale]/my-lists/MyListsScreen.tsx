'use client';

import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {ButtonLink, Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Tag} from '@/components/ui/Tag';
import {useMyLists} from '@/hooks/use-stored-list';
import {Link} from '@/i18n/navigation';
import {forgetList} from '@/lib/device-store';
import styles from './MyLists.module.css';

export function MyListsScreen() {
  const t = useTranslations('MyLists');
  const common = useTranslations('Common');
  const lists = useMyLists();
  const entries = lists ? Object.values(lists).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt)) : null;

  return (
    <main className={screen.screen}>
      <AppHeader />
      <h1 className={styles.title}>{t('title')}</h1>

      {entries === null ? (
        <p className={screen.sectionHint}>{common('loading')}</p>
      ) : entries.length === 0 ? (
        <p className={screen.sectionHint}>{t('empty')}</p>
      ) : (
        <Card variant="flush">
          <ul className={styles.list}>
            {entries.map((list) => (
              <li key={list.slug} className={styles.item}>
                <Link href={list.hostToken ? `/l/${list.slug}/host` : `/l/${list.slug}`} className={styles.link}>
                  <span className={styles.main}>
                    <span className={styles.name}>{list.title}</span>
                    <span className={screen.row}>
                      {list.hostToken && <Tag tone="brand">{t('roleHost')}</Tag>}
                      {list.participantToken && <Tag>{t('roleParticipant')}</Tag>}
                    </span>
                  </span>
                  <ChevronRight />
                </Link>
                <Button
                  variant="ghost"
                  className={styles.forget}
                  onClick={() => {
                    if (window.confirm(t('forgetConfirm', {title: list.title}))) forgetList(list.slug);
                  }}
                >
                  {t('forget')}
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ButtonLink href="/" size="cta" isFullWidth>
        {t('create')}
      </ButtonLink>

      <footer className={screen.footer}>
        <LegalLinks />
      </footer>
    </main>
  );
}
