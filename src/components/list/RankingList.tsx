'use client';

import {useTranslations} from 'next-intl';
import type {Item} from '@/lib/api';
import type {Evaluation} from '@/lib/ranking';
import styles from './List.module.css';

/** One person's ranking: placed items numbered, then (while incomplete) the ones without a place yet. */
export function RankingList({items, evaluation}: {items: Item[]; evaluation: Evaluation}) {
  const t = useTranslations('Ranking');
  const labelOf = new Map(items.map((item) => [item.id, item.label]));

  return (
    <ol className={styles.ranking}>
      {evaluation.order.map((id, index) => (
        <li key={id} className={styles.rankingRow}>
          <span className={styles.position}>{index + 1}</span>
          <span className={styles.rankingLabel}>{labelOf.get(id)}</span>
          {evaluation.wins && <span className={styles.rankingNote}>{t('wins', {count: evaluation.wins[id] ?? 0})}</span>}
        </li>
      ))}
      {evaluation.unplaced.map((id) => (
        <li key={id} className={`${styles.rankingRow} ${styles.pending}`}>
          <span className={styles.position}>–</span>
          <span className={styles.rankingLabel}>{labelOf.get(id)}</span>
          <span className={styles.rankingNote}>{t('unplaced')}</span>
        </li>
      ))}
    </ol>
  );
}
