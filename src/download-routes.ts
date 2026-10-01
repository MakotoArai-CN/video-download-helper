import { matchPlatform } from './platforms.ts';
import { douyinContentId } from './douyin-interceptor.ts';
import type { ShortVideoPlatform } from './types.ts';

export interface RouteContext {
  platform: ShortVideoPlatform;
  pageUrl: string;
  videoId?: string;
}

interface DownloadRoute {
  id: string;
  name: string;
  origin: string;
  platforms: ShortVideoPlatform[];
  build: (context: RouteContext) => string;
}

const withUrl = (base: string, context: RouteContext) => `${base}${encodeURIComponent(context.pageUrl)}`;
const grabPaths: Partial<Record<ShortVideoPlatform, string>> = {
  youtube: 'yt', tiktok: 'tk', douyin: 'tk', instagram: 'ins', threads: 'threads', x: 'twitter'
};

/** 外部网站的跳转配置。平台列表表示可转交链接，不代表已验证其解析能力。 */
export const DOWNLOAD_ROUTES: DownloadRoute[] = [
  { id: 'saveany', name: 'SaveAnyYouTube', origin: 'https://saveanyyoutube.com', platforms: ['youtube'],
    build: c => `https://saveanyyoutube.com/watch?v=${c.videoId}` },
  { id: 'ssyoutube', name: 'SSYouTube', origin: 'https://ssyoutube.com', platforms: ['youtube'],
    build: c => `https://ssyoutube.com/watch?v=${c.videoId}` },
  { id: 'yout', name: 'Yout', origin: 'https://yout.com',
    platforms: ['youtube', 'tiktok', 'instagram', 'x', 'facebook', 'vimeo', 'twitch', 'soundcloud', 'reddit', 'dailymotion'],
    build: c => withUrl('https://yout.com/video/?url=', c) },
  { id: 'tenzaa', name: 'Tenzaa', origin: 'https://tenzaa.com', platforms: ['youtube'],
    build: c => withUrl('https://tenzaa.com/youtube?url=', c) },
  { id: 'tool77', name: 'Tool77', origin: 'https://www.tool77.com',
    platforms: ['youtube', 'tiktok', 'instagram', 'x', 'facebook', 'threads', 'douyin', 'xiaohongshu', 'pinterest', 'ted', 'snapchat', 'dailymotion'],
    build: c => withUrl('https://www.tool77.com/zh-CN/v/downloader?url=', c) },
  { id: 'grabshorts', name: 'GrabShorts', origin: 'https://www.grabshorts.com',
    platforms: ['youtube', 'tiktok', 'douyin', 'instagram', 'threads', 'x'],
    build: c => withUrl(`https://www.grabshorts.com/zh-CN/${grabPaths[c.platform]}?s=40&url=`, c) },
  { id: 'y2mate-stream', name: 'Y2Mate Stream', origin: 'https://y2mate.stream', platforms: ['youtube'],
    build: c => `https://y2mate.stream/convert/?videoId=${c.videoId}` }
];

/** 仅按当前 URL 识别内容，不使用 SPA 中可能过期的 canonical / 播放器全局状态。 */
export function getRouteContext(rawUrl: string, platform: ShortVideoPlatform): RouteContext | null {
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
    case 'vimeo':
      valid = /^\/(?:video\/)?\d+(?:\/[\w-]+)?\/?$/.test(path)
        || /^\/(?:channels\/[^/]+|groups\/[^/]+\/videos|showcase\/\d+\/video|album\/\d+\/video)\/\d+\/?$/.test(path);
      break;
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
    case 'dailymotion': valid = /^\/(?:embed\/)?video\/[a-z0-9]+(?:_[^/]+)?\/?$/i.test(path) || host === 'dai.ly' && /^\/[a-z0-9]+\/?$/i.test(path); break;
  }
  if (!valid) return null;
  // 保留内容访问需要的参数，例如小红书 xsec_token 与 Vimeo h。
  for (const key of [...url.searchParams.keys()]) {
    if (/^utm_/i.test(key) || ['fbclid', 'igsh', 'si'].includes(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return { platform, pageUrl: url.href };
}

export function routesForPlatform(platform: ShortVideoPlatform): DownloadRoute[] {
  return DOWNLOAD_ROUTES.filter(route => route.platforms.includes(platform));
}

export function routeUrl(id: string, context: RouteContext): string | null {
  const validated = getRouteContext(context.pageUrl, context.platform);
  const route = routesForPlatform(context.platform).find(item => item.id === id);
  return route && validated ? route.build(validated) : null;
}

export function preferredRoute(platform: ShortVideoPlatform): string {
  const routes = routesForPlatform(platform);
  let saved: unknown;
  try { saved = (globalThis as any).GM_getValue?.(`bdl:route:${platform}`, ''); } catch {}
  if (routes.some(route => route.id === saved)) return saved as string;
  return platform === 'youtube' ? 'saveany' : routes.find(route => route.id === 'tool77')?.id || routes[0]?.id || '';
}

export function rememberRoute(platform: ShortVideoPlatform, id: string): void {
  if (!routesForPlatform(platform).some(route => route.id === id)) return;
  try { (globalThis as any).GM_setValue?.(`bdl:route:${platform}`, id); } catch {}
}

/** 网站响应检查，不传内容链接、不自动改默认项，也不宣称解析或下载成功。 */
export async function checkRouteSite(id: string): Promise<string> {
  const route = DOWNLOAD_ROUTES.find(item => item.id === id);
  const request = (globalThis as any).GM_xmlhttpRequest;
  if (!route || typeof request !== 'function') return '当前环境无法检查';
  return new Promise(resolve => {
    try {
      request({ method: 'GET', url: `${route.origin}/`, anonymous: true, timeout: 6500,
        onload: (res: { status: number }) => resolve(res.status >= 200 && res.status < 400
          ? '网站已响应，下载能力需实际尝试' : `网站访问受限或失败（HTTP ${res.status}）`),
        onerror: () => resolve('网站连接失败'), ontimeout: () => resolve('网站连接超时'), onabort: () => resolve('检查已取消') });
    } catch { resolve('网站连接失败'); }
  });
}
