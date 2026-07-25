import type { SiteContext, VideoId } from './types.ts';

export const Utils = {
  getVideoId(): VideoId | null {
    const pathname = window.location.pathname;
    const bvidMatch = pathname.match(/\/video\/(BV[\w]+)/i);
    if (bvidMatch) return { type: 'video', id: bvidMatch[1] };
    const epMatch = pathname.match(/\/bangumi\/play\/ep(\d+)/i);
    if (epMatch) return { type: 'bangumi', id: 'ep' + epMatch[1] };
    const ssMatch = pathname.match(/\/bangumi\/play\/ss(\d+)/i);
    if (ssMatch) return { type: 'bangumi', id: 'ss' + ssMatch[1] };
    return null;
  },

  getSiteContext(): SiteContext {
    const host = window.location.hostname.toLowerCase();
    const videoId = this.getVideoId();

    if (host.endsWith('bilibili.com') && videoId) {
      return {
        kind: 'bilibili',
        platform: 'bilibili',
        sourceType: videoId.type
      };
    }

    if (host.endsWith('douyin.com') || host.endsWith('iesdouyin.com')) {
      return { kind: 'short-video', platform: 'douyin' };
    }
    if (host.endsWith('kuaishou.com')) {
      return { kind: 'short-video', platform: 'kuaishou' };
    }
    if (host.endsWith('xiaohongshu.com') || host.endsWith('xhslink.com') || host.endsWith('xhs.cn')) {
      return { kind: 'short-video', platform: 'xiaohongshu' };
    }
    if (host.endsWith('weibo.com') || host.endsWith('weibo.cn')) {
      return { kind: 'short-video', platform: 'weibo' };
    }
    if (host.endsWith('toutiao.com')) {
      return { kind: 'short-video', platform: 'toutiao' };
    }
    if (host.endsWith('ippzone.com') || host.endsWith('pipigx.com')) {
      return { kind: 'short-video', platform: 'pipigx' };
    }

    return { kind: 'unsupported', platform: null };
  },

  getCurrentPage(): number {
    const urlParams = new URLSearchParams(window.location.search);
    return parseInt(urlParams.get('p') || '1') || 1;
  },

  formatDuration(seconds: number): string {
    if (!seconds) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    }
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },

  formatDurationMs(milliseconds?: number | null): string {
    if (!milliseconds) return '--';
    return this.formatDuration(milliseconds >= 1000 ? Math.round(milliseconds / 1000) : milliseconds);
  },

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 180);
  },

  inferExtension(url: string, fallback: string): string {
    const cleanUrl = url.split('#')[0].split('?')[0];
    const match = cleanUrl.match(/\.([a-zA-Z0-9]{2,6})$/);
    if (!match) return fallback;
    return match[1].toLowerCase();
  },

  getShortVideoFilename(title: string, author?: string | null): string {
    const parts = [title, author].filter(Boolean).join(' - ');
    return this.sanitizeFilename(parts || 'short-video');
  },

  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  getCPUCores(): number {
    return navigator.hardwareConcurrency || 2;
  },

  getOptimalThreads(): number {
    const cores = this.getCPUCores();
    if (cores <= 4) return 1;
    return Math.floor(cores * 0.6 / 2) * 2;
  }
};
