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

test('shutdown accepts the remaining grammY update batch before closing the queue', async () => {
    const { Bot } = await import('grammy');
    const bot = new Bot('123:test', {
        botInfo: {
            id: 123,
            is_bot: true,
            first_name: 'Test',
            username: 'test_bot',
            can_join_groups: true,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            can_connect_to_business: false,
            has_main_web_app: false,
        },
    });
    let fetched = false;
    bot.api.deleteWebhook = async () => true;
    bot.api.getUpdates = async () => {
        const updates = fetched ?
            [] :
            [1, 2].map(id => ({
                update_id: id,
                message: {
                    message_id: id,
                    date: 0,
                    from: { id: 1, is_bot: false, first_name: 'Test' },
                    chat: { id: 1, type: 'private' as const, first_name: 'Test' },
                    text: 'test',
                },
            }));
        fetched = true;
        return updates;
    };
    const queue = new TaskQueue();
    const completed: number[] = [];
    let entered!: () => void;
    const started = new Promise<void>((resolve) => {
        entered = resolve;
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const jobs: Promise<void>[] = [];
    bot.on('message', async (ctx) => {
        entered();
        await gate;
        jobs.push(queue.enqueue(async () => {
            completed.push(ctx.update.update_id);
        }));
    });
    const polling = bot.start();
    await started;
    await bot.stop();
    assert.deepEqual(completed, []);
    release();
    await polling;
    await queue.close();
    await Promise.all(jobs);
    assert.deepEqual(completed, [1, 2]);
});
