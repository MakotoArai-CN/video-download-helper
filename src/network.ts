declare function GM_xmlhttpRequest(details: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  responseType?: string;
  onload?: (res: any) => void;
  onerror?: () => void;
  ontimeout?: () => void;
  onprogress?: (e: any) => void;
}): void;

export const Network = {
  fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': navigator.userAgent
        },
        responseType: 'json',
        onload(res) {
          if (res.status >= 200 && res.status < 300) {
            let data = res.response;
            if (typeof data === 'string') data = JSON.parse(data);
            resolve(data);
          } else {
            reject(new Error('HTTP ' + res.status));
          }
        },
        onerror() { reject(new Error('网络错误')); },
        ontimeout() { reject(new Error('请求超时')); }
      });
    });
  },

  downloadBuffer(url: string, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'Origin': 'https://www.bilibili.com',
          'User-Agent': navigator.userAgent
        },
        responseType: 'arraybuffer',
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

  fetchFileWithProgress(url: string, onProgress?: (loaded: number, total: number) => void): Promise<Uint8Array> {
    return fetch(url, {
      headers: {
        'Referer': 'https://www.bilibili.com',
        'Origin': 'https://www.bilibili.com'
      }
    }).then(response => {
      const reader = response.body!.getReader();
      const contentLength = parseInt(response.headers.get('Content-Length') || '0');
      if (!contentLength) {
        return response.arrayBuffer().then(data => new Uint8Array(data));
      }
      let receivedLength = 0;
      const chunks: Uint8Array[] = [];
      function processChunk(result: ReadableStreamReadResult<Uint8Array>): Promise<Uint8Array> | Uint8Array {
        if (result.done) {
          const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
          const combined = new Uint8Array(totalLength);
          let position = 0;
          for (const chunk of chunks) { combined.set(chunk, position); position += chunk.length; }
          return combined;
        }
        chunks.push(result.value);
        receivedLength += result.value.length;
        if (onProgress) onProgress(receivedLength, contentLength);
        return reader.read().then(processChunk);
      }
      return reader.read().then(processChunk);
    });
  }
};
