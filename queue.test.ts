import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskQueue } from './queue.js';

test('jobs run in FIFO order without overlap', async () => {
    const queue = new TaskQueue();
    const events: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });

    const first = queue.enqueue(async () => {
        events.push('first started');
        await gate;
        events.push('first finished');
        return 1;
    });
    const second = queue.enqueue(async () => {
        events.push('second');
        return 2;
    });
    const third = queue.enqueue(async () => {
        events.push('third');
        return 3;
    });

    await Promise.resolve();
    assert.deepEqual(events, ['first started']);
    release();
    assert.deepEqual(await Promise.all([first, second, third]), [1, 2, 3]);
    assert.deepEqual(events, ['first started', 'first finished', 'second', 'third']);
});

test('rejected and synchronously thrown jobs do not stop the queue', async () => {
    const queue = new TaskQueue();
    const rejected = queue.enqueue(async () => {
        throw new Error('async failure');
    });
    const thrown = queue.enqueue(() => {
        throw new Error('sync failure');
    });
    const next = queue.enqueue(async () => 'success');

    await assert.rejects(rejected, /async failure/);
    await assert.rejects(thrown, /sync failure/);
    assert.equal(await next, 'success');
    await queue.close();
});

test('close drains accepted jobs and rejects new jobs', async () => {
    const queue = new TaskQueue();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const events: string[] = [];
    const first = queue.enqueue(async () => {
        await gate;
    });
    const second = queue.enqueue(async () => {
        events.push('finished');
    });
    const closing = queue.close().then(() => {
        events.push('closed');
    });

    await assert.rejects(queue.enqueue(async () => {
        events.push('unexpected');
    }), /Queue is closed/);
    assert.deepEqual(events, []);
    release();
    await Promise.all([first, second, closing]);
    assert.deepEqual(events, ['finished', 'closed']);
    await queue.close();
});
