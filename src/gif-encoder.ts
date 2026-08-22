/**
 * 不依赖外部库的 GIF 编码器。
 *
 * 解码交给浏览器：把源视频塞进一个游离的 video 元素，逐帧 seek 并画到 canvas
 * 取像素；编码部分（调色板量化、有序抖动、LZW、GIF89a 容器）在本文件内实现。
 *
 * 与 FFmpeg 路径的取舍：无需下载 wasm 核心，首次转换快且不受 CDN 拦截影响；
 * 代价是只能解浏览器支持的封装，且调色板由抽样帧统计得出，不如 palettegen 精确。
 */

/** 全局调色板的颜色数上限，GIF 单帧索引为 8 位。 */
const PALETTE_SIZE = 256;

/** 统计与查表使用的量化位深，每通道 5 位共 32768 格。 */
const HIST_BITS = 5;

/** 直方图格数。 */
const HIST_SIZE = 1 << (HIST_BITS * 3);

/** 参与调色板统计的抽样帧数上限。 */
const PALETTE_SAMPLES = 24;

/** 输出帧数上限，超出部分截断，避免产出过大的文件。 */
const MAX_FRAMES = 240;

/** 单帧 seek 的等待上限，毫秒。 */
const SEEK_TIMEOUT = 8000;

/**
 * 4×4 Bayer 抖动矩阵，值域 0 ~ 15。
 *
 * 与 FFmpeg 路径的 `dither=bayer` 同族，避免两条路径的观感差异过大。
 */
const BAYER_4X4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
];

/** 抖动幅度，按 8 位色阶计。取值接近 256 色调色板的平均量化步长。 */
const DITHER_STRENGTH = 18;

/** JS 编码器的可选参数。 */
export interface JsGifOptions {
  /** 输出帧率，缺省 12。 */
  fps?: number;
  /** 输出宽度上限，源更窄时保持原宽，缺省 480。 */
  maxWidth?: number;
  /** 转换进度回调，参数为 0 ~ 1。 */
  onProgress?: (ratio: number) => void;
}

/** 自动扩容的字节缓冲，用于拼装 GIF 数据流。 */
class ByteWriter {
  private buffer = new Uint8Array(1 << 16);
  private length = 0;

  private ensure(extra: number): void {
    if (this.length + extra <= this.buffer.length) return;
    let size = this.buffer.length * 2;
    while (size < this.length + extra) size *= 2;
    const grown = new Uint8Array(size);
    grown.set(this.buffer.subarray(0, this.length));
    this.buffer = grown;
  }

  byte(value: number): void {
    this.ensure(1);
    this.buffer[this.length++] = value & 0xff;
  }

  /** 小端 16 位整数，GIF 的所有多字节字段均为小端。 */
  short(value: number): void {
    this.byte(value);
    this.byte(value >> 8);
  }

  bytes(values: ArrayLike<number>): void {
    this.ensure(values.length);
    this.buffer.set(values as Uint8Array, this.length);
    this.length += values.length;
  }

  /** 按 ASCII 写入字符串，仅用于固定的签名与扩展标识。 */
  ascii(text: string): void {
    for (let i = 0; i < text.length; i++) this.byte(text.charCodeAt(i));
  }

  toUint8Array(): Uint8Array {
    return this.buffer.slice(0, this.length);
  }
}

/** LZW 字典容量，码长 12 位。 */
const LZW_MAX_CODES = 1 << 12;

/**
 * 按 GIF 的变长 LZW 压缩一帧索引数据，并切成不超过 255 字节的子块写出。
 *
 * 与通用 LZW 的差异：码长从 minCodeSize + 1 起随字典增长，字典满时发 clear 码
 * 重置而非停止扩张；位序为低位在前。
 *
 * @param out 目标缓冲，写入 minCodeSize、各子块与结束的 0 字节
 * @param indices 每像素一个调色板索引，按从左到右、从上到下排列
 * @param minCodeSize 索引位宽，本文件固定 8
 */
