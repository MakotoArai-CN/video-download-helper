import { getMediaContext } from './media-context.ts';
import { assignedJSON, httpUrl, mediaJSON } from './media-http.ts';
import { PLATFORMS } from './platforms.ts';
import { NativeCapture } from './native-capture.ts';
import type { ShortVideoData, ShortVideoPlatform } from './types.ts';

declare const unsafeWindow: any;
type Raw = Record<string, any>;

const list = (value: any): any[] => Array.isArray(value) ? value : [];
const firstUrl = (...values: any[]): string => values.flatMap(value => Array.isArray(value) ? value : [value]).map(value => httpUrl(value)).find(Boolean) || '';
const rank = (values: any[]) => values.slice().sort((a, b) => (Number(b.width || b.height || b.bitrate || b.quality) || 0) - (Number(a.width || a.height || a.bitrate || a.quality) || 0));

export function contentIdentity(url: string, platform: ShortVideoPlatform): string {
  const parsed = new URL(url);
  const path = parsed.pathname;
  switch (platform) {
    case 'youtube': return getMediaContext(url, platform)?.videoId || '';
    case 'tiktok': return path.match(/\/(?:video|photo)\/(\d+)/)?.[1] || '';
    case 'instagram': return path.match(/\/(?:reel|reels|p|tv)\/([^/]+)/)?.[1] || path.match(/\/stories\/[^/]+\/(\d+)/)?.[1] || '';
    case 'threads': return path.match(/\/(?:post|t)\/([^/]+)/)?.[1] || '';
    case 'facebook': return parsed.searchParams.get('v') || path.match(/\/(?:videos|reels?)\/(?:[^/]+\/)?(\d+)/)?.[1] || '';
    case 'pinterest': return path.match(/\/pin\/(\d+)/)?.[1] || '';
    case 'twitch': return parsed.searchParams.get('clip') || path.split('/').filter(Boolean).at(-1) || '';
    case 'ted': case 'snapchat': return path.split('/').filter(Boolean).at(-1) || '';
    case 'soundcloud': return parsed.origin + path.replace(/\/$/, '');
    default: return '';
  }
}

function samePage(candidate: unknown, url: string): boolean {
  const address = httpUrl(candidate, url);
  if (!address) return false;
  const a = new URL(address), b = new URL(url);
  if (a.hostname.replace(/^www\./, '') !== b.hostname.replace(/^www\./, '') || a.pathname.replace(/\/$/, '') !== b.pathname.replace(/\/$/, '')) return false;
  // watch/embed 页面通过查询参数区分作品，不能仅比较路径。
  return ['v', 'clip'].every(key => a.searchParams.get(key) === b.searchParams.get(key));
}

function matches(node: Raw, key: string, id: string, url: string, platform: ShortVideoPlatform): boolean {
  if (!id) return false;
  if (key === id) return true;
  if (['id', 'pk', 'videoId', 'video_id', 'aweme_id', 'shortcode', 'code', 'slug', 'snapId'].some(field => {
    const value = String(node[field] ?? '');
    return value === id || platform === 'instagram' && value.split('_')[0] === id;
  })) return true;
  return ['permalink_url', 'canonicalUrl', 'canonical_url', 'webpage_url', 'url', '@id', 'mainEntityOfPage'].some(field => samePage(node[field], url));
}

