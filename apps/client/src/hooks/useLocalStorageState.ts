import { useCallback, useEffect, useState } from 'react';

/**
 * Boolean state persisted to localStorage (per browser profile). Used for sticky
 * UI preferences like "keep the contact panel collapsed" so the user doesn't have
 * to re-toggle it on every visit. Falls back to `initial` when storage is
 * unavailable or holds no value yet.
 */
export function usePersistentBoolean(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const saved = window.localStorage.getItem(key);
      return saved === null ? initial : saved === '1';
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
      /* localStorage unavailable */
    }
  }, [key, value]);

  const toggle = useCallback(() => setValue((v) => !v), []);
  return [value, setValue, toggle] as const;
}

/**
 * String state persisted to localStorage (per browser profile). Used for sticky
 * filter selections (e.g. the CRM owner/industria/servicio pills) so the user
 * doesn't have to re-filter on every visit. Falls back to `initial` when storage
 * is unavailable or holds no value yet.
 */
export function usePersistentString(key: string, initial: string) {
  const [value, setValue] = useState<string>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      return window.localStorage.getItem(key) ?? initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* localStorage unavailable */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

/** Como usePersistentString pero para un arreglo de strings (filtros multi-select). */
export function usePersistentStringArray(key: string, initial: string[] = []) {
  const [value, setValue] = useState<string[]>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as string[]) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* localStorage unavailable */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
