import {Strategy} from '../pipe.js';

export function slowLastChunk(): Strategy {
    return async function* slowLastChunkStrategy(stream, {getQueueState}) {
        for await (const data of stream) {
            const state = getQueueState();
            if (state.resolved.length <= 1 || data.chunk.index !== state.resolved.length - 1) {
                yield data;
                continue;
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
