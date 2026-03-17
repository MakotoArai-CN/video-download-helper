import { CONFIG } from './config.ts';
import { JSMerger, FFmpegMerger } from './merger.ts';
import type { MergeMethod, MergeResult, Metadata } from './types.ts';

export const MergeManager = {
  currentMethod: CONFIG.MERGE_METHODS.JSMERGE as MergeMethod,

  methods: {
    'js-merge': { name: 'JS原生合并', desc: '浏览器内直接合并，兼容性好', handler: JSMerger as any, recommended: true },
    'ffmpeg-merge': { name: 'FFmpeg合并', desc: '使用FFmpeg进行专业合并', handler: FFmpegMerger as any, recommended: false },
    'separate': { name: '分离下载', desc: '分别保存视频和音频文件', handler: null, recommended: false }
  } as Record<string, { name: string; desc: string; handler: any; recommended: boolean }>,

  setMethod(method: MergeMethod): void {
    this.currentMethod = method;
  },

  getMethodStatus(method: MergeMethod): string {
    if (method === CONFIG.MERGE_METHODS.SEPARATE) return 'ready';
    const handler = this.methods[method]?.handler;
    return handler ? handler.status : 'unavailable';
  },

  merge(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, metadata: Metadata): Promise<MergeResult> {
    const method = this.methods[this.currentMethod];
    if (this.currentMethod === CONFIG.MERGE_METHODS.SEPARATE) {
      return Promise.resolve({ separate: true, video: videoBuffer, audio: audioBuffer });
    }
    if (!method.handler) return Promise.reject(new Error('未找到合并处理器'));
    return method.handler.merge(videoBuffer, audioBuffer, metadata)
      .then((result: ArrayBuffer) => ({ separate: false, data: result }))
      .catch((error: Error) => { console.error(method.name + ' 合并失败:', error); throw error; });
  }
};
