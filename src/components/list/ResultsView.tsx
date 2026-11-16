'use client';

import {useTranslations} from 'next-intl';
import screen from '@/components/layout/Screen.module.css';
import {Card} from '@/components/ui/Card';
import {useFormatPercent} from '@/i18n/numbers';
import type {Item, ParticipantResult} from '@/lib/api';
import {expectedComparisons, summarizeResults, type Method} from '@/lib/ranking';
import styles from './List.module.css';

type ResultsViewProps = {
  items: Item[];
  method: Method;
  results: ParticipantResult[];
  /** The viewer's participant id, shown as "Você". */
  meId?: string;
};

const MAX_LISTED_PAIRS = 6;
const MAX_DIVERGENT_ITEMS = 3;
const MAX_NAMED_POSITIONS = 6;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** Stronger brand color for higher positions: the table reads as a heat map. */
function cellStyle(position: number, count: number) {
  const top = count > 1 ? 1 - (position - 1) / (count - 1) : 1;
  const strength = Math.round((0.12 + 0.78 * top * top) * 100);
  return {background: `color-mix(in srgb, var(--brand) ${strength}%, transparent)`};
}

/** Everyone's view side by side: consolidated ranking, agreement between people, where they differ. */
export function ResultsView({items, method, results, meId}: ResultsViewProps) {
  const t = useTranslations('Results');
  const formatPercent = useFormatPercent();
  const itemIds = items.map((item) => item.id);
  const labelOf = new Map(items.map((item) => [item.id, item.label]));
  const nameOf = (id: string) => (id === meId ? t('you') : (results.find((person) => person.id === id)?.name ?? '?'));
  const shortName = (id: string) => nameOf(id).split(/\s+/)[0];

  const complete = results.filter((person) => person.ranking && itemIds.every((id) => person.ranking!.includes(id)));
  const summary = summarizeResults(
    itemIds,
    complete.map((person) => ({id: person.id, ranking: person.ranking!})),
  );
  const expected = expectedComparisons(items.length, method);

  const people = (
    <ul className={styles.people}>
      {results.map((person) => {
        const isDone = complete.includes(person);
        return (
          <li key={person.id} className={styles.person}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(person.name)}
            </span>
            {nameOf(person.id)}
            <span className={styles.personStatus}>
              {isDone
                ? t('statusDone')
                : person.comparisonCount === 0
                  ? t('statusNotStarted')
                  : t('statusProgress', {percent: formatPercent(Math.min(0.99, person.comparisonCount / Math.max(1, expected)))})}
            </span>
          </li>
        );
      })}
    </ul>
  );

  if (complete.length === 0) {
    return (
      <div className={screen.stack}>
        {people}
        <p className={screen.sectionHint}>{t('noneComplete')}</p>
      </div>
    );
  }

  const hasSeveralPeople = complete.length > 1;
  const pairs = [...summary.pairs].sort((a, b) => b.share - a.share);
  const listedPairs = pairs.length <= MAX_LISTED_PAIRS ? pairs : [...pairs.slice(0, MAX_LISTED_PAIRS / 2), ...pairs.slice(-MAX_LISTED_PAIRS / 2)];
  const divergent = summary.rows
    .filter((row) => row.spread > 0)
    .sort((a, b) => b.spread - a.spread)
    .slice(0, MAX_DIVERGENT_ITEMS);
  const maxSpread = Math.max(0, ...summary.rows.map((row) => row.spread));
  const pendingCount = results.length - complete.length;

  return (
    <div className={screen.stack}>
      {people}

      <Card variant="large" className={screen.stack}>
        <h3 className={screen.sectionTitle}>{t('consolidatedTitle')}</h3>
        <p className={screen.sectionHint}>
          {t('consolidatedHint', {count: complete.length})}
          {pendingCount > 0 && ` ${t('pendingLeftOut', {count: pendingCount})}`}
        </p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col" className={styles.itemCell}>
                  {t('item')}
                </th>
                {complete.map((person) => (
                  <th key={person.id} scope="col" title={nameOf(person.id)}>
                    {shortName(person.id)}
                  </th>
                ))}
                {hasSeveralPeople && (
                  <>
                    <th scope="col">{t('mean')}</th>
                    <th scope="col">{t('spread')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row, index) => (
                <tr key={row.itemId}>
                  <td>
                    <strong className={styles.position}>{index + 1}</strong>
                  </td>
                  <td className={styles.itemCell}>{labelOf.get(row.itemId)}</td>
                  {complete.map((person) => {
                    const position = row.positions[person.id];
                    const isTop = items.length > 1 && 1 - (position - 1) / (items.length - 1) > 0.55;
                    return (
                      <td key={person.id}>
                        <span className={[styles.cell, isTop && styles.cellTop].filter(Boolean).join(' ')} style={cellStyle(position, items.length)}>
                          {position}
                        </span>
                      </td>
                    );
                  })}
                  {hasSeveralPeople && (
                    <>
                      <td>{row.meanPosition.toFixed(1)}</td>
                      <td className={row.spread > 0 && row.spread === maxSpread ? styles.spreadHigh : undefined}>
                        {row.spread === 0 ? '—' : `±${row.spread}`}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {hasSeveralPeople && (
        <>
          <Card variant="large" className={screen.stack}>
            <h3 className={screen.sectionTitle}>{t('agreementTitle')}</h3>
            <p className={screen.sectionHint}>{t('agreementHint', {percent: formatPercent(summary.meanAgreement ?? 1)})}</p>
            <ul className={styles.bullets}>
              {listedPairs.map((pair) => (
                <li key={`${pair.firstId}:${pair.secondId}`}>
                  {t('agreementPair', {first: nameOf(pair.firstId), second: nameOf(pair.secondId), percent: formatPercent(pair.share)})}
                </li>
              ))}
            </ul>
          </Card>

          <Card variant="large" className={screen.stack}>
            <h3 className={screen.sectionTitle}>{t('divergenceTitle')}</h3>
            {divergent.length === 0 ? (
              <p className={screen.sectionHint}>{t('fullConsensus')}</p>
            ) : (
              <>
                <p className={screen.sectionHint}>{t('divergenceHint')}</p>
                <ul className={styles.bullets}>
                  {divergent.map((row) => (
                    <li key={row.itemId}>
                      <strong>{labelOf.get(row.itemId)}</strong>
                      {': '}
                      {complete.length <= MAX_NAMED_POSITIONS
                        ? complete.map((person) => t('positionOf', {name: shortName(person.id), position: row.positions[person.id]})).join(' · ')
                        : t('positionRange', {best: Math.min(...Object.values(row.positions)), worst: Math.max(...Object.values(row.positions))})}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