function sourceData(raw: Raw, platform: ShortVideoPlatform, pageUrl: string, urls: string[], images: string[] = [], audioOnly = false): ShortVideoData | null {
  const candidates = [...new Set(urls.filter(Boolean))];
  if (!candidates.length && !images.length) return null;
  const url = candidates[0] || '';
  const kind = /\.m3u8(?:[?#]|$)/i.test(url) ? 'hls' : /\.mpd(?:[?#]|$)/i.test(url) ? 'dash' : undefined;
  return {
    platform, sourceUrl: pageUrl, video_id: contentIdentity(pageUrl, platform),
    title: raw.title || raw.desc || raw.caption?.text || raw.accessibility_caption || raw.name || PLATFORMS[platform].label,
    author: { name: raw.author?.nickname || raw.author?.name || raw.user?.full_name || raw.user?.username || raw.owner?.name || '' },
    duration: Number(raw.duration || raw.video?.duration) || null,
    type: url ? 'video' : 'image', url, video_backup: candidates.slice(1), images: url ? [] : images,
    cover: firstUrl(raw.thumbnail_url, raw.thumbnailUrl, raw.cover, raw.video?.cover, images[0]),
    ...(kind ? { processing: { kind, audioOnly }, output_ext: audioOnly ? 'm4a' : 'mp4' } : {}),
    ...(audioOnly && !kind ? { url: '', music: { title: raw.title, url } } : {})
  };
}

/** 解码已经和当前内容 ID 匹配的节点；不把推荐列表中的首个视频当作当前内容。 */
export function decodePlatformNode(raw: Raw, platform: ShortVideoPlatform, pageUrl: string): ShortVideoData | null {
  if (raw.is_drm || raw.drm === true || raw.drm_metadata || raw.drmFamilies?.length) throw new Error('当前媒体需要 DRM 授权，不能作为普通文件处理');
  const schemaTypes = list(raw['@type']).concat(typeof raw['@type'] === 'string' ? [raw['@type']] : []);
  if (schemaTypes.some(type => type === 'VideoObject' || type === 'AudioObject')) {
    return sourceData(raw, platform, pageUrl, [httpUrl(raw.contentUrl)], [], schemaTypes.includes('AudioObject'));
  }
  if (platform === 'tiktok') {
    const images = list(raw.imagePost?.images || raw.image_post_info?.images).map(image => firstUrl(image.imageURL?.urlList, image.display_image?.url_list));
    if (images.some(Boolean)) return sourceData(raw, platform, pageUrl, [], images.filter(Boolean));
    return sourceData(raw, platform, pageUrl, [firstUrl(raw.video?.playAddr, raw.video?.playAddr?.urlList, raw.video?.downloadAddr)]);
  }
  if (platform === 'instagram' || platform === 'threads') {
    const children = raw.carousel_media || raw.edge_sidecar_to_children?.edges?.map((edge: any) => edge.node);
    if (Array.isArray(children)) {
      const items = children.map(child => decodePlatformNode(child, platform, pageUrl)).filter(Boolean) as ShortVideoData[];
      return items.length ? { ...items[0], title: raw.caption?.text || items[0].title, items } : null;
    }
    if (raw.media && typeof raw.media === 'object') return decodePlatformNode(raw.media, platform, pageUrl);
    const urls = rank(list(raw.video_versions)).map(v => httpUrl(v.url));
    urls.push(httpUrl(raw.video_url));
    return sourceData(raw, platform, pageUrl, urls, [firstUrl(raw.display_url, rank(list(raw.image_versions2?.candidates))[0]?.url)].filter(Boolean));
  }
  if (platform === 'facebook') {
    const data = sourceData(raw, platform, pageUrl, [raw.browser_native_hd_url, raw.playable_url_quality_hd, raw.browser_native_sd_url, raw.playable_url].map(value => httpUrl(value)));
    if (data) return data;
    if (typeof raw.dash_manifest === 'string' && raw.dash_manifest.includes('<MPD')) {
      return { title: raw.name || 'Facebook 视频', type: 'video', platform, sourceUrl: pageUrl, url: pageUrl,
        output_ext: 'mp4', processing: { kind: 'dash', manifest: raw.dash_manifest } };
    }
  }
  if (platform === 'pinterest') {
    const videos = Object.values(raw.videos?.video_list || {}) as any[];
    return sourceData(raw, platform, pageUrl, rank(videos).map(v => httpUrl(v.url)), [firstUrl(raw.images?.orig?.url)].filter(Boolean));
  }
  if (platform === 'snapchat') return sourceData(raw, platform, pageUrl, [firstUrl(raw.snapUrls?.mediaUrl, raw.mediaUrl, raw.videoUrl, raw.videoMetadata?.mediaUrl)]);
  if (platform === 'ted') {
    const resources = raw.playerData?.resources || raw.resources || {};
    return sourceData(raw, platform, pageUrl, [...rank(list(resources.h264)).map(v => httpUrl(v.file)),
      firstUrl(raw.nativeDownloads?.high, raw.nativeDownloads?.medium, resources.hls?.stream)]);
  }
  if (platform === 'twitch') return sourceData(raw, platform, pageUrl, rank(list(raw.videoQualities)).map(v => httpUrl(v.sourceURL)));
  // 标准 VideoObject / AudioObject 的 contentUrl 才是文件，embedUrl 不是。
  return null;
}

export function findPlatformMedia(roots: unknown[], platform: ShortVideoPlatform, pageUrl: string): ShortVideoData | null {
  const id = contentIdentity(pageUrl, platform);
  const seen = new WeakSet<object>();
  let budget = 20000;
  const walk = (node: any, depth = 0, key = ''): ShortVideoData | null => {
    if (!node || typeof node !== 'object' || depth > 20 || --budget < 0 || seen.has(node)) return null;
    seen.add(node);
    if (matches(node, key, id, pageUrl, platform)) {
      const result = decodePlatformNode(node, platform, pageUrl);
      if (result) return result;
    }
    for (const [childKey, child] of Object.entries(node)) {
      const found = walk(child, depth + 1, childKey);
      if (found) return found;
    }
    return null;
  };
  for (const root of roots) { const found = walk(root); if (found) return found; }
  return null;
}

export function pageDataRoots(): unknown[] {
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const roots: unknown[] = NativeCapture.current();
  for (const key of ['__NEXT_DATA__', '__INITIAL_STATE__', '__UNIVERSAL_DATA_FOR_REHYDRATION__', 'SIGI_STATE', '_sharedData', '__additionalData', '__sc_hydration']) {
    try { if (win[key]) roots.push(win[key]); } catch {}
  }
  let total = 0;
  for (const script of Array.from(document.scripts)) {
    const text = script.textContent || '';
    total += text.length;
    if (total > 24 * 1024 * 1024) break;
    if (/json/i.test(script.type) || ['__NEXT_DATA__', 'SIGI_STATE', '__UNIVERSAL_DATA_FOR_REHYDRATION__'].includes(script.id)) {
      try { roots.push(JSON.parse(text)); } catch {}
    } else {
      for (const marker of ['window._sharedData =', 'window.__INITIAL_STATE__ =']) {
        const value = assignedJSON(text, marker); if (value) roots.push(value);
      }
    }
  }
  return roots;
}

async function soundCloud(roots: unknown[], url: string): Promise<ShortVideoData | null> {
  const queue: any[] = roots.slice();
  const seen = new WeakSet<object>();
  let track: any;
  for (let budget = 0; queue.length && budget < 10000; budget++) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (samePage(node.permalink_url, url) && node.media?.transcodings) { track = node; break; }
    queue.push(...Object.values(node));
  }
  if (!track) return null;
  const sources = list(track.media.transcodings).filter(v => !v.snipped && /mpeg|mp4/.test(v.format?.mime_type));
  sources.sort((a, b) => Number(b.format?.protocol === 'progressive') - Number(a.format?.protocol === 'progressive'));
  let clientId = '';
  for (const entry of performance.getEntriesByType('resource')) {
    try { const endpoint = new URL(entry.name); if (endpoint.hostname === 'api-v2.soundcloud.com') clientId ||= endpoint.searchParams.get('client_id') || ''; } catch {}
  }
  for (const item of sources) {
    const address = httpUrl(item.url);
    if (!address || new URL(address).hostname !== 'api-v2.soundcloud.com') continue;
    const endpoint = new URL(address);
    if (clientId) endpoint.searchParams.set('client_id', clientId);
    if (track.track_authorization) endpoint.searchParams.set('track_authorization', track.track_authorization);
    try {
      const response = await mediaJSON(endpoint.href);
      const resolved = httpUrl(response.url);
      if (!resolved) continue;
      const result = sourceData(track, 'soundcloud', url, [resolved], [], true)!;
      if (item.format.protocol === 'hls') Object.assign(result, { url: resolved, music: undefined, processing: { kind: 'hls', audioOnly: true }, output_ext: 'm4a' });
      return result;
    } catch { /* 继续尝试该作品的其他真实音频源。 */ }
  }
  return null;
}

async function twitch(url: string): Promise<ShortVideoData | null> {
  const id = contentIdentity(url, 'twitch');
  const vod = /\/videos\/\d+/.test(new URL(url).pathname);
  const query = vod
    ? 'query($id:ID!){video(id:$id){title} videoPlaybackAccessToken(id:$id,params:{platform:"web",playerBackend:"mediaplayer",playerType:"site"}){value signature}}'
    : 'query($id:ID!){clip(slug:$id){title videoQualities{quality sourceURL} playbackAccessToken(params:{platform:"web",playerBackend:"mediaplayer",playerType:"site"}){value signature}}}';
  const response = await mediaJSON('https://gql.twitch.tv/gql', {
    method: 'POST', headers: { 'Client-ID': 'kimne78kx3ncx6brgo4mv6wki5h1ko', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { id } })
  });
  const item = vod ? response.data?.video : response.data?.clip;
  const token = vod ? response.data?.videoPlaybackAccessToken : item?.playbackAccessToken;
  if (!item || !token?.value || !token?.signature) return null;
  const address = vod ? new URL(`https://usher.ttvnw.net/vod/${id}.m3u8`) : new URL(firstUrl(rank(list(item.videoQualities))[0]?.sourceURL));
  address.searchParams.set(vod ? 'nauth' : 'token', token.value);
  address.searchParams.set(vod ? 'nauthsig' : 'sig', token.signature);
  if (vod) address.searchParams.set('allow_source', 'true');
  return { type: 'video', title: item.title, platform: 'twitch', sourceUrl: url, url: address.href,
    ...(vod ? { processing: { kind: 'hls' as const }, output_ext: 'mp4' as const } : {}) };
}

