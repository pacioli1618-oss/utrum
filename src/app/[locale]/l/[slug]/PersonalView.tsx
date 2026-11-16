'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {LegalLinks} from '@/components/legal/LegalLinks';
import {LinkBox} from '@/components/list/LinkBox';
import {ListSummary} from '@/components/list/ListSummary';
import {RankingList} from '@/components/list/RankingList';
import {ResultsView} from '@/components/list/ResultsView';
import {StatusScreen} from '@/components/list/StatusScreen';
import {Button} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {TextField} from '@/components/ui/TextField';
import {useLoader} from '@/hooks/use-loader';
import {useOrigin} from '@/hooks/use-origin';
import {useFormatPercent} from '@/i18n/numbers';
import {getRpcErrorCode, useRpcErrorMessage} from '@/i18n/errors';
import {Link} from '@/i18n/navigation';
import {
  addComparison,
  openParticipant,
  resetComparisons,
  suggestItem,
  undoComparison,
  type ParticipantResult,
  type ParticipantView,
} from '@/lib/api';
import {forgetParticipantToken, getDeviceId, updateStoredList} from '@/lib/device-store';
import {evaluateRanking, withComparison, type Comparison, type Evaluation} from '@/lib/ranking';
import {buildParticipantUrl} from '@/lib/share-links';
import styles from './Personal.module.css';

type PersonalViewProps = {
  slug: string;
  participantToken: string;
  /** false when showing a link that is not the one saved on this phone (nothing is stored). */
  isSaved?: boolean;
  /** Shows a shortcut to the host panel when this phone also runs the list. */
  hasHostToken?: boolean;
};

type Tab = 'compare' | 'ranking' | 'results';

/** One person's page: compare two at a time, see their own ranking, then everyone's. */
export function PersonalView({slug, participantToken, isSaved = true, hasHostToken = false}: PersonalViewProps) {
  const common = useTranslations('Common');
  const rpcErrorMessage = useRpcErrorMessage();
  const loader = useLoader(`${slug}:${participantToken}`, () => openParticipant(slug, participantToken, getDeviceId()));
  const {data, error, isLoading} = loader;

  const isTokenInvalid = getRpcErrorCode(error) === 'participant_not_found';
  useEffect(() => {
    // Removed by the host: fall back to the join screen.
    if (isTokenInvalid && isSaved) forgetParticipantToken(slug);
  }, [isTokenInvalid, isSaved, slug]);

  useEffect(() => {
    if (!data) return;
    if (isSaved) updateStoredList(slug, {title: data.list.title});
    document.title = `${data.list.title} · Utrum`;
  }, [data, isSaved, slug]);

  if (isLoading) return <StatusScreen message={common('loading')} />;
  if (!data) return <StatusScreen isError message={rpcErrorMessage(error)} />;

  return (
    <PersonalPanel
      slug={slug}
      participantToken={participantToken}
      data={data}
      refresh={loader.refresh}
      isSaved={isSaved}
      hasHostToken={hasHostToken}
    />
  );
}

type PanelProps = {
  slug: string;
  participantToken: string;
  data: ParticipantView;
  refresh: () => Promise<void>;
  isSaved: boolean;
  hasHostToken: boolean;
};

/** Answers made on this screen, ahead of the server, for the data they were made on. */
type LocalState = {source: ParticipantView; comparisons: Comparison[]; hasCompleted: boolean};

