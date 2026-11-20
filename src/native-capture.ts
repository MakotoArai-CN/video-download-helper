import { PLATFORMS } from './platforms.ts';
import type { ShortVideoPlatform } from './types.ts';

declare const unsafeWindow: any;
const entries: Array<{ page: string; data: unknown; size: number }> = [];
let installed = false;

/** 仅旁路读取页面已经发出的原站 JSON 响应，不修改请求或响应。 */
export const NativeCapture = {
  current(): unknown[] { return entries.filter(entry => entry.page === location.href).map(entry => entry.data); },
  record(page: string, text: string): void {
    if (page !== location.href || text.length > 2 * 1024 * 1024) return;
    try {
      const data = JSON.parse(text.replace(/^for\s*\(;;\);\s*/, ''));
      entries.push({ page, data, size: text.length });
      while (entries.length > 12 || entries.reduce((sum, entry) => sum + entry.size, 0) > 8 * 1024 * 1024) entries.shift();
    } catch {}
  },
  install(platform: ShortVideoPlatform): void {
    if (installed) return;
    installed = true;
    const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const relevant = (input: any) => {
      try {
        const url = new URL(typeof input === 'string' ? input : input.url || input.href, location.href);
        return PLATFORMS[platform].hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))
          && /api|graphql|feed|item|media|video|metadata/i.test(url.pathname);
      } catch { return false; }
    };
    const original = win.fetch;
    if (typeof original === 'function') win.fetch = function(input: any, ...args: any[]) {
      const page = location.href;
      const result = original.call(this, input, ...args);
      if (!relevant(input)) return result;
      return result.then((response: Response) => {
        if (Number(response.headers.get('content-length') || 0) <= 2 * 1024 * 1024 && /json/i.test(response.headers.get('content-type') || '')) {
          response.clone().text().then(text => NativeCapture.record(page, text)).catch(() => {});
        }
        return response;
      });
    };
    const xhr = win.XMLHttpRequest?.prototype;
    if (!xhr) return;
    const open = xhr.open, send = xhr.send;
    const requests = new WeakMap<object, boolean>();
    xhr.open = function(method: string, url: string, ...args: any[]) {
      requests.set(this, relevant(url));
      return open.call(this, method, url, ...args);
    };
    xhr.send = function(...args: any[]) {
      const page = location.href;
      if (requests.get(this)) this.addEventListener('load', () => {
        try {
          if (this.responseType === 'json') NativeCapture.record(page, JSON.stringify(this.response));
          else if (!this.responseType || this.responseType === 'text') NativeCapture.record(page, this.responseText);
        } catch {}
      }, { once: true });
      return send.apply(this, args);
    };
  }
};
