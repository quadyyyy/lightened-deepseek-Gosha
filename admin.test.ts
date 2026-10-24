import assert from 'node:assert/strict';
import test, { TestContext } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Bot } from 'grammy';
import { BanList } from './banlist.js';
import { registerAdmin } from './admin.js';

async function setup(t: TestContext) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gosha-bans-'));
    t.after(() => fs.rm(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'banlist.json');
    return { file, list: await BanList.load(file, [42]) };
}

test('ban list persists changes and serializes concurrent writes', async (t) => {
    const { file, list } = await setup(t);
    await Promise.all([list.set(123, true), list.set(-456, true), list.set(42, false)]);
    assert.deepEqual(list.list(), [-456, 123]);
    assert.deepEqual((await BanList.load(file, [42])).list(), [-456, 123]);
});

test('failed persistence does not change the active ban list', async (t) => {
    const { file, list } = await setup(t);
    await fs.mkdir(file + '.tmp');
    await assert.rejects(list.set(123, true));
    assert.deepEqual(list.list(), [42]);
});

for (const enabled of [true, false]) {
    test(`admin access checks (enabled: ${enabled})`, async (t) => {
        const { list } = await setup(t);
        const bot = new Bot('123:test', {
            botInfo: {
                id: 123, is_bot: true, first_name: 'Test', username: 'test_bot',
                can_join_groups: true, can_read_all_group_messages: false,
                supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
            },
        });
        const replies: string[] = [];
        bot.api.config.use(async (_prev, method, payload) => {
            if (method !== 'sendMessage') {
                throw new Error('Unexpected API request');
            }
            replies.push((payload as { text: string }).text);
            throw new Error('Reply captured');
        });
        const adminId = 987654321;
        registerAdmin(bot, list, enabled ? adminId : null);
        let updateId = 0;
        const send = async (userId: number, privateChat: boolean, text: string) => {
            await bot.handleUpdate({
                update_id: ++updateId,
                message: {
                    message_id: updateId, date: 0,
                    from: { id: userId, is_bot: false, first_name: 'Test' },
                    chat: privateChat ?
                        { id: userId, type: 'private', first_name: 'Test' } :
                        { id: -1001, type: 'supergroup', title: 'Test' },
                    text, entities: [{ type: 'bot_command', offset: 0, length: 6 }],
                },
            }).catch((error) => {
                if (!String(error).includes('Reply captured')) {
                    throw error;
                }
            });
        };
        await send(999, true, '/admin ban 123');
        await send(123456789, true, '/admin ban 123');
        await send(adminId, false, '/admin ban 123');
        assert.equal(list.has(123), false);
        assert.deepEqual(replies, []);
        await send(adminId, true, '/admin ban 123');
        if (!enabled) {
            assert.equal(list.has(123), false);
            assert.deepEqual(replies, []);
            return;
        }
        assert.equal(list.has(123), true);
        await send(adminId, true, '/admin unban 123');
        assert.equal(list.has(123), false);
        await send(adminId, true, '/admin ban 1e3');
        assert.equal(list.has(1000), false);
        await send(adminId, true, '/admin list');
        assert.match(replies.at(-1)!, /42/);
    });
}
