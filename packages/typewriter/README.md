# Typewriter

A state transition function receiving chunks of input and simulates typewriter text output.

## Usage

```ts
import {toWord, linear, createTypewriterPipeline} from '@state-transition/typewriter';

// Suppose we have a function that calls a LLM and returns chunked text as an async generator
const input = requestLlmStreaming();
// See all possible strategies below
const pipe = createTypewriterPipeline(
    input,
    [
        toWord({locale: 'zh-Hans'}),
        linear(20),
        eager({eagerInterval: 10}),
        slowLastChunk(),
    ]

for await (const output of pipe) {
    process.stdout.write(output);
}
```

## Strategies

### toCharacter

```ts
toCharacter();
```

This strategy split each chunk into single characters.

### toWord

```ts
toWord(options: {locale: string});
toWord(options: {segment: (text: string) => string[]});
```

This strategy split chunk into words from a locale value or a custom segment function, the `locale` option indicates using `Intl.Segmenter` internally.

### linear

```ts
linear(interval: number);
```

This strategy adds a constant latency between each yield value.

### eager

```ts
eager({eagerInterval: number, flushInterval?: number});
```

This is a mixed strategy that:

1. Do not modify latency when no more chunks waiting.
2. Modify latency to `eagerInterval` when 1 chunk is waiting in the queue.
3. Modify latency to `flushInterval` if 2 or more chunks are waiting in the queue, or the input is consumed compeletely. The `flushInterval` can be optional or `0` to indicate the value should be immediately flushed.

### slowLastChunk

```ts
slowLastChunk(options?: {defaultLatencyPerCharacter?: number});
```

This strategy will slow down the output speed when current chunk is the last one and the stream is not completed yet. It estimates an "average latency" from previous chunks and then yield character by character with this latency. It will stop this behavior when more chunk arrives.

The `defaultLatencyPerCharacter` option is used when the first chunk is in a "slow state" because we don't have enough chunks to compute the average latency, if this option is not provided, the default value will be `0`.
