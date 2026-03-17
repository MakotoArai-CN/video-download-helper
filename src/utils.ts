import type { VideoId } from './types.ts';

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
