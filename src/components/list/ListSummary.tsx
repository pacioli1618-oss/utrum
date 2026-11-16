'use client';

import {useTranslations} from 'next-intl';
import {Card} from '@/components/ui/Card';
import type {ListView} from '@/lib/api';
import styles from './List.module.css';

type ListSummaryProps = {
  list: ListView;
  /** Small label above the title ("Você organiza", "Priorização"). */
  label?: string;
  /** Shows the items and the names of everyone already in (join screen). */
  showDetails?: boolean;
  /** Title and counts only: the compare screen already shows the criterion in large type. */
  isCompact?: boolean;
};

/** The list's card: title, the criterion question, and optionally its items and people. */
export function ListSummary({list, label, showDetails = false, isCompact = false}: ListSummaryProps) {
  const common = useTranslations('Common');
  const t = useTranslations('ListSummary');

  return (
    <Card variant="large" className={styles.summary}>
      {label && <span className={styles.summaryLabel}>{label}</span>}
      <h1 className={styles.summaryTitle}>{list.title}</h1>
      {!isCompact && <p className={styles.criterion}>{list.criterion}</p>}
      {!isCompact && list.criterionDetail && <p className={styles.notes}>{list.criterionDetail}</p>}
      <ul className={styles.facts}>
        <li>
          {common('items', {count: list.items.length})} · {t(`method.${list.method}`)}
        </li>
      </ul>
      {showDetails && (
        <>
          <div className={styles.names}>
            <span className={styles.namesLabel}>{t('itemsLabel')}</span>
            <ul className={styles.nameChips}>
              {list.items.map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
          </div>
          <div className={styles.names}>
            <span className={styles.namesLabel}>
              {t('whoIsIn')} · {common('people', {count: list.participantNames.length})}
            </span>
            {list.participantNames.length === 0 ? (
              <span className={styles.namesEmpty}>{t('nobodyYet')}</span>
            ) : (
              <ul className={styles.nameChips}>
                {list.participantNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
