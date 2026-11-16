// The only door between the app and the database.
//
// - Calls the public.ut_* RPCs with typed arguments (database.types.ts).
// - Converts snake_case responses into camelCase view types (api-mappers.ts).
// - Throws RpcError with the fixed error code; translate it with useRpcErrorMessage().

import type {Locale} from '@/i18n/locales';
import {
  toCreatedList,
  toHostListView,
  toListView,
  toParticipantView,
  type RawAddedComparison,
  type RawCreatedList,
  type RawHostListView,
  type RawJoinedList,
  type RawListView,
  type RawParticipantView,
} from './api-mappers';
import type {Database} from './database.types';
import type {Method} from './ranking';
import {supabase} from './supabase';

export type * from './api-mappers';

type Functions = Database['public']['Functions'];

/** message = the fixed error code (e.g. "item_label_taken"); details = DETAIL, when set. */
export class RpcError extends Error {
  constructor(
    message: string,
    public readonly details: string | null = null,
  ) {
    super(message);
    this.name = 'RpcError';
  }
}

async function call<F extends keyof Functions>(fn: F, args: Functions[F]['Args']): Promise<Functions[F]['Returns']> {
  const {data, error} = await supabase.rpc(fn, args as never);
  if (error) throw new RpcError(error.message, error.details || null);
  return data as Functions[F]['Returns'];
}

// ---------------------------------------------------------------------------
// Anyone with the list link
// ---------------------------------------------------------------------------

export type CreateListInput = {
  title: string;
  criterion: string;
  criterionDetail?: string;
  method: Method;
  items: string[];
  locale?: Locale;
  deviceId?: string;
  /** When set, the host compares too. */
  hostName?: string;
};

/** Returns the host token (and the host's participant token) once. Store them right away. */
export async function createList(input: CreateListInput) {
  const raw = await call('ut_create_list', {
    p_title: input.title,
    p_criterion: input.criterion,
    p_criterion_detail: input.criterionDetail,
    p_method: input.method,
    p_items: input.items,
    p_locale: input.locale,
    p_device_id: input.deviceId,
    p_host_name: input.hostName,
  });
  return toCreatedList(raw as unknown as RawCreatedList);
}

export async function getList(slug: string) {
  return toListView((await call('ut_get_list', {p_slug: slug})) as unknown as RawListView);
}

export async function joinList(slug: string, name: string, deviceId: string) {
  const raw = (await call('ut_join_list', {p_slug: slug, p_name: name, p_device_id: deviceId})) as unknown as RawJoinedList;
  return {participantId: raw.participant_id, participantToken: raw.participant_token};
}

// ---------------------------------------------------------------------------
// A participant's personal link
// ---------------------------------------------------------------------------

export async function openParticipant(slug: string, participantToken: string, deviceId: string) {
  const raw = await call('ut_open_participant', {p_slug: slug, p_participant_token: participantToken, p_device_id: deviceId});
  return toParticipantView(raw as unknown as RawParticipantView);
}

export type AddComparisonInput = {
  itemAId: string;
  itemBId: string;
  winnerId: string;
  /** The complete ranking, when this answer completes it. */
  ranking?: string[];
};

export async function addComparison(slug: string, participantToken: string, input: AddComparisonInput) {
  const raw = (await call('ut_add_comparison', {
    p_slug: slug,
    p_participant_token: participantToken,
    p_item_a_id: input.itemAId,
    p_item_b_id: input.itemBId,
    p_winner_id: input.winnerId,
    p_ranking: input.ranking,
  })) as unknown as RawAddedComparison;
  return {hasRanking: raw.has_ranking, hasCompleted: raw.has_completed};
}

export async function undoComparison(slug: string, participantToken: string) {
  await call('ut_undo_comparison', {p_slug: slug, p_participant_token: participantToken});
}

export async function resetComparisons(slug: string, participantToken: string) {
  await call('ut_reset_comparisons', {p_slug: slug, p_participant_token: participantToken});
}

export async function suggestItem(slug: string, participantToken: string, label: string) {
  return call('ut_suggest_item', {p_slug: slug, p_participant_token: participantToken, p_label: label});
}

// ---------------------------------------------------------------------------
// Host link
// ---------------------------------------------------------------------------

export async function getListAsHost(slug: string, hostToken: string) {
  const raw = await call('ut_get_list_as_host', {p_slug: slug, p_host_token: hostToken});
  return toHostListView(raw as unknown as RawHostListView);
}

export type ListPatch = {title: string; criterion: string; criterionDetail: string | null};

export async function updateList(slug: string, hostToken: string, patch: ListPatch) {
  await call('ut_update_list', {
    p_slug: slug,
    p_host_token: hostToken,
    p_title: patch.title,
    p_criterion: patch.criterion,
    p_criterion_detail: patch.criterionDetail ?? undefined,
  });
}

export async function addItems(slug: string, hostToken: string, labels: string[]) {
  return call('ut_add_items', {p_slug: slug, p_host_token: hostToken, p_labels: labels});
}

export async function deleteItem(slug: string, hostToken: string, itemId: string) {
  await call('ut_delete_item', {p_slug: slug, p_host_token: hostToken, p_item_id: itemId});
}

export async function removeParticipant(slug: string, hostToken: string, participantId: string) {
  await call('ut_remove_participant', {p_slug: slug, p_host_token: hostToken, p_participant_id: participantId});
}

export async function deleteList(slug: string, hostToken: string) {
  await call('ut_delete_list', {p_slug: slug, p_host_token: hostToken});
}
