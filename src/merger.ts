import { LEARNING_DISCLAIMER } from './config.ts';
import { Diagnostics } from './diagnostics.ts';
import type { Metadata } from './types.ts';

export const JSMerger = {
  name: 'JS原生合并',
  status: 'ready' as string,

  readBox(buffer: ArrayBuffer, offset: number) {
    const view = new DataView(buffer);
    if (offset + 8 > buffer.byteLength) return null;
    let size = view.getUint32(offset);
    const type = String.fromCharCode(view.getUint8(offset+4), view.getUint8(offset+5), view.getUint8(offset+6), view.getUint8(offset+7));
    let headerSize = 8;
    if (size === 1 && offset + 16 <= buffer.byteLength) { size = Number(view.getBigUint64(offset + 8)); headerSize = 16; }
    else if (size === 0) { size = buffer.byteLength - offset; }
    return { size, type, headerSize, offset };
  },

  parseBoxes(buffer: ArrayBuffer) {
    const boxes: any[] = [];
    let offset = 0;
    while (offset < buffer.byteLength) {
      const box = this.readBox(buffer, offset);
      if (!box || box.size < 8) break;
      boxes.push({ size: box.size, type: box.type, headerSize: box.headerSize, offset: box.offset, data: new Uint8Array(buffer, offset, box.size) });
      offset += box.size;
    }
    return boxes;
  },

  findBox(boxes: any[], type: string) { return boxes.find(b => b.type === type) || null; },
  findAllBoxes(boxes: any[], type: string) { return boxes.filter(b => b.type === type); },

  parseContainerBox(boxData: Uint8Array, headerOffset = 8): any[] {
    const childBoxes: any[] = [];
    let offset = headerOffset;
    while (offset < boxData.length) {
      if (offset + 8 > boxData.length) break;
      const view = new DataView(boxData.buffer, boxData.byteOffset + offset);
      let size = view.getUint32(0);
      const type = String.fromCharCode(boxData[offset+4], boxData[offset+5], boxData[offset+6], boxData[offset+7]);
      if (size === 0) size = boxData.length - offset;
      if (size < 8 || offset + size > boxData.length) break;
      childBoxes.push({ size, type, offset, data: boxData.slice(offset, offset + size) });
      offset += size;
    }
    return childBoxes;
  },

  createBox(type: string, content: Uint8Array): Uint8Array {
    const size = 8 + content.length;
    const box = new Uint8Array(size);
    new DataView(box.buffer).setUint32(0, size);
    box[4] = type.charCodeAt(0); box[5] = type.charCodeAt(1); box[6] = type.charCodeAt(2); box[7] = type.charCodeAt(3);
    box.set(content, 8);
    return box;
  },

  concat(...arrays: Uint8Array[]): Uint8Array {
    const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const a of arrays) { result.set(a, offset); offset += a.length; }
    return result;
  },

  toArrayBuffer(data: Uint8Array): ArrayBuffer {
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    return buffer;
  },

  modifyTrackId(trakData: Uint8Array, newId: number): Uint8Array {
    const result = new Uint8Array(trakData);
    for (const box of this.parseContainerBox(result)) {
      if (box.type === 'tkhd') {
        const version = result[box.offset + 8];
        const trackIdOffset = box.offset + 8 + (version === 0 ? 12 : 20);
        new DataView(result.buffer, result.byteOffset + trackIdOffset).setUint32(0, newId);
      }
    }
    return result;
  },

  modifyTrexTrackId(trexData: Uint8Array, newId: number): Uint8Array {
    const result = new Uint8Array(trexData);
    new DataView(result.buffer, result.byteOffset + 12).setUint32(0, newId);
    return result;
  },

  getTrackType(trakData: Uint8Array): string | null {
    for (const box of this.parseContainerBox(trakData)) {
      if (box.type === 'mdia') {
        for (const mdiaBox of this.parseContainerBox(box.data)) {
          if (mdiaBox.type === 'hdlr') {
            return String.fromCharCode(mdiaBox.data[16], mdiaBox.data[17], mdiaBox.data[18], mdiaBox.data[19]);
          }
        }
      }
    }
    return null;
  },

  buildMvex(videoMvex: any, audioMvex: any): Uint8Array | null {
    const mvexParts: Uint8Array[] = [];
    if (videoMvex) {
      for (const box of this.parseContainerBox(videoMvex.data)) {
        if (box.type === 'trex') mvexParts.push(this.modifyTrexTrackId(box.data, 1));
        else if (box.type === 'mehd') mvexParts.push(box.data);
      }
    }
    if (audioMvex) {
      for (const box of this.parseContainerBox(audioMvex.data)) {
        if (box.type === 'trex') mvexParts.push(this.modifyTrexTrackId(box.data, 2));
      }
    }
    if (mvexParts.length > 0) return this.createBox('mvex', this.concat(...mvexParts));
    return null;
  },

  buildUdta(metadata: Metadata): Uint8Array {
    const encoder = new TextEncoder();
    const buildDataBox = (value: string): Uint8Array | null => {
      if (!value) return null;
      const valueBytes = encoder.encode(value);
      const payload = new Uint8Array(8 + valueBytes.length);
      const view = new DataView(payload.buffer);
      view.setUint32(0, 1); view.setUint32(4, 0);
      payload.set(valueBytes, 8);
      return this.createBox('data', payload);
    };
    const buildMetaTag = (tag: string, value: string): Uint8Array => {
      if (!value) return new Uint8Array(0);
      const dataBox = buildDataBox(value);
      if (!dataBox) return new Uint8Array(0);
      return this.createBox(tag, dataBox);
    };
    const commentText = metadata.description ? (metadata.description + '\n\n' + LEARNING_DISCLAIMER) : LEARNING_DISCLAIMER;
    const ilstContent = this.concat(
      buildMetaTag('\xa9nam', metadata.title),
      buildMetaTag('\xa9ART', metadata.author),
      buildMetaTag('\xa9alb', 'Bilibili'),
      buildMetaTag('\xa9day', new Date().getFullYear().toString()),
      buildMetaTag('\xa9cmt', commentText),
      buildMetaTag('\xa9too', 'Bilibili Video Downloader')
    );
    const ilstBox = this.createBox('ilst', ilstContent);
    const hdlrContent = new Uint8Array(24);
    const hdlrView = new DataView(hdlrContent.buffer);
    hdlrView.setUint32(0, 0); hdlrView.setUint32(4, 0);
    hdlrContent.set([0x6d,0x64,0x69,0x72], 8); hdlrContent.set([0x61,0x70,0x70,0x6c], 12);
    hdlrView.setUint32(16, 0); hdlrView.setUint32(20, 0);
    const hdlrBox = this.createBox('hdlr', hdlrContent);
    const metaContent = this.concat(new Uint8Array([0,0,0,0]), hdlrBox, ilstBox);
    return this.createBox('udta', this.createBox('meta', metaContent));
  },

  buildMoov(videoMoov: any, audioMoov: any, metadata: Metadata): Uint8Array {
    const videoMoovBoxes = this.parseContainerBox(videoMoov.data);
    const audioMoovBoxes = this.parseContainerBox(audioMoov.data);
    const mvhd = this.findBox(videoMoovBoxes, 'mvhd');
    if (!mvhd) throw new Error('找不到mvhd box');
    const videoTrak = videoMoovBoxes.find(b => b.type === 'trak' && this.getTrackType(b.data) === 'vide') || null;
    const audioTrak = audioMoovBoxes.find(b => b.type === 'trak' && this.getTrackType(b.data) === 'soun') || null;
    if (!videoTrak) throw new Error('找不到视频轨道');
    const videoTrakData = this.modifyTrackId(videoTrak.data, 1);
    const audioTrakData = audioTrak ? this.modifyTrackId(audioTrak.data, 2) : null;
    const mvhdData = new Uint8Array(mvhd.data);
    const mvhdVersion = mvhdData[8];
    const nextTrackIdOffset = mvhdVersion === 0 ? 8 + 96 : 8 + 108;
    new DataView(mvhdData.buffer, mvhdData.byteOffset + nextTrackIdOffset - 4).setUint32(0, audioTrakData ? 3 : 2);
    const videoMvex = this.findBox(videoMoovBoxes, 'mvex');
    const audioMvex = this.findBox(audioMoovBoxes, 'mvex');
    const mvexData = (videoMvex || audioMvex) ? this.buildMvex(videoMvex, audioMvex) : null;
    const udtaContent = this.buildUdta(metadata);
    const moovParts: Uint8Array[] = [mvhdData, videoTrakData];
    if (audioTrakData) moovParts.push(audioTrakData);
    if (mvexData) moovParts.push(mvexData);
    moovParts.push(udtaContent);
    return this.createBox('moov', this.concat(...moovParts));
  },

  modifyMoofTrackId(moofData: Uint8Array, newId: number): Uint8Array {
    const result = new Uint8Array(moofData);
    for (const box of this.parseContainerBox(result)) {
      if (box.type === 'traf') {
        for (const trafBox of this.parseContainerBox(box.data)) {
          if (trafBox.type === 'tfhd') {
            new DataView(result.buffer, result.byteOffset + box.offset + trafBox.offset + 12).setUint32(0, newId);
          }
        }
      }
    }
    return result;
  },

  merge(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, metadata: Metadata): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      try {
        const videoBoxes = this.parseBoxes(videoBuffer);
        const audioBoxes = this.parseBoxes(audioBuffer);
        const videoFtyp = this.findBox(videoBoxes, 'ftyp');
        const videoMoov = this.findBox(videoBoxes, 'moov');
        const videoMdat = this.findAllBoxes(videoBoxes, 'mdat');
        const videoMoof = this.findAllBoxes(videoBoxes, 'moof');
        const audioMoov = this.findBox(audioBoxes, 'moov');
        const audioMdat = this.findAllBoxes(audioBoxes, 'mdat');
        const audioMoof = this.findAllBoxes(audioBoxes, 'moof');
        if (!videoFtyp || !videoMoov) throw new Error('视频文件结构不完整');
        const isFragmented = videoMoof.length > 0 || audioMoof.length > 0;
        if (isFragmented) {
          const parts: Uint8Array[] = [videoFtyp.data];
          parts.push(audioMoov ? this.buildMoov(videoMoov, audioMoov, metadata) : videoMoov.data);
          for (let i = 0; i < videoMoof.length; i++) {
            parts.push(videoMoof[i].data);
            if (videoMdat[i]) parts.push(videoMdat[i].data);
          }
          for (let j = 0; j < audioMoof.length; j++) {
            parts.push(this.modifyMoofTrackId(audioMoof[j].data, 2));
            if (audioMdat[j]) parts.push(audioMdat[j].data);
          }
          resolve(this.toArrayBuffer(this.concat(...parts)));
        } else {
          const mergedMoov = audioMoov ? this.buildMoov(videoMoov, audioMoov, metadata) : videoMoov.data;
          const allMdat = [...videoMdat, ...audioMdat].map((m: any) => m.data.slice(8));
          const mdatContent = this.concat(...allMdat);
          const mergedMdat = this.createBox('mdat', mdatContent);
          resolve(this.toArrayBuffer(this.concat(videoFtyp.data, mergedMoov, mergedMdat)));
        }
      } catch (error) {
        console.error('JS合并失败:', error);
        reject(error);
      }
    });
  }
};

