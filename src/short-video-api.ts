import { CONFIG } from './config.ts';
import { Network } from './network.ts';
import type { ShortVideoApiResponse, ShortVideoAuthor, ShortVideoData, ShortVideoPlatform } from './types.ts';

type RawShortVideoData = Record<string, any>;

declare const unsafeWindow: any;

const ITEM_ARRAY_KEYS = [
  'items',
  'list',
  'data',
  'videos',
  'video_list',
  'videoList',
  'aweme_list',
  'awemeList',
  'statuses',
  'cards',
  'feeds'
];

function unique(values: string[]): string[] {
  return values.filter((value, index) => Boolean(value) && values.indexOf(value) === index);
}

function isRecord(value: unknown): value is RawShortVideoData {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^(https?:)?\/\//i.test(value.trim());
}

function normalizeUrl(value: unknown): string {
  if (!isHttpUrl(value)) return '';
  const url = value.trim();
  return url.startsWith('//') ? `https:${url}` : url;
}

function pushUrl(target: string[], value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(item => pushUrl(target, item));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach(item => pushUrl(target, item));
    return;
  }

  const url = normalizeUrl(value);
  if (url && !target.includes(url)) target.push(url);
}

function normalizeAuthor(data: RawShortVideoData): ShortVideoAuthor {
  const author = data.author;
  if (author && typeof author === 'object') {
    return {
      ...author,
      name: author.name || author.nickname || author.screen_name || author.user_name || data.nickname || data.author_name || '',
      avatar: author.avatar || author.avatar_url || data.avatar || data.author_avatar || ''
    };
  }

  return {
    name: typeof author === 'string' ? author : (data.nickname || data.author_name || data.screen_name || ''),
    id: data.author_id || data.uid || data.user_id || '',
    avatar: data.avatar || data.author_avatar || ''
  };
}

function normalizeStringList(value: unknown): string[] {
  const urls: string[] = [];
  pushUrl(urls, value);
  return urls;
}

function normalizeLivePhotos(value: unknown): Array<{ image?: string; video?: string }> {
  if (!Array.isArray(value)) return [];
  const items: Array<{ image?: string; video?: string } | null> = value.map(item => {
    if (!item || typeof item !== 'object') return null;
    return {
      image: normalizeUrl(item.image || item.cover || item.url),
      video: normalizeUrl(item.video || item.video_url || item.play_url)
    };
  });

  return items.filter((item): item is { image?: string; video?: string } => Boolean(item && (item.image || item.video)));
}

function getVisibleArea(element: Element): number {
  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
  return width * height;
}

function getBestVisibleVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
  return videos
    .map(video => ({ video, area: getVisibleArea(video) }))
    .filter(item => item.area > 1000)
    .sort((a, b) => b.area - a.area)[0]?.video || videos[0] || null;
}

function getElementTreeSource(element: Element | null, maxDepth = 6): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    parts.push(current.outerHTML.slice(0, 60000));
    current = current.parentElement;
    depth += 1;
  }

  return parts.join('\n');
}

function findNearbyText(element: Element | null, selectors: string[], maxLength: number, maxDepth = 7): string {
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    for (const selector of selectors) {
      const nodes = Array.from(current.querySelectorAll<HTMLElement>(selector));
      for (const node of nodes) {
        const text = node.innerText?.replace(/\s+/g, ' ').trim();
        if (text && text.length <= maxLength) return text;
      }
    }

    current = current.parentElement;
    depth += 1;
  }

  return '';
}

function getVideoCandidates(data: RawShortVideoData): string[] {
  const candidates: string[] = [];
  const qualityUrls = data.quality_urls || data.qualityUrls || null;

  if (qualityUrls && typeof qualityUrls === 'object' && !Array.isArray(qualityUrls)) {
    const preferred = data.default_quality || data.defaultQuality || '高清 720P';
    pushUrl(candidates, qualityUrls[preferred]);
  }

  pushUrl(candidates, data.download_url || data.downloadUrl);
  pushUrl(candidates, data.url);
  pushUrl(candidates, data.video_url || data.videoUrl);
  pushUrl(candidates, data.play_url || data.playUrl);
  pushUrl(candidates, data.media_url || data.mediaUrl);
  pushUrl(candidates, data.hd_url || data.hdUrl);
  pushUrl(candidates, data.sd_url || data.sdUrl);
  pushUrl(candidates, data.mp4);
  pushUrl(candidates, data.src);
  pushUrl(candidates, data.video);
  pushUrl(candidates, data.video_backup || data.videoBackup);
  pushUrl(candidates, data.video_urls || data.videoUrls);
  pushUrl(candidates, data.downloads);
  pushUrl(candidates, qualityUrls);
  pushUrl(candidates, data.urls);
  pushUrl(candidates, data.download_urls || data.downloadUrls);

  return candidates;
}

