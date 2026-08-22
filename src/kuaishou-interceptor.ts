declare const unsafeWindow: any;

/** 一路可直接落盘的播放地址。 */
export interface KuaishouPlayUrl {
  url: string;
  label: string;
  bitrate: number;
}

/** 从 GraphQL 响应归一化出的作品信息。 */
export interface KuaishouPhoto {
  id: string;
  caption: string;
  coverUrl: string;
  duration: number;
  authorName: string;
  urls: KuaishouPlayUrl[];
}

const CACHE_MAX = 30;
const cache = new Map<string, KuaishouPhoto>();

/**
 * 只接受整段文件。
 *
 * manifest 里同时存在 m3u8/mpd 分片清单，直接保存会得到一个无法播放的文本文件。
 */
const PROGRESSIVE_URL = /\.(mp4|flv)(?:[?#]|$)/i;

function isPlayableUrl(value: unknown): value is string {
  return typeof value === 'string'
    && /^https?:\/\//i.test(value)
    && PROGRESSIVE_URL.test(value);
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

/**
 * 收集一个 representation 节点上的主地址与备份地址。
 *
 * @param node representation 数组中的一项
 * @param target 收集结果的数组
 */
function collectRepresentation(node: any, target: KuaishouPlayUrl[]): void {
  if (!node || typeof node !== 'object') return;

  const bitrate = pickNumber(node.avgBitrate, node.maxBitrate, node.bitrate);
  const height = pickNumber(node.height);
  const label = pickString(node.qualityLabel, node.shortName, node.name)
    || (height ? `${height}p` : '')
    || (bitrate ? `${Math.round(bitrate)}kbps` : '原画');

  const candidates: unknown[] = [node.url];
  if (Array.isArray(node.backupUrl)) candidates.push(...node.backupUrl);
  if (typeof node.backupUrl === 'string') candidates.push(node.backupUrl);

  candidates.filter(isPlayableUrl).forEach(url => {
    target.push({ url, label, bitrate });
  });
}

/**
 * 从 videoResource / manifest 结构中取出所有清晰度。
 *
 * 同一作品的 h264、hevc 两套编码都在这里，故不在此处去重编码，
 * 交由调用方按地址去重后按码率排序。
 */
function collectManifestUrls(node: any, target: KuaishouPlayUrl[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 4) return;

  if (Array.isArray(node.adaptationSet)) {
    node.adaptationSet.forEach((set: any) => {
      if (Array.isArray(set?.representation)) {
        set.representation.forEach((item: any) => collectRepresentation(item, target));
      }
    });
    return;
  }

  Object.values(node).forEach(value => collectManifestUrls(value, target, depth + 1));
}

/**
 * 判断一个对象是否为作品节点。
 *
 * 判据是「有 id」且「带播放信息」：feed 响应里作者、音乐等同级对象也有 id，
 * 只看 id 会把它们一起收进来。
 */
function isPhotoNode(value: any): boolean {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.id !== 'string' && typeof value.id !== 'number') return false;
  return typeof value.photoUrl === 'string'
    || value.videoResource != null
    || value.manifest != null;
}

/**
 * 把作品节点转成缓存条目。
 *
 * @param node GraphQL 响应中的 photo 对象
 * @param author 同级的 author 对象，feed 里作者与作品分开挂
 * @returns 无可用播放地址时返回 null
 */
function normalizePhoto(node: any, author?: any): KuaishouPhoto | null {
  const urls: KuaishouPlayUrl[] = [];

  if (isPlayableUrl(node.photoUrl)) {
    // photoUrl 是站点给出的默认播放地址，无码率可比，置最大值让它排在首位
    urls.push({ url: node.photoUrl, label: '原画', bitrate: Number.MAX_SAFE_INTEGER });
  }
  collectManifestUrls(node.videoResource, urls);
  collectManifestUrls(node.manifest, urls);

  const seenUrl = new Set<string>();
  const deduped = urls
    .filter(item => !seenUrl.has(item.url) && seenUrl.add(item.url))
    .sort((a, b) => b.bitrate - a.bitrate);

  if (deduped.length === 0) return null;

  return {
    id: String(node.id),
    caption: pickString(node.caption, node.originCaption, node.name),
    coverUrl: pickString(node.coverUrl, node.webpCoverUrl, node.animatedCoverUrl),
    duration: pickNumber(node.duration),
    authorName: pickString(author?.name, node.userName, node.author?.name),
    urls: deduped
  };
}

/**
 * 写入缓存，同一作品的已有字段不被空值覆盖。
 *
 * 同一作品会从多个响应里拦到（推荐流带作者名与封面，详情页只带作品本身），
 * 各响应携带的字段并不一致，直接覆盖会把先前取到的作者名或封面清空。
 */
function storePhoto(photo: KuaishouPhoto): void {
  const prev = cache.get(photo.id);
  const merged: KuaishouPhoto = prev
    ? {
      id: photo.id,
      caption: photo.caption || prev.caption,
      coverUrl: photo.coverUrl || prev.coverUrl,
      duration: photo.duration || prev.duration,
      authorName: photo.authorName || prev.authorName,
      urls: photo.urls.length >= prev.urls.length ? photo.urls : prev.urls
    }
    : photo;

  if (prev) {
    // 重新插入让它排到末尾，getLatest 取的就是最近一次拦截到的作品
    cache.delete(photo.id);
  } else if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value!);
  }
  cache.set(merged.id, merged);
}

