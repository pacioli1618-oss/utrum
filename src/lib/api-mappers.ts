// RPC responses (snake_case jsonb) → view types (camelCase). Framework-free and unit-tested
// against real responses in tests/fixtures/. Components only ever see the view types.

import type {Locale} from '@/i18n/locales';
import type {Comparison, Method} from './ranking';

// ---------------------------------------------------------------------------
// Raw shapes, exactly as the ut_* functions return them
// ---------------------------------------------------------------------------

export type RawItem = {id: string; label: string; added_by_name: string | null};

export type RawListView = {
  slug: string;
  title: string;
  criterion: string;
  criterion_detail: string | null;
  method: string;
  locale: string;
  items: RawItem[];
  participant_names: string[];
};

export type RawParticipantResult = {
  id: string;
  name: string;
  ranking: string[] | null;
  comparison_count: number;
  has_completed: boolean;
};

export type RawHostListView = RawListView & {results: RawParticipantResult[]};

export type RawComparison = {item_low_id: string; item_high_id: string; winner_id: string};

export type RawParticipantView = {
  list: RawListView;
  me: {id: string; name: string};
  comparisons: RawComparison[];
  has_completed: boolean;
  results: RawParticipantResult[] | null;
};

export type RawCreatedList = {slug: string; host_token: string; participant_token: string | null};

export type RawJoinedList = {participant_id: string; participant_token: string};

export type RawAddedComparison = {has_ranking: boolean; has_completed: boolean};

// ---------------------------------------------------------------------------
// View types
// ---------------------------------------------------------------------------

export type Item = {
  id: string;
  label: string;
  /** Name of the participant who suggested it; null when the host added it. */
  addedByName: string | null;
};

export type ListView = {
  slug: string;
  title: string;
  /** The question on every comparison: "Qual é mais urgente?". */
  criterion: string;
  criterionDetail: string | null;
  method: Method;
  locale: Locale;
  items: Item[];
  participantNames: string[];
};

export type ParticipantResult = {
  id: string;
  name: string;
  /** Item ids, most to least; null while the person still has comparisons to make. */
  ranking: string[] | null;
  comparisonCount: number;
  /** Has completed a ranking at least once (sees the others' rankings). */
  hasCompleted: boolean;
};

export type HostListView = ListView & {results: ParticipantResult[]};

export type ParticipantView = {
  list: ListView;
  me: {id: string; name: string};
  comparisons: Comparison[];
  hasCompleted: boolean;
  /** Everyone's rankings; null until this person has completed their own. */
  results: ParticipantResult[] | null;
};

export type CreatedList = {slug: string; hostToken: string; participantToken: string | null};

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const knownLocales = ['pt-BR', 'es', 'en'] as const;

export function toListView(raw: RawListView): ListView {
  return {
    slug: raw.slug,
    title: raw.title,
    criterion: raw.criterion,
    criterionDetail: raw.criterion_detail,
    method: raw.method === 'full' ? 'full' : 'quick',
    locale: (knownLocales as readonly string[]).includes(raw.locale) ? (raw.locale as Locale) : 'pt-BR',
    items: (raw.items ?? []).map((item) => ({id: item.id, label: item.label, addedByName: item.added_by_name})),
    participantNames: raw.participant_names ?? [],
  };
}

export function toParticipantResults(raw: RawParticipantResult[]): ParticipantResult[] {
  return raw.map((participant) => ({
    id: participant.id,
    name: participant.name,
    ranking: participant.ranking,
    comparisonCount: Number(participant.comparison_count),
    hasCompleted: participant.has_completed,
  }));
}

export function toHostListView(raw: RawHostListView): HostListView {
  return {...toListView(raw), results: toParticipantResults(raw.results ?? [])};
}

export function toComparison(raw: RawComparison): Comparison {
  return {itemLowId: raw.item_low_id, itemHighId: raw.item_high_id, winnerId: raw.winner_id};
}

export function toParticipantView(raw: RawParticipantView): ParticipantView {
  return {
    list: toListView(raw.list),
    me: {id: raw.me.id, name: raw.me.name},
    comparisons: (raw.comparisons ?? []).map(toComparison),
    hasCompleted: raw.has_completed,
    results: raw.results ? toParticipantResults(raw.results) : null,
  };
}

export function toCreatedList(raw: RawCreatedList): CreatedList {
  return {slug: raw.slug, hostToken: raw.host_token, participantToken: raw.participant_token};
}
