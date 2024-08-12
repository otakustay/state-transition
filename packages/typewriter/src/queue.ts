interface QueueItemResolved {
    state: 'resolved';
    time: number;
    value: string;
}

interface QueueItemError {
    state: 'error';
    time: number;
    reason: string;
}

interface YieldResult {
    value: string;
    done: false;
}

interface QueueItemPending {
    state: 'pending';
    promise: Promise<YieldResult>;
    resolve: (data: YieldResult) => void;
    reject: (error: Error) => void;
}

export interface IterationItem {
    index: number;
    value: string;
}

interface ResolvedItem {
    time: number;
    value: string;
}

export interface QueueState {
    resolved: ResolvedItem[];
    completed: boolean;
}

function createPendingItem(): QueueItemPending {
    const item: Partial<QueueItemPending> = {
        state: 'pending',
    };
    item.promise = new Promise<YieldResult>((resolve, reject) => Object.assign(item, {resolve, reject}));
    return item as QueueItemPending;
}

export class Queue {
    private chunksCount = -1;

    private cursor = 0;

    private readonly queue: Array<QueueItemResolved | QueueItemPending | QueueItemError> = [];

    async consume(input: AsyncIterableIterator<string>) {
        try {
            for await (const chunk of input) {
                this.put(chunk);
            }
        }
        /* v8 ignore next 3 */
        catch (ex) {
            this.error(ex instanceof Error ? ex.message : `${ex}`);
        }
        finally {
            this.complete();
        }
    }

    getState(): QueueState {
        const state: QueueState = {
            resolved: [],
            completed: this.chunksCount >= 0,
        };
        for (const item of this.queue) {
            /* v8 ignore next 3 */
            if (item.state !== 'resolved') {
                break;
            }

            state.resolved.push({time: item.time, value: item.value});
        }
        return state;
    }

    toIterable(): AsyncIterable<IterationItem> {
        return {
            [Symbol.asyncIterator]: (): AsyncIterator<IterationItem> => {
                const state = {
                    cursor: 0,
                };
                const pull = (): Promise<IteratorResult<IterationItem>> => {
                    const index = state.cursor;
                    if (this.chunksCount >= 0 && index >= this.chunksCount) {
                        return Promise.resolve({value: undefined, done: true});
                    }

                    const item = this.queue.at(index);
                    state.cursor++;

                    const expand = (value: string | IteratorResult<string>): IteratorResult<IterationItem> => {
                        if (typeof value === 'string') {
                            return {value: {value, index}, done: false};
                        }
                        return {value: {value: value.value, index}, done: value.done};
                    };

                    if (item) {
                        switch (item.state) {
                            /* v8 ignore next 2 */
                            case 'pending':
                                return item.promise.then(expand);
                            case 'resolved':
                                return Promise.resolve(expand(item.value));
                            case 'error':
                                return Promise.reject(new Error(item.reason));
                        }
                    }

                    const pendingItem = createPendingItem();
                    this.queue[index] = pendingItem;
                    return pendingItem.promise.then(expand);
                };
                return {
                    next: pull,
                };
            },
        };
    }

    private put(value: string) {
        /* v8 ignore start */
        if (this.chunksCount >= 0) {
            return;
        }
        /* v8 ignore end */

        const current = this.queue.at(this.cursor);

        if (current && current.state === 'pending') {
            current.resolve({value, done: false});
        }

        const item: QueueItemResolved = {
            state: 'resolved',
            time: Date.now(),
            value,
        };
        this.queue[this.cursor] = item;
        this.cursor++;
    }

    private error(reason: string) {
        /* v8 ignore start */
        if (this.chunksCount >= 0) {
            return;
        }
        /* v8 ignore end */

        const current = this.queue.at(this.cursor);

        if (current && current.state === 'pending') {
            current.reject(new Error(reason));
        }

        const item: QueueItemError = {
            state: 'error',
            time: Date.now(),
            reason,
        };
        this.queue[this.cursor] = item;
        this.cursor++;
    }

    private complete() {
        this.chunksCount = this.queue.length;
    }
}