function getImageCandidates(data: RawShortVideoData): string[] {
  const candidates: string[] = [];
  pushUrl(candidates, data.images || data.image_urls || data.imageUrls);
  pushUrl(candidates, data.pics || data.pictures || data.pic_urls || data.picUrls);
  pushUrl(candidates, data.photo || data.photos || data.photo_list || data.photoList);
  pushUrl(candidates, data.image || data.image_url || data.imageUrl);
  pushUrl(candidates, data.image_list || data.imageList || data.images_list || data.imagesList);
  pushUrl(candidates, data.album || data.album_images || data.albumImages);
  return candidates;
}

function unwrapRawItem(item: unknown): RawShortVideoData | null {
  if (!isRecord(item)) return null;
  if (isRecord(item.mblog)) return item.mblog;
  if (isRecord(item.status)) return item.status;
  if (isRecord(item.video)) return { ...item, ...item.video };
  if (isRecord(item.aweme_detail)) return item.aweme_detail;
  return item;
}

function pickParentFallback(data: RawShortVideoData): RawShortVideoData {
  return {
    title: data.title,
    desc: data.desc,
    author: data.author,
    nickname: data.nickname,
    author_name: data.author_name,
    screen_name: data.screen_name,
    avatar: data.avatar,
    author_avatar: data.author_avatar,
    cover: data.cover,
    cover_image: data.cover_image,
    coverImage: data.coverImage
  };
}

function getNestedRawItems(data: RawShortVideoData): RawShortVideoData[] {
  for (const key of ITEM_ARRAY_KEYS) {
    if (!Array.isArray(data[key])) continue;

    const fallback = pickParentFallback(data);
    const items = data[key]
      .map(unwrapRawItem)
      .filter((item): item is RawShortVideoData => Boolean(item))
      .map(item => ({ ...fallback, ...item }));

    if (items.length > 0) return items;
  }

  return [];
}

function collectRawItems(raw: ShortVideoApiResponse['data']): RawShortVideoData[] {
  const sourceItems = Array.isArray(raw) ? raw : [raw || {}];
  const items: RawShortVideoData[] = [];

  sourceItems.forEach(item => {
    const rawItem = unwrapRawItem(item);
    if (!rawItem) return;

    const nested = getNestedRawItems(rawItem);
    if (nested.length > 0) items.push(...nested);
    else items.push(rawItem);
  });

  return items.length > 0 ? items : [{}];
}

function getShortVideoItemKey(item: ShortVideoData): string {
  return [
    item.url,
    item.images?.join('|'),
    item.live_photo?.map(live => `${live.image || ''}:${live.video || ''}`).join('|'),
    item.music?.url,
    item.sourceUrl,
    item.title
  ].find(Boolean) || '';
}

