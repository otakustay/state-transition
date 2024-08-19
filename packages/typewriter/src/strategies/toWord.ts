import {Strategy} from '../pipe.js';

export interface ToWordLocaleOptions {
    locale: string;
}

export interface ToWordSegmentOptions {
    segment: (value: string) => Iterable<string>;
}

export type ToWordOptions = ToWordLocaleOptions | ToWordSegmentOptions;

function* segment(value: string, options: ToWordOptions) {
    if ('locale' in options) {
        const segmenter = new Intl.Segmenter(options.locale, {granularity: 'word'});
        for (const data of segmenter.segment(value)) {
            yield data.segment;
        }
    }
    else {
        yield* options.segment(value);
    }
}

export function toWord(options: ToWordOptions): Strategy {
    return async function* toWordStrategy(stream) {
        for await (const data of stream) {
            const cursor = {current: data.index};
            const segments = segment(data.value, options);
            for (const word of segments) {
                yield {value: word, index: cursor.current, chunk: data.chunk, latency: data.latency};
                cursor.current += word.length;
            }
        }
    };
}
