import { matchPlatform } from './platforms.ts';
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

    // B 站单列在前：它是唯一按路径而非仅按域名识别的站点，
    // 且 bilibili.com 下非视频页不应视为受支持。
    if (host.endsWith('bilibili.com') && videoId) {
      return { kind: 'bilibili', platform: 'bilibili', sourceType: videoId.type };
    }

    const platform = matchPlatform(host);
    if (platform) return { kind: 'short-video', platform };

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

  /**
   * 清理文件名中不能出现的字符并限长。
   *
   * 长度按 UTF-16 长度计（文件系统的限制也按此计），但以码点为单位取舍，
   * 不会把一对代理项切开后编码成替换字符。
   *
   * @param filename 原始名称
   * @returns 可用于保存的文件名，最长 180
   */
  sanitizeFilename(filename: string): string {
    const cleaned = filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/\s+/g, ' ')
      .trim();
    if (cleaned.length <= 180) return cleaned;
    let result = '';
    for (const char of cleaned) {
      if (result.length + char.length > 180) break;
      result += char;
    }
    return result;
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
