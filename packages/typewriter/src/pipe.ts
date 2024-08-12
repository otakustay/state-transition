import {IterationItem, Queue, QueueState} from './queue.js';

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

interface SegmentData {
    segment: string;
    index: number;
}

export interface ByWordLocaleOptions {
    locale: string;
}

export interface ByWordSegmentOptions {
    segment: (value: string) => Iterable<SegmentData>;
}

export type ByWordOptions = ByWordLocaleOptions | ByWordSegmentOptions;

function segment(value: string, options: ByWordOptions) {
    if ('locale' in options) {
        return new Intl.Segmenter(options.locale, {granularity: 'word'}).segment(value);
    }

    return options.segment(value);
}

export function byWordLinear(interval: number, options: ByWordOptions): TypewriterStrategy {
    return async function* byWordLinearStrategy(chunk) {
        const segments = segment(chunk.value, options);
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

export type ByWordEagerOptions = EagerOptions & ByWordOptions;

export function byWordEager(options: ByWordEagerOptions): TypewriterStrategy {
    return async function* byWordEagerStrategy(chunk, context) {
        const segments = segment(chunk.value, options);
        for (const data of segments) {
            const state = context.getQueueState();
            const remainingChunksCount = state.resolved.length - chunk.index - 1;

            // Once we are in a state that too behind of incoming stream, we should flush all possible text immediately
            if (state.completed || remainingChunksCount >= 2) {
                yield chunk.value.slice(data.index);
                return;
            }
            // When it's the last chunk, we can't expect the next chunk coming soon, so try to be more smooth
            if (remainingChunksCount === 0 && state.resolved.length > 1) {
                const lastChunkTime = state.resolved.at(-1)?.time;
                const firstChunkTime = state.resolved[0].time;
                const totalTime = lastChunkTime ? (lastChunkTime - firstChunkTime) : /* v8 ignore next */ 0;
                const totalSize = state.resolved.reduce((sum, chunk) => sum + chunk.value.length, 0);
                const averageLatencyPerCharacter = totalTime / totalSize;
                const remainingCharactersCount = chunk.value.length - data.index;
                const averageChunkSize = totalSize / state.resolved.length;
                const expectedLatency = averageChunkSize * averageLatencyPerCharacter;
                const interval = Math.ceil(expectedLatency / remainingCharactersCount);
                for (const char of data.segment) {
                    yield char;
                    await wait(interval);
                }
            }
            // For condition where not that much backpressure, we can still output word by word in a smaller interval
            else {
                yield data.segment;
                const interval = remainingChunksCount === 1 ? options.eagerInterval : options.defaultInterval;
                await wait(interval);
            }
        }
    };
}

export async function* createTypewriterPipeline(input: AsyncIterableIterator<string>, options: TypewriterOptions) {
    const queue = new Queue();
    void queue.consume(input);

    const context: TypewriterStrategyContext = {
        getQueueState: () => queue.getState(),
    };

    for await (const chunk of queue.toIterable()) {
        for await (const output of options.strategy(chunk, context)) {
            yield output;
        }
    }
}
