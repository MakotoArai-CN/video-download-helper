import { matchPlatform } from './platforms.ts';
import { douyinContentId } from './douyin-interceptor.ts';
import type { ShortVideoPlatform } from './types.ts';

export interface MediaPage { platform: ShortVideoPlatform; pageUrl: string; videoId?: string; }

/** 仅按当前 URL 识别内容，不使用 SPA 中可能过期的 canonical / 播放器全局状态。 */
export function getMediaContext(rawUrl: string, platform: ShortVideoPlatform): MediaPage | null {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return null; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || matchPlatform(url.hostname) !== platform) return null;
  const path = url.pathname;
  const host = url.hostname.toLowerCase();
  let valid = false;
  let videoId: string | undefined;
  switch (platform) {
    case 'youtube': {
      videoId = host === 'youtu.be' ? path.match(/^\/([^/]+)\/?$/)?.[1]
        : path === '/watch' ? url.searchParams.get('v') || undefined
        : path.match(/^\/(?:shorts|embed|live)\/([^/]+)\/?$/)?.[1];
      if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
      return { platform, videoId, pageUrl: `https://www.youtube.com/watch?v=${videoId}` };
    }
    case 'tiktok':
      valid = /^\/@[^/]+\/(?:video|photo)\/\d+\/?$/.test(path) || /^\/(?:t|v)\/[^/]+\/?$/.test(path)
        || /^(?:vm|vt)\.tiktok\.com$/.test(host) && /^\/[^/]+\/?$/.test(path);
      break;
    case 'instagram':
      valid = /^\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/[\w-]+\/?$/.test(path)
        || /^\/stories\/[^/]+\/\d+\/?$/.test(path);
      break;
    case 'x':
      valid = /^\/(?:[^/]+|i\/web)\/status(?:es)?\/\d+(?:\/(?:video|photo)\/\d+)?\/?$/.test(path);
      break;
    case 'facebook':
      valid = /^\/(?:reel|reels)\/\d+\/?$/.test(path) || /\/videos\/(?:[^/]+\/)?\d+\/?$/.test(path)
        || /^\/share\/[vr]\/[^/]+\/?$/.test(path)
        || /^\/(?:watch\/?)?$/.test(path) && /^\d+$/.test(url.searchParams.get('v') || '')
        || host === 'fb.watch' && /^\/[^/]+\/?$/.test(path);
      break;
    case 'threads': valid = /^\/@[^/]+\/post\/[\w-]+\/?$/.test(path) || /^\/t\/[\w-]+\/?$/.test(path); break;
    case 'douyin': {
      const id = douyinContentId(rawUrl);
      if (id) return { platform, pageUrl: `https://www.douyin.com/${path.includes('/note/') ? 'note' : 'video'}/${id}` };
      valid = host === 'v.douyin.com' && /^\/[^/]+\/?$/.test(path);
      break;
    }
    case 'xiaohongshu':
      valid = /^\/(?:explore|discovery\/item|user\/profile\/[^/]+)\/[a-f0-9]{24}\/?$/i.test(path)
        || /^(?:www\.)?(?:xhslink\.com|xhs\.cn)$/.test(host) && path !== '/';
      break;
    case 'pinterest': valid = /^\/pin\/\d+\/?$/.test(path) || host === 'pin.it' && /^\/[^/]+\/?$/.test(path); break;
    case 'snapchat': valid = /^\/spotlight\/[\w-]+\/?$/.test(path); break;
    case 'ted': valid = /^\/talks\/[^/]+\/?$/.test(path); break;
    case 'twitch':
      valid = /^\/videos\/\d+\/?$/.test(path) || /^\/[^/]+\/clip\/[\w-]+\/?$/.test(path)
        || host === 'clips.twitch.tv' && (/^\/[\w-]+\/?$/.test(path) && path !== '/embed'
          || path === '/embed' && /^[\w-]+$/.test(url.searchParams.get('clip') || ''));
      break;
    case 'soundcloud': {
      const parts = path.split('/').filter(Boolean);
      valid = parts.length === 2 && !['discover', 'search', 'you', 'upload', 'stream', 'charts', 'pages', 'settings'].includes(parts[0])
        && !['sets', 'tracks', 'albums', 'reposts', 'likes', 'popular-tracks', 'followers', 'following'].includes(parts[1])
        || host === 'on.soundcloud.com' && parts.length === 1;
      break;
    }
    case 'reddit': valid = /\/(?:comments|gallery)\/[a-z0-9]+(?:\/|$)/i.test(path) || host === 'redd.it' && /^\/[a-z0-9]+\/?$/i.test(path); break;
  }
  if (!valid) return null;
  // 保留内容访问需要的参数，例如小红书 xsec_token。
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'igsh', 'si'].includes(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return { platform, pageUrl: url.href };
}
