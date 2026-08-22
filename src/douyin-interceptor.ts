declare const unsafeWindow: any;

export interface DouyinVideoQuality {
  quality_type: number;
  /** 接口返回的画质名，Web 端常缺省。 */
  quality_desc?: string;
  /** 档位名，形如 `normal_1080_0`、`adapt_lowest_720_1`。 */
  gear_name?: string;
  /** 1 表示 H.265 编码，接口有时以字符串下发。 */
  is_h265?: number | string;
  bit_rate: number;
  play_addr: { url_list: string[] };
}

export interface DouyinAwemeDetail {
  aweme_id: string;
  desc: string;
  author?: { nickname?: string; uid?: string; avatar_thumb?: { url_list?: string[] } };
  video?: {
    play_addr?: { url_list: string[] };
    bit_rate?: DouyinVideoQuality[];
    cover?: { url_list?: string[] };
    duration?: number;
  };
  music?: {
    title?: string;
    author?: string;
    play_url?: { uri?: string; url_list?: string[] };
    cover_medium?: { url_list?: string[] };
  };
}

const CACHE_MAX = 30;
const cache = new Map<string, DouyinAwemeDetail>();

function storeDetail(detail: DouyinAwemeDetail): void {
  if (!detail?.aweme_id) return;
  if (cache.has(detail.aweme_id)) {
    // 刷新顺序：删掉再插入让它排到末尾
    cache.delete(detail.aweme_id);
  } else if (cache.size >= CACHE_MAX) {
    // 删掉最老的（Map 按插入顺序迭代，第一个就是最旧的）
    cache.delete(cache.keys().next().value!);
  }
  cache.set(detail.aweme_id, detail);
}

/** 从已解析的响应体收集作品详情。 */
function collectAwemeDetails(json: any): void {
  const detail = json?.aweme_detail || json?.itemInfo?.itemStruct;
  if (detail) { storeDetail(detail); return; }
  const list = json?.aweme_list || json?.item_list;
  if (Array.isArray(list)) list.forEach(storeDetail);
}

function tryParseAwemeResponse(text: string): void {
  try {
    collectAwemeDetails(JSON.parse(text));
  } catch {}
}

/**
 * 从 XHR 响应中收集作品详情。
 *
 * responseType 为 json/blob/arraybuffer 时读 responseText 会抛
 * InvalidStateError，该异常发生在 load 回调里会冒泡到页面，故按类型分流；
 * json 已是解析结果，直接取用。
 */
function collectAwemeFromXhr(xhr: XMLHttpRequest): void {
  if (xhr.responseType === 'json') {
    collectAwemeDetails(xhr.response);
    return;
  }
  if (xhr.responseType === '' || xhr.responseType === 'text') {
    tryParseAwemeResponse(xhr.responseText || '');
  }
}

function isAwemeUrl(url: string): boolean {
  return /douyin\.com.*\/aweme\/v\d+\//i.test(url);
}

/** gear_name 中间段为纵向分辨率。 */
const GEAR_HEIGHT = /_(\d{3,4})_/;

/** 取画质的纵向分辨率，用于排序；取不到记 0，排在有分辨率的档位之后。 */
function qualityHeight(item: DouyinVideoQuality): number {
  const fromDesc = item.quality_desc?.match(/(\d{3,4})\s*P/i)?.[1];
  return Number(fromDesc || item.gear_name?.match(GEAR_HEIGHT)?.[1] || 0);
}

/**
 * 取画质名。
 *
 * quality_desc 在 Web 端接口常缺省，退到 gear_name 里的分辨率；两者都没有时
 * 用码率命名，保证不同档位仍有可区分的标识。
 */
function qualityLabel(item: DouyinVideoQuality): string {
  const desc = item.quality_desc?.trim();
  if (desc) return desc;

  const height = item.gear_name?.match(GEAR_HEIGHT)?.[1];
  return height ? `${height}P` : `${Math.round(item.bit_rate / 1000)}kbps`;
}

/**
 * 从 url_list 取第一条 http 地址。
 *
 * 抖音的 url_list 会混入 null 与非字符串元素，直接对元素调 startsWith 会抛
 * TypeError 并中断整个解析，故先判类型。
 *
 * @param list 接口下发的地址数组，允许为空
 * @returns 第一条 http 地址，没有则返回空串
 */
