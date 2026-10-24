import fs from 'node:fs/promises';
import { TaskQueue } from './queue.js';

export const isTelegramId = (id: number): boolean => Number.isSafeInteger(id) && id !== 0;

export class BanList {
    private readonly writes = new TaskQueue();

    private readonly path: string;

    private ids: Set<number>;

    private constructor(path: string, ids: Set<number>) {
        this.path = path;
        this.ids = ids;
    }

    public static async load(path: string, initial: number[]): Promise<BanList> {
        let ids: unknown = initial;
        try {
            ids = JSON.parse(await fs.readFile(path, 'utf8'));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
        if (!Array.isArray(ids) || !ids.every(id => typeof id === 'number' && isTelegramId(id))) {
            throw new Error('Invalid ban list');
        }
        return new BanList(path, new Set(ids));
    }

    public has(id: number): boolean {
        return this.ids.has(id);
    }

    public list(): number[] {
        return [...this.ids].sort((a, b) => a - b);
    }

    public set(id: number, banned: boolean): Promise<void> {
        return this.writes.enqueue(async () => {
            if (!isTelegramId(id)) {
                throw new Error('Invalid Telegram ID');
            }
            const next = new Set(this.ids);
            if (banned) {
                next.add(id);
            } else {
                next.delete(id);
            }
            // Publish the new state only after the atomic file replacement succeeds.
            const temporary = this.path + '.tmp';
            await fs.writeFile(temporary, JSON.stringify([...next], null, 4) + '\n', { mode: 0o600 });
            await fs.rename(temporary, this.path);
            this.ids = next;
        });
    }
}
