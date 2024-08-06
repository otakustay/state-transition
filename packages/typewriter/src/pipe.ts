import {IterationItem, Queue, QueueState} from './queue.js';

async function consumeInput(input: AsyncIterableIterator<string>, queue: Queue) {
    const cursor = {current: 0};
    for await (const chunk of input) {
        queue.put(cursor.current, chunk);
        cursor.current++;
    }
    queue.complete();
}

interface TypewriterStrategyContext {
    getQueueState: () => QueueState;
}

type TypewriterStrategy = (chunk: IterationItem, context: TypewriterStrategyContext) => AsyncIterableIterator<string>;

interface TypewriterOptions {
    strategy: TypewriterStrategy;
}

function wait(time: number): Promise<void> {
    if (time <= 0) {
        return Promise.resolve();
    }

    return new Promise(resolve => setTimeout(resolve, time));
}

export function byChunk(): TypewriterStrategy {
    return async function* byChunkStrategy(chunk) {
        yield chunk.value;
    };
}

export function byCharacterLinear(interval: number): TypewriterStrategy {
    return async function* byCharacterLinearStrategy(chunk) {
        for (const char of chunk.value) {
            yield char;
            await wait(interval);
        }
    };
}

export function byWordLinear(interval: number): TypewriterStrategy {
    return async function* byWordLinearStrategy(chunk) {
        const segmenter = new Intl.Segmenter('zh-Hans', {granularity: 'word'});
        const segments = segmenter.segment(chunk.value);
        for (const data of segments) {
            yield data.segment;
            await wait(interval);
        }
    };
}

export interface EagerOptions {
    defaultInterval: number;
    eagerInterval: number;
}

export function byWordEager({defaultInterval, eagerInterval}: EagerOptions): TypewriterStrategy {
    return async function* byWordEagerStrategy(chunk, context) {
        const segmenter = new Intl.Segmenter('zh-Hans', {granularity: 'word'});
        const segments = segmenter.segment(chunk.value);
        for (const data of segments) {
            const state = context.getQueueState();
            const remainingChunksCount = state.resolved.length - chunk.index - 1;

            // Once we are in a state that too behind of incoming stream, we should flush all possible text immediately
            if (state.completed || remainingChunksCount >= 2) {
                yield chunk.value.slice(data.index);
                return;
            }

            // For condition where not that much backpressure, we can still output word by word in a smaller interval
            const interval = remainingChunksCount === 1 ? eagerInterval : defaultInterval;
            yield data.segment;
            await wait(interval);
        }
    };
}

export async function* createTypewriterPipeline(input: AsyncIterableIterator<string>, options: TypewriterOptions) {
    const queue = new Queue();
    void consumeInput(input, queue);
    const cursor = {index: 0};

    for await (const chunk of queue.toIterable()) {
        const context: TypewriterStrategyContext = {
            getQueueState: () => queue.getState(),
        };
        for await (const output of options.strategy(chunk, context)) {
            yield output;
        }

        cursor.index++;
    }
}
