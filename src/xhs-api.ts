import type { ShortVideoData } from './types.ts';
import { Diagnostics } from './diagnostics.ts';

declare const unsafeWindow: any;

function http(value: any): string {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
}

function unwrap(value: any): any {
  return value?.__v_isRef ? (value.value ?? value._value) : value;
}

export function extractXhsNote(state: any, id: string, url: string): ShortVideoData | null {
  const seen = new WeakSet<object>();
  let budget = 5000;
  function walk(raw: any, depth: number, key = ''): ShortVideoData | null {
    const value = unwrap(raw);
    if (!value || typeof value !== 'object' || depth > 14 || --budget < 0 || seen.has(value)) return null;
    seen.add(value);
    const note = unwrap(value.note ?? value.noteDetail ?? value);
    const noteId = note?.noteId ?? note?.note_id ?? note?.id ?? key;
    if (noteId === id) {
      const livePhotos = (note.imageList ?? note.image_list ?? []).map((img: any) => {
        const info = img.infoList ?? img.info_list ?? [];
        const image = http(img.urlDefault) || http(info.find((i: any) => i.imageScene === 'WB_DFT')?.url)
          || http(img.url) || http(info[0]?.url) || http(img.urlPre);
        const stream = img.stream ?? img.video?.media?.stream;
        const video = ['h264', 'h265', 'av1'].flatMap(codec => stream?.[codec] ?? [])
          .flatMap((s: any) => [s.masterUrl, ...(s.backupUrls ?? [])]).map(http).find(Boolean) || '';
        return { image, video };
      }).filter((photo: { image: string }) => photo.image);
      const images: string[] = livePhotos.map((photo: { image: string }) => photo.image);
      const hasLive = note.type === 'normal' && livePhotos.some((photo: { video: string }) => photo.video);
      const streams = note.video?.media?.stream;
      const candidates: string[] = ['h264', 'h265', 'av1'].flatMap(codec => streams?.[codec] ?? [])
        .flatMap((s: any) => [s.masterUrl, ...(s.backupUrls ?? [])]).map(http).filter(Boolean);
      const video = note.type !== 'normal' ? candidates[0] : '';
      if (video || images.length) return {
        type: video ? 'video' : hasLive ? 'live' : 'image', title: note.title || note.desc || '小红书内容',
        desc: note.desc || '', author: { name: note.user?.nickname || '' },
        cover: images[0] || '', images: video ? [] : images,
        url: video || '', video_backup: candidates.slice(1), video_id: id,
        ...(hasLive ? { live_photo: livePhotos } : {}),
        platform: 'xiaohongshu', sourceUrl: url
      };
    }
    for (const [childKey, child] of Object.entries(value)) {
      const found = walk(child, depth + 1, childKey);
      if (found) return found;
    }
    return null;
  }
  return walk(state, 0);
}

export async function parseXhsLocal(url: string): Promise<ShortVideoData | null> {
  const id = new URL(url).pathname.match(/\/(?:explore|discovery\/item|user\/profile\/[^/]+)\/([a-f0-9]{24})(?:\/|$)/i)?.[1];
  if (!id) throw new Error('请打开小红书笔记详情页后再试');
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const keys = ['__INITIAL_STATE__', '__INITIAL_SSR_STATE__', '__NUXT__', '__data', 'initialState', '__REDUX_STATE__'];
  for (let attempt = 0; attempt < 9; attempt++) {
    if (attempt) await new Promise(resolve => setTimeout(resolve, 300));
    if (location.href !== url) return null;
    for (const key of keys) {
      try {
        const result = extractXhsNote(win[key], id, url);
        if (result) return result;
      } catch { /* 页面状态可能正在更新。 */ }
    }
  }
  // 只读取笔记详情容器，避免把推荐卡片、头像或之前播放的视频当作当前笔记。
  const root = document.querySelector('#noteContainer, .note-detail-mask .note-container');
  if (root) {
    const images = [...new Set(Array.from(root.querySelectorAll<HTMLElement>('.swiper-slide img, .note-slider-img'))
      .map(element => {
        const img = element as HTMLImageElement;
        const background = element.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        return http(element.getAttribute('data-src')) || http(img.currentSrc) || http(img.src) || http(background);
      }).filter(Boolean))];
    const video = root.querySelector('video');
    const src = http(video?.currentSrc) || http(video?.src);
    if (images.length || src) return {
      type: src ? 'video' : 'image', title: root.querySelector('#detail-title')?.textContent || document.title,
      images: src ? [] : images, url: src, cover: video?.poster || images[0],
      platform: 'xiaohongshu', sourceUrl: url, video_id: id
    };
  }
  Diagnostics.debug('xiaohongshu', `未取到当前笔记: state=[${keys.filter(key => win[key] != null).join(',')}] detail=${Boolean(root)}`);
  return null;
}
