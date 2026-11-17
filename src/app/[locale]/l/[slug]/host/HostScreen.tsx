'use client';

import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {AppHeader} from '@/components/layout/AppHeader';
import {ChevronRight} from '@/components/layout/ChevronRight';
import screen from '@/components/layout/Screen.module.css';
import {CriterionField} from '@/components/list/CriterionField';
import {LinkBox} from '@/components/list/LinkBox';
import {ListSummary} from '@/components/list/ListSummary';
import {ResultsView} from '@/components/list/ResultsView';
import {StatusScreen} from '@/components/list/StatusScreen';
import {Button, buttonClassName} from '@/components/ui/Button';
import {Card} from '@/components/ui/Card';
import {Tag} from '@/components/ui/Tag';
import {TextAreaField} from '@/components/ui/TextAreaField';
import {TextField} from '@/components/ui/TextField';
import {useLoader} from '@/hooks/use-loader';
import {useOrigin} from '@/hooks/use-origin';
import {useStoredList} from '@/hooks/use-stored-list';
import {useRpcErrorMessage} from '@/i18n/errors';
import {Link, useRouter} from '@/i18n/navigation';
import {
  addItems,
  deleteItem,
  deleteList,
  getListAsHost,
  removeParticipant,
  updateList,
  type HostListView,
  type ListPatch,
  type ParticipantResult,
} from '@/lib/api';
import {forgetList, updateStoredList} from '@/lib/device-store';
import {expectedComparisons} from '@/lib/ranking';
import {buildHostUrl, buildListUrl, buildWhatsAppUrl, parseItems} from '@/lib/share-links';
import styles from './Host.module.css';

const MIN_ITEMS = 2;

/** /l/<slug>/host: everything the host does, on one screen. */
export function HostScreen({slug}: {slug: string}) {
  const t = useTranslations('Host');
  const common = useTranslations('Common');
  const stored = useStoredList(slug);
  const hostToken = stored?.hostToken;

  if (stored === null) return <StatusScreen message={common('loading')} />;
  if (!hostToken) return <StatusScreen isError message={t('noHostToken')} />;
  return <HostPanel slug={slug} hostToken={hostToken} hasParticipantToken={Boolean(stored?.participantToken)} />;
}

type ActionRunner = (key: string, action: () => Promise<unknown>) => Promise<boolean>;

