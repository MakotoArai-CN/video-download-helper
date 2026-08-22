import { Diagnostics } from './diagnostics.ts';
import { DouyinInterceptor, pickHttpUrl } from './douyin-interceptor.ts';
import type { DouyinAwemeDetail } from './douyin-interceptor.ts';
import { KuaishouInterceptor } from './kuaishou-interceptor.ts';
import type { KuaishouPhoto } from './kuaishou-interceptor.ts';
import { PLATFORMS } from './platforms.ts';
import type { ShortVideoApiResponse, ShortVideoAuthor, ShortVideoData, ShortVideoPlatform } from './types.ts';
import { XAPI } from './x-api.ts';

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

/**
 * 当前播放作品的可搜索文本：媒体地址、封面与所在节点子树。
 *
 * 限定在可见 video 的子树内，推荐流里同时存在多条内容的 DOM，
 * 全文搜索会把相邻作品的 id 一并取出。
 */
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

/**
 * 把拦截到的作品转成面板可用的条目。
 *
 * 多路清晰度按码率降序，首项作主地址，其余进 video_backup 供下载失败时重试。
 */
function toKuaishouShortVideo(photo: KuaishouPhoto, url: string, label: string): ShortVideoData {
  const title = photo.caption || getKuaishouDomTitle(getBestVisibleVideo());
  return {
    type: 'video',
    title,
    desc: photo.caption,
    author: photo.authorName ? { name: photo.authorName } : {},
    cover: photo.coverUrl,
    url: photo.urls[0].url,
    video_backup: photo.urls.slice(1).map(item => item.url),
    duration: photo.duration || null,
    video_id: photo.id,
    platform: 'kuaishou',
    sourceUrl: url,
    itemLabel: label
  };
}

/**
 * 取与当前播放内容对应的拦截结果。
 *
 * 先按作品 id 精确匹配，再退到封面比对：推荐流一次请求会返回多条内容，
 * 取最近一条会下到隔壁视频，故此处只接受能对上当前播放内容的结果。
 *
 * 缓存为空时直接返回，避免白跑一次 DOM 序列化：拦截器未命中的页面上，
 * 后续查询无论如何都取不到结果。
 */
function getKuaishouCorrelatedItem(url: string): ShortVideoData | null {
  if (KuaishouInterceptor.size() === 0) return null;

  for (const id of extractKuaishouPhotoIds(url)) {
    const photo = KuaishouInterceptor.getById(id);
    if (photo) return toKuaishouShortVideo(photo, url, '当前播放视频');
  }

  for (const id of extractKuaishouPhotoIds(getKuaishouActiveSource())) {
    const photo = KuaishouInterceptor.getById(id);
    if (photo) return toKuaishouShortVideo(photo, url, '当前播放视频');
  }

  const poster = normalizeUrl(getBestVisibleVideo()?.poster);
  const byCover = poster ? KuaishouInterceptor.getByCover(poster) : null;
  return byCover ? toKuaishouShortVideo(byCover, url, '当前播放视频') : null;
}

const KUAISHOU_MEDIA_HOSTS = /(kwaicdn\.com|kwimgs\.com|yximgs\.com|chenzhongtech\.com|ndcimgs\.com)/i;

