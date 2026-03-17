import { LEARNING_DISCLAIMER } from './config.ts';
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
          resolve(this.concat(...parts).buffer);
        } else {
          const mergedMoov = audioMoov ? this.buildMoov(videoMoov, audioMoov, metadata) : videoMoov.data;
          const allMdat = [...videoMdat, ...audioMdat].map((m: any) => m.data.slice(8));
          const mdatContent = this.concat(...allMdat);
          const mergedMdat = this.createBox('mdat', mdatContent);
          resolve(this.concat(videoFtyp.data, mergedMoov, mergedMdat).buffer);
        }
      } catch (error) {
        console.error('JS合并失败:', error);
        reject(error);
      }
    });
  }
};

declare const FFmpeg: any;

export const FFmpegMerger = {
  name: 'FFmpeg合并',
  status: 'loading' as string,
  ffmpeg: null as any,

  init(): Promise<boolean> {
    if (typeof FFmpeg === 'undefined') { this.status = 'unavailable'; return Promise.reject(new Error('FFmpeg未加载')); }
    if (!this.ffmpeg) this.ffmpeg = FFmpeg.createFFmpeg({ log: false });
    if (!this.ffmpeg.isLoaded()) {
      this.status = 'loading';
      return this.ffmpeg.load().then(() => { this.status = 'ready'; return true; }).catch((e: any) => { this.status = 'error'; throw e; });
    }
    this.status = 'ready';
    return Promise.resolve(true);
  },

  merge(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, metadata: { title?: string; author?: string }): Promise<ArrayBuffer> {
    return this.init().then(() => {
      this.ffmpeg.FS('writeFile', 'video.mp4', new Uint8Array(videoBuffer));
      this.ffmpeg.FS('writeFile', 'audio.m4a', new Uint8Array(audioBuffer));
      return this.ffmpeg.run('-i','video.mp4','-i','audio.m4a','-c','copy','-map','0:v:0','-map','1:a:0',
        '-metadata','title='+(metadata.title||''),'-metadata','artist='+(metadata.author||''),
        '-metadata','comment='+LEARNING_DISCLAIMER,'output.mp4');
    }).then(() => {
      const data = this.ffmpeg.FS('readFile', 'output.mp4');
      try { this.ffmpeg.FS('unlink','video.mp4'); this.ffmpeg.FS('unlink','audio.m4a'); this.ffmpeg.FS('unlink','output.mp4'); } catch(e) {}
      return data.buffer;
    });
  }
};