function HostPanel({slug, hostToken, hasParticipantToken}: {slug: string; hostToken: string; hasParticipantToken: boolean}) {
  const t = useTranslations('Host');
  const common = useTranslations('Common');
  const rpcErrorMessage = useRpcErrorMessage();
  const origin = useOrigin();
  const router = useRouter();
  const {data: list, error, isLoading, refresh} = useLoader(`${slug}:${hostToken}`, () => getListAsHost(slug, hostToken));

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{key: string; message: string} | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (list) {
      updateStoredList(slug, {title: list.title});
      document.title = `${list.title} · Utrum`;
    }
  }, [list, slug]);

  if (isLoading) return <StatusScreen message={common('loading')} />;
  if (!list) return <StatusScreen isError message={rpcErrorMessage(error)} />;

  // Runs one change, shows its error next to the section that started it, then reloads.
  const run: ActionRunner = async (key, action) => {
    setBusyKey(key);
    setActionError(null);
    try {
      await action();
      await refresh();
      return true;
    } catch (failure) {
      setActionError({key, message: rpcErrorMessage(failure)});
      await refresh();
      return false;
    } finally {
      setBusyKey(null);
    }
  };
  const errorFor = (key: string) =>
    actionError?.key === key ? (
      <p className={screen.formError} role="alert">
        {actionError.message}
      </p>
    ) : null;

  const listUrl = origin ? buildListUrl(origin, slug) : '';
  const hostUrl = origin ? buildHostUrl(origin, slug, hostToken) : '';

  return (
    <main className={screen.screen}>
      <AppHeader />
      {hasParticipantToken && (
        <Link href={`/l/${slug}`} className={screen.shortcut}>
          <span>
            {t('mySide')} · {t('openMine')}
          </span>
          <ChevronRight />
        </Link>
      )}

      {isEditing ? (
        <DetailsForm
          list={list}
          isSaving={busyKey === 'details'}
          error={actionError?.key === 'details' ? actionError.message : null}
          onCancel={() => setIsEditing(false)}
          onSave={async (patch) => {
            if (await run('details', () => updateList(slug, hostToken, patch))) setIsEditing(false);
          }}
        />
      ) : (
        <div className={styles.summary}>
          <ListSummary list={list} label={t('badge')} />
          <Button variant="ghost" onClick={() => setIsEditing(true)}>
            {t('editDetails')}
          </Button>
        </div>
      )}

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('inviteTitle')}</h2>
        <p className={screen.sectionHint}>{t('inviteHint')}</p>
        <LinkBox url={listUrl} />
        <a
          href={buildWhatsAppUrl(`${t('inviteMessage', {title: list.title, criterion: list.criterion})}\n${listUrl}`)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClassName({variant: 'primary', isFullWidth: true})}
        >
          {t('sendListLink')}
        </a>
      </section>

      <ParticipantsSection list={list} slug={slug} hostToken={hostToken} run={run} busyKey={busyKey} errorFor={errorFor} />

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('resultsTitle')}</h2>
        {list.results.length === 0 ? (
          <p className={screen.sectionHint}>{t('resultsEmpty')}</p>
        ) : (
          <>
            <p className={screen.sectionHint}>{t('resultsHint')}</p>
            <ResultsView items={list.items} method={list.method} results={list.results} />
          </>
        )}
      </section>

      <ItemsSection list={list} slug={slug} hostToken={hostToken} run={run} busyKey={busyKey} errorFor={errorFor} />

      <section className={screen.section}>
        <h2 className={screen.sectionTitle}>{t('hostLinkTitle')}</h2>
        <p className={screen.sectionHint}>{t('hostLinkHint')}</p>
        <LinkBox url={hostUrl} />
      </section>

      <section className={`${screen.section} ${styles.danger}`}>
        <h2 className={screen.sectionTitle}>{t('dangerTitle')}</h2>
        <p className={screen.sectionHint}>{t('dangerHint')}</p>
        <Button
          variant="secondary"
          className={styles.dangerButton}
          isLoading={busyKey === 'delete'}
          onClick={async () => {
            if (!window.confirm(t('deleteConfirm', {title: list.title}))) return;
            setBusyKey('delete');
            try {
              await deleteList(slug, hostToken);
              forgetList(slug);
              setBusyKey(null);
              router.replace('/my-lists');
            } catch (failure) {
              setActionError({key: 'delete', message: rpcErrorMessage(failure)});
              setBusyKey(null);
            }
          }}
        >
          {t('deleteList')}
        </Button>
        {errorFor('delete')}
      </section>
    </main>
  );
}

type SectionProps = {
  list: HostListView;
  slug: string;
  hostToken: string;
  run: ActionRunner;
  busyKey: string | null;
  errorFor: (key: string) => ReactNode;
};

