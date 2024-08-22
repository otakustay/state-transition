import {IterationItem, Queue, QueueState} from './queue.js';

interface StrategyContext {
    getQueueState: () => QueueState;
}

export interface PipeData {
    value: string;
    index: number;
    latency: number;
    chunk: IterationItem;
}

export type PipeStream = AsyncIterableIterator<PipeData>;

export type Strategy = (input: PipeStream, context: StrategyContext) => PipeStream;

async function* toStream(input: AsyncIterable<IterationItem>): PipeStream {
    for await (const chunk of input) {
        const data: PipeData = {
            value: chunk.value,
            index: 0,
            latency: 0,
            chunk,
        };
        yield data;
    }
}

export async function* createTypewriterPipeline(input: AsyncIterableIterator<string>, streategies: Strategy[]) {
    const queue = new Queue();
    void queue.consume(input);

    const context: StrategyContext = {
        getQueueState: () => queue.getState(),
    };
    const stream = streategies.reduce(
        (stream, strategy) => strategy(stream, context),
        toStream(queue.toIterable())
    );
    const state = {
        latency: 0,
    };

    for await (const item of stream) {
        if (state.latency > 0) {
            await new Promise(r => setTimeout(r, state.latency));
        }

        state.latency = item.latency;
        yield item.value;
    }
}
