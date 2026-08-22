/**
 * 最小 ZIP 打包器，仅支持 store（不压缩）方式。
 *
 * 打包对象是图片与视频，本身已是压缩格式，deflate 收益接近零，
 * 因此省去压缩实现，只拼装 ZIP 容器结构。
 *
 * 不支持 zip64，单个文件与整包均不得超过 4GB。
 */

/** ZIP 条目：文件名与其原始字节。 */
export interface ZipEntry {
  /** 包内路径，使用 / 分隔，不得以 / 开头。 */
  name: string;
  data: Uint8Array<ArrayBuffer>;
}

/** 单文件与整包的体积上限，超出需要 zip64。 */
const ZIP32_LIMIT = 0xffffffff;

let crcTable: Uint32Array | null = null;

/** 构建 CRC-32 查表（IEEE 802.3 反射多项式 0xEDB88320）。 */
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/**
 * 计算字节序列的 CRC-32。
 *
 * @param data 待校验的字节
 * @returns 无符号 32 位校验值
 */
export function crc32(data: Uint8Array): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP 使用的 MS-DOS 时间戳，精度 2 秒，年份自 1980 起算。 */
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

/**
 * 归一化包内路径。
 *
 * 去掉盘符、开头的斜杠与 .. 段，避免解压时写到目标目录之外。
 *
 * @param name 原始文件名
 * @returns 可安全写入 ZIP 的相对路径
 */
function normalizeName(name: string): string {
  const parts = name.replace(/\\/g, '/').split('/')
    .filter(seg => seg && seg !== '.' && seg !== '..');
  return parts.join('/') || 'file';
}

/** 为重名条目追加 _2、_3 等序号，解压时不会互相覆盖。 */
function dedupe(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map(name => {
    const lower = name.toLowerCase();
    const hit = seen.get(lower);
    if (hit === undefined) {
      seen.set(lower, 1);
      return name;
    }
    seen.set(lower, hit + 1);
    const dot = name.lastIndexOf('.');
    return dot > 0
      ? `${name.slice(0, dot)}_${hit + 1}${name.slice(dot)}`
      : `${name}_${hit + 1}`;
  });
}

/** 一个条目在写入 local header 时确定、生成中央目录时复用的信息。 */
interface ZipRecord {
  nameBytes: Uint8Array<ArrayBuffer>;
  crc: number;
  size: number;
  offset: number;
}

/** 30 字节的 local file header，紧跟文件名与原始数据。 */
function localHeader(record: ZipRecord, dos: { time: number; date: number }): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(30 + record.nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  // bit 11：文件名按 UTF-8 编码，中文标题才能在解压端正确显示
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, dos.time, true);
  view.setUint16(12, dos.date, true);
  view.setUint32(14, record.crc, true);
  view.setUint32(18, record.size, true);
  view.setUint32(22, record.size, true);
  view.setUint16(26, record.nameBytes.length, true);
  view.setUint16(28, 0, true);
  buf.set(record.nameBytes, 30);
  return buf;
}

/** 46 字节的中央目录条目，紧跟文件名。 */
function centralHeader(record: ZipRecord, dos: { time: number; date: number }): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(46 + record.nameBytes.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, dos.time, true);
  view.setUint16(14, dos.date, true);
  view.setUint32(16, record.crc, true);
  view.setUint32(20, record.size, true);
  view.setUint32(24, record.size, true);
  view.setUint16(28, record.nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, record.offset, true);
  buf.set(record.nameBytes, 46);
  return buf;
}

/** 22 字节的 end of central directory 记录，无注释。 */
function endOfCentralDirectory(count: number, cdSize: number, cdOffset: number): Uint8Array<ArrayBuffer> {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdOffset, true);
  view.setUint16(20, 0, true);
  return buf;
}

/**
 * 把多个文件打成一个 store 方式的 ZIP。
 *
 * @param entries 待打包的条目，重名会自动追加序号
 * @param modified 条目的修改时间，缺省为当前时间
 * @returns ZIP 内容，类型为 application/zip
 * @throws 单个文件或整包超过 4GB 时抛出，此时需要 zip64
 */
export function createZip(entries: ZipEntry[], modified: Date = new Date()): Blob {
  const dos = dosDateTime(modified);
  const encoder = new TextEncoder();
  const names = dedupe(entries.map(entry => normalizeName(entry.name)));

  const parts: BlobPart[] = [];
  const records: ZipRecord[] = [];
  let offset = 0;

  entries.forEach((entry, index) => {
    if (entry.data.length > ZIP32_LIMIT) {
      throw new Error(`${names[index]} 超过 4GB，无法打包`);
    }
    const record: ZipRecord = {
      nameBytes: encoder.encode(names[index]),
      crc: crc32(entry.data),
      size: entry.data.length,
      offset
    };
    const header = localHeader(record, dos);
    parts.push(header, entry.data);
    offset += header.length + record.size;
    if (offset > ZIP32_LIMIT) throw new Error('打包体积超过 4GB，请减少选中项');
    records.push(record);
  });

  const cdOffset = offset;
  let cdSize = 0;
  for (const record of records) {
    const header = centralHeader(record, dos);
    parts.push(header);
    cdSize += header.length;
  }
  parts.push(endOfCentralDirectory(records.length, cdSize, cdOffset));

  return new Blob(parts, { type: 'application/zip' });
}
