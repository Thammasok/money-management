import { useEffect, useState } from 'react';

/** Where a load stands: not answered yet, answered with the value, or failed with whatever it rejected with. */
export type AsyncValue<Value> =
  { status: 'loading' } | { status: 'loaded'; value: Value } | { status: 'failed'; error: unknown };

type Settled<Value> = Exclude<AsyncValue<Value>, { status: 'loading' }>;

const LOADING = { status: 'loading' } as const;

/**
 * Runs `load` when the screen appears and whenever `load` itself changes, and says where it stands. Give it a stable
 * function (`useCallback` over what it reads): a new function means "load something else", and the screen goes back
 * to loading until that answers. An answer that comes after the screen has gone, or after `load` changed, is dropped.
 */
export function useAsyncValue<Value>(load: () => Promise<Value>): AsyncValue<Value> {
  // The answer is kept with the loader it answers, so a changed loader reads as "loading" without setting state in
  // an effect.
  const [settled, setSettled] = useState<{
    load: () => Promise<Value>;
    outcome: Settled<Value>;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    load().then(
      (value) => {
        if (isCurrent) setSettled({ load, outcome: { status: 'loaded', value } });
      },
      (error: unknown) => {
        if (isCurrent) setSettled({ load, outcome: { status: 'failed', error } });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [load]);

  return settled !== null && settled.load === load ? settled.outcome : LOADING;
}