function PersonalPanel({slug, participantToken, data, refresh, isSaved, hasHostToken}: PanelProps) {
  const t = useTranslations('Personal');
  const rpcErrorMessage = useRpcErrorMessage();
  const origin = useOrigin();

  // Back on the page with a complete ranking: straight to the results. Otherwise, keep comparing.
  const [tab, setTab] = useState<Tab>(() =>
    data.hasCompleted &&
    evaluateRanking({itemIds: data.list.items.map((item) => item.id), comparisons: data.comparisons, method: data.list.method, seed: data.me.id}).isComplete
      ? 'results'
      : 'compare',
  );
  const [local, setLocal] = useState<LocalState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Writes go out one at a time, in the order they were made. When the last one lands and the
  // screen needs fresh data (an error, the ranking just completed, a new item), reload once.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const shouldRefreshRef = useRef(false);

  function enqueue(action: () => Promise<unknown>, {refreshAfter = false} = {}) {
    if (refreshAfter) shouldRefreshRef.current = true;
    pendingRef.current++;
    setActionError(null);
    queueRef.current = queueRef.current
      .then(async () => {
        await action();
      })
      .catch((failure: unknown) => {
        shouldRefreshRef.current = true;
        setActionError(rpcErrorMessage(failure));
      })
      .finally(() => {
        pendingRef.current--;
        if (pendingRef.current === 0 && shouldRefreshRef.current) {
          shouldRefreshRef.current = false;
          void refresh();
        }
      });
    return queueRef.current;
  }

  const current: LocalState = local && local.source === data ? local : {source: data, comparisons: data.comparisons, hasCompleted: data.hasCompleted};
  const {list, me} = data;
  const itemIds = list.items.map((item) => item.id);
  const evaluation = evaluateRanking({itemIds, comparisons: current.comparisons, method: list.method, seed: me.id});

  function handlePick(winnerId: string) {
    if (!evaluation.nextPair) return;
    const [itemAId, itemBId] = evaluation.nextPair;
    const comparisons = withComparison(current.comparisons, itemAId, itemBId, winnerId);
    const next = evaluateRanking({itemIds, comparisons, method: list.method, seed: me.id});
    const ranking = next.isComplete ? next.order : undefined;
    setLocal({source: data, comparisons, hasCompleted: current.hasCompleted || Boolean(ranking)});
    // Completing for the first time unlocks the others' rankings: fetch them.
    void enqueue(() => addComparison(slug, participantToken, {itemAId, itemBId, winnerId, ranking}), {refreshAfter: Boolean(ranking) && !current.hasCompleted});
  }

  function handleUndo() {
    if (current.comparisons.length === 0) return;
    setLocal({source: data, comparisons: current.comparisons.slice(0, -1), hasCompleted: current.hasCompleted});
    void enqueue(() => undoComparison(slug, participantToken));
    setTab('compare');
  }

  function handleRestart() {
    if (!window.confirm(t('restartConfirm'))) return;
    setLocal({source: data, comparisons: [], hasCompleted: current.hasCompleted});
    void enqueue(() => resetComparisons(slug, participantToken));
    setTab('compare');
  }

  // My own row in the results follows this screen, not the last load.
  const results: ParticipantResult[] | null = data.results
    ? data.results.map((person) =>
        person.id === me.id
          ? {...person, ranking: evaluation.isComplete ? evaluation.order : null, comparisonCount: current.comparisons.length, hasCompleted: current.hasCompleted}
          : person,
      )
    : null;

  return (
    <main className={screen.screen}>
      <AppHeader />
      {hasHostToken && (
        <Link href={`/l/${slug}/host`} className={screen.shortcut}>
          <span>{t('hostShortcut')}</span>
          <ChevronRight />
        </Link>
      )}

      <p className={styles.hello}>{t('hello', {name: me.name})}</p>
      <ListSummary list={list} isCompact={tab === 'compare'} />

      <div className={styles.tabs} role="tablist" aria-label={t('tabsLabel')}>
        {(['compare', 'ranking', 'results'] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={styles.tab} onClick={() => setTab(value)}>
            {t(`tabs.${value}`)}
          </button>
        ))}
      </div>

      {actionError && (
        <p className={screen.formError} role="alert">
          {actionError}
        </p>
      )}

      {tab === 'compare' && (
        <CompareTab
          criterion={list.criterion}
          criterionDetail={list.criterionDetail}
          labelOf={new Map(list.items.map((item) => [item.id, item.label]))}
          evaluation={evaluation}
          isFull={list.method === 'full'}
          canUndo={current.comparisons.length > 0}
          onPick={handlePick}
          onUndo={handleUndo}
          onRestart={handleRestart}
          onShowResults={() => setTab('results')}
        />
      )}

      {tab === 'ranking' &&
        (current.comparisons.length === 0 ? (
          <Card variant="large" className={screen.stack}>
            <p className={screen.sectionHint}>{t('rankingEmpty')}</p>
            <Button onClick={() => setTab('compare')}>{t('start')}</Button>
          </Card>
        ) : (
          <section className={screen.section}>
            {!evaluation.isComplete && <p className={screen.sectionHint}>{t('rankingPartial')}</p>}
            <RankingList items={list.items} evaluation={evaluation} />
          </section>
        ))}

      {tab === 'results' &&
        (current.hasCompleted && results ? (
          <section className={screen.section}>
            <ResultsView items={list.items} method={list.method} results={results} meId={me.id} />
            <Button variant="ghost" onClick={() => void refresh()}>
              {t('refreshResults')}
            </Button>
          </section>
        ) : current.hasCompleted ? (
          <p className={screen.sectionHint}>{t('loadingResults')}</p>
        ) : (
          <Card variant="large" className={screen.stack}>
            <p className={screen.sectionHint}>{t('resultsLocked')}</p>
            <Button onClick={() => setTab('compare')}>{evaluation.answeredCount > 0 ? t('continue') : t('start')}</Button>
          </Card>
        ))}

      <SuggestItemForm onSuggest={(label) => enqueue(() => suggestItem(slug, participantToken, label), {refreshAfter: true})} />

      {isSaved && origin && (
        <section className={screen.section}>
          <h2 className={screen.sectionTitle}>{t('keepLinkTitle')}</h2>
          <p className={screen.sectionHint}>{t('keepLinkHint')}</p>
          <LinkBox url={buildParticipantUrl(origin, slug, participantToken)} />
        </section>
      )}

      <footer className={screen.footer}>
        <LegalLinks />
      </footer>
    </main>
  );
}

