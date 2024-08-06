interface QueueItemResolved {
    state: 'resolved';
    value: string;
}

interface QueueItemError {
    state: 'error';
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

export interface QueueState {
    resolved: string[];
    completed: boolean;
}

function createPendingItem(): QueueItemPending {
    const item: Partial<QueueItemPending> = {
        state: 'pending',
    };
    item.promise = new Promise<YieldResult>((resolve, reject) => Object.assign(item, {resolve, reject}));
    return item as QueueItemPending;
}

/**
 * A intermediate medium allows to put data and pull them as an async generator.
 */
export class Queue {
    private chunksCount = -1;

    private readonly queue: Array<QueueItemResolved | QueueItemPending | QueueItemError> = [];

    /**
     * Put a chunk into current execution.
     *
     * @param index The chunk index
     * @param value The chunk value
     */
    put(index: number, value: string) {
        /* v8 ignore start */
        if (this.chunksCount >= 0) {
            return;
        }
        /* v8 ignore end */

        const current = this.queue.at(index);

        if (current && current.state === 'pending') {
            current.resolve({value, done: false});
        }

        const item: QueueItemResolved = {
            state: 'resolved',
            value,
        };
        this.queue[index] = item;
    }

    /**
     * Mark current execution to an error state.
     *
     * @param index The chunk index
     * @param reason The error reason
     */
    error(index: number, reason: string) {
        /* v8 ignore start */
        if (this.chunksCount >= 0) {
            return;
        }
        /* v8 ignore end */

        const current = this.queue.at(index);

        if (current && current.state === 'pending') {
            current.reject(new Error(reason));
        }

        const item: QueueItemError = {
            state: 'error',
            reason,
        };
        this.queue[index] = item;
    }

    /**
     * Mark current execution to a complete state.
     */
    complete() {
        this.chunksCount = this.queue.length;
    }

    getState(): QueueState {
        const resolved: string[] = [];
        for (const item of this.queue) {
            if (item.state === 'resolved') {
                resolved.push(item.value);
            }
            else {
                break;
            }
        }
        return {
            resolved,
            completed: this.chunksCount >= 0,
        };
    }

    /**
     * Create an `AsyncIterable` for current execution.
     *
     * @returns An `AsyncIterable` object that can iterate over the chunks of current execution.
     */
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
}
