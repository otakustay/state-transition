# Typewriter

A state transition function receiving chunks of input and simulates typewriter text output.

## Usage

```ts
import {byWordLinear, createTypewriterPipeline} from '@state-transition/typewriter';

// Suppose we have a function that calls a LLM and returns chunked text as an async generator
const input = requestLlmStreaming();
// See all possible strategies below
const pipe = createTypewriterPipeline(input, {strategy: byWordLinear});

for await (const output of pipe) {
    process.stdout.write(output);
}
```

## Strategies

### byChunk

```ts
byChunk();
```

This strategy simply pipe chunks to output.

### byCharacterLinear

```ts
byCharacterLinear(interval: number);
```

This strategy outputs character by character at a certain interval.

### byWordLinear

```ts
byWordLinear(interval: number);
```

This strategy outputs word by word at a certain interval, it uses `Intl.Segmenter` currently and will allow a custom segmenter in the future.

### byWordEager

```ts
byWordEager({defaultInterval: number, eagerInterval: number});
```

This is a mixed strategy that:

1. Output word by word at a `defaultInterval` when no more chunks waiting.
2. Output word by word at a `eagerInterval` when 1 chunk is waiting in the queue.
3. Output the entire chunk immediately if 2 or more chunks are waiting in the queue, or the input is consumed compeletely.

This strategy is not optimal for now, more detailed implementation will be added later.