type CompareTabProps = {
  criterion: string;
  criterionDetail: string | null;
  labelOf: Map<string, string>;
  evaluation: Evaluation;
  isFull: boolean;
  canUndo: boolean;
  onPick: (winnerId: string) => void;
  onUndo: () => void;
  onRestart: () => void;
  onShowResults: () => void;
};

function CompareTab({criterion, criterionDetail, labelOf, evaluation, isFull, canUndo, onPick, onUndo, onRestart, onShowResults}: CompareTabProps) {
  const t = useTranslations('Personal');
  const formatPercent = useFormatPercent();

  // Keyboard: ← and → pick, Z undoes. The handler is refreshed every render through a ref.
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select') || event.metaKey || event.ctrlKey || event.altKey) return;
      if (evaluation.nextPair && event.key === 'ArrowLeft') {
        event.preventDefault();
        onPick(evaluation.nextPair[0]);
      } else if (evaluation.nextPair && event.key === 'ArrowRight') {
        event.preventDefault();
        onPick(evaluation.nextPair[1]);
      } else if ((event.key === 'z' || event.key === 'Z') && canUndo) {
        onUndo();
      }
    };
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  if (evaluation.isComplete) {
    return (
      <Card variant="large" className={styles.done}>
        <p className={styles.doneTitle}>{t('doneTitle')}</p>
        <p className={screen.sectionHint}>{t('doneHint', {count: evaluation.answeredCount})}</p>
        <Button size="cta" isFullWidth onClick={onShowResults}>
          {t('seeResults')}
        </Button>
        <div className={screen.row}>
          <Button variant="ghost" onClick={onUndo} disabled={!canUndo}>
            {t('undo')}
          </Button>
          <Button variant="ghost" onClick={onRestart} disabled={!canUndo}>
            {t('restart')}
          </Button>
        </div>
      </Card>
    );
  }

  const [left, right] = evaluation.nextPair!;
  return (
    <section className={styles.compare} aria-label={t('tabs.compare')}>
      <h2 className={styles.question}>{criterion}</h2>
      {criterionDetail && <p className={styles.detail}>{criterionDetail}</p>}

      <div className={styles.duel}>
        <button key={`l:${left}`} type="button" className={styles.pick} onClick={() => onPick(left)}>
          {labelOf.get(left)}
        </button>
        <span className={styles.or} aria-hidden="true">
          {t('or')}
        </span>
        <button key={`r:${right}`} type="button" className={styles.pick} onClick={() => onPick(right)}>
          {labelOf.get(right)}
        </button>
      </div>

      <div
        className={styles.track}
        role="progressbar"
        aria-label={t('progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(evaluation.progress * 100)}
      >
        <div className={styles.fill} style={{width: `${evaluation.progress * 100}%`}} />
      </div>
      <div className={styles.progressRow}>
        <span>
          {isFull
            ? t('progressFull', {answered: evaluation.answeredCount, total: evaluation.expectedCount})
            : t('progressQuick', {percent: formatPercent(evaluation.progress), left: evaluation.expectedCount - evaluation.answeredCount})}
        </span>
        <Button variant="ghost" className={styles.smallButton} onClick={onUndo} disabled={!canUndo}>
          {t('undo')}
        </Button>
      </div>
      <p className={styles.keys}>{t('keysHint')}</p>
    </section>
  );
}

function SuggestItemForm({onSuggest}: {onSuggest: (label: string) => Promise<void>}) {
  const t = useTranslations('Personal');
  const [label, setLabel] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    setIsSending(true);
    await onSuggest(trimmed);
    setLabel('');
    setIsSending(false);
  }

  return (
    <form className={screen.section} onSubmit={handleSubmit}>
      <h2 className={screen.sectionTitle}>{t('suggestTitle')}</h2>
      <p className={screen.sectionHint}>{t('suggestHint')}</p>
      <div className={styles.suggestRow}>
        <TextField label={t('suggestLabel')} placeholder={t('suggestPlaceholder')} value={label} onChange={(event) => setLabel(event.target.value)} maxLength={120} />
        <Button type="submit" variant="secondary" isLoading={isSending} disabled={!label.trim()}>
          {t('suggestSubmit')}
        </Button>
      </div>
    </form>
  );
}
