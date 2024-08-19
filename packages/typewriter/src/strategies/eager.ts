import {Strategy} from '../pipe.js';
import {IterationItem, QueueState} from '../queue.js';

export interface EagerOptions {
    eagerInterval: number;
    flushInterval?: number;
}

function nextInterval(state: QueueState, chunk: IterationItem, options: EagerOptions) {
    const remainingChunksCount = state.resolved.length - chunk.index - 1;

    // Once we are in a state that too behind of incoming stream, we should flush all possible text immediately,
    if (state.completed || remainingChunksCount >= 2) {
        return options.flushInterval ?? 0;
    }
    else if (remainingChunksCount === 1) {
        return options.eagerInterval;
    }
    // for condition where not that much backpressure, we can still output word by word in a smaller interval
    else {
        return null;
    }
}

export function eager(options: EagerOptions): Strategy {
    return async function* eagerStrategy(stream, {getQueueState}) {
        for await (const data of stream) {
            const interval = nextInterval(getQueueState(), data.chunk, options);
            yield {...data, latency: interval ?? data.latency};
        }
    };
}