declare const FFmpeg: any;
declare const unsafeWindow: any;
declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  responseType?: string;
  onload?: (res: any) => void;
  onerror?: () => void;
  ontimeout?: () => void;
}): void;

// 使用 @ffmpeg/core-st (single-threaded) 核心，编译时未启用 pthreads，
// 无 SharedArrayBuffer / 跨源隔离依赖，可在 Bilibili 等未设置 COOP/COEP 的宿主页面运行。
// 配合 @ffmpeg/ffmpeg@0.11.6 loader 的 mainName: 'main' 选项，
// 让 loader 调 wasm 导出的 'main' 而不是默认的 'proxy_main'（proxy_main 只存在于多线程核心）。
// 注意：宿主页面（如 Bilibili）的 CSP 会拦截 unpkg 的直接 script/wasm 加载，
// 所以通过 GM_xmlhttpRequest 拉成 blob URL 再交给 createFFmpeg。
const FFMPEG_CORE_JS = 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.js';
const FFMPEG_CORE_WASM = 'https://unpkg.com/@ffmpeg/core-st@0.11.1/dist/ffmpeg-core.wasm';

// loader 走 CDNJS：Bilibili 的 CSP 白名单包含该域名。
const FFMPEG_LOADER_JS = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js';

/**
 * 取 FFmpeg 全局对象。
 *
 * 脚本注入到页面上下文时全局挂在 unsafeWindow 上，取到后同步到沙箱全局，
 * 让 `declare const FFmpeg` 的直接引用也能命中。
 *
 * @returns FFmpeg 命名空间，未加载时为 null
 */
