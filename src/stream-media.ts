import { CONFIG } from './config.ts';
import { httpUrl, mediaRequest } from './media-http.ts';
import { remuxLocalMedia } from './merger.ts';
import type { MediaProcessing } from './types.ts';

export interface Fragment { url: string; range?: [number, number]; }
interface LocalFile { name: string; data: Uint8Array; }
export interface DashTrack { kind: 'video' | 'audio'; fragments: Fragment[]; }
const MAX_FRAGMENTS = 4000;

export function hlsAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const text = line.slice(line.indexOf(':') + 1);
  const re = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
  let match;
  while ((match = re.exec(text))) attrs[match[1]] = match[2] ?? match[3];
  return attrs;
}

export function hlsVariant(text: string, base: string): { video: string; audio?: string } | null {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim());
  if (lines[0] !== '#EXTM3U') throw new Error('原站没有返回 HLS 清单');
  const variants: Array<{ url: string; attrs: Record<string, string> }> = [];
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].startsWith('#EXT-X-STREAM-INF:')) {
      const uri = lines[index + 1];
      if (!uri || uri.startsWith('#')) throw new Error('HLS 变体缺少媒体地址');
      variants.push({ url: httpUrl(uri, base), attrs: hlsAttributes(lines[index]) });
    }
  }
  if (!variants.length) return null;
  variants.sort((a, b) => Number(b.attrs.BANDWIDTH || 0) - Number(a.attrs.BANDWIDTH || 0));
  const selected = variants[0];
  if (!selected.url) throw new Error('HLS 变体地址无效');
  const audio = lines.filter(line => line.startsWith('#EXT-X-MEDIA:')).map(hlsAttributes)
    .filter(attrs => attrs.TYPE === 'AUDIO' && attrs['GROUP-ID'] === selected.attrs.AUDIO)
    .sort((a, b) => Number(b.DEFAULT === 'YES') - Number(a.DEFAULT === 'YES'))[0];
  if (selected.attrs.AUDIO && !audio || audio?.URI && !httpUrl(audio.URI, base)) throw new Error('HLS 独立音轨地址缺失');
  return { video: selected.url, ...(audio?.URI ? { audio: httpUrl(audio.URI, base) } : {}) };
}

function parseRange(value: string, previousEnd?: number): [number, number] {
  const match = value.match(/^(\d+)(?:@(\d+))?$/);
  if (!match) throw new Error('HLS 字节范围无效');
  const length = Number(match[1]);
  const start = match[2] !== undefined ? Number(match[2]) : previousEnd;
  if (start === undefined || length <= 0 || !Number.isSafeInteger(start + length)) throw new Error('HLS 字节范围缺少起始位置');
  return [start, start + length - 1];
}