function dedupeShortVideoItems(items: ShortVideoData[]): ShortVideoData[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = getShortVideoItemKey(item);
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function combineShortVideoItems(items: ShortVideoData[], platform: ShortVideoPlatform, url: string): ShortVideoData {
  const deduped = dedupeShortVideoItems(items);
  const first = deduped[0] || {
    type: 'unknown' as const,
    title: '',
    platform,
    sourceUrl: url
  };

  return {
    ...first,
    items: deduped
  };
}

function getEndpointCandidates(endpoint: string, fallbackEndpoints: string[] = []): string[] {
  const endpoints = [endpoint, ...fallbackEndpoints]
    .map(value => value.replace(/^\/+/, ''))
    .filter(Boolean)
    .map(cleanEndpoint => ({
      cleanEndpoint,
      withoutPhp: cleanEndpoint.endsWith('.php') ? cleanEndpoint.slice(0, -4) : cleanEndpoint
    }));

  return unique([
    ...endpoints.map(item => item.withoutPhp),
    ...endpoints.map(item => item.cleanEndpoint),
    ...endpoints.map(item => `${item.withoutPhp}.php`),
    'short_videos'
  ]);
}

function getDocumentSource(): string {
  return [
    document.querySelector<HTMLMetaElement>('meta[property="og:video:url"]')?.content || '',
    document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.content || '',
    document.querySelector<HTMLMetaElement>('meta[name="twitter:url"]')?.content || '',
    document.documentElement?.innerHTML || ''
  ].join('\n');
}

function normalizeWeiboFid(value: string): string {
  return value.replace(/%253A|%3A|\\u003a/ig, ':');
}

function extractWeiboFids(source: string): string[] {
  const fids = source.match(/1034(?::|%3A|%253A|\\u003a)\d{6,}/ig) || [];
  return unique(fids.map(normalizeWeiboFid));
}

function getWeiboResolvableUrls(url: string): string[] {
  const parsed = new URL(url);
  const directFid = parsed.searchParams.get('fid') || parsed.searchParams.get('oid');
  const urls: string[] = [];

  if (directFid && /^1034(?::|%3A|%253A|\\u003a)\d{6,}$/i.test(directFid)) {
    urls.push(`https://weibo.com/tv/show/${normalizeWeiboFid(directFid)}`);
  }

  const tvMatch = url.match(/weibo\.com\/tv\/show\/([^?&#/]+)/i);
  if (tvMatch?.[1]) urls.push(url);

  extractWeiboFids(`${url}\n${getDocumentSource()}`).forEach(fid => {
    urls.push(`https://weibo.com/tv/show/${fid}`);
  });

  urls.push(url);
  return unique(urls);
}

function getDouyinResolvableUrls(url: string): string[] {
  const parsed = new URL(url);
  const urls: string[] = [];
  const modalId = parsed.searchParams.get('modal_id') || parsed.searchParams.get('aweme_id');
  const videoMatch = parsed.pathname.match(/\/video\/(\d+)/i);

  if (modalId) urls.push(`https://www.douyin.com/video/${modalId}`);
  if (videoMatch?.[1]) urls.push(`https://www.douyin.com/video/${videoMatch[1]}`);
  urls.push(url);
  return unique(urls);
}

function getPageWindow(): any {
  if (typeof unsafeWindow !== 'undefined') return unsafeWindow;
  return window;
}

function extractKuaishouPhotoIds(source: string): string[] {
  const ids: string[] = [];
  const patterns = [
    /\/short-video\/([A-Za-z0-9_-]+)/ig,
    /(?:VisionVideoDetailPhoto|VisionPhoto|RecoPhoto|FeedPhoto|PhotoEntity|Photo):([A-Za-z0-9_-]{6,})/ig,
    /(?:photoId|photo_id|photoIdStr)["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})/ig,
    /(?:[?&]|&amp;)(?:photoId|photo_id)=([A-Za-z0-9_-]{6,})/ig,
    /clientCacheKey=([A-Za-z0-9-]+?)(?:_[A-Za-z0-9]+)?\.(?:mp4|jpg|jpeg|kvif|webp)/ig
  ];

  patterns.forEach(pattern => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source))) {
      ids.push(match[1]);
    }
  });

  return unique(ids);
}

function collectKuaishouPhotoIdsFromValue(value: unknown, ids: string[], seen = new WeakSet<object>(), depth = 0): void {
  if (ids.length >= 30 || depth > 6 || value == null) return;

  if (typeof value === 'string') {
    extractKuaishouPhotoIds(value).forEach(id => ids.push(id));
    return;
  }

  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  const entries = Object.entries(value as Record<string, unknown>).slice(0, 300);
  for (const [key, item] of entries) {
    if (/^(photoId|photo_id|photoIdStr)$/i.test(key) && typeof item === 'string' && /^[A-Za-z0-9_-]{6,}$/.test(item)) {
      ids.push(item);
    }

    collectKuaishouPhotoIdsFromValue(item, ids, seen, depth + 1);
    if (ids.length >= 30) return;
  }
}

function getKuaishouWindowStatePhotoIds(): string[] {
  const pageWindow = getPageWindow();
  const stateNames = ['INIT_STATE', '__APOLLO_STATE__', '__INITIAL_STATE__', '__NEXT_DATA__', '__NUXT__'];
  const ids: string[] = [];

  stateNames.forEach(name => collectKuaishouPhotoIdsFromValue(pageWindow?.[name], ids));
  return unique(ids);
}

function getKuaishouStorageSource(): string {
  const parts: string[] = [];
  const storages = [window.localStorage, window.sessionStorage];

  storages.forEach(storage => {
    try {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index) || '';
        const value = storage.getItem(key) || '';
        if (/(kuaishou|kwai|ks|photo|video|feed|reco|apollo)/i.test(`${key}\n${value}`)) {
          parts.push(`${key}\n${value.slice(0, 100000)}`);
        }
      }
    } catch {}
  });

  return parts.join('\n');
}

function getKuaishouActiveSource(): string {
  const video = getBestVisibleVideo();
  if (!video) return '';

  return [
    video.currentSrc || '',
    video.src || '',
    video.poster || '',
    getElementTreeSource(video)
  ].join('\n');
}

