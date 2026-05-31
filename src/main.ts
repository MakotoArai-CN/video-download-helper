import { Utils } from './utils.ts';
import { ThreadManager } from './thread-manager.ts';
import { UI } from './ui.ts';
import { Downloader } from './downloader.ts';
import { MergeManager } from './merge-manager.ts';
import { FFmpegMerger } from './merger.ts';

declare const FFmpeg: any;
declare const unsafeWindow: any;

let initialized = false;
let initTimer: number | null = null;
let ffmpegLoadPromise: Promise<void> | null = null;

function getFFmpegGlobal(): any {
  if (typeof FFmpeg !== 'undefined') return FFmpeg;
  if (typeof unsafeWindow !== 'undefined' && unsafeWindow.FFmpeg) {
    (globalThis as any).FFmpeg = unsafeWindow.FFmpeg;
    return unsafeWindow.FFmpeg;
  }
  return null;
}

function bindUIEvents(): void {
  const el = UI.elements;
  let mountQueued = false;

  const syncMount = () => {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => {
      mountQueued = false;
      UI.ensureMounted();
      UI.positionPopup();
    });
  };

  syncMount();

  (el.btn as HTMLElement).addEventListener('click', event => {
    event.stopPropagation();
    if (UI.consumeEntryClickSuppression()) return;
    const shown = UI.togglePopup();
    if (shown && !Downloader.isDownloading) Downloader.refreshInfo();
  });

  (el.close as HTMLElement).addEventListener('click', () => UI.hidePopup());

  document.addEventListener('click', e => {
    const path = e.composedPath();
    if (!path.includes(el.panel as EventTarget) && !path.includes(el.entry as EventTarget)) UI.hidePopup();
  });

  (el.methods as HTMLElement).addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest('.bdl-method-item') as HTMLElement | null;
    if (item) {
      const method = item.dataset.method as any;
      UI.queryAll<HTMLElement>('.bdl-method-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      MergeManager.setMethod(method);
      UI.hideTips();
      (el.mergeRow as HTMLElement).style.display = method === 'separate' ? 'none' : 'block';
    }
  });

  (el.download as HTMLElement).addEventListener('click', () => Downloader.start());

  (el.footer as HTMLElement).addEventListener('click', () => {
    if (UI.handleFooterSecretClick()) {
      UI.positionPopup();
    }
  });

  (el.selectAll as HTMLElement).addEventListener('click', () => {
    (el.pagesList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = true);
    Downloader.updateSelectedPages();
  });
  (el.selectNone as HTMLElement).addEventListener('click', () => {
    (el.pagesList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = false);
    Downloader.updateSelectedPages();
  });
  (el.selectReverse as HTMLElement).addEventListener('click', () => {
    (el.pagesList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = !cb.checked);
    Downloader.updateSelectedPages();
  });

  (el.ugcSelectAll as HTMLElement).addEventListener('click', () => {
    (el.ugcList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = true);
    Downloader.updateSelectedUGC();
  });
  (el.ugcSelectNone as HTMLElement).addEventListener('click', () => {
    (el.ugcList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = false);
    Downloader.updateSelectedUGC();
  });
  (el.ugcSelectReverse as HTMLElement).addEventListener('click', () => {
    (el.ugcList as HTMLElement).querySelectorAll<HTMLInputElement>('.bdl-page-checkbox').forEach(cb => cb.checked = !cb.checked);
    Downloader.updateSelectedUGC();
  });

  (el.videoCodec as HTMLSelectElement).addEventListener('change', function() {
    Downloader.selectedVideoCodec = this.value;
  });
  (el.audioCodec as HTMLSelectElement).addEventListener('change', function() {
    Downloader.selectedAudioCodec = parseInt(this.value);
  });

  window.addEventListener('resize', () => {
    UI.positionEntry();
    UI.positionPopup();
  });
  document.addEventListener('scroll', () => {
    UI.positionEntry();
    UI.positionPopup();
  }, true);

  let lastUrl = location.href;
  new MutationObserver(() => {
    syncMount();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      UI.hidePopup();
      setTimeout(() => {
        UI.ensureMounted();
        Downloader.refreshInfo({ silent: true });
      }, 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function loadFFmpeg(): Promise<void> {
  if (getFFmpegGlobal()) return Promise.resolve();
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  ffmpegLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js';
    script.async = true;
    script.onload = () => {
      if (getFFmpegGlobal()) resolve();
      else reject(new Error('FFmpeg 加载后不可用'));
    };
    script.onerror = () => reject(new Error('FFmpeg 加载失败'));
    (document.head || document.documentElement).appendChild(script);
  });

  return ffmpegLoadPromise;
}

function checkFFmpegAvailability(): void {
  const updateStatus = (ready: boolean) => {
    const el = UI.query<HTMLElement>('[data-method="ffmpeg-merge"] .bdl-method-status');
    if (!el) return;

    el.textContent = ready ? '就绪' : '不可用';
    el.className = ready ? 'bdl-method-status ready' : 'bdl-method-status';
    el.style.background = ready ? '' : '#f8d7da';
    el.style.color = ready ? '' : '#721c24';
  };

  if (getFFmpegGlobal()) {
    FFmpegMerger.init().then(() => {
      updateStatus(true);
    }).catch(() => {
      updateStatus(false);
    });
    return;
  }

  loadFFmpeg().then(() => {
    if (!getFFmpegGlobal()) {
      updateStatus(false);
      return;
    }
    return FFmpegMerger.init().then(() => {
      updateStatus(true);
    }).catch(() => {
      updateStatus(false);
    });
  }).catch(() => {
    updateStatus(false);
  });
}

function init(): void {
  if (initialized) return;

  if (!document.body) {
    scheduleInit(50);
    return;
  }

  const siteContext = Utils.getSiteContext();
  if (siteContext.kind === 'unsupported') return;

  initialized = true;
  ThreadManager.init();
  UI.init();
  if (siteContext.kind === 'short-video') UI.setShortVideoMode(siteContext.platform);
  bindUIEvents();
  if (siteContext.kind === 'bilibili') checkFFmpegAvailability();
  setTimeout(() => Downloader.refreshInfo({ silent: siteContext.kind === 'short-video' }), siteContext.kind === 'short-video' ? 900 : 500);
  console.log('[视频下载助手] 初始化完成');
  console.log('[视频下载助手] CPU逻辑核心数:', Utils.getCPUCores());
  console.log('[视频下载助手] 最大下载线程数:', ThreadManager.maxThreads);
  console.log('[视频下载助手] 版本: 0.2.0');
}

function scheduleInit(delay: number): void {
  if (initialized || initTimer !== null) return;
  initTimer = window.setTimeout(() => {
    initTimer = null;
    init();
  }, delay);
}

init();
scheduleInit(100);
document.addEventListener('DOMContentLoaded', init, { once: true });
window.addEventListener('load', init, { once: true });