function ParticipantsSection({list, slug, hostToken, run, busyKey, errorFor}: SectionProps) {
  const t = useTranslations('Host');
  const common = useTranslations('Common');
  const expected = expectedComparisons(list.items.length, list.method);

  function statusOf(participant: ParticipantResult) {
    if (participant.ranking) return {tone: 'brand' as const, label: t('statusDone')};
    if (participant.comparisonCount === 0) return {tone: 'ember' as const, label: t('statusNotStarted')};
    return {tone: 'neutral' as const, label: t('statusProgress', {count: participant.comparisonCount, expected})};
  }

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>
        {t('participantsTitle')} · {common('people', {count: list.results.length})}
      </h2>
      {list.results.length === 0 ? (
        <p className={screen.sectionHint}>{t('participantsEmpty')}</p>
      ) : (
        <>
          <Card variant="flush">
            <ul className={styles.rows}>
              {list.results.map((participant) => {
                const status = statusOf(participant);
                return (
                  <li key={participant.id} className={styles.row}>
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{participant.name}</span>
                      <Tag tone={status.tone}>{status.label}</Tag>
                    </span>
                    <Button
                      variant="ghost"
                      className={styles.smallButton}
                      isLoading={busyKey === `remove:${participant.id}`}
                      aria-label={`${common('remove')}: ${participant.name}`}
                      onClick={() => {
                        if (window.confirm(t('removeConfirm', {name: participant.name}))) {
                          void run(`remove:${participant.id}`, () => removeParticipant(slug, hostToken, participant.id));
                        }
                      }}
                    >
                      {common('remove')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
          {list.results.map((participant) => errorFor(`remove:${participant.id}`))}
        </>
      )}
    </section>
  );
}

function ItemsSection({list, slug, hostToken, run, busyKey, errorFor}: SectionProps) {
  const t = useTranslations('Host');
  const common = useTranslations('Common');
  const [itemsText, setItemsText] = useState('');
  const labels = parseItems(itemsText);
  const hasAnswers = list.results.some((participant) => participant.comparisonCount > 0);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (labels.length === 0) return;
    if (await run('add', () => addItems(slug, hostToken, labels))) setItemsText('');
  }

  return (
    <section className={screen.section}>
      <h2 className={screen.sectionTitle}>
        {t('itemsTitle')} · {common('items', {count: list.items.length})}
      </h2>
      <Card variant="flush">
        <ul className={styles.rows}>
          {list.items.map((item) => (
            <li key={item.id} className={styles.row}>
              <span className={styles.rowMain}>
                <span className={styles.rowLabel}>{item.label}</span>
                {item.addedByName && <Tag>{t('suggestedBy', {name: item.addedByName})}</Tag>}
              </span>
              <Button
                variant="ghost"
                className={styles.smallButton}
                isLoading={busyKey === `item:${item.id}`}
                disabled={list.items.length <= MIN_ITEMS}
                aria-label={`${common('remove')}: ${item.label}`}
                onClick={() => {
                  if (window.confirm(t('removeItemConfirm', {label: item.label}))) {
                    void run(`item:${item.id}`, () => deleteItem(slug, hostToken, item.id));
                  }
                }}
              >
                {common('remove')}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
      {list.items.map((item) => errorFor(`item:${item.id}`))}

      <form className={styles.addForm} onSubmit={handleAdd}>
        <TextAreaField
          label={t('addItems')}
          hint={hasAnswers ? t('addItemsHintStarted') : t('addItemsHint')}
          placeholder={t('addItemsPlaceholder')}
          value={itemsText}
          onChange={(event) => setItemsText(event.target.value)}
          rows={3}
        />
        <Button type="submit" variant="secondary" isLoading={busyKey === 'add'} disabled={labels.length === 0}>
          {t('addSubmit')}
        </Button>
        {errorFor('add')}
      </form>
    </section>
  );
}

type DetailsFormProps = {
  list: HostListView;
  isSaving: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (patch: ListPatch) => void;
};

function DetailsForm({list, isSaving, error, onCancel, onSave}: DetailsFormProps) {
  const t = useTranslations('Details');
  const create = useTranslations('CreateList');
  const criterionText = useTranslations('Criterion');
  const common = useTranslations('Common');
  const [title, setTitle] = useState(list.title);
  const [criterion, setCriterion] = useState(list.criterion);
  const [criterionDetail, setCriterionDetail] = useState(list.criterionDetail ?? '');
  const [errors, setErrors] = useState<{title?: string; criterion?: string}>({});
  const hasAnswers = list.results.some((participant) => participant.comparisonCount > 0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = {
      title: title.trim() ? undefined : create('titleRequired'),
      criterion: criterion.trim() ? undefined : criterionText('required'),
    };
    setErrors(next);
    if (next.title || next.criterion) return;
    onSave({title: title.trim(), criterion: criterion.trim(), criterionDetail: criterionDetail.trim() || null});
  }

  return (
    <Card variant="large">
      <form className={styles.detailsForm} onSubmit={handleSubmit} noValidate>
        <h1 className={screen.sectionTitle}>{t('title')}</h1>
        <TextField label={create('title')} value={title} onChange={(event) => setTitle(event.target.value)} error={errors.title} maxLength={120} />
        <CriterionField value={criterion} onChange={setCriterion} error={errors.criterion} />
        {hasAnswers && criterion.trim() !== list.criterion && <p className={styles.warning}>{t('criterionChangedWarning')}</p>}
        <TextField
          label={`${criterionText('detailLabel')} (${common('optional')})`}
          value={criterionDetail}
          onChange={(event) => setCriterionDetail(event.target.value)}
          maxLength={300}
        />
        {error && (
          <p className={screen.formError} role="alert">
            {error}
          </p>
        )}
        <div className={screen.row}>
          <Button type="submit" isLoading={isSaving}>
            {t('submit')}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            {common('cancel')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
