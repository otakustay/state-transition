import {Strategy} from '../pipe.js';

export function linear(interval: number): Strategy {
    return async function* linearStrategy(stream) {
        for await (const data of stream) {
            yield {...data, latency: interval};
        }
    };
}
