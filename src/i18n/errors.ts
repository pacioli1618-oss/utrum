import {useTranslations} from 'next-intl';

// ut_* RPCs raise errors whose message is a fixed code (docs/conventions.md, section 5).
// Messages → Errors uses the same codes as keys.
export const rpcErrorCodes = [
  'list_not_found',
  'not_authorized',
  'participant_not_found',
  'participant_name_required',
  'participant_name_taken',
  'list_full',
  'list_items_full',
  'not_enough_items',
  'item_not_found',
  'item_label_required',
  'item_label_taken',
  'comparison_invalid',
  'rate_limited',
] as const;
export type RpcErrorCode = (typeof rpcErrorCodes)[number];

type RpcError = {message?: string; details?: string | null} | null | undefined;

export function getRpcErrorCode(error: unknown): RpcErrorCode | 'network' | 'unknown' {
  const failure = error as RpcError;
  if (!failure) return 'unknown';
  const code = failure.message?.trim();
  if ((rpcErrorCodes as readonly string[]).includes(code ?? '')) return code as RpcErrorCode;
  if (code && /fetch|network|failed to fetch/i.test(code)) return 'network';
  return 'unknown';
}

/** Turns an RPC error into a message for the person. */
export function useRpcErrorMessage() {
  const t = useTranslations('Errors');

  return (error: unknown) => {
    const failure = error as RpcError;
    const code = getRpcErrorCode(error);
    if (code === 'rate_limited') {
      // DETAIL says which window is full: 'hour' or 'day' (ut_create_list).
      return t('rate_limited', {period: failure?.details === 'day' ? 'day' : 'hour'});
    }
    if (code === 'participant_name_taken') {
      return t('participant_name_taken', {name: failure?.details ?? ''});
    }
    if (code === 'item_label_taken') {
      return t('item_label_taken', {label: failure?.details ?? ''});
    }
    return t(code);
  };
}