/** 遍历状态。 */
interface WalkState {
  /** 已进入的对象，用于环检测。 */
  visited: WeakSet<object>;
  /** 已解析过的作品节点，避免重复解析清晰度。 */
  parsed: WeakSet<object>;
}

/**
 * 深度遍历响应体收集作品节点。
 *
 * 不按 operationName 定位：推荐流、详情页、作者页各自的字段名不同且会随
 * 前端改版变化，按结构特征找更稳。
 *
 * 已解析的作品节点单独记账，不能并入环检测集合：后者会在进入前直接返回，
 * 连该节点的子树一起跳过，嵌套在作品下的作品就收不到了。
 */
function walkForPhotos(value: any, depth: number, state: WalkState): void {
  if (depth > 8 || value == null || typeof value !== 'object') return;
  if (state.visited.has(value)) return;
  state.visited.add(value);

  if (Array.isArray(value)) {
    const end = Math.min(value.length, 50);
    for (let index = 0; index < end; index += 1) walkForPhotos(value[index], depth + 1, state);
    return;
  }

  const node = isPhotoNode(value.photo) ? value.photo : (isPhotoNode(value) ? value : null);
  if (node && !state.parsed.has(node)) {
    state.parsed.add(node);
    const photo = normalizePhoto(node, value.author || node.author);
    if (photo) storePhoto(photo);
  }

  let visited = 0;
  for (const key in value) {
    if (visited >= 200) return;
    visited += 1;
    walkForPhotos(value[key], depth + 1, state);
  }
}

/**
 * 解析 GraphQL 响应体。
 *
 * JSON.parse 与深度遍历的开销随响应体增大，而站内多数查询（评论、计数、
 * 用户信息）不含播放地址，故先用子串筛一遍再解析。
 */
function tryParseGraphqlResponse(text: string): void {
  if (!text || text.length > 8_000_000) return;
  if (text.indexOf('photoUrl') < 0 && text.indexOf('adaptationSet') < 0) return;
  try {
    walkForPhotos(JSON.parse(text), 0, { visited: new WeakSet<object>(), parsed: new WeakSet<object>() });
  } catch {}
}

/**
 * 从 XHR 响应中收集作品节点。
 *
 * responseType 为 json/blob/arraybuffer/document 时读 responseText 会抛
 * InvalidStateError，该异常发生在 load 回调里会冒泡到页面，故按类型分流；
 * json 已是解析结果，跳过子串预筛直接遍历。
 */
function collectPhotosFromXhr(xhr: XMLHttpRequest): void {
  if (xhr.responseType === 'json') {
    walkForPhotos(xhr.response, 0, { visited: new WeakSet<object>(), parsed: new WeakSet<object>() });
    return;
  }
  if (xhr.responseType === '' || xhr.responseType === 'text') {
    tryParseGraphqlResponse(xhr.responseText || '');
  }
}