export function getFFmpegGlobal(): any {
  if (typeof FFmpeg !== 'undefined') return FFmpeg;
  if (typeof unsafeWindow !== 'undefined' && unsafeWindow.FFmpeg) {
    (globalThis as any).FFmpeg = unsafeWindow.FFmpeg;
    return unsafeWindow.FFmpeg;
  }
  return null;
}

let loaderPromise: Promise<void> | null = null;

/**
 * 注入 FFmpeg loader 脚本，已加载则直接返回。
 *
 * @returns 全局对象可用时兑现
 */
export function loadFFmpegLoader(): Promise<void> {
  if (getFFmpegGlobal()) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  Diagnostics.info('ffmpeg', '开始加载 FFmpeg (0.11.6 loader / core-st)');
  loaderPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = FFMPEG_LOADER_JS;
    script.async = true;
    script.onload = () => {
      if (getFFmpegGlobal()) {
        Diagnostics.info('ffmpeg', 'FFmpeg 脚本加载完成');
        resolve();
      } else {
        Diagnostics.error('ffmpeg', 'FFmpeg 脚本已加载但全局对象不可用');
        reject(new Error('FFmpeg 加载后不可用'));
      }
    };
    script.onerror = () => {
      Diagnostics.error('ffmpeg', 'FFmpeg 脚本加载失败（网络或 CDN 被拦截）');
      reject(new Error('FFmpeg 加载失败'));
    };
    (document.head || document.documentElement).appendChild(script);
  }).catch(err => {
    loaderPromise = null;
    throw err;
  });

  return loaderPromise;
}