function writeLzw(out: ByteWriter, indices: Uint8Array, minCodeSize: number): void {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  // 键为 前缀码 * 256 + 后继字节，存 码 + 1，0 表示该组合未出现
  const dict = new Int32Array(LZW_MAX_CODES * 256);
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;

  const block: number[] = [];
  let bitBuffer = 0;
  let bitCount = 0;

  const flushBlock = (): void => {
    if (!block.length) return;
    out.byte(block.length);
    out.bytes(block);
    block.length = 0;
  };

  const emit = (code: number): void => {
    bitBuffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      block.push(bitBuffer & 0xff);
      bitBuffer >>= 8;
      bitCount -= 8;
      if (block.length === 255) flushBlock();
    }
  };

  out.byte(minCodeSize);
  emit(clearCode);

  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const next = indices[i];
    const key = prefix * 256 + next;
    const found = dict[key];
    if (found) {
      prefix = found - 1;
      continue;
    }
    emit(prefix);
    if (nextCode < LZW_MAX_CODES) {
      dict[key] = nextCode + 1;
      nextCode++;
      // 后续能发出的最大码是 nextCode - 1，它超出当前位宽时才加长；
      // 提前一个码加长会让解码端按旧位宽取位，整条流错位
      if (nextCode === (1 << codeSize) + 1 && codeSize < 12) codeSize++;
    } else {
      emit(clearCode);
      dict.fill(0);
      codeSize = minCodeSize + 1;
      nextCode = endCode + 1;
    }
    prefix = next;
  }

  emit(prefix);
  emit(endCode);
  if (bitCount > 0) {
    block.push(bitBuffer & 0xff);
    if (block.length === 255) flushBlock();
  }
  flushBlock();
  out.byte(0);
}

/** 5 位量化值还原为 8 位，低位用高位补齐，使 31 映射到 255。 */
function expand5(value: number): number {
  return (value << 3) | (value >> 2);
}

/** 直方图下标转 5 位分量。 */
function keyToChannels(key: number): [number, number, number] {
  return [(key >> 10) & 31, (key >> 5) & 31, key & 31];
}

/** 中位切分时的一个色块。 */
interface ColorBox {
  /** 落在该块内的直方图下标。 */
  keys: number[];
  /** 块内像素总数。 */
  count: number;
}

/**
 * 用中位切分（median cut）从直方图算出全局调色板。
 *
 * 每次取像素数最多的块，沿分量跨度最大的轴按像素数中位处切开，直到块数达到
 * 上限或无块可切；每块取其内部颜色按像素数加权的均值作为调色板颜色。
 *
 * @param histogram 长度为 HIST_SIZE 的计数表，下标为 5-5-5 量化色
 * @returns RGB 三元组连续排列的调色板，长度为 PALETTE_SIZE * 3
 */
function buildPalette(histogram: Uint32Array): Uint8Array {
  const keys: number[] = [];
  let total = 0;
  for (let key = 0; key < HIST_SIZE; key++) {
    const count = histogram[key];
    if (!count) continue;
    keys.push(key);
    total += count;
  }

  const boxes: ColorBox[] = [{ keys, count: total }];
  while (boxes.length < PALETTE_SIZE) {
    let target = -1;
    let best = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].keys.length > 1 && boxes[i].count > best) {
        best = boxes[i].count;
        target = i;
      }
    }
    if (target < 0) break;
    const parts = splitBox(boxes[target], histogram);
    if (!parts) break;
    boxes.splice(target, 1, parts[0], parts[1]);
  }

  const palette = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < boxes.length; i++) {
    const [r, g, b] = averageColor(boxes[i], histogram);
    palette[i * 3] = r;
    palette[i * 3 + 1] = g;
    palette[i * 3 + 2] = b;
  }
  // 颜色数不足 256 时余下的表项复制首色。留成全黑会让近黑像素被吸到纯黑上。
  for (let i = boxes.length; i < PALETTE_SIZE; i++) {
    palette[i * 3] = palette[0];
    palette[i * 3 + 1] = palette[1];
    palette[i * 3 + 2] = palette[2];
  }
  return palette;
}

/**
 * 沿跨度最大的分量把色块切成两半。
 *
 * @returns 切分后的两块；块内颜色全都落在同一侧无法切开时返回 null
 */
function splitBox(box: ColorBox, histogram: Uint32Array): [ColorBox, ColorBox] | null {
  const min = [31, 31, 31];
  const max = [0, 0, 0];
  for (const key of box.keys) {
    const channels = keyToChannels(key);
    for (let c = 0; c < 3; c++) {
      if (channels[c] < min[c]) min[c] = channels[c];
      if (channels[c] > max[c]) max[c] = channels[c];
    }
  }
  let axis = 0;
  for (let c = 1; c < 3; c++) {
    if (max[c] - min[c] > max[axis] - min[axis]) axis = c;
  }
  if (max[axis] === min[axis]) return null;

  const shift = axis === 0 ? 10 : axis === 1 ? 5 : 0;
  const sorted = box.keys.slice().sort((a, b) => ((a >> shift) & 31) - ((b >> shift) & 31));

  const half = box.count / 2;
  let taken = 0;
  let cut = 0;
  while (cut < sorted.length - 1 && taken < half) {
    taken += histogram[sorted[cut]];
    cut++;
  }

  const left = sorted.slice(0, cut);
  const right = sorted.slice(cut);
  if (!left.length || !right.length) return null;
  return [
    { keys: left, count: taken },
    { keys: right, count: box.count - taken }
  ];
}

