import {Strategy, PipeData} from '../pipe.js';
import {QueueState} from '../queue.js';

export interface SlowLastChunkOptions {
    defaultLatencyPerCharacter?: number;
}

export function slowLastChunk({defaultLatencyPerCharacter}: SlowLastChunkOptions = {}): Strategy {
    const computeLatency = (state: QueueState, data: PipeData) => {
        if (data.chunk.index === 0) {
            return defaultLatencyPerCharacter ?? 0;
        }

        const lastChunkTime = state.resolved.at(-1)?.time;
        const firstChunkTime = state.resolved[0].time;
        const totalTime = lastChunkTime ? (lastChunkTime - firstChunkTime) : /* v8 ignore next */ 0;
        const totalSize = state.resolved.reduce((sum, chunk) => sum + chunk.value.length, 0);
        const averageLatencyPerCharacter = totalTime / totalSize;
        const remainingCharactersCount = data.chunk.value.length - data.index;
        const averageChunkSize = totalSize / state.resolved.length;
        const expectedLatency = averageChunkSize * averageLatencyPerCharacter;
        const latency = Math.ceil(expectedLatency / remainingCharactersCount);
        return latency;
    };

    return async function* slowLastChunkStrategy(stream, {getQueueState}) {
        for await (const data of stream) {
            const state = getQueueState();
            if (data.chunk.index !== state.resolved.length - 1) {
                yield data;
                continue;
            }

            const latency = computeLatency(state, data);

            for (let i = 0; i < data.value.length; i++) {
                const state = getQueueState();

                // Flush all remaining characters on arrival of next chunk
                if (data.chunk.index === state.resolved.length - 1) {
                    const character = data.value[i];
                    yield {value: character, index: data.index + i, chunk: data.chunk, latency};
                }
                else {
                    yield {value: data.value.slice(i), index: data.index + i, chunk: data.chunk, latency: 0};
                }
            }
        }
    };
}
