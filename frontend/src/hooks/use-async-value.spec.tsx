import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { deferred } from '../test-utils';
import { useAsyncValue } from './use-async-value';

// Boundary under test: useAsyncValue — the one state model every screen that loads something shares: loading, then
// loaded with the value, or failed with the reason.

describe('useAsyncValue', () => {
  it('is loading until the first answer comes', () => {
    // Arrange
    const load = () => deferred<string>().promise;

    // Act
    const { result } = renderHook(() => useAsyncValue(load));

    // Assert
    expect(result.current).toEqual({ status: 'loading' });
  });

  it('is loaded with the value once it comes', async () => {
    // Arrange
    const load = () => Promise.resolve('Cash');

    // Act
    const { result } = renderHook(() => useAsyncValue(load));

    // Assert
    await waitFor(() => expect(result.current).toEqual({ status: 'loaded', value: 'Cash' }));
  });

  it('is failed with the reason when the load fails', async () => {
    // Arrange
    const reason = new Error('boom');
    const load = () => Promise.reject(reason);

    // Act
    const { result } = renderHook(() => useAsyncValue(load));

    // Assert
    await waitFor(() => expect(result.current).toEqual({ status: 'failed', error: reason }));
  });

  it('loads once, however often the screen re-renders', async () => {
    // Arrange
    let calls = 0;
    const load = () => {
      calls += 1;
      return Promise.resolve(calls);
    };
    const { result, rerender } = renderHook(() => useAsyncValue(load));
    await waitFor(() => expect(result.current.status).toBe('loaded'));

    // Act
    rerender();

    // Assert
    expect(calls).toBe(1);
  });

  it('goes back to loading and loads again when it is given another loader', async () => {
    // Arrange
    const second = deferred<string>();
    const { result, rerender } = renderHook(({ load }) => useAsyncValue(load), {
      initialProps: { load: () => Promise.resolve('first') },
    });
    await waitFor(() => expect(result.current).toEqual({ status: 'loaded', value: 'first' }));

    // Act
    rerender({ load: () => second.promise });

    // Assert
    expect(result.current).toEqual({ status: 'loading' });
    second.resolve('second');
    await waitFor(() => expect(result.current).toEqual({ status: 'loaded', value: 'second' }));
  });

  it('ignores an answer that arrives after the screen has gone', async () => {
    // Arrange
    const answer = deferred<string>();
    const load = () => answer.promise;
    const { result, unmount } = renderHook(() => useAsyncValue(load));

    // Act
    unmount();
    answer.resolve('too late');

    // Assert: nothing to render into, and no "state update on an unmounted component" complaint
    await expect(answer.promise).resolves.toBe('too late');
    expect(result.current).toEqual({ status: 'loading' });
  });
});
