import { CONFIG } from './config.ts';
import { JsGifEncoder } from './gif-encoder.ts';
import { GifConverter } from './merger.ts';
import type { GifMethod } from './types.ts';

/** 一种 GIF 转码方式的描述与实现。 */
interface GifMethodEntry {
  /** 选项标题。 */
  name: string;
  /** 选项说明。 */
  desc: string;
  /** 转码实现。 */
  convert: (source: ArrayBuffer, onProgress?: (ratio: number) => void) => Promise<ArrayBuffer>;
}

/**
 * GIF 转码方式的调度器。
 *
 * 与 MergeManager 同构：面板上选中哪一项就由哪个实现接手。两条路径的取舍是
 * 依赖与画质——JS 路径不下载任何东西，FFmpeg 路径调色板更准但要先取到 wasm 核心。
 */
export const GifManager = {
  currentMethod: CONFIG.GIF_METHODS.JS as GifMethod,

  methods: {
    'js-gif': {
      name: 'JS 原生转码',
      desc: '浏览器内直接转码，无需下载 FFmpeg',
      convert: (source, onProgress) => JsGifEncoder.convert(source, { onProgress })
    },
    'ffmpeg-gif': {
      name: 'FFmpeg 转码',
      desc: '调色板更准，需先加载 FFmpeg 核心',
      convert: source => GifConverter.convert(source)
    }
  } as Record<GifMethod, GifMethodEntry>,

  setMethod(method: GifMethod): void {
    this.currentMethod = method;
  },

  /**
   * 按指定方式把视频转成 GIF。
   *
   * @param source 视频内容
   * @param method 转码方式，缺省用当前选中项
   * @param onProgress 进度回调，参数为 0 ~ 1；FFmpeg 路径不报告进度
   * @returns GIF 文件内容
   */
  convert(source: ArrayBuffer, method?: GifMethod, onProgress?: (ratio: number) => void): Promise<ArrayBuffer> {
    const entry = this.methods[method ?? this.currentMethod];
    if (!entry) return Promise.reject(new Error('未找到 GIF 转码处理器'));
    return entry.convert(source, onProgress);
  }
};