function fetchAsBlobUrl(url: string, mime: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest !== 'function') {
      reject(new Error('GM_xmlhttpRequest 不可用'));
      return;
    }
    GM_xmlhttpRequest({
      method: 'GET',
      url,
      responseType: 'blob',
      onload(res) {
        if (res.status >= 200 && res.status < 300) {
          const blob = res.response instanceof Blob ? res.response : new Blob([res.response], { type: mime });
          const typed = blob.type ? blob : new Blob([blob], { type: mime });
          resolve(URL.createObjectURL(typed));
        } else {
          reject(new Error(`HTTP ${res.status} @ ${url}`));
        }
      },
      onerror() { reject(new Error(`网络错误 @ ${url}`)); },
      ontimeout() { reject(new Error(`超时 @ ${url}`)); }
    });
  });
}

let corePathPromise: Promise<string> | null = null;
function prepareCorePath(): Promise<string> {
  if (corePathPromise) return corePathPromise;
  corePathPromise = Promise.all([
    fetchAsBlobUrl(FFMPEG_CORE_WASM, 'application/wasm')
  ]).then(([wasmBlobUrl]) => {
    // 用 blob URL 替换 core JS 里对 ffmpeg-core.wasm 的引用，然后把改写后的 JS 也做成 blob URL
    return fetchAsBlobUrl(FFMPEG_CORE_JS, 'text/javascript').then(coreJsBlobUrl => {
      // 直接返回 JS blob URL 即可；core JS 会用 fetch 拉 wasm，
      // 但它内部通过相对路径 'ffmpeg-core.wasm' 计算 wasm URL，
      // 相对于 blob URL 计算会失败，所以需要文本改写。
      return fetch(coreJsBlobUrl).then(r => r.text()).then(coreJsText => {
        URL.revokeObjectURL(coreJsBlobUrl);
        const patched = coreJsText.replace(/ffmpeg-core\.wasm/g, wasmBlobUrl);
        const patchedBlob = new Blob([patched], { type: 'text/javascript' });
        return URL.createObjectURL(patchedBlob);
      });
    });
  }).catch(err => {
    corePathPromise = null;
    throw err;
  });
  return corePathPromise;
}

/** 新建并加载一个 ffmpeg 实例。核心 JS / wasm 已缓存，重复加载只是重新编译。 */
function createInstance(): Promise<any> {
  return loadFFmpegLoader().then(() => prepareCorePath()).then(corePath => {
    const ns = getFFmpegGlobal();
    if (!ns) throw new Error('FFmpeg未加载');
    const instance = ns.createFFmpeg({ log: false, corePath, mainName: 'main' });
    return instance.load().then(() => instance);
  });
}

/** 写入虚拟文件系统的输入文件。 */
interface VfsFile {
  name: string;
  data: Uint8Array;
}

