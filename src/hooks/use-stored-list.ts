'use client';

import {useSyncExternalStore} from 'react';
import {getStoredList, readStore, subscribeToStore, type StoredList} from '@/lib/device-store';

/**
 * What this device knows about a list (host and participant tokens), kept in sync with the
 * device store. `null` on the server and before hydration, `undefined` when this device never
 * opened the list. Wait for `null` to pass before deciding anything.
 */
export function useStoredList(slug: string): StoredList | undefined | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => getStoredList(slug),
    () => null,
  );
}

/** Every list this device knows. `null` on the server and before hydration. */
export function useMyLists(): Record<string, StoredList> | null {
  return useSyncExternalStore(
    subscribeToStore,
    () => readStore().lists,
    () => null,
  );
}
