import { afterEach, expect, test } from 'bun:test';
import { evaluatePlayerScript } from '../src/player-sandbox.ts';

afterEach(() => { delete (globalThis as any).GM_xmlhttpRequest; });

test('真实 QuickJS WASM 在本机执行播放器算法且不暴露浏览器宿主', async () => {
  const binary = await Bun.file(new URL('../node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm', import.meta.url)).arrayBuffer();
  (globalThis as any).GM_xmlhttpRequest = (options: any) => {
    queueMicrotask(() => options.onload({ status: 200, response: binary }));
    return { abort() {} };
  };
  expect(await evaluatePlayerScript('return { sig: "abc".split("").reverse().join(""), dom: typeof document, network: typeof fetch };'))
    .toEqual({ sig: 'cba', dom: 'undefined', network: 'undefined' });
  await expect(evaluatePlayerScript('throw new Error("算法异常")')).rejects.toThrow('算法异常');
  await expect(evaluatePlayerScript('while (true) {}')).rejects.toThrow();
  expect(await evaluatePlayerScript('return 42')).toBe(42);
}, 10000);
