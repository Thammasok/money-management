import { deferred } from '../../test/support/deferred';
import { KeyedMutex } from './keyed-mutex';

describe('KeyedMutex', () => {
  it('runs tasks that share a key one at a time, in the order they were requested', async () => {
    // Arrange
    const mutex = new KeyedMutex();
    const events: string[] = [];
    const firstGate = deferred();
    const task = (name: string, gate?: Promise<void>) => async () => {
      events.push(`${name}:start`);
      await gate;
      events.push(`${name}:end`);
      return name;
    };

    // Act
    const all = Promise.all([
      mutex.run('a', task('first', firstGate.promise)),
      mutex.run('a', task('second')),
      mutex.run('a', task('third')),
    ]);
    await Promise.resolve();
    const startedWhileFirstIsRunning = [...events];
    firstGate.resolve();
    const results = await all;

    // Assert
    expect(startedWhileFirstIsRunning).toEqual(['first:start']);
    expect(results).toEqual(['first', 'second', 'third']);
    expect(events).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
      'third:start',
      'third:end',
    ]);
  });

  it('lets tasks with different keys run at the same time', async () => {
    // Arrange
    const mutex = new KeyedMutex();
    const events: string[] = [];
    const gate = deferred();
    const task = (name: string) => async () => {
      events.push(`${name}:start`);
      await gate.promise;
      events.push(`${name}:end`);
    };

    // Act
    const all = Promise.all([mutex.run('a', task('a')), mutex.run('b', task('b'))]);
    await Promise.resolve();
    const startedBeforeEitherEnds = [...events];
    gate.resolve();
    await all;

    // Assert
    expect(startedBeforeEitherEnds).toEqual(['a:start', 'b:start']);
  });

  it('hands a failure to its own caller only, and the next task for the key still runs', async () => {
    // Arrange
    const mutex = new KeyedMutex();
    const failing = mutex.run('a', async () => {
      throw new Error('boom');
    });
    const following = mutex.run('a', async () => 'still runs');

    // Act
    const outcomes = await Promise.allSettled([failing, following]);

    // Assert
    expect(outcomes[0]).toMatchObject({ status: 'rejected', reason: new Error('boom') });
    expect(outcomes[1]).toEqual({ status: 'fulfilled', value: 'still runs' });
  });

  it('can be used again for a key once everything queued for it has finished', async () => {
    // Arrange
    const mutex = new KeyedMutex();
    await mutex.run('a', async () => 'first round');

    // Act
    const second = await mutex.run('a', async () => 'second round');

    // Assert
    expect(second).toBe('second round');
  });
});