export function pickHttpUrl(list?: unknown[]): string {
  if (!Array.isArray(list)) return '';
  for (const item of list) {
    if (typeof item === 'string' && item.startsWith('http')) return item;
  }
  return '';
}

export const DouyinInterceptor = {
  installed: false,

  install(): void {
    if (this.installed) return;
    this.installed = true;

    const win = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
    const origFetch = win.fetch;
    if (typeof origFetch !== 'function') return;

    win.fetch = function(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : (input as Request).url);
      const promise: Promise<Response> = origFetch.call(this, input, init);
      if (!isAwemeUrl(url)) return promise;

      return promise.then(response => {
        const cloned = response.clone();
        cloned.text().then(tryParseAwemeResponse).catch(() => {});
        return response;
      });
    };

    const origXhrOpen = win.XMLHttpRequest.prototype.open;
    const origXhrSend = win.XMLHttpRequest.prototype.send;

    win.XMLHttpRequest.prototype.open = function(method: string, url: string, ...rest: any[]) {
      this._bdl_url = url;
      return origXhrOpen.call(this, method, url, ...rest);
    };

    win.XMLHttpRequest.prototype.send = function(...args: any[]) {
      if (isAwemeUrl(this._bdl_url || '')) {
        this.addEventListener('load', function(this: XMLHttpRequest) {
          collectAwemeFromXhr(this);
        });
      }
      return origXhrSend.apply(this, args);
    };
  },

  // 从页面全局变量中扫描（方案3）
  scanWindowState(): DouyinAwemeDetail[] {
    const win = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
    const stateKeys = ['__NEXT_DATA__', '_SSR_DATA_', '__INITIAL_STATE__', '__pinia', 'odin'];
    const found: DouyinAwemeDetail[] = [];

    const walk = (value: any, depth: number, seen: WeakSet<object>): void => {
      if (depth > 8 || value == null || typeof value !== 'object') return;
      if (seen.has(value)) return;
      seen.add(value);

      if (typeof value.aweme_id === 'string' && value.video) {
        storeDetail(value as DouyinAwemeDetail);
        found.push(value as DouyinAwemeDetail);
        return;
      }

      const entries = Object.entries(value).slice(0, 200);
      for (const [, v] of entries) walk(v, depth + 1, seen);
    };

    const seen = new WeakSet<object>();
    for (const key of stateKeys) {
      try { walk(win[key], 0, seen); } catch {}
    }

    // 也扫一下缓存
    cache.forEach(v => found.push(v));
    return found;
  },

  // 根据精确 aweme_id 查缓存（不做兜底）
  getByAwemeId(awemeId: string): DouyinAwemeDetail | null {
    if (cache.has(awemeId)) return cache.get(awemeId)!;
    const all = this.scanWindowState();
    return all.find(d => d.aweme_id === awemeId) || null;
  },

  // 根据 URL 或 aweme_id 找到对应的 detail
  getByUrl(url: string): DouyinAwemeDetail | null {
    const idMatch = url.match(/(?:video|note|modal_id=|aweme_id=)(\d{15,20})/i);
    const awemeId = idMatch?.[1];

    if (awemeId && cache.has(awemeId)) return cache.get(awemeId)!;

    const all = this.scanWindowState();
    if (awemeId) {
      const found = all.find(d => d.aweme_id === awemeId);
      if (found) return found;
    }

    // 返回最新拦截到的
    return all[all.length - 1] || null;
  },

  /**
   * 提取可下载画质，按分辨率与码率从高到低排序，每个画质档位只保留一条。
   *
   * bit_rate 会把同一档位拆成多份下发：H.264 与 H.265 各一条，同编码下再按
   * 设备分层给出多个码率，一个作品常有二十余条，直接展开会得到一串无法区分的
   * 同名条目。故按画质名归并，优先保留兼容性更好的 H.264，同编码下取码率最高的。
   */
  extractQualities(detail: DouyinAwemeDetail): Array<{ label: string; url: string }> {
    const video = detail.video;
    if (!video) return [];

    const picked = new Map<string, { label: string; url: string; bitrate: number; height: number; h265: boolean }>();

    for (const item of video.bit_rate || []) {
      const url = pickHttpUrl(item?.play_addr?.url_list);
      if (!url) continue;

      const label = qualityLabel(item);
      const h265 = String(item.is_h265) === '1';
      const prev = picked.get(label);
      if (prev && (prev.h265 === h265 ? prev.bitrate >= item.bit_rate : !prev.h265)) continue;

      picked.set(label, { label, url, bitrate: item.bit_rate, height: qualityHeight(item), h265 });
    }

    const results = Array.from(picked.values());

    // 如果没有 bit_rate，用 play_addr
    if (results.length === 0) {
      const url = pickHttpUrl(video.play_addr?.url_list);
      if (url) results.push({ label: '原画', url, bitrate: 0, height: 0, h265: false });
    }

    results.sort((a, b) => (b.height - a.height) || (b.bitrate - a.bitrate));
    return results.map(item => ({ label: item.label, url: item.url }));
  },

  // 直接调用抖音官方 API（方案4，利用浏览器同源 cookie）
  async fetchDetail(awemeId: string): Promise<DouyinAwemeDetail | null> {
    const win = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
    try {
      const params = new URLSearchParams({
        aweme_id: awemeId,
        aid: '6383',
        channel: 'channel_pc_web',
        device_platform: 'webapp',
        pc_client_type: '1',
        version_code: '170400',
        version_name: '17.4.0',
      });
      const response: Response = await win.fetch(
        `https://www.douyin.com/aweme/v1/web/aweme/detail/?${params}`,
        {
          headers: { Accept: 'application/json, text/plain, */*', Referer: 'https://www.douyin.com/' },
          credentials: 'include',
        }
      );
      const text: string = await response.text();
      const json = JSON.parse(text);
      const detail = json?.aweme_detail;
      if (detail?.aweme_id) {
        storeDetail(detail as DouyinAwemeDetail);
        return detail as DouyinAwemeDetail;
      }
    } catch {}
    return null;
  },

  // 从页面全局 feed 数据中找当前正在播放的视频 aweme_id（推荐页专用）
  getAwemeIdFromFeed(): string | null {
    const win = (typeof unsafeWindow !== 'undefined' ? unsafeWindow : window) as any;
    // 尝试从全局变量扫描 aweme_list / item_list 里的第一个
    const stateKeys = ['__NEXT_DATA__', '_SSR_DATA_', '__INITIAL_STATE__', '__pinia', 'odin', '__recommend__'];
    const AWEME_ID_RE = /^\d{15,20}$/;

    const extractFromValue = (value: any, depth: number, seen: WeakSet<object>): string | null => {
      if (depth > 12 || !value || typeof value !== 'object') return null;
      if (seen.has(value)) return null;
      seen.add(value);

      // 找 aweme_list 或 item_list
      if (Array.isArray(value.aweme_list) && value.aweme_list.length > 0) {
        const item = value.aweme_list[0];
        if (item?.aweme_id && AWEME_ID_RE.test(String(item.aweme_id))) return String(item.aweme_id);
      }
      if (Array.isArray(value.item_list) && value.item_list.length > 0) {
        const item = value.item_list[0];
        if (item?.aweme_id && AWEME_ID_RE.test(String(item.aweme_id))) return String(item.aweme_id);
      }

      const entries = Object.entries(value).slice(0, 200);
      for (const [, v] of entries) {
        const found = extractFromValue(v, depth + 1, seen);
        if (found) return found;
      }
      return null;
    };

    const seen = new WeakSet<object>();
    for (const key of stateKeys) {
      try {
        const result = extractFromValue(win[key], 0, seen);
        if (result) return result;
      } catch {}
    }

    // 也从 cache 里取第一个最近存储的
    const arr: string[] = [];
    cache.forEach((v) => { if (v.aweme_id) arr.push(v.aweme_id); });
    if (arr.length > 0) return arr[arr.length - 1];

    return null;
  },

  // 从 video.currentSrc 兜底（方案1）
  getFromDom(): { url: string; cover: string } | null {
    const videos = Array.from(document.querySelectorAll<HTMLVideoElement>('video'));
    const video = videos
      .map(v => ({ v, area: (() => { const r = v.getBoundingClientRect(); return r.width * r.height; })() }))
      .filter(item => item.area > 1000)
      .sort((a, b) => b.area - a.area)[0]?.v || videos[0];

    const src = video?.currentSrc || video?.src;
    if (!src || !src.startsWith('http')) return null;
    return { url: src, cover: video?.poster || '' };
  }
};
