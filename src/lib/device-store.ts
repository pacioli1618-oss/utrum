// Everything Utrum keeps on the device, in one versioned place. No component touches
// localStorage directly.
//
// A device can be the host of a list, a participant in it, or both (the host who also compares).
// The two tokens are kept separately: the host token manages the list, the participant token
// holds one person's comparisons. Both exist only here; the server keeps just their hashes.
//
// Browser only. Do not import from Server Components.

import {isThemeChoice, THEME_STORAGE_KEY, type ThemeChoice} from './theme';

const STORAGE_KEY = 'utrum';
const STORE_VERSION = 1;

export type StoredList = {
  slug: string;
  title: string;
  hostToken?: string;
  participantToken?: string;
  lastOpenedAt: string;
};

export type DeviceStore = {
  version: typeof STORE_VERSION;
  /** Anonymous identity of this device, sent to the RPCs as p_device_id. */
  deviceId: string;
  /** Lists by slug. */
  lists: Record<string, StoredList>;
};

function createEmptyStore(): DeviceStore {
  return {version: STORE_VERSION, deviceId: crypto.randomUUID(), lists: {}};
}

// When the format changes, bump STORE_VERSION and convert the previous version here.
function migrateStore(raw: unknown): DeviceStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<DeviceStore>;
  if (data.version === STORE_VERSION && typeof data.deviceId === 'string' && data.lists) {
    return data as DeviceStore;
  }
  return null;
}

// localStorage may be missing or throw (private mode, WhatsApp's in-app browser):
// then the app keeps working in this tab's memory only.
let memoryStore: DeviceStore | null = null;

export function readStore(): DeviceStore {
  if (memoryStore) return memoryStore;
  try {
    const parsed = migrateStore(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'));
    memoryStore = parsed ?? createEmptyStore();
    if (!parsed) writeStore(memoryStore);
  } catch {
    memoryStore = createEmptyStore();
  }
  return memoryStore;
}

function writeStore(store: DeviceStore) {
  memoryStore = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // No persistence available: keep going in memory.
  }
  listeners.forEach((listener) => listener());
}

const listeners = new Set<() => void>();

/** Calls back when this tab or another tab changes the store. Returns the unsubscribe function. */
export function subscribeToStore(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memoryStore = null; // another tab wrote: read again
    listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getDeviceId(): string {
  return readStore().deviceId;
}

export function getStoredList(slug: string): StoredList | undefined {
  return readStore().lists[slug];
}

/** Saves or updates a list in "My lists". Never drops a token this device already has. */
export function rememberList(list: Omit<StoredList, 'lastOpenedAt'>) {
  const store = readStore();
  const previous = store.lists[list.slug];
  const next: StoredList = {
    ...previous,
    ...list,
    hostToken: list.hostToken ?? previous?.hostToken,
    participantToken: list.participantToken ?? previous?.participantToken,
    lastOpenedAt: new Date().toISOString(),
  };
  writeStore({...store, lists: {...store.lists, [list.slug]: next}});
}

/** Refreshes what "My lists" shows without touching the tokens. */
export function updateStoredList(slug: string, patch: Partial<Pick<StoredList, 'title'>>) {
  const store = readStore();
  const previous = store.lists[slug];
  if (!previous) return;
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).some((key) => previous[key] !== patch[key]);
  if (!changed) return;
  writeStore({...store, lists: {...store.lists, [slug]: {...previous, ...patch}}});
}

/** Drops the participant token only (e.g. the host removed this person, or the link is invalid). */
export function forgetParticipantToken(slug: string) {
  const store = readStore();
  const previous = store.lists[slug];
  if (!previous?.participantToken) return;
  const next = {...previous};
  delete next.participantToken;
  if (!next.hostToken) {
    forgetList(slug);
    return;
  }
  writeStore({...store, lists: {...store.lists, [slug]: next}});
}

export function forgetList(slug: string) {
  const store = readStore();
  const lists = {...store.lists};
  delete lists[slug];
  writeStore({...store, lists});
}

/** "My lists", most recent first. */
export function listMyLists(): StoredList[] {
  return Object.values(readStore().lists).sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
}

// Theme choice (src/lib/theme.ts). Its own key, read before the first paint by the inline script.

export function readThemeChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(value) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/** "auto" removes the key: the device decides again. */
export function writeThemeChoice(choice: ThemeChoice) {
  try {
    if (choice === 'auto') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Nothing to do: this browser can't keep the choice, so the device setting stays in charge.
  }
}
