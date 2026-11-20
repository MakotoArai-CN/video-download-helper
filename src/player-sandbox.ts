import { newQuickJSWASMModuleFromVariant, newVariant, shouldInterruptAfterDeadline } from 'quickjs-emscripten-core';
import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync';
import { mediaRequest } from './media-http.ts';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@jitl/quickjs-wasmfile-release-sync@0.32.0/dist/emscripten-module.wasm';
let engine: ReturnType<typeof newQuickJSWASMModuleFromVariant> | null = null;

/** 原站播放器算法在独立 WASM VM 中运行，没有 DOM、Cookie、网络或宿主函数。 */
export async function evaluatePlayerScript(code: string): Promise<any> {
  if (code.length > 8 * 1024 * 1024) throw new Error('播放器算法过大');
  if (!engine) {
    engine = newQuickJSWASMModuleFromVariant(newVariant(RELEASE_SYNC, {
      wasmBinary: async () => (await mediaRequest(WASM_URL, { binary: true, maxBytes: 4 * 1024 * 1024 })).data
    })).catch(error => { engine = null; throw error; });
  }
  const vm = await engine;
  return vm.evalCode(`(function(){${code}\n})()`, {
    memoryLimitBytes: 64 * 1024 * 1024,
    maxStackSizeBytes: 1024 * 1024,
    shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + 2000)
  });
}