/** 色块内颜色按像素数加权的均值，返回 8 位 RGB。 */
function averageColor(box: ColorBox, histogram: Uint32Array): [number, number, number] {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (const key of box.keys) {
    const weight = histogram[key];
    const channels = keyToChannels(key);
    r += expand5(channels[0]) * weight;
    g += expand5(channels[1]) * weight;
    b += expand5(channels[2]) * weight;
    count += weight;
  }
  if (!count) return [0, 0, 0];
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

/**
 * 把一帧 RGBA 像素映射为调色板索引。
 *
 * 先按 Bayer 矩阵给每个通道加一个位置相关的偏移，再取最近的调色板颜色，
 * 用平坦渐变上的有序噪点换取色带的消除。查表结果按 5 位量化色缓存，
 * 同一色只做一次最近色搜索。
 *
 * @param rgba canvas 取到的像素，四通道
 * @param width 帧宽，用于还原像素坐标
 * @param palette 全局调色板
 * @param cache 长度为 HIST_SIZE 的缓存，元素为 -1 表示未命中
 * @returns 每像素一个索引
 */
function mapToIndices(rgba: Uint8ClampedArray, width: number, palette: Uint8Array, cache: Int16Array): Uint8Array {
  const pixels = rgba.length >> 2;
  const indices = new Uint8Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const x = i % width;
    const y = (i - x) / width;
    const bias = (BAYER_4X4[(y & 3) * 4 + (x & 3)] / 15 - 0.5) * DITHER_STRENGTH;
    const r = clamp255(rgba[i * 4] + bias);
    const g = clamp255(rgba[i * 4 + 1] + bias);
    const b = clamp255(rgba[i * 4 + 2] + bias);
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let index = cache[key];
    if (index < 0) {
      index = nearestColor(palette, r, g, b);
      cache[key] = index;
    }
    indices[i] = index;
  }
  return indices;
}

/** 夹到 0 ~ 255 并取整。 */
function clamp255(value: number): number {
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return value | 0;
}

/** 在调色板中线性搜索欧氏距离最近的颜色，返回其索引。 */
function nearestColor(palette: Uint8Array, r: number, g: number, b: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const dr = r - palette[i * 3];
    const dg = g - palette[i * 3 + 1];
    const db = b - palette[i * 3 + 2];
    const distance = dr * dr + dg * dg + db * db;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * 写入 GIF89a 文件头：签名、逻辑屏幕描述、全局调色板与循环扩展。
 *
 * @param out 目标缓冲
 * @param width 画面宽
 * @param height 画面高
 * @param palette 全局调色板，固定 256 项
 */
function writeHeader(out: ByteWriter, width: number, height: number, palette: Uint8Array): void {
  out.ascii('GIF89a');
  out.short(width);
  out.short(height);
  // 有全局调色板(0x80) | 色深 8 位(0x70) | 表长 2^8(0x07)
  out.byte(0xf7);
  out.byte(0);
  out.byte(0);
  out.bytes(palette);
  // Netscape 应用扩展，循环次数 0 表示无限循环
  out.byte(0x21);
  out.byte(0xff);
  out.byte(0x0b);
  out.ascii('NETSCAPE2.0');
  out.byte(0x03);
  out.byte(0x01);
  out.short(0);
  out.byte(0);
}

/**
 * 写入一帧：图形控制扩展、图像描述符与 LZW 数据。
 *
 * @param out 目标缓冲
 * @param indices 该帧的调色板索引
 * @param width 画面宽
 * @param height 画面高
 * @param delay 帧延时，单位为 1/100 秒
 */
function writeFrame(out: ByteWriter, indices: Uint8Array, width: number, height: number, delay: number): void {
  out.byte(0x21);
  out.byte(0xf9);
  out.byte(0x04);
  // 处置方式 1（保留当前帧），无用户输入，无透明色
  out.byte(0x04);
  out.short(delay);
  out.byte(0);
  out.byte(0);

  out.byte(0x2c);
  out.short(0);
  out.short(0);
  out.short(width);
  out.short(height);
  // 无局部调色板、非交错
  out.byte(0);
  writeLzw(out, indices, 8);
}

/** 已挂载的取样用 video 及其释放函数。 */
interface LoadedVideo {
  video: HTMLVideoElement;
  release: () => void;
}

/**
 * 把视频字节挂到一个隐藏的 video 元素上，等到可以取帧为止。
 *
 * 元素需在文档内：部分浏览器不会为游离元素解码画面，drawImage 会得到空白。
 *
 * @param source 视频内容
 * @returns 已就绪的元素与释放函数
 */
function loadVideo(source: ArrayBuffer): Promise<LoadedVideo> {
  const url = URL.createObjectURL(new Blob([source], { type: 'video/mp4' }));
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';

  const release = (): void => {
    video.removeAttribute('src');
    video.load();
    video.remove();
    URL.revokeObjectURL(url);
  };

  return new Promise<LoadedVideo>((resolve, reject) => {
    const timer = setTimeout(() => {
      release();
      reject(new Error('视频解码超时'));
    }, SEEK_TIMEOUT);
    video.addEventListener('loadeddata', () => {
      clearTimeout(timer);
      resolve({ video, release });
    }, { once: true });
    video.addEventListener('error', () => {
      clearTimeout(timer);
      release();
      reject(new Error('浏览器无法解码该视频'));
    }, { once: true });
    video.src = url;
    (document.body || document.documentElement).appendChild(video);
  });
}

/**
 * 跳到指定时间点并等到该帧可取。
 *
 * 当前时间已在目标点时直接返回：重复赋同一个 currentTime 不保证触发 seeked。
 *
 * @param video 已就绪的元素
 * @param time 目标时间，单位秒
 */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 1e-3 && video.readyState >= 2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      video.removeEventListener('seeked', done);
    };
    const done = (): void => {
      cleanup();
      resolve();
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('取帧超时'));
    }, SEEK_TIMEOUT);
    video.addEventListener('seeked', done);
    video.currentTime = time;
  });
}

