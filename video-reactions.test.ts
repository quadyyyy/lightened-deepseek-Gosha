import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { Bot } from 'grammy';
import { TaskQueue } from './queue.js';
import { generateVideoReaction, registerVideoReactions, validateVideo, MAX_VIDEO_BYTES } from './video-reactions.js';

test('duration and size boundaries', () => {
    validateVideo(300, MAX_VIDEO_BYTES);
    for (const duration of [301, 0, NaN, -1]) {
        assert.throws(() => validateVideo(duration, 1));
    }
    assert.throws(() => validateVideo(1, MAX_VIDEO_BYTES + 1));
});

test('Gemini uploads full video, reads answer and cleans up even after generation failure', async (t) => {
    const previous = axios.defaults.adapter;
    t.after(() => {
        axios.defaults.adapter = previous;
    });
    const calls: string[] = [];
    let fail = false;
    axios.defaults.adapter = async (config) => {
        calls.push(`${config.method} ${config.url}`);
        let data: unknown = {};
        const headers: Record<string, string> = {};
        if (config.url?.endsWith('/upload/v1beta/files')) {
            headers['x-goog-upload-url'] = 'https://generativelanguage.googleapis.com/upload-session';
        } else if (config.url?.endsWith('/upload-session')) {
            assert.deepEqual(config.data, Buffer.from('whole-video'));
            data = { file: { name: 'files/test', uri: 'https://example.test/video', state: 'ACTIVE' } };
        } else if (config.url?.endsWith(':generateContent')) {
            const body = JSON.parse(config.data);
            assert.equal(body.contents[0].parts[0].fileData.mimeType, 'video/mp4');
            assert.match(body.systemInstruction.parts[0].text, /Гоша/);
            if (fail) {
                throw new Error('Test generation failure');
            }
            data = { candidates: [{ content: { parts: [{ text: 'private reasoning', thought: true }, { text: 'Реакция!' }] } }] };
        }
        return { status: 200, statusText: 'OK', config, headers, data };
    };
    const settings = { apiKey: 'test-only', model: 'test-model' };
    assert.equal(await generateVideoReaction(Buffer.from('whole-video'), settings), 'Реакция!');
    assert.equal(calls.at(-1), 'delete https://generativelanguage.googleapis.com/v1beta/files/test');
    fail = true;
    await assert.rejects(generateVideoReaction(Buffer.from('whole-video'), settings), /Test generation failure/);
    assert.equal(calls.at(-1), 'delete https://generativelanguage.googleapis.com/v1beta/files/test');
    const before = calls.length;
    await assert.rejects(generateVideoReaction(Buffer.from('video'), { ...settings, apiKey: '' }), /ключ/);
    assert.equal(calls.length, before);
});

test('Telegram media invocation replies to the original video and respects bans and mentions', async () => {
    const bot = new Bot('123:test', { botInfo: {
        id: 123, is_bot: true, first_name: 'Gosha', username: 'gosha_bot',
        can_join_groups: true, can_read_all_group_messages: false,
        supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false,
    } });
    const replies: { reply_parameters?: { message_id: number }; text?: string }[] = [];
    bot.api.config.use(async (_previous, method, payload) => {
        assert.equal(method, 'sendMessage');
        replies.push(payload as typeof replies[number]);
        return { ok: true, result: true } as never;
    });
    const queue = new TaskQueue();
    registerVideoReactions(bot, {
        settings: { apiKey: '', model: 'test' }, queue, botUsername: 'gosha_bot',
        mentions: { RU: ['гоша'] }, isBanned: id => id === 99, takeSlot: () => true,
    });
    let id = 0;
    const video = { file_id: 'video', file_unique_id: 'unique', width: 10, height: 10, duration: 2 };
    const chat = { id: -1, type: 'supergroup' as const, title: 'Test' };
    for (const [user, text] of [[1, 'гоша'], [99, 'гоша'], [1, 'unrelated']] as const) {
        await bot.handleUpdate({ update_id: ++id, message: {
            message_id: id, date: 0, chat, from: { id: user, is_bot: false, first_name: 'Test' }, text,
            reply_to_message: { message_id: 777, date: 0, chat, video, reply_to_message: undefined },
        } });
    }
    assert.equal(replies.length, 1);
    assert.equal(replies[0].reply_parameters?.message_id, 777);
    assert.match(replies[0].text!, /ключ/);
    await queue.close();
});
