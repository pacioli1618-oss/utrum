'use client';

import {useTranslations} from 'next-intl';
import {ChevronRight} from '@/components/layout/ChevronRight';
import styles from '@/components/layout/Screen.module.css';
import {useMyLists} from '@/hooks/use-stored-list';
import {Link} from '@/i18n/navigation';

/** Home shortcut to /my-lists; hidden until this device has at least one list. */
export function MyListsLink() {
  const t = useTranslations('MyLists');
  const lists = useMyLists();
  const count = lists ? Object.keys(lists).length : 0;
  if (count === 0) return null;
  return (
    <Link href="/my-lists" className={styles.shortcut}>
      <span>
        {t('link')} · {count}
      </span>
      <ChevronRight />
    </Link>
  );
}