export async function parseNativePlatform(url: string, platform: ShortVideoPlatform): Promise<ShortVideoData | null> {
  const context = getMediaContext(url, platform);
  if (!context) throw new Error(`请打开 ${PLATFORMS[platform].label} 的具体内容页`);
  const roots = pageDataRoots();
  const found = findPlatformMedia(roots, platform, url);
  if (found) return found;
  const id = contentIdentity(url, platform);
  if (platform === 'twitch' && id) { const result = await twitch(url); if (result) return result; }
  if (platform === 'soundcloud') { const result = await soundCloud(roots, url); if (result) return result; }
  // 元数据必须对应当前内容，SPA 中仍指向旧帖的元数据不能作为兜底。
  const canonical = document.querySelector<HTMLLinkElement>('link[rel=canonical]')?.href
    || document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content;
  if (canonical && samePage(canonical, url)) {
    for (const property of ['og:video:secure_url', 'og:video', 'og:audio']) {
      const media = httpUrl(document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)?.content);
      if (/\.(?:mp4|webm|m3u8|mpd|mp3|m4a)(?:[?#]|$)/i.test(media)) return sourceData({ title: document.title }, platform, url, [media], [], property === 'og:audio');
    }
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video')).filter(video => {
      const rect = video.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
    });
    if (videos.length === 1 && httpUrl(videos[0].currentSrc || videos[0].src)) {
      return sourceData({ title: document.title, cover: videos[0].poster }, platform, url, [httpUrl(videos[0].currentSrc || videos[0].src)]);
    }
  }
  throw new Error(`${PLATFORMS[platform].label} 页面未提供可识别的媒体数据，请先播放当前内容；需登录、私有接口变化或受保护格式可能无法解析`);
}
