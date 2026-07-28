import { Diagnostics } from './diagnostics.ts';

declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  responseType?: string;
  onload?: (res: { status: number; response: any; responseHeaders?: string }) => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onprogress?: (e: any) => void;
}): void;
declare const unsafeWindow: any;

function shortUrl(url: string): string {
  if (!url) return url;
  return url.length > 140 ? url.slice(0, 140) + '...' : url;
}

export const Network = {
  fetchJSON(url: string, headers?: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': navigator.userAgent,
          ...headers
        },
        responseType: 'json',
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            let data = res.response;
            if (typeof data === 'string') data = JSON.parse(data);
            resolve(data);
          } else {
            Diagnostics.warn('network', `fetchJSON HTTP ${res.status}`, shortUrl(url));
            reject(new Error('HTTP ' + res.status));
          }
        },
        onerror() {
          Diagnostics.error('network', 'fetchJSON 网络错误', shortUrl(url));
          reject(new Error('网络错误'));
        },
        ontimeout() {
          Diagnostics.error('network', 'fetchJSON 请求超时', shortUrl(url));
          reject(new Error('请求超时'));
        }
      });
    });
  },

  downloadBufferWithFallback(urls: string[], onProgress?: (loaded: number, total: number) => void, headers?: Record<string, string>): Promise<ArrayBuffer> {
    const unique = [...new Set(urls.filter(Boolean))];
    if (unique.length === 0) return Promise.reject(new Error('无可用下载地址'));
    const tryNext = (index: number, lastError?: Error): Promise<ArrayBuffer> => {
      if (index >= unique.length) return Promise.reject(lastError || new Error('所有地址均不可用'));
      return this.downloadBuffer(unique[index], onProgress, headers).catch(err => tryNext(index + 1, err));
    };
    return tryNext(0);
  },

  downloadBuffer(url: string, onProgress?: (loaded: number, total: number) => void, headers?: Record<string, string>): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'Origin': 'https://www.bilibili.com',
          'User-Agent': navigator.userAgent,
          ...headers
        },
        responseType: 'arraybuffer',
        onprogress(e) {
          if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
        },
        onload(res) {
          if (res.status >= 200 && res.status < 300) resolve(res.response);
          else {
            Diagnostics.warn('network', `downloadBuffer HTTP ${res.status}`, shortUrl(url));
            reject(new Error('下载失败: ' + res.status));
          }
        },
        onerror() {
          Diagnostics.error('network', 'downloadBuffer 网络错误', shortUrl(url));
          reject(new Error('下载网络错误'));
        },
        ontimeout() {
          Diagnostics.error('network', 'downloadBuffer 超时', shortUrl(url));
          reject(new Error('下载超时'));
        }
      });
    });
  },

  downloadBlob(url: string, onProgress?: (loaded: number, total: number) => void, headers?: Record<string, string>): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const isBiliDefault = !headers || (!headers.Referer && !headers['Referer']);
      const defaults: Record<string, string> = isBiliDefault
        ? { 'Referer': 'https://www.bilibili.com', 'Origin': 'https://www.bilibili.com', 'User-Agent': navigator.userAgent }
        : { 'User-Agent': navigator.userAgent };
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          ...defaults,
          ...headers
        },
        responseType: 'blob',
        onprogress(e) {
          if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
        },
        onload(res) {
          if (res.status >= 200 && res.status < 300) resolve(res.response);
          else reject(new Error('下载失败: ' + res.status));
        },
        onerror() { reject(new Error('下载网络错误')); },
        ontimeout() { reject(new Error('下载超时')); }
      });
    });
  },

  // 在页面上下文里 fetch，让请求继承 tab 的网络栈（Referer / 客户端指纹）。
  // 用于 video.twimg.com 这类需要页面指纹才能通过校验的 CDN。
  // 注意：这些 CDN 的响应不带 Access-Control-Allow-Credentials，
  // 用 credentials:'include' 会被 CORS 直接拒掉，必须用 'omit'。
  downloadBlobInPageContext(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Blob> {
    const win: any = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
    const pageFetch: typeof fetch = win.fetch.bind(win);

    return pageFetch(url, { credentials: 'omit', mode: 'cors' }).then(async response => {
      if (!response.ok) throw new Error('下载失败: ' + response.status);
      const total = parseInt(response.headers.get('Content-Length') || '0', 10);
      if (!response.body || !total) {
        return response.blob();
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (onProgress) onProgress(received, total);
        }
      }
      return new Blob(chunks as BlobPart[]);
    });
  },

  fetchFileWithProgress(url: string, onProgress?: (loaded: number, total: number) => void, headers?: Record<string, string>): Promise<Uint8Array> {
    return fetch(url, {
      headers: {
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com',
        ...headers
      }
    }).then(response => {
      const reader = response.body!.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      if (!contentLength) {
        return response.arrayBuffer().then(data => new Uint8Array(data));
      }
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];
      function processChunk(result: Awaited<ReturnType<typeof reader.read>>): Promise<Uint8Array> | Uint8Array {
        if (result.done) {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(totalLength);
          let position = 0;
          for (const chunk of chunks) { combined.set(chunk, position); position += chunk.length; }
          return combined;
        }
        const chunk = result.value;
        chunks.push(chunk);
        receivedLength += chunk.length;
        if (onProgress) onProgress(receivedLength, contentLength);
        return reader.read().then(processChunk);
      }
      return reader.read().then(processChunk);
    });
  }
};