/**
 * 判断是否为快手 GraphQL 请求。
 *
 * 页面自身多用相对地址 `/graphql`，故先按当前页解析成绝对地址再判定，
 * 只匹配字符串会漏掉全部同源请求。
 */
function isGraphqlUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, location.href);
    return /(^|\.)kuaishou\.com$/i.test(parsed.hostname) && /\/graphql/i.test(parsed.pathname);
  } catch {
    return /\/graphql/i.test(url);
  }
}

/** 封面地址的可比对特征。 */
interface CoverKeys {
  /** 文件名去扩展名。 */
  base: string;
  /** clientCacheKey 查询参数去扩展名，作品间唯一。 */
  cacheKey: string;
}

/**
 * 取封面地址的可比对特征。
 *
 * 封面在页面上与响应里可能带不同的裁剪参数与签名，只有这两处稳定。
 */
function coverKeys(value: string): CoverKeys {
  try {
    const parsed = new URL(value, location.href);
    const base = (parsed.pathname.split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
    const cacheKey = parsed.searchParams.get('clientCacheKey') || '';
    return {
      base: base.toLowerCase(),
      cacheKey: cacheKey.replace(/\.[a-z0-9]+$/i, '').toLowerCase()
    };
  } catch {
    return { base: '', cacheKey: '' };
  }
}

export const KuaishouInterceptor = {
  installed: false,

  /** 挂接 fetch 与 XHR，抓取 GraphQL 响应里的作品播放地址。 */
  install(): void {
    if (this.installed) return;
    this.installed = true;

    const win = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
    const origFetch = win.fetch;

    if (typeof origFetch === 'function') {
      win.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
        const url = typeof input === 'string'
          ? input
          : (input instanceof URL ? input.href : (input as Request).url);
        const promise: Promise<Response> = origFetch.call(this, input, init);
        if (!isGraphqlUrl(url)) return promise;

        return promise.then(response => {
          response.clone().text().then(tryParseGraphqlResponse).catch(() => {});
          return response;
        });
      };
    }

    const origXhrOpen = win.XMLHttpRequest?.prototype?.open;
    const origXhrSend = win.XMLHttpRequest?.prototype?.send;
    if (typeof origXhrOpen !== 'function' || typeof origXhrSend !== 'function') return;

    win.XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
      this._bdl_ks_url = url;
      return origXhrOpen.call(this, method, url, ...rest);
    };

    win.XMLHttpRequest.prototype.send = function(...args: any[]) {
      if (isGraphqlUrl(this._bdl_ks_url || '')) {
        this.addEventListener('load', function(this: XMLHttpRequest) {
          collectPhotosFromXhr(this);
        });
      }
      return origXhrSend.apply(this, args);
    };
  },

  /** 按作品 id 精确查缓存。 */
  getById(id: string): KuaishouPhoto | null {
    return cache.get(id) || null;
  },

  /**
   * 按封面地址反查作品，用于推荐流里定位当前播放的那一条。
   *
   * clientCacheKey 在作品间唯一，优先级高于文件名：文件名可能撞车，
   * 撞车时会取到相邻作品。故整表扫完没有 clientCacheKey 命中才用文件名。
   *
   * @param poster 可见 video 的 poster
   */
  getByCover(poster: string): KuaishouPhoto | null {
    const target = coverKeys(poster);
    if (!target.cacheKey && !target.base) return null;

    let byBase: KuaishouPhoto | null = null;
    for (const photo of cache.values()) {
      const keys = coverKeys(photo.coverUrl);
      if (target.cacheKey && keys.cacheKey === target.cacheKey) return photo;
      if (!byBase && target.base && keys.base === target.base) byBase = photo;
    }

    return byBase;
  },

  /** 最近一次拦截到的作品。 */
  getLatest(): KuaishouPhoto | null {
    let last: KuaishouPhoto | null = null;
    cache.forEach(photo => { last = photo; });
    return last;
  },

  /** 缓存条数，供诊断日志区分「没装上」与「装上了但没抓到」。 */
  size(): number {
    return cache.size;
  }
};
