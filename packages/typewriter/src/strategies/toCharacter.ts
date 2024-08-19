import {Strategy} from '../pipe.js';

export function toCharacter(): Strategy {
    return async function* toCharacterStrategy(stream) {
        for await (const data of stream) {
            const characters = data.value.split('');
            for (let i = 0; i < characters.length; i++) {
                yield {value: characters[i], index: data.index + i, chunk: data.chunk, latency: data.latency};
            }
        }
    };
}
