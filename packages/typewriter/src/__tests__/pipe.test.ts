import {test, expect, vi} from 'vitest';
import {byCharacterLinear, createTypewriterPipeline} from '../pipe.js';
import {byChunk, byWordEager, byWordLinear} from '../index.js';

vi.setConfig({testTimeout: 30000});

const textChunks = [
    '晴朗的天空',
    '下，阳光如金色绸带般洒落，空气中弥漫着花草的香气。',
    '在这和煦的气氛中，一只可爱的小猫正在草丛中欢快地玩耍。',
    '它的毛色如同雪一般洁白，间或夹杂着几缕浅浅的灰色。',
    '小猫灵动活泼，不时地在草丛中跳跃翻滚，好似在与风儿捉迷藏。',
    '它的蓝色双眼闪烁着好奇与探索的光芒，似乎对这周围的一切都充满了无尽的兴趣。',
    '草丛中的小虫、蝴蝶都成了它的玩伴，它时而扑腾着追逐，时而安静地观察，一举一动都透露着童真与可爱',
    '。',
    '偶尔，它会停下来，昂首望向天空，仿佛在对着那洁白的云朵诉说着自己的小心事。',
    '阳光照耀在小猫柔软的毛发上，形成一层淡淡的光晕，这一刻，它就像是草丛中的小精灵，为这美好的天气增添了一抹生动的',
    '色彩。',
];

async function* incoming(latency = 10): AsyncIterableIterator<string> {
    for (const chunk of textChunks) {
        await new Promise(resolve => setTimeout(resolve, latency));
        yield chunk;
    }
}

async function streamToArray(stream: AsyncIterableIterator<string>) {
    const result: string[] = [];
    for await (const chunk of stream) {
        result.push(chunk);
    }
    return result;
}

test('by chunk', async () => {
    const pipe = createTypewriterPipeline(
        incoming(),
        {
            strategy: byChunk(),
        }
    );
    const result = await streamToArray(pipe);
    expect(result).toEqual(textChunks);
});

test('character linear', async () => {
    const pipe = createTypewriterPipeline(
        incoming(),
        {
            strategy: byCharacterLinear(0),
        }
    );
    const result = await streamToArray(pipe);
    expect(result).toEqual(textChunks.map(v => v.split('')).flat());
});

test('word linear', async () => {
    const pipe = createTypewriterPipeline(
        incoming(),
        {
            strategy: byWordLinear(0),
        }
    );
    const result = await streamToArray(pipe);
    expect(result.join('')).toBe(textChunks.join(''));
});

test('word eager yield all chunk on pending', async () => {
    const pipe = createTypewriterPipeline(
        incoming(),
        {
            strategy: byWordEager({defaultInterval: 40, eagerInterval: 10}),
        }
    );
    const result = await streamToArray(pipe);
    expect(result.some(v => v.length > 10)).toBe(true);
});

test('word eager await latency on last chunk', async () => {
    const pipe = createTypewriterPipeline(
        incoming(40),
        {
            strategy: byWordEager({defaultInterval: 20, eagerInterval: 10}),
        }
    );
    const result = await streamToArray(pipe);
    expect(result.filter(v => v.length === 1).length).toBeGreaterThan(10);
});

test('error', async () => {
    async function* incoming() {
        yield 'foo';
        throw new Error('bar');
    }

    const pipe = createTypewriterPipeline(
        incoming(),
        {
            strategy: byChunk(),
        }
    );
    await expect(streamToArray(pipe)).rejects.toThrow();
});