/**
 * 用一个全新实例跑一条 ffmpeg 命令并取回产物。
 *
 * core-st 的运行时在 main() 返回后即退出，一个实例只能跑一条命令：第二条会抛
 * ExitStatus(0) 并把 loader 的 running 标志永久置位。故实例用后即弃，
 * owner.ffmpeg 上由 init() 预热出的那一个在首次调用时被消费。
 *
 * @param owner 持有预热实例的对象，实例被取走后该字段置空
 * @param inputs 命令执行前写入的输入文件
 * @param argv ffmpeg 参数，不含程序名
 * @param outFile 产物在虚拟文件系统中的路径
 * @returns 产物内容
 */
function runOnce(owner: { ffmpeg: any }, inputs: VfsFile[], argv: string[], outFile: string): Promise<Uint8Array> {
  const prepared = owner.ffmpeg && owner.ffmpeg.isLoaded()
    ? Promise.resolve(owner.ffmpeg)
    : createInstance();
  owner.ffmpeg = null;

  return prepared.then(instance => {
    inputs.forEach(file => instance.FS('writeFile', file.name, file.data));
    return instance.run(...argv)
      .catch((e: any) => {
        // 产物已写出、运行时以 exit(0) 收尾时 loader 仍会抛，按成功处理
        if (e && e.name === 'ExitStatus' && e.status === 0) return;
        throw e;
      })
      .then(() => instance.FS('readFile', outFile) as Uint8Array);
  });
}

export const FFmpegMerger = {
  name: 'FFmpeg合并',
  status: 'loading' as string,
  unavailableReason: '' as string,
  ffmpeg: null as any,

  isEnvSupported(): boolean {
    return true;
  },

  getUnavailableReason(): string {
    return this.unavailableReason;
  },

  init(): Promise<boolean> {
    if (this.ffmpeg && this.ffmpeg.isLoaded()) {
      this.status = 'ready';
      return Promise.resolve(true);
    }
    this.status = 'loading';
    return createInstance().then(instance => {
      this.ffmpeg = instance;
      this.status = 'ready';
      return true;
    }).catch((e: any) => {
      this.status = 'error';
      this.unavailableReason = e?.message || String(e);
      throw e;
    });
  },

  merge(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, metadata: { title?: string; author?: string }): Promise<ArrayBuffer> {
    return this.init().then(() => runOnce(
      this,
      [{ name: 'video.mp4', data: new Uint8Array(videoBuffer) }, { name: 'audio.m4a', data: new Uint8Array(audioBuffer) }],
      ['-i','video.mp4','-i','audio.m4a','-c','copy','-map','0:v:0','-map','1:a:0',
        '-metadata','title='+(metadata.title||''),'-metadata','artist='+(metadata.author||''),
        '-metadata','comment='+LEARNING_DISCLAIMER,'output.mp4'],
      'output.mp4'
    )).then(data => data.buffer as ArrayBuffer);
  }
};

/** 转 GIF 的可选参数。 */
export interface GifOptions {
  /** 输出帧率，缺省 15。 */
  fps?: number;
  /** 输出宽度上限，源更窄时保持原宽，缺省 640。 */
  maxWidth?: number;
}

export const GifConverter = {
  /**
   * 把视频转成 GIF。
   *
   * 走 palettegen / paletteuse 两遍法：GIF 每帧限 256 色，由整段画面统计出的
   * 调色板比编码器的默认调色板少很多色带。两遍是两条独立命令，各占一个实例。
   *
   * @param source 视频内容，需为 ffmpeg 能解的封装（X 的 GIF 为 mp4）
   * @param options 帧率与宽度上限
   * @returns GIF 文件内容
   */
  convert(source: ArrayBuffer, options: GifOptions = {}): Promise<ArrayBuffer> {
    const fps = options.fps ?? 15;
    const maxWidth = options.maxWidth ?? 640;
    // min() 的逗号需转义，否则会被当成滤镜链的分隔符
    const scale = `fps=${fps},scale=min(${maxWidth}\\,iw):-1:flags=lanczos`;
    const input = new Uint8Array(source);

    return FFmpegMerger.init()
      .then(() => runOnce(FFmpegMerger, [{ name: 'in.mp4', data: input }],
        ['-i', 'in.mp4', '-vf', `${scale},palettegen=max_colors=256`, 'pal.png'], 'pal.png'))
      .then(palette => runOnce(FFmpegMerger,
        [{ name: 'in.mp4', data: input }, { name: 'pal.png', data: palette }],
        ['-i', 'in.mp4', '-i', 'pal.png', '-filter_complex',
          `${scale}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, '-loop', '0', 'out.gif'],
        'out.gif'))
      .then(data => data.buffer as ArrayBuffer);
  }
};
