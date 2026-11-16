// Server only: what a link preview (WhatsApp, Telegram, iMessage) shows for /l/<slug>.
// Used by the list layout's metadata and by the image at /api/og/<slug>.
// Only the list's title and criterion: never names, never rankings.

import {cacheLife} from 'next/cache';
import type {Locale} from '@/i18n/locales';
import {getList, RpcError} from './api';

export type ListPreview = {
  title: string;
  criterion: string;
  itemCount: number;
  /** The organizer's language: the preview is the same for everyone. */
  locale: Locale;
};

// Slugs are 12 random [a-z0-9] characters; anything else is not worth a database call.
const SLUG_PATTERN = /^[a-z0-9]{8,32}$/;

async function loadListPreview(slug: string): Promise<ListPreview | null> {
  'use cache';
  // Previews are cached by the apps for days anyway; a few minutes here spares the database.
  cacheLife('minutes');
  try {
    const list = await getList(slug);
    return {title: list.title, criterion: list.criterion, itemCount: list.items.length, locale: list.locale};
  } catch (error) {
    if (error instanceof RpcError && error.message === 'list_not_found') return null;
    throw error; // not cached: the next request tries again
  }
}

/** null when the list does not exist or the database can't be reached: callers fall back to the app's preview. */
export async function getListPreview(slug: string): Promise<ListPreview | null> {
  if (!SLUG_PATTERN.test(slug)) return null;
  try {
    return await loadListPreview(slug);
  } catch {
    return null;
  }
}