export const JsGifEncoder = {
  name: 'JS原生转码',

  /** 需要 canvas 取像素，无 DOM 的环境不可用。 */
  isEnvSupported(): boolean {
    return typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined';
  },

  /**
   * 把视频转成 GIF。
   *
   * 分两遍：先在若干抽样帧上统计颜色算出全局调色板，再逐帧量化编码。抽样而非
   * 全帧统计是为了避免把所有帧的像素同时留在内存里，编码时每次只持有一帧。
   *
   * @param source 视频内容，需为浏览器能解的封装
   * @param options 帧率、宽度上限与进度回调
   * @returns GIF 文件内容
   */
  async convert(source: ArrayBuffer, options: JsGifOptions = {}): Promise<ArrayBuffer> {
    const fps = Math.min(30, Math.max(2, options.fps ?? 12));
    // GIF 的延时以 1/100 秒为单位，取样间隔按取整后的延时算，两者才对得上
    const delay = Math.max(2, Math.round(100 / fps));
    const step = delay / 100;
    const maxWidth = options.maxWidth ?? 480;
    const report = options.onProgress ?? (() => { /* 调用方未关心进度 */ });

    const { video, release } = await loadVideo(source);
    try {
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) throw new Error('无法读取视频时长');
      const sourceWidth = video.videoWidth;
      const sourceHeight = video.videoHeight;
      if (!sourceWidth || !sourceHeight) throw new Error('无法读取视频尺寸');

      const width = Math.max(1, Math.min(maxWidth, sourceWidth));
      const height = Math.max(1, Math.round(sourceHeight * width / sourceWidth));
      const frameCount = Math.max(1, Math.min(MAX_FRAMES, Math.round(duration / step)));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('无法创建画布上下文');

      const grab = async (index: number): Promise<Uint8ClampedArray> => {
        await seekTo(video, Math.min(index * step, Math.max(0, duration - 1e-3)));
        ctx.drawImage(video, 0, 0, width, height);
        return ctx.getImageData(0, 0, width, height).data;
      };

      const histogram = new Uint32Array(HIST_SIZE);
      const samples = Math.min(PALETTE_SAMPLES, frameCount);
      for (let i = 0; i < samples; i++) {
        const index = samples === 1 ? 0 : Math.round(i * (frameCount - 1) / (samples - 1));
        const rgba = await grab(index);
        for (let p = 0; p < rgba.length; p += 4) {
          histogram[((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3)]++;
        }
        report(0.25 * (i + 1) / samples);
      }

      const palette = buildPalette(histogram);
      const cache = new Int16Array(HIST_SIZE).fill(-1);
      const out = new ByteWriter();
      writeHeader(out, width, height, palette);
      for (let frame = 0; frame < frameCount; frame++) {
        const rgba = await grab(frame);
        writeFrame(out, mapToIndices(rgba, width, palette, cache), width, height, delay);
        report(0.25 + 0.75 * (frame + 1) / frameCount);
      }
      out.byte(0x3b);
      return out.toUint8Array().buffer as ArrayBuffer;
    } finally {
      release();
    }
  }
};