/** 分片清单、图片与页面资源：都不是可直接落盘的整段视频。 */
const KUAISHOU_NON_MEDIA_EXT = /\.(m3u8|mpd|ts|jpe?g|png|webp|gif|svg|ico|css|js|json|html?)(?:[?#]|$)/i;

/**
 * 判断 video 元素上的地址是否可直接保存。
 *
 * 该地址即正在播放的媒体，故不限定 CDN 主机：快手视频分批投放在不同域名下
 * （已见 kwaicdn、yximgs、ndcimgs），白名单会漏掉新域名而整体取源失败。
 * 只排除分片清单与非媒体资源，保存 m3u8 会得到无法播放的文本文件。
 */
function isKuaishouPlayableUrl(value: unknown): value is string {
  const url = normalizeUrl(value);
  return Boolean(url && !KUAISHOU_NON_MEDIA_EXT.test(url));
}

/**
 * 判断资源请求是否为快手视频。
 *
 * performance 里混有埋点、脚本与封面图，也不区分来源站点，故同时校验扩展名与
 * CDN 主机。flv 与 mp4 都是整段文件，可直接落盘。
 */
function isKuaishouVideoUrl(value: unknown): value is string {
  const url = normalizeUrl(value);
  return Boolean(url
    && /\.(mp4|flv)(?:[?#]|$)/i.test(url)
    && KUAISHOU_MEDIA_HOSTS.test(url));
}

/**
 * 媒体地址的可诊断特征，形如 `txmov6.a.yximgs.com/.mp4`。
 *
 * 只取协议、主机与扩展名：完整地址带签名参数，写进日志会随诊断报告
 * 提交到公开 issue。
 */
function describeMediaUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'empty';
  if (raw.startsWith('blob:')) return 'blob';
  if (raw.startsWith('data:')) return 'data';
  try {
    const parsed = new URL(raw, location.href);
    const ext = (parsed.pathname.match(/\.([a-z0-9]{2,5})$/i) || [])[1] || 'none';
    return `${parsed.hostname}/.${ext}`;
  } catch {
    return 'invalid';
  }
}

/**
 * 快手取源失败时的现场快照，用于在诊断报告中定位缺口。
 *
 * 取源共有 GraphQL 拦截、DOM、performance 三条路径。`gql` 为拦截到的作品数：
 * 为 0 说明请求形态或字段结构变了，非 0 却仍失败则是没能与当前播放内容对应上；
 * 其余字段区分页面用了 MSE（currentSrc 为 blob）、扩展名不在白名单、
 * 以及页面尚未开始播放。
 */
function describeKuaishouSources(): string {
  const best = getBestVisibleVideo();
  const win = getPageWindow();
  const stateKeys = ['__APOLLO_STATE__', '__INITIAL_STATE__', '__NUXT__', '__PRELOADED_STATE__', 'pageData']
    .filter(key => {
      try {
        return win?.[key] != null;
      } catch {
        return false;
      }
    });

  let cdn: string[] = [];
  try {
    cdn = unique(performance.getEntriesByType('resource')
      .map(entry => entry.name)
      .filter(name => KUAISHOU_MEDIA_HOSTS.test(name))
      .map(describeMediaUrl)).slice(0, 8);
  } catch {}

  return [
    `videos=${document.querySelectorAll('video').length}`,
    `currentSrc=${describeMediaUrl(best?.currentSrc)}`,
    `src=${describeMediaUrl(best?.getAttribute('src'))}`,
    `poster=${best?.poster ? 'yes' : 'no'}`,
    `gql=${KuaishouInterceptor.installed ? KuaishouInterceptor.size() : 'off'}`,
    `state=[${stateKeys.join(',') || 'none'}]`,
    `cdn=[${cdn.join(' ') || 'none'}]`
  ].join(' ');
}

/**
 * 从资源加载记录中取快手视频地址。
 *
 * 单趟遍历并就地去重：分段 map/filter 会为全部记录各建一个中间数组，
 * 而这里只关心其中极少数命中项。
 */
function getKuaishouPerformanceVideoUrls(): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  try {
    for (const entry of performance.getEntriesByType('resource')) {
      const name = entry.name;
      if (seen.has(name) || !isKuaishouVideoUrl(name)) continue;
      seen.add(name);
      urls.push(name);
    }
  } catch {}

  return urls;
}

/**
 * 汇总当前播放视频可用的下载地址。
 *
 * video 元素上的地址排在前面作主地址，performance 里同一作品的其他清晰度
 * 作备份地址。
 *
 * @param video 可见的 video 元素
 */
function collectKuaishouMediaUrls(video: HTMLVideoElement | null): string[] {
  return unique([
    ...[normalizeUrl(video?.currentSrc), normalizeUrl(video?.src)].filter(isKuaishouPlayableUrl),
    ...getKuaishouPerformanceVideoUrls()
  ]);
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

function isKuaishouFeedPage(url: string): boolean {
  const pathname = new URL(url).pathname.replace(/\/+$/, '') || '/';
  return pathname === '/new-reco' || pathname === '/';
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

// ---------------------------------------------------------------------------
// 快手本地解析
// ---------------------------------------------------------------------------
/**
 * 从页面取当前播放视频。
 *
 * 首次取不到时按 250ms 轮询共 2 秒：切换作品或页面刚加载时，video 上的
 * 地址会短暂为空。
 *
 * @param url 当前页地址
 * @param itemLabel 面板上的条目标签，推荐流里用于说明只取当前播放的一条
 */
async function parseKuaishouLocal(url: string, itemLabel?: string): Promise<ShortVideoData | null> {
  for (let attempt = 0; attempt < 9; attempt += 1) {
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 250));

    const video = getBestVisibleVideo();
    const videoUrls = collectKuaishouMediaUrls(video);
    if (videoUrls.length === 0) continue;

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
      itemLabel
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// 小红书本地解析
// ---------------------------------------------------------------------------
function parseXhsWindowState(url: string): ShortVideoData | null {
  const win = getPageWindow();
  const stateKeys = ['__INITIAL_SSR_STATE__', '__NUXT__', '__data', 'initialState', '__REDUX_STATE__'];

  const walk = (value: any, depth: number, seen: WeakSet<object>): ShortVideoData | null => {
    if (depth > 8 || !value || typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);

    // Look for XHS note structure
    if (value.note || value.noteDetail) {
      const note = value.note || value.noteDetail;
      if (note?.video?.media?.stream) {
        const streams = note.video.media.stream;
        const h264 = streams.h264?.[0] || streams.av1?.[0] || streams.h265?.[0];
        if (h264?.masterUrl) {
          const videoUrl = h264.masterUrl;
          const images = note.imageList?.map((img: any) => img?.urlDefault || img?.url).filter(Boolean) || [];
          const isImageNote = images.length > 0 && !videoUrl;
          return {
            type: isImageNote ? 'image' : 'video',
            title: note.title || note.desc || '小红书内容',
            desc: note.desc || '',
            author: { name: note.user?.nickname || note.author?.nickname || '' },
            cover: note.cover?.urlDefault || note.cover?.url || '',
            url: videoUrl || '',
            images: isImageNote ? images : [],
            platform: 'xiaohongshu',
            sourceUrl: url
          };
        }
      }
      // Image note
      if (note?.imageList?.length > 0) {
        const images = note.imageList.map((img: any) => img?.urlDefault || img?.infoList?.[0]?.url || img?.url).filter(Boolean);
        if (images.length > 0) {
          return {
            type: 'image',
            title: note.title || note.desc || '小红书图集',
            desc: note.desc || '',
            author: { name: note.user?.nickname || '' },
            cover: images[0],
            url: '',
            images,
            platform: 'xiaohongshu',
            sourceUrl: url
          };
        }
      }
    }

    const entries = Object.entries(value).slice(0, 100);
    for (const [, v] of entries) {
      const found = walk(v, depth + 1, seen);
      if (found) return found;
    }
    return null;
  };

  const seen = new WeakSet<object>();
  for (const key of stateKeys) {
    try {
      const result = walk(win[key], 0, seen);
      if (result) return result;
    } catch {}
  }

  // Also try performance entries for xhs video CDN
  try {
    const videoUrls = performance.getEntriesByType('resource')
      .map(e => e.name)
      .filter(n => /xhscdn\.com.*\.mp4/i.test(n) || /sns-video.*\.mp4/i.test(n));
    if (videoUrls.length > 0) {
      const video = getBestVisibleVideo();
      return {
        type: 'video',
        title: document.title.replace(/[-_|｜]?\s*小红书.*$/i, '').trim() || '小红书视频',
        desc: '',
        author: {},
        cover: video?.poster || '',
        url: videoUrls[0],
        platform: 'xiaohongshu',
        sourceUrl: url
      };
    }
  } catch {}
  return null;
}

async function parseXhsLocal(url: string): Promise<ShortVideoData | null> {
  // Try immediately
  const immediate = parseXhsWindowState(url);
  if (immediate?.url || (immediate?.images && immediate.images.length > 0)) return immediate;

  // Poll for SSR data to populate
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 300));
    const result = parseXhsWindowState(url);
    if (result?.url || (result?.images && result.images.length > 0)) return result;
  }

  // DOM fallback: video element
  const video = getBestVisibleVideo();
  const src = video?.currentSrc || video?.src;
  if (src && src.startsWith('http')) {
    return {
      type: 'video',
      title: document.title.replace(/[-_|｜]?\s*小红书.*$/i, '').trim() || '小红书视频',
      desc: '',
      author: {},
      cover: video?.poster || '',
      url: src,
      platform: 'xiaohongshu',
      sourceUrl: url
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 微博本地解析
// ---------------------------------------------------------------------------
async function parseWeiboLocal(url: string): Promise<ShortVideoData | null> {
  const win = getPageWindow();

  // Try window state first
  const stateAttempt = (() => {
    try {
      const keys = ['__INITIAL_STATE__', '__preloadData', '__wb_data__', 'WEIBO_DATA'];
      for (const k of keys) {
        const val = win[k];
        if (!val) continue;
        const walk = (v: any, d: number, seen: WeakSet<object>): any => {
          if (d > 6 || !v || typeof v !== 'object') return null;
          if (seen.has(v)) return null;
          seen.add(v);
          if (v.video_sources && Array.isArray(v.video_sources)) return v;
          if (v.media_info?.stream_url) return v;
          // 图集帖子：含 pic_ids 和 pic_infos 且有内容
          if (Array.isArray(v.pic_ids) && v.pic_ids.length > 0 && v.pic_infos) return v;
          for (const [, child] of Object.entries(v).slice(0, 100)) {
            const r = walk(child, d + 1, seen);
            if (r) return r;
          }
          return null;
        };
        const found = walk(val, 0, new WeakSet());
        if (found) {
          const cleanText = found.text?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || '';
          const title = cleanText || '微博内容';
          const authorName = found.user?.screen_name || '';

          // 图集
          if (Array.isArray(found.pic_ids) && found.pic_ids.length > 0 && found.pic_infos) {
            const images = (found.pic_ids as string[]).map((pid: string) => {
              const info = found.pic_infos[pid];
              return info?.original?.url || info?.large?.url || info?.bmiddle?.url || '';
            }).filter(Boolean);
            if (images.length > 0) {
              return {
                type: 'image' as const,
                title,
                desc: cleanText,
                author: { name: authorName },
                cover: images[0],
                url: '',
                images,
                platform: 'weibo' as const,
                sourceUrl: url
              };
            }
          }

          // 视频
          const sources = found.video_sources || [];
          const best = sources.find((s: any) => s.quality === 'original' || s.quality === 'HD') || sources[0];
          const videoUrl = best?.url || found.media_info?.stream_url;
          if (videoUrl) {
            return {
              type: 'video' as const,
              title,
              desc: cleanText,
              author: { name: authorName },
              cover: found.thumbnail_pic || found.original_pic || '',
              url: videoUrl,
              platform: 'weibo' as const,
              sourceUrl: url
            };
          }
        }
      }
    } catch {}
    return null;
  })();
  if (stateAttempt) return stateAttempt;

  // Use weibo AJAX show API
  const fids = extractWeiboFids(`${url}\n${getDocumentSource()}`);
  for (const fid of fids) {
    try {
      const tvUrl = `https://weibo.com/tv/show/${fid}?from=api`;
      const resp = await (getPageWindow() as any).fetch(tvUrl, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'include'
      });
      const json = await resp.json();
      const urls = json?.data?.urls;
      if (urls && typeof urls === 'object') {
        const sorted = Object.entries(urls as Record<string, string>)
          .sort(([a], [b]) => {
            const rank = (k: string) => k.includes('ld') ? 0 : k.includes('hd') ? 1 : k.includes('ori') ? 2 : 0;
            return rank(b) - rank(a);
          });
        if (sorted.length > 0) {
          return {
            type: 'video',
            title: json.data?.title || '微博视频',
            desc: '',
            author: {},
            cover: '',
            url: sorted[0][1],
            video_backup: sorted.slice(1).map(e => e[1]),
            platform: 'weibo',
            sourceUrl: url
          };
        }
      }
    } catch {}
  }

  // DOM video fallback: also check performance entries for weibo CDN mp4
  const video = getBestVisibleVideo();
  const directSrc = (() => {
    const src = video?.currentSrc || video?.src;
    if (src && src.startsWith('http') && !src.includes('blob:')) return src;
    // weibo uses video.js HLS, look for mp4 in performance entries
    try {
      const perf = performance.getEntriesByType('resource')
        .map(e => e.name)
        .filter(n => /\.mp4/i.test(n) && /weibo|sinaimg|weibocdn|sinastorage|scloud/i.test(n));
      if (perf.length > 0) return perf[perf.length - 1];
    } catch {}
    return null;
  })();
  if (directSrc) {
    const weiboTitle = '微博视频';
    const weiboAuthor = {};
    return {
      type: 'video',
      title: weiboTitle,
      desc: '',
      author: weiboAuthor,
      cover: video?.poster || '',
      url: directSrc,
      platform: 'weibo',
      sourceUrl: url
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// 今日头条本地解析
// ---------------------------------------------------------------------------
function parseToutiaoWindowState(url: string): ShortVideoData | null {
  const win = getPageWindow();
  const stateKeys = ['__INITIAL_STATE__', 'SSR_HYDRATION_DATA', '__pageData', 'detailSSRData', '__tt_spa_initial_state__', 'APP_INITIAL_DATA', 'PAGE_SSR_DATA'];

  const extract = (value: any, depth: number, seen: WeakSet<object>): ShortVideoData | null => {
    if (depth > 8 || !value || typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);

    // toutiao video structure: .video_list (object of quality variants)
    if (value.video_list && typeof value.video_list === 'object' && !Array.isArray(value.video_list)) {
      const entries = Object.values(value.video_list as Record<string, any>);
      const best = entries.sort((a: any, b: any) => (b.definition || 0) - (a.definition || 0))[0];
      if (best?.main_url || best?.play_url) {
        const videoUrl = best.main_url || best.play_url;
        try {
          return {
            type: 'video',
            title: value.title || value.abstract || document.title.replace(/[-|]?\s*今日头条.*$/i, '').trim() || '头条视频',
            desc: value.abstract || '',
            author: { name: value.user_info?.name || value.source || '' },
            cover: value.detail_video_large_image?.url || value.thumb_image_list?.[0]?.url || '',
            url: decodeURIComponent(videoUrl),
            platform: 'toutiao',
            sourceUrl: url
          };
        } catch { /* decodeURIComponent can throw */ }
      }
    }
    // .mediaInfo or .videoInfo structure
    const mediaInfo = value.mediaInfo || value.videoInfo;
    if (mediaInfo?.mp4_url || mediaInfo?.mp4_play_url || mediaInfo?.video_url) {
      const videoUrl = mediaInfo.mp4_url || mediaInfo.mp4_play_url || mediaInfo.video_url;
      return {
        type: 'video',
        title: mediaInfo?.title || value.title || '头条视频',
        desc: '',
        author: { name: mediaInfo?.user_info?.name || '' },
        cover: mediaInfo?.poster || mediaInfo?.cover?.url || '',
        url: videoUrl,
        platform: 'toutiao',
        sourceUrl: url
      };
    }
    // direct play_url / mp4_url on a node
    if ((value.play_url || value.mp4_url) && (value.title || value.abstract)) {
      const videoUrl = value.play_url || value.mp4_url;
      return {
        type: 'video',
        title: value.title || value.abstract || '头条视频',
        desc: value.abstract || '',
        author: { name: value.user_info?.name || value.source || '' },
        cover: value.cover?.url || value.thumb_image_list?.[0]?.url || '',
        url: videoUrl,
        platform: 'toutiao',
        sourceUrl: url
      };
    }

    const entries2 = Object.entries(value).slice(0, 100);
    for (const [, v] of entries2) {
      const r = extract(v, depth + 1, seen);
      if (r) return r;
    }
    return null;
  };

  const seen = new WeakSet<object>();
  for (const key of stateKeys) {
    try {
      const r = extract(win[key], 0, seen);
      if (r) return r;
    } catch {}
  }

  // Try page script tags for JSON data
  try {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script:not([src])'));
    for (const script of scripts) {
      const text = script.textContent || '';
      if (!text.includes('video_list') && !text.includes('videoInfo')) continue;
      const match = text.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?\s*(?:window|$)/s);
      if (match?.[1]) {
        try {
          const parsed = JSON.parse(match[1]);
          const r = extract(parsed, 0, new WeakSet());
          if (r) return r;
        } catch {}
      }
    }
  } catch {}
  return null;
}

async function parseToutiaoLocal(url: string): Promise<ShortVideoData | null> {
  const immediate = parseToutiaoWindowState(url);
  if (immediate) return immediate;

  // Poll
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 300));
    const result = parseToutiaoWindowState(url);
    if (result) return result;

    // Also try DOM video
    const v = getBestVisibleVideo();
    const src = v?.currentSrc;
    if (src && src.startsWith('http') && !src.includes('blob:')) {
      return {
        type: 'video',
        title: document.title.replace(/[-|]?\s*今日头条.*$/i, '').trim() || '头条视频',
        desc: '',
        author: {},
        cover: v?.poster || '',
        url: src,
        platform: 'toutiao',
        sourceUrl: url
      };
    }
  }

  // Final DOM fallback
  const v = getBestVisibleVideo();
  const src = v?.currentSrc || v?.src;
  if (src && src.startsWith('http') && !src.includes('blob:')) {
    return {
      type: 'video',
      title: document.title.replace(/[-|]?\s*今日头条.*$/i, '').trim() || '头条视频',
      desc: '',
      author: {},
      cover: v?.poster || '',
      url: src,
      platform: 'toutiao',
      sourceUrl: url
    };
  }
  return null;
}

/**
 * 各平台的解析入口。
 *
 * 统一签名：拿到最终可用的 ShortVideoData 则返回，无内容返回 null 由调用方
 * 生成通用错误文案；需要更具体的提示时（微博未打开详情页）由解析器自行抛出。
 *
 * 表放在本文件而非 platforms.ts：解析器实现依赖本文件的辅助函数，
 * 反向引用会形成循环导入。platforms.ts 只承载数据，不承载行为。
 */
const PARSERS: Record<ShortVideoPlatform, (url: string) => Promise<ShortVideoData | null>> = {
  douyin: url => ShortVideoAPI.parseDouyinLocal(url),

  kuaishou: async url => {
    // GraphQL 拦截结果最完整（带多路清晰度与标题），且不受 MSE 播放影响
    const correlated = getKuaishouCorrelatedItem(url);
    if (correlated) return combineShortVideoItems([correlated], 'kuaishou', url);

    // 推荐流页无独立详情接口，只能从页面取源；标注条目说明只取当前播放的一条
    const local = await parseKuaishouLocal(url, isKuaishouFeedPage(url) ? '当前播放视频' : undefined);
    if (local) return combineShortVideoItems([local], 'kuaishou', url);

    // 详情页只有一条内容，对不上当前播放内容也不会下错
    if (!isKuaishouFeedPage(url)) {
      const latest = KuaishouInterceptor.getLatest();
      if (latest) return combineShortVideoItems([toKuaishouShortVideo(latest, url, '')], 'kuaishou', url);
    }

    Diagnostics.debug('kuaishou', `未取到媒体源: ${describeKuaishouSources()}`);
    return null;
  },

  xiaohongshu: async url => {
    const local = await parseXhsLocal(url);
    return local ? combineShortVideoItems([local], 'xiaohongshu', url) : null;
  },

  weibo: async url => {
    const local = await parseWeiboLocal(url);
    if (local) return combineShortVideoItems([local], 'weibo', url);
    if (isWeiboNonContentPage(url, [url])) throw new Error('请打开微博视频详情页后再试');
    return null;
  },

  toutiao: async url => {
    const local = await parseToutiaoLocal(url);
    return local ? combineShortVideoItems([local], 'toutiao', url) : null;
  },

  x: async url => {
    const data = await XAPI.parseUrl(url);
    if (!data) return null;
    return combineShortVideoItems(data.items?.length ? data.items : [data], 'x', url);
  }
};

export const ShortVideoAPI = {
  getPlatformConfig(platform: ShortVideoPlatform) {
    return PLATFORMS[platform];
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

  normalizeDouyinDetail(detail: DouyinAwemeDetail, url: string): ShortVideoData {
    const qualities = DouyinInterceptor.extractQualities(detail);
    const primaryUrl = qualities[0]?.url || '';
    const backupUrls = qualities.slice(1).map(q => q.url);
    const video = detail.video;
    const cover = pickHttpUrl(video?.cover?.url_list);
    const avatarUrl = pickHttpUrl(detail.author?.avatar_thumb?.url_list);
    const musicUrl = pickHttpUrl(detail.music?.play_url?.url_list) || detail.music?.play_url?.uri || '';
    const musicCover = pickHttpUrl(detail.music?.cover_medium?.url_list);

    const items: ShortVideoData[] = qualities.map(q => ({
      type: 'video' as const,
      title: detail.desc || '抖音视频',
      desc: detail.desc || '',
      author: { name: detail.author?.nickname || '', id: detail.author?.uid || '', avatar: avatarUrl },
      cover,
      url: q.url,
      video_backup: [],
      duration: video?.duration ? video.duration / 1000 : null,
      music: musicUrl ? { title: detail.music?.title, author: detail.music?.author, url: musicUrl, cover: musicCover } : undefined,
      platform: 'douyin' as const,
      sourceUrl: url,
      itemLabel: q.label
    }));

    return {
      type: 'video',
      title: detail.desc || '抖音视频',
      desc: detail.desc || '',
      author: { name: detail.author?.nickname || '', id: detail.author?.uid || '', avatar: avatarUrl },
      cover,
      url: primaryUrl,
      video_backup: backupUrls,
      duration: video?.duration ? video.duration / 1000 : null,
      music: musicUrl ? { title: detail.music?.title, author: detail.music?.author, url: musicUrl, cover: musicCover } : undefined,
      platform: 'douyin',
      sourceUrl: url,
      items: items.length > 1 ? items : undefined,
      alternativeSources: items.length > 1
    };
  },

  async parseDouyinLocal(url: string, waitMs = 3000): Promise<ShortVideoData | null> {
    const extractAwemeId = (u: string): string | null => {
      try {
        const p = new URL(u);
        return p.searchParams.get('modal_id')
          || p.searchParams.get('aweme_id')
          || p.pathname.match(/\/(?:video|note)\/(\d{15,20})/)?.[1]
          || null;
      } catch {
        return null;
      }
    };

    const AWEME_ID_RE = /\b(\d{15,20})\b/;

    // 沿 fiber.return 链向上扫描 props 中的 aweme_id
    const scanFiberChain = (fiber: any): string | null => {
      for (let i = 0; i < 60 && fiber; i++) {
        const props = fiber.memoizedProps || fiber.pendingProps;
        if (props) {
          const id = props.aweme_id || props.awemeId || props.itemId || props.videoId
            || props.item?.aweme_id || props.item?.awemeId
            || props.aweme?.aweme_id || props.video?.aweme_id
            || props.data?.aweme_id || props.awemeInfo?.aweme_id
            || props.feedItem?.aweme_id || props.videoData?.aweme_id;
          if (id && AWEME_ID_RE.test(String(id))) return String(id).match(AWEME_ID_RE)![1];
        }
        fiber = fiber.return;
      }
      return null;
    };

    // 从 DOM 父节点树逐层向上找，对每个挂了 fiber 的元素扫 fiber 链
    const extractFromDomFibers = (startEl: Element | null): string | null => {
      let el: Element | null = startEl;
      while (el && el !== document.documentElement) {
        const fiberKey = Object.keys(el as object).find(
          k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
        );
        if (fiberKey) {
          const found = scanFiberChain((el as any)[fiberKey]);
          if (found) return found;
        }
        el = el.parentElement;
      }
      return null;
    };

    // 从 DOM 元素属性、href 链接、React fiber 中提取 aweme_id
    const extractAwemeIdFromDom = (): string | null => {
      const video = getBestVisibleVideo();

      // 1. 最可靠方法：class 名 video_{aweme_id}（推荐页每个视频卡片的 sliderVideo 容器）
      // 先从当前可见视频向上找
      let el2: Element | null = video;
      while (el2 && el2 !== document.documentElement) {
        const m = el2.className?.match?.(/\bvideo_(\d{15,20})\b/);
        if (m?.[1]) return m[1];
        el2 = el2.parentElement;
      }
      // 全页扫描 class 名，但取可见面积最大的那个
      const classMatches = Array.from(document.querySelectorAll<HTMLElement>('[class*="video_"]'));
      let bestClassEl: HTMLElement | null = null;
      let bestArea = 0;
      for (const el of classMatches) {
        const m = el.className.match(/\bvideo_(\d{15,20})\b/);
        if (!m?.[1]) continue;
        const r = el.getBoundingClientRect();
        const visW = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
        const visH = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        const area = visW * visH;
        if (area > bestArea) { bestArea = area; bestClassEl = el; }
      }
      if (bestClassEl) {
        const m = bestClassEl.className.match(/\bvideo_(\d{15,20})\b/);
        if (m?.[1]) return m[1];
      }

      // 2. data-e2e-vid 属性——同样取可见面积最大的
      const eVidEls = Array.from(document.querySelectorAll<HTMLElement>('[data-e2e-vid]'));
      let bestEVid: HTMLElement | null = null;
      let bestEArea = 0;
      for (const el of eVidEls) {
        const r = el.getBoundingClientRect();
        const visW = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
        const visH = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        const area = visW * visH;
        if (area > bestEArea) { bestEArea = area; bestEVid = el; }
      }
      if (bestEVid) {
        const vid = bestEVid.getAttribute('data-e2e-vid');
        if (vid && AWEME_ID_RE.test(vid)) return vid.match(AWEME_ID_RE)![1];
      }

      // 3. React fiber 扫描：从视频元素逐层向上找到挂了 fiber 的祖先，再沿 fiber 链向上扫
      const fiberId = extractFromDomFibers(video);
      if (fiberId) return fiberId;

      // 2. data-aweme-id / data-id 属性扫描
      const dataAttrs = ['data-aweme-id', 'data-item-id', 'data-awemeid', 'data-id', 'data-video-id'];
      const allElements = Array.from(document.querySelectorAll<HTMLElement>('[data-aweme-id],[data-item-id],[data-awemeid]'));
      for (const el of allElements) {
        for (const attr of dataAttrs) {
          const val = el.getAttribute(attr);
          if (val && AWEME_ID_RE.test(val)) return val.match(AWEME_ID_RE)![1];
        }
      }

      // 3. 从视频元素父节点树中找 data-* 和 a[href] 链接
      let el: Element | null = video;
      for (let depth = 0; depth < 15 && el; depth++) {
        for (const attr of dataAttrs) {
          const val = el.getAttribute(attr);
          if (val && AWEME_ID_RE.test(val)) return val.match(AWEME_ID_RE)![1];
        }
        const link = el.querySelector<HTMLAnchorElement>('a[href*="/video/"],a[href*="/note/"]');
        if (link) {
          const m = link.getAttribute('href')?.match(/\/(?:video|note)\/(\d{15,20})/);
          if (m?.[1]) return m[1];
        }
        el = el.parentElement;
      }

      // 4. 全页 a[href] 链接
      const allLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/video/"],a[href*="/note/"]'));
      for (const link of allLinks) {
        const m = link.getAttribute('href')?.match(/\/(?:video|note)\/(\d{15,20})/);
        if (m?.[1]) return m[1];
      }

      // 5. 从全局 feed 状态扫描（推荐页 SSR 数据）
      const feedId = DouyinInterceptor.getAwemeIdFromFeed();
      if (feedId) return feedId;

      return null;
    };

    const awemeIdFromUrl = extractAwemeId(url);

    // 方案4 快速路径：URL 中有 aweme_id 则立即请求官方 API
    if (awemeIdFromUrl) {
      const detail = await DouyinInterceptor.fetchDetail(awemeIdFromUrl);
      if (detail) {
        const data = this.normalizeDouyinDetail(detail, url);
        if (data.url) return data;
      }
    }

    // URL 无 aweme_id（推荐页）：先从 DOM 提取当前视频 id，从缓存精确命中
    if (!awemeIdFromUrl) {
      const domId = extractAwemeIdFromDom();
      if (domId) {
        const cached = DouyinInterceptor.getByAwemeId(domId);
        if (cached) {
          const data = this.normalizeDouyinDetail(cached, url);
          if (data.url) return data;
        }
        // 缓存未命中则直接调 API
        const detail = await DouyinInterceptor.fetchDetail(domId);
        if (detail) {
          const data = this.normalizeDouyinDetail(detail, url);
          if (data.url) return data;
        }
      }
    }

    // 方案2+3+1：轮询等待
    const interval = 300;
    const maxTries = Math.ceil(waitMs / interval);
    let lastDomIdFetched: string | null = null;

    for (let i = 0; i < maxTries; i++) {
      const detail = DouyinInterceptor.getByUrl(url);
      if (detail) {
        const data = this.normalizeDouyinDetail(detail, url);
        if (data.url) return data;
      }

      const dom = DouyinInterceptor.getFromDom();
      if (dom?.url) {
        return {
          type: 'video',
          title: document.title.replace(/[-_|｜]?\s*抖音.*$/i, '').trim() || '抖音视频',
          desc: '',
          cover: dom.cover,
          url: dom.url,
          video_backup: [],
          platform: 'douyin',
          sourceUrl: url,
          itemLabel: '当前播放'
        };
      }

      // 方案4：URL 无 aweme_id 时，从 DOM 链接提取并调 API（推荐页场景）
      if (!awemeIdFromUrl) {
        const domId = extractAwemeIdFromDom();
        if (domId && domId !== lastDomIdFetched) {
          lastDomIdFetched = domId;
          const detail2 = await DouyinInterceptor.fetchDetail(domId);
          if (detail2) {
            const data = this.normalizeDouyinDetail(detail2, location.href);
            if (data.url) return data;
          }
        }
      }

      if (i < maxTries - 1) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }

    // 方案4 最终兜底：从 location.href 提取
    if (!awemeIdFromUrl) {
      const fallbackId = extractAwemeId(location.href);
      if (fallbackId) {
        const detail = await DouyinInterceptor.fetchDetail(fallbackId);
        if (detail) {
          const data = this.normalizeDouyinDetail(detail, location.href);
          if (data.url) return data;
        }
      }
    }

    return null;
  },

  async parseUrl(url: string, platform: ShortVideoPlatform): Promise<ShortVideoData> {
    const parse = PARSERS[platform];
    if (!parse) throw new Error('不支持的平台');
    const data = await parse(url);
    if (data) return data;
    throw new Error(`解析失败，无法获取${this.getPlatformLabel(platform)}内容`);
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
