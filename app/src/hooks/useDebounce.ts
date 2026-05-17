import { useState, useEffect, useRef } from 'react';

/**
 * useDebounce — returns a debounced value that only updates
 * after `delay` ms of inactivity.
 *
 * Usage:
 *   const debouncedSearch = useDebounce(searchText, 300);
 *   useEffect(() => { fetchUsers(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback — returns a debounced version of a callback.
 *
 * Usage:
 *   const handleSearch = useDebouncedCallback((q: string) => fetchUsers(q), 300);
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Always use the latest callback without re-creating the debounced fn
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return (...args: Parameters<T>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  };
}
