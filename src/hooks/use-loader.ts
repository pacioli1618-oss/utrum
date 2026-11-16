'use client';

import {useCallback, useEffect, useRef, useState} from 'react';

type LoaderState<T> = {
  /** Which request this state belongs to, so a new key never shows old data. */
  key: string;
  data: T | null;
  error: unknown;
};

export type LoaderResult<T> = {
  data: T | null;
  error: unknown;
  isLoading: boolean;
  /** Reload now, e.g. right after a change. */
  refresh: () => Promise<void>;
};

/**
 * Loads data for `key` (null = don't load yet) and reloads it when the page becomes visible
 * again, so a host who switches to WhatsApp and back sees who opened their link meanwhile.
 * `load` must only depend on what `key` describes.
 */
export function useLoader<T>(key: string | null, load: () => Promise<T>): LoaderResult<T> {
  const [state, setState] = useState<LoaderState<T>>({key: '', data: null, error: null});
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // A slow answer for a previous key must not overwrite the current one.
  const latestKeyRef = useRef<string | null>(key);

  const run = useCallback(async (currentKey: string) => {
    try {
      const data = await loadRef.current();
      if (latestKeyRef.current !== currentKey) return;
      setState({key: currentKey, data, error: null});
    } catch (error) {
      if (latestKeyRef.current !== currentKey) return;
      setState((previous) => ({key: currentKey, data: previous.key === currentKey ? previous.data : null, error}));
    }
  }, []);

  useEffect(() => {
    latestKeyRef.current = key;
    if (key === null) return;
    let isActive = true;
    const guardedRun = () => {
      if (isActive) void run(key);
    };
    guardedRun();
    const handleVisible = () => {
      if (document.visibilityState === 'visible') guardedRun();
    };
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('online', handleVisible);
    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('online', handleVisible);
    };
  }, [key, run]);

  const refresh = useCallback(async () => {
    if (key !== null) await run(key);
  }, [key, run]);

  const isCurrent = key !== null && state.key === key;
  return {
    data: isCurrent ? state.data : null,
    error: isCurrent ? state.error : null,
    isLoading: key === null || !isCurrent || (state.data === null && state.error === null),
    refresh,
  };
}
