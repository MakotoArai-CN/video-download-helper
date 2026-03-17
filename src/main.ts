import { Utils } from './utils.ts';
import { ThreadManager } from './thread-manager.ts';
import { UI } from './ui.ts';
import { Downloader } from './downloader.ts';
import { MergeManager } from './merge-manager.ts';
import { FFmpegMerger } from './merger.ts';

declare const FFmpeg: any;

function bindUIEvents(): void {
  const el = UI.elements;

  (el.btn as HTMLElement).addEventListener('click', () => {
    (el.popup as HTMLElement).classList.toggle('show');
    if ((el.popup as HTMLElement).classList.contains('show')) Downloader.refreshInfo();
  });

  (el.close as HTMLElement).addEventListener('click', () => (el.popup as HTMLElement).classList.remove('show'));

  document.addEventListener('click', e => {
    if (!(el.panel as HTMLElement).contains(e.target as Node)) (el.popup as HTMLElement).classList.remove('show');
  });

  (el.methods as HTMLElement).addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest('.bdl-method-item') as HTMLElement | null;
    if (item) {
      const method = item.dataset.method as any;
      document.querySelectorAll('.bdl-method-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      MergeManager.setMethod(method);
      UI.hideTips();
      (el.mergeRow as HTMLElement).style.display = method === 'separate' ? 'none' : 'block';
    }
  });

  (el.download as HTMLElement).addEventListener('click', () => Downloader.start());

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

  (el.footer as HTMLElement).addEventListener('click', () => {
    if (UI.pagesSectionEnabled || UI.ugcSectionEnabled) UI.toggleExtendedSections();
  });

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(() => Downloader.refreshInfo(), 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });
}

function checkFFmpegAvailability(): void {
  if (typeof FFmpeg !== 'undefined') {
    FFmpegMerger.init().then(() => {
      const el = document.querySelector('[data-method="ffmpeg-merge"] .bdl-method-status');
      if (el) { el.textContent = '就绪'; el.className = 'bdl-method-status ready'; }
    }).catch(() => {
      const el = document.querySelector('[data-method="ffmpeg-merge"] .bdl-method-status') as HTMLElement | null;
      if (el) { el.textContent = '不可用'; el.className = 'bdl-method-status'; el.style.background = '#f8d7da'; el.style.color = '#721c24'; }
    });
  } else {
    setTimeout(checkFFmpegAvailability, 1000);
  }
}

function init(): void {
  Utils.delay(1000).then(() => {
    ThreadManager.init();
    UI.init();
    bindUIEvents();
    checkFFmpegAvailability();
    setTimeout(() => Downloader.refreshInfo(), 500);
    console.log('[视频下载助手] 初始化完成');
    console.log('[视频下载助手] CPU逻辑核心数:', Utils.getCPUCores());
    console.log('[视频下载助手] 最大下载线程数:', ThreadManager.maxThreads);
    console.log('[视频下载助手] 版本: 0.1.3');
  });
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