/** 重写媒体清单：每个远程分片、初始化段和 AES key 都变成本地文件名。 */
export function localizeHls(text: string, base: string, add: (fragment: Fragment, extension: string) => string): string {
  const lines = text.trim().split(/\r?\n/).map(line => line.trim());
  if (lines[0] !== '#EXTM3U' || !lines.includes('#EXT-X-ENDLIST')) throw new Error('当前 HLS 尚未结束，暂不支持持续录制直播');
  const output = ['#EXTM3U'];
  let previousRange: { url: string; end: number } | undefined;
  let byteRange = '', fragments = 0;
  for (const line of lines.slice(1)) {
    if (!line) continue;
    if (line.startsWith('#EXT-X-BYTERANGE:')) { byteRange = line.slice(line.indexOf(':') + 1); continue; }
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = hlsAttributes(line);
      if (attrs.METHOD === 'NONE') { output.push('#EXT-X-KEY:METHOD=NONE'); continue; }
      if (attrs.METHOD !== 'AES-128' || attrs.KEYFORMAT && attrs.KEYFORMAT !== 'identity') throw new Error('HLS 使用了不支持的加密/DRM 格式');
      const key = httpUrl(attrs.URI, base);
      if (!key) throw new Error('HLS 密钥地址无效');
      if (attrs.IV && !/^0x[0-9a-f]{1,32}$/i.test(attrs.IV)) throw new Error('HLS 加密 IV 无效');
      output.push(`#EXT-X-KEY:METHOD=AES-128,URI="${add({ url: key }, 'key')}"${attrs.IV ? `,IV=${attrs.IV}` : ''}`);
      continue;
    }
    if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = hlsAttributes(line);
      const url = httpUrl(attrs.URI, base);
      if (!url) throw new Error('HLS 初始化段地址无效');
      output.push(`#EXT-X-MAP:URI="${add({ url, ...(attrs.BYTERANGE ? { range: parseRange(attrs.BYTERANGE, 0) } : {}) }, 'mp4')}"`);
      continue;
    }
    if (!line.startsWith('#')) {
      if (++fragments > MAX_FRAGMENTS) throw new Error('分片数量超出本机处理上限');
      const url = httpUrl(line, base);
      if (!url) throw new Error('HLS 分片地址无效');
      const range = byteRange ? parseRange(byteRange, previousRange?.url === url ? previousRange.end : undefined) : undefined;
      previousRange = range ? { url, end: range[1] + 1 } : undefined;
      byteRange = '';
      output.push(add({ url, range }, /\.(?:m4s|mp4)(?:[?#]|$)/i.test(url) ? 'mp4' : 'ts'));
    } else if (/^#(?:EXTINF:|EXT-X-(?:VERSION:|TARGETDURATION:|MEDIA-SEQUENCE:|DISCONTINUITY(?:-SEQUENCE:|$)|ENDLIST$|PLAYLIST-TYPE:))/.test(line)) output.push(line);
  }
  if (byteRange) throw new Error('HLS 字节范围缺少对应分片');
  if (!fragments) throw new Error('HLS 清单没有媒体分片');
  return output.join('\n') + '\n';
}

const child = (node: Element, name: string) => Array.from(node.children).find(item => item.localName === name);
const durationSeconds = (value: string | null) => {
  const match = (value || '').match(/^P(?:(\d+(?:\.\d+)?)D)?T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  return match ? Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0) : 0;
};

export function parseDash(xml: string, base: string): DashTrack[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const mpd = doc.documentElement;
  if (doc.querySelector('parsererror') || mpd.localName !== 'MPD') throw new Error('原站没有返回有效 DASH 清单');
  if (mpd.getAttribute('type') === 'dynamic') throw new Error('暂不支持持续录制 DASH 直播');
  if (doc.querySelector('ContentProtection')) throw new Error('DASH 使用了受保护媒体格式');
  const periods = Array.from(mpd.children).filter(node => node.localName === 'Period');
  if (periods.length !== 1) throw new Error('暂不支持多 Period DASH，避免合并出缺失片段的文件');
  const period = periods[0];
  const duration = durationSeconds(period.getAttribute('duration')) || durationSeconds(mpd.getAttribute('mediaPresentationDuration'));
  const tracks: DashTrack[] = [];
  for (const kind of ['video', 'audio'] as const) {
    const reps = Array.from(period.querySelectorAll('Representation')).filter(rep => {
      const parent = rep.parentElement!;
      return `${rep.getAttribute('mimeType') || parent.getAttribute('mimeType') || parent.getAttribute('contentType')}`.startsWith(kind);
    }).sort((a, b) => Number(b.getAttribute('bandwidth')) - Number(a.getAttribute('bandwidth')));
    const rep = reps[0];
    if (!rep) continue;
    const ancestors: Element[] = [];
    for (let node: Element | null = rep; node; node = node.parentElement) ancestors.unshift(node);
    let resource = base;
    let inheritedTemplate: Element | undefined, inheritedList: Element | undefined;
    const attrs: Record<string, string> = {};
    let timeline: Element | undefined;
    for (const node of ancestors) {
      const path = child(node, 'BaseURL')?.textContent?.trim();
      if (path) resource = httpUrl(path, resource);
      const template = child(node, 'SegmentTemplate');
      if (template) {
        inheritedTemplate = template;
        Array.from(template.attributes).forEach(attr => { attrs[attr.name] = attr.value; });
        timeline = child(template, 'SegmentTimeline') || timeline;
      }
      inheritedList = child(node, 'SegmentList') || inheritedList;
    }
    if (!resource) throw new Error('DASH 媒体地址无效');
    const fragments: Fragment[] = [];
    const range = (value: string | null): [number, number] | undefined => {
      if (!value) return undefined;
      if (!/^\d+-\d+$/.test(value)) throw new Error('DASH 字节范围无效');
      const parts = value.split('-').map(Number) as [number, number];
      if (parts[1] < parts[0]) throw new Error('DASH 字节范围无效');
      return parts;
    };
    const add = (path: string, byteRange?: [number, number]) => {
      if (fragments.length >= MAX_FRAGMENTS) throw new Error('DASH 分片过多');
      const url = httpUrl(path, resource);
      if (!url) throw new Error('DASH 分片地址无效');
      fragments.push({ url, range: byteRange });
    };
    if (inheritedList) {
      const init = child(inheritedList, 'Initialization');
      if (init) add(init.getAttribute('sourceURL') || resource, range(init.getAttribute('range')));
      Array.from(inheritedList.children).filter(node => node.localName === 'SegmentURL')
        .forEach(segment => add(segment.getAttribute('media') || resource, range(segment.getAttribute('mediaRange'))));
    } else if (inheritedTemplate) {
      const expand = (template: string, number: number, time: number) => template.replace(/\$\$|\$(RepresentationID|Bandwidth|Number|Time)(?:%0(\d+)d)?\$/g, (token, name, padding) => {
        if (token === '$$') return '$';
        const value = name === 'RepresentationID' ? rep.getAttribute('id') || '' : name === 'Bandwidth' ? rep.getAttribute('bandwidth') || '' : String(name === 'Number' ? number : time);
        return padding ? value.padStart(Math.min(20, Number(padding)), '0') : value;
      });
      const scale = Number(attrs.timescale || 1), start = Number(attrs.startNumber || 1);
      if (!(scale > 0) || !attrs.media) throw new Error('DASH 模板参数无效');
      if (attrs.initialization) add(expand(attrs.initialization, start, 0));
      let number = start, time = 0;
      if (timeline) {
        const entries = Array.from(timeline.children).filter(node => node.localName === 'S');
        for (let index = 0; index < entries.length; index++) {
          const entry = entries[index];
          if (entry.hasAttribute('t')) time = Number(entry.getAttribute('t'));
          const d = Number(entry.getAttribute('d')), repeat = Number(entry.getAttribute('r') || 0);
          const end = entries[index + 1]?.hasAttribute('t') ? Number(entries[index + 1].getAttribute('t')) : duration * scale + Number(attrs.presentationTimeOffset || 0);
          const count = repeat < 0 ? Math.ceil((end - time) / d) : repeat + 1;
          if (!(d > 0) || !(count > 0) || count > MAX_FRAGMENTS) throw new Error('DASH 时间线无法确定结束位置');
          for (let i = 0; i < count; i++) { add(expand(attrs.media, number++, time)); time += d; }
        }
      } else {
        const d = Number(attrs.duration), count = Math.ceil(duration * scale / d);
        if (!(d > 0) || !(count > 0) || count > MAX_FRAGMENTS) throw new Error('DASH 缺少有限的分片时长');
        for (let i = 0; i < count; i++) add(expand(attrs.media, start + i, i * d));
      }
    } else {
      if (resource === base) throw new Error('DASH 没有可下载的媒体地址');
      add(resource);
    }
    if (!fragments.length) throw new Error('DASH 音视频轨道为空');
    tracks.push({ kind, fragments });
  }
  if (!tracks.length) throw new Error('DASH 没有音视频轨道');
  return tracks;
}

export async function downloadStream(url: string, processing: MediaProcessing, headers: Record<string, string>, extension = 'mp4', onProgress: (percent: number) => void = () => {}): Promise<Blob> {
  let bytes = 0;
  const files: LocalFile[] = [];
  const jobs: Array<{ fragment: Fragment; name: string }> = [];
  const add = (fragment: Fragment, ext: string) => {
    if (jobs.length >= MAX_FRAGMENTS) throw new Error('分片数量超出本机处理上限');
    const name = `fragment${jobs.length}.${ext}`;
    jobs.push({ fragment, name });
    return name;
  };
  const fetchFragment = async (fragment: Fragment) => {
    const range = fragment.range;
    const response = await mediaRequest(fragment.url, { binary: true, maxBytes: CONFIG.MAX_FFMPEG_MERGE_BYTES - bytes,
      headers: { ...headers, ...(range ? { Range: `bytes=${range[0]}-${range[1]}` } : {}) } });
    let data = new Uint8Array(response.data);
    if (range) {
      if (response.status === 200) data = data.slice(range[0], range[1] + 1);
      if (data.length !== range[1] - range[0] + 1) throw new Error('分片字节范围不完整');
    }
    bytes += data.length;
    if (!data.length || bytes > CONFIG.MAX_FFMPEG_MERGE_BYTES) throw new Error('分片为空或媒体超出 WASM 本机内存上限');
    return data;
  };
  const inputs: string[] = [];
  if (processing.kind === 'hls') {
    const prepare = async (address: string, depth = 0): Promise<string[]> => {
      if (depth > 4) throw new Error('HLS 清单嵌套过深');
      const response = await mediaRequest(address, { headers });
      const variant = hlsVariant(response.data, response.finalUrl);
      if (variant) {
        if (processing.audioOnly && variant.audio) return prepare(variant.audio, depth + 1);
        const result = await prepare(variant.video, depth + 1);
        if (variant.audio) result.push(...await prepare(variant.audio, depth + 1));
        return result;
      }
      const name = `playlist${files.length}.m3u8`;
      const text = localizeHls(response.data, response.finalUrl, add);
      files.push({ name, data: new TextEncoder().encode(text) });
      return [name];
    };
    inputs.push(...await prepare(url));
    if (inputs.length > 2) throw new Error('HLS 音轨结构过于复杂');
    for (let index = 0; index < jobs.length; index++) {
      const job = jobs[index];
      const data = await fetchFragment(job.fragment);
      if (job.name.endsWith('.key') && data.length !== 16) throw new Error('HLS AES-128 密钥长度无效');
      files.push({ name: job.name, data });
      onProgress(Math.round((index + 1) * 85 / jobs.length));
    }
  } else {
    const response = processing.manifest ? { data: processing.manifest, finalUrl: url } : await mediaRequest(url, { headers });
    const tracks = parseDash(response.data, response.finalUrl);
    const selected = processing.audioOnly ? tracks.filter(track => track.kind === 'audio') : tracks;
    if (!selected.length) throw new Error('清单没有所需的音轨');
    let done = 0;
    const total = selected.reduce((sum, track) => sum + track.fragments.length, 0);
    for (const track of selected) {
      const parts: Uint8Array[] = [];
      for (const fragment of track.fragments) {
        parts.push(await fetchFragment(fragment));
        onProgress(Math.round(++done * 85 / total));
      }
      const data = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
      let offset = 0;
      parts.forEach(part => { data.set(part, offset); offset += part.length; });
      const name = `${track.kind}.mp4`;
      files.push({ name, data }); inputs.push(name);
    }
  }
  onProgress(90);
  const result = await remuxLocalMedia(files, inputs, extension, processing.audioOnly);
  if (!result.length) throw new Error('WASM 没有生成媒体文件');
  onProgress(100);
  return new Blob([result as BlobPart], { type: processing.audioOnly ? 'audio/mp4' : extension === 'webm' ? 'video/webm' : 'video/mp4' });
}
