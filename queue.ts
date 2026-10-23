export class TaskQueue {
    private tail: Promise<void> = Promise.resolve();

    private closed = false;

    public enqueue<T>(task: () => Promise<T>): Promise<T> {
        if (this.closed) {
            return Promise.reject(new Error('Queue is closed'));
        }

        const result = this.tail.then(task);
        // A failed job must not prevent the next job from running.
        this.tail = result.then(() => {}, () => {});
        return result;
    }

    public async close(): Promise<void> {
        this.closed = true;
        await this.tail;
    }
}
