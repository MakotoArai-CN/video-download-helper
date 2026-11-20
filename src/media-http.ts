/** 本机直接请求原站/API/CDN；不使用在线解析代理。 */
export function httpUrl(value: unknown, base?: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.replace(/&amp;/g, '&'), base);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export interface MediaRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  binary?: boolean;
  maxBytes?: number;
}

export class MediaHttpError extends Error {
  constructor(public readonly status: number, public readonly host: string) {
    super(`原站请求失败（HTTP ${status}，${host}）`);
    this.name = 'MediaHttpError';
  }
}

export function mediaRequest(url: string, options: MediaRequest = {}): Promise<{ data: any; status: number; finalUrl: string }> {
  if (!httpUrl(url)) return Promise.reject(new Error('媒体地址无效'));
  return new Promise((resolve, reject) => {
    const request = (globalThis as any).GM_xmlhttpRequest;
    if (typeof request !== 'function') { reject(new Error('脚本管理器未提供跨域请求权限')); return; }
    let handle: { abort?: () => void } | undefined;
    const limit = options.maxBytes ?? (options.binary ? 350 * 1024 * 1024 : 16 * 1024 * 1024);
    try {
      handle = request({
        method: options.method || 'GET', url, data: options.body, headers: options.headers,
        responseType: options.binary ? 'arraybuffer' : 'text', timeout: 30000,
        onprogress: (event: { loaded: number }) => {
          if (event.loaded > limit) { reject(new Error('响应超出本机处理大小限制')); handle?.abort?.(); }
        },
        onload: (res: any) => {
          if (res.status < 200 || res.status >= 300) { reject(new MediaHttpError(res.status, new URL(httpUrl(res.finalUrl) || url).hostname)); return; }
          const data = options.binary ? res.response : (res.responseText ?? res.response);
          if (options.binary && !(data instanceof ArrayBuffer) || !options.binary && typeof data !== 'string') {
            reject(new Error('原站返回了非预期的数据格式')); return;
          }
          if ((options.binary ? data.byteLength : data.length) > limit) { reject(new Error('响应超出本机处理大小限制')); return; }
          resolve({ data, status: res.status, finalUrl: res.finalUrl || url });
        },
        onerror: () => reject(new Error('原站网络请求失败')),
        ontimeout: () => reject(new Error('原站请求超时')),
        onabort: () => reject(new Error('请求已取消'))
      });
    } catch (error) { reject(error); }
  });
}

export async function mediaJSON(url: string, options: MediaRequest = {}): Promise<any> {
  const response = await mediaRequest(url, options);
  try { return JSON.parse(response.data); } catch { throw new Error('原站没有返回可解析的数据，请确认当前账号可以播放此内容'); }
}

/** 提取严格 JSON 的赋值，绝不在页面上下文 eval 脚本。 */
export function assignedJSON(source: string, marker: string): any | null {
  const position = source.indexOf(marker);
  if (position < 0) return null;
  const start = source.indexOf('{', position + marker.length);
  if (start < 0 || start - position > 100) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < source.length; index++) {
    const ch = source[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try { return JSON.parse(source.slice(start, index + 1)); } catch { return null; }
    }
  }
  return null;
}
