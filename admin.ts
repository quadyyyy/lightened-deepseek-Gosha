import { Bot, Context } from 'grammy';
import { BanList, isTelegramId } from './banlist.js';

const HELP = [
    'Админка Гоши — чёрный список',
    '/admin ban <ID> — заблокировать пользователя или чат',
    '/admin unban <ID> — снять блокировку',
    '/admin list — показать ЧС',
].join('\n');

export function registerAdmin<C extends Context>(bot: Bot<C>, banList: BanList, adminId: number | null): void {
    bot.command('admin', async (ctx) => {
        if (adminId === null || ctx.chat.type !== 'private' || ctx.from?.id !== adminId) {
            return;
        }
        const parts = ctx.match.trim().split(/\s+/);
        const [action, value] = parts;
        if (action === 'list' && parts.length === 1) {
            const ids = banList.list();
            if (!ids.length) {
                await ctx.reply('Чёрный список пуст.');
                return;
            }
            // Keep each message below Telegram's text length limit.
            for (let i = 0; i < ids.length; i += 100) {
                await ctx.reply('Чёрный список:\n' + ids.slice(i, i + 100).join('\n'));
            }
            return;
        }
        if ((action !== 'ban' && action !== 'unban') || parts.length !== 2) {
            await ctx.reply(HELP);
            return;
        }
        const id = Number(value);
        if (!/^-?\d+$/.test(value) || !isTelegramId(id)) {
            await ctx.reply('Укажи числовой Telegram ID: положительный для пользователя, отрицательный для группы.');
            return;
        }
        try {
            await banList.set(id, action === 'ban');
        } catch (error) {
            console.error('Failed to update ban list:', error);
            await ctx.reply('Не удалось сохранить ЧС. Изменение не применено.');
            return;
        }
        await ctx.reply(action === 'ban' ? `ID ${id} добавлен в ЧС.` : `ID ${id} удалён из ЧС.`);
    });
}