function getKuaishouResolvableUrls(url: string): string[] {
  const urls: string[] = [];
  const ids = [
    ...extractKuaishouPhotoIds(url),
    ...extractKuaishouPhotoIds(getKuaishouActiveSource()),
    ...getKuaishouWindowStatePhotoIds(),
    ...extractKuaishouPhotoIds(`${getDocumentSource()}\n${getKuaishouStorageSource()}`)
  ];

  unique(ids).forEach(photoId => {
    urls.push(`https://www.kuaishou.com/short-video/${photoId}`);
  });

  urls.push(url);
  return unique(urls);
}

function isKuaishouVideoUrl(value: unknown): value is string {
  const url = normalizeUrl(value);
  return Boolean(url
    && /\.(mp4)(?:[?#]|$)/i.test(url)
    && /(kwaicdn\.com|kwimgs\.com|yximgs\.com|chenzhongtech\.com)/i.test(url));
}

function getKuaishouPerformanceVideoUrls(): string[] {
  try {
    return unique(performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(isKuaishouVideoUrl));
  } catch {
    return [];
  }
}

function getKuaishouDomTitle(video: HTMLVideoElement | null): string {
  const selectors = [
    '[class*="photo-desc"]',
    '[class*="video-desc"]',
    '[class*="caption"]',
    '[class*="desc"]',
    '[class*="title"]',
    '[data-e2e*="desc"]',
    'h1',
    'h2'
  ];

  const nearbyTitle = findNearbyText(video?.parentElement || null, selectors, 180);
  if (nearbyTitle) return nearbyTitle;
  return document.title.replace(/[-_｜|]?\s*快手.*$/i, '').trim() || '快手视频';
}

function getKuaishouDomAuthor(video: HTMLVideoElement | null): ShortVideoAuthor {
  const selectors = [
    'a[href*="/profile/"]',
    'a[href*="/user/"]',
    '[class*="author"]',
    '[class*="nickname"]',
    '[class*="user"]',
    '[class*="name"]',
    '[data-e2e*="author"]',
    '[data-e2e*="user"]'
  ];

  const name = findNearbyText(video?.parentElement || null, selectors, 80);
  return name ? { name } : {};
}

function getKuaishouDomMediaFallback(url: string): ShortVideoData | null {
  const video = getBestVisibleVideo();
  const videoUrls = unique([
    normalizeUrl(video?.currentSrc),
    normalizeUrl(video?.src),
    ...getKuaishouPerformanceVideoUrls()
  ].filter(isKuaishouVideoUrl));

  if (videoUrls.length === 0) return null;

  const title = getKuaishouDomTitle(video);
  return {
    type: 'video',
    title,
    desc: title,
    author: getKuaishouDomAuthor(video),
    cover: normalizeUrl(video?.poster) || '',
    url: videoUrls[0],
    video_backup: videoUrls.slice(1),
    platform: 'kuaishou',
    sourceUrl: url,
    itemLabel: '当前播放视频'
  };
}

function isKuaishouFeedPage(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/\/+$/, '') || '/';
  return pathname === '/new-reco' || pathname === '/';
}

function getResolvableUrls(url: string, platform: ShortVideoPlatform): string[] {
  if (platform === 'douyin') return getDouyinResolvableUrls(url);
  if (platform === 'kuaishou') return getKuaishouResolvableUrls(url);
  if (platform === 'weibo') return getWeiboResolvableUrls(url);
  return [url];
}

function isWeiboNonContentPage(url: string, candidates: string[]): boolean {
  if (candidates.some(candidate => /weibo\.com\/tv\/show\/1034:/i.test(candidate))) return false;

  const parsed = new URL(url);
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return pathname === '/'
    || /^\/newlogin/i.test(pathname)
    || /^\/login/i.test(pathname)
    || /^\/u\/?\d*$/i.test(pathname);
}

export const ShortVideoAPI = {
  getPlatformConfig(platform: ShortVideoPlatform) {
    return CONFIG.SHORT_VIDEO_PLATFORMS[platform];
  },

  getPlatformLabel(platform: ShortVideoPlatform): string {
    return this.getPlatformConfig(platform).label;
  },

  getMediaHeaders(platform: ShortVideoPlatform): Record<string, string> {
    const config = this.getPlatformConfig(platform);
    return {
      Referer: config.mediaReferer,
      Origin: config.mediaOrigin,
      'User-Agent': navigator.userAgent
    };
  },

  getProxyUrl(url: string, platform: ShortVideoPlatform): string | null {
    const config = this.getPlatformConfig(platform);
    if (!config.proxyType) return null;
    if (!/^https?:\/\//i.test(url)) return null;
    if (/api\.bugpk\.com\/api\/(?:weibo|svproxyurl)\.php/i.test(url) || /api\.bugpk\.com\/api\/weibo\?/i.test(url)) return null;
    return `${CONFIG.SHORT_VIDEO_API_BASE}/svproxyurl.php?proxyurl=${encodeURIComponent(url)}&type=${config.proxyType}`;
  },

  async parseUrl(url: string, platform: ShortVideoPlatform): Promise<ShortVideoData> {
    const config = this.getPlatformConfig(platform);
    const parseUrls = getResolvableUrls(url, platform);
    const endpoints = getEndpointCandidates(config.endpoint, config.fallbackEndpoints);
    const collectedItems: ShortVideoData[] = [];
    let lastError: Error | null = null;

    if (platform === 'weibo' && isWeiboNonContentPage(url, parseUrls)) {
      throw new Error('当前微博页面不是具体视频内容页，请打开视频详情页后再试');
    }

    if (platform === 'kuaishou' && isKuaishouFeedPage(url)) {
      const domFallback = getKuaishouDomMediaFallback(url);
      if (domFallback) return combineShortVideoItems([domFallback], platform, url);
    }

    for (const parseUrl of parseUrls) {
      for (const endpoint of endpoints) {
        const apiUrl = `${CONFIG.SHORT_VIDEO_API_BASE}/${endpoint}?url=${encodeURIComponent(parseUrl)}`;

        try {
          const response = await Network.fetchJSON(apiUrl) as ShortVideoApiResponse;
          const code = Number(response?.code);
          if (!response || !Number.isFinite(code)) {
            throw new Error('解析接口返回异常');
          }
          if (code !== 200) {
            throw new Error(response.msg || '解析失败');
          }
          const normalized = this.normalizeResponse(response.data, platform, parseUrl);
          collectedItems.push(...(normalized.items?.length ? normalized.items : [normalized]));
          break;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      if (collectedItems.length > 0 && platform !== 'weibo') {
        return combineShortVideoItems(collectedItems, platform, url);
      }
    }

    if (collectedItems.length > 0) {
      return combineShortVideoItems(collectedItems, platform, url);
    }

    if (platform === 'kuaishou') {
      const domFallback = getKuaishouDomMediaFallback(url);
      if (domFallback) return combineShortVideoItems([domFallback], platform, url);
    }

    throw lastError || new Error('解析失败');
  },

  normalizeResponse(raw: ShortVideoApiResponse['data'], platform: ShortVideoPlatform, url: string): ShortVideoData {
    const items = collectRawItems(raw).map((data, index) => this.normalizeRawItem(data, platform, url, index));
    return combineShortVideoItems(items, platform, url);
  },

  normalizeRawItem(data: RawShortVideoData, platform: ShortVideoPlatform, url: string, index = 0): ShortVideoData {
    const videoCandidates = getVideoCandidates(data);
    const images = getImageCandidates(data);
    const livePhotos = normalizeLivePhotos(data.live_photo || data.livePhoto || data.live_photos || data.livePhotos);
    const author = normalizeAuthor(data);
    const rawType = typeof data.type === 'string' ? data.type : '';
    const type = ['video', 'image', 'live'].includes(rawType)
      ? rawType as ShortVideoData['type']
      : livePhotos.length > 0
        ? 'live'
        : (images.length > 0 && videoCandidates.length === 0 ? 'image' : (videoCandidates.length > 0 ? 'video' : 'unknown'));

    const normalized: ShortVideoData = {
      ...data,
      type,
      title: data.title || data.desc || this.getPlatformLabel(platform),
      desc: data.desc || data.title || '',
      author,
      cover: normalizeUrl(data.cover || data.cover_image || data.coverImage || data.pic || data.thumbnail || data.avatar) || '',
      url: data.url || '',
      duration: typeof data.duration === 'number' ? data.duration : null,
      video_backup: videoCandidates.slice(1),
      images,
      live_photo: livePhotos,
      music: data.music && typeof data.music === 'object' ? {
        ...data.music,
        url: normalizeUrl(data.music.url || data.music.play_url || data.music.playUrl),
        cover: normalizeUrl(data.music.cover || data.music.cover_url || data.music.coverUrl)
      } : {},
      platform,
      sourceUrl: url,
      itemLabel: data.itemLabel || data.label || data.quality || `${type === 'image' ? '图集' : '视频'} ${index + 1}`
    };

    normalized.url = videoCandidates[0] || normalizeUrl(data.url) || '';
    if (!normalized.title) normalized.title = this.getPlatformLabel(platform);
    return normalized;
  }
};
