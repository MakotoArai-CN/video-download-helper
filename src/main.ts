import { Utils } from './utils.ts';
import { ThreadManager } from './thread-manager.ts';
import { UI } from './ui.ts';
import { Downloader } from './downloader.ts';
import { MergeManager } from './merge-manager.ts';
import { FFmpegMerger, getFFmpegGlobal, loadFFmpegLoader } from './merger.ts';
import { DouyinInterceptor } from './douyin-interceptor.ts';
import { KuaishouInterceptor } from './kuaishou-interceptor.ts';
import { Diagnostics } from './diagnostics.ts';
import { PLATFORMS } from './platforms.ts';
import type { GifOutput, WatchConfig } from './types.ts';

// 最早期启用诊断日志，覆盖到脚本入口的所有阶段
Diagnostics.init();

// 在页面最早期安装拦截器（document-start）
const _earlyCtx = Utils.getSiteContext();
if (_earlyCtx.kind === 'short-video') {
  if (_earlyCtx.platform === 'douyin') DouyinInterceptor.install();
  if (_earlyCtx.platform === 'kuaishou') KuaishouInterceptor.install();
}

declare const FFmpeg: any;
declare const unsafeWindow: any;
declare const GM_info: {
  script: {
    version: string;
    name?: string;
    namespace?: string;
  };
  scriptHandler?: string;
  version?: string;
};

let initialized = false;
let initTimer: number | null = null;

function bindUIEvents(): void {
  const el = UI.elements;
  let mountQueued = false;

  const syncMount = () => {
    if (mountQueued) return;
    mountQueued = true;
    requestAnimationFrame(() => {
      mountQueued = false;
      UI.ensureMounted();
      if (!UI.isPopupVisible()) UI.positionPopup();
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
    if (!item) return;

    const method = item.dataset.method as any;
    // FFmpeg 状态标为不可用时（例如页面未启用 COOP/COEP），阻止切换并给出提示
    const status = item.querySelector<HTMLElement>('.bdl-method-status');
    if (method === 'ffmpeg-merge' && status && !status.classList.contains('ready') && !status.classList.contains('loading')) {
      const reason = status.title || '当前页面无法使用 FFmpeg 合并，请改用「JS 原生合并」';
      UI.showAlert(reason, 'warning');
      return;
    }

    UI.queryAll<HTMLElement>('#bdl-methods .bdl-method-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    MergeManager.setMethod(method);
    UI.hideTips();
    (el.mergeRow as HTMLElement).style.display = method === 'separate' ? 'none' : 'block';
  });

  (el.gifFormats as HTMLElement).addEventListener('click', e => {
    const item = (e.target as HTMLElement).closest('.bdl-method-item') as HTMLElement | null;
    if (!item || !item.dataset.gif) return;
    Downloader.setGifMethod(item.dataset.gif as GifOutput);
  });

  (el.download as HTMLElement).addEventListener('click', () => Downloader.start());

  (el.footer as HTMLElement).addEventListener('click', event => {
    // 诊断触发器有自己的点击处理，避免被识别为 footer 秘密点击
    if ((event.target as Element | null)?.closest('.bdl-diag-trigger')) return;
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
    // popup が開いている間はスクロールで位置を再計算しない
    // (Bilibili PiP 出現などで buttonRect が大きく変わり popup が飛ぶのを防ぐ)
    if (!UI.isPopupVisible()) UI.positionPopup();
  }, true);

  const ctx = Utils.getSiteContext();
  installWatchers(syncMount, ctx.kind === 'short-video' ? PLATFORMS[ctx.platform].watch : undefined);
}

/**
 * 安装切换视频的监听。
 *
 * URL 变化是所有站点通用的信号，无条件监听。沉浸式信息流（抖音推荐页、
 * 微博视频流）切换视频时 URL 不变，需按平台的 watch 配置补充播放器侧的信号。
 *
 * @param syncMount DOM 变动后重新挂载入口按钮的回调
 * @param watch 当前平台的监听配置，缺省时只依赖 URL 变化
 */
function installWatchers(syncMount: () => void, watch?: WatchConfig): void {
  const urlChangeDelay = watch?.urlChangeDelayMs ?? 1500;
  let lastUrl = location.href;
  new MutationObserver(() => {
    syncMount();
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    UI.hidePopup();
    UI.ensureMounted();
    setTimeout(() => {
      UI.ensureMounted();
      Downloader.refreshInfo({ silent: true });
    }, urlChangeDelay);
  }).observe(document.body, { childList: true, subtree: true });

  if (!watch) return;

  const debounceMs = watch.debounceMs ?? 300;
  let refreshTimer: number | null = null;
  const onVideoChange = () => {
    if (refreshTimer !== null) clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null;
      // 滑动结束后重挂一次：matchVisible 的挂载点在切换动画期间会短暂命中
      // 上一个视频的操作栏，DOM 变动此时可能已停止，需在此补一次校正。
      UI.ensureMounted();
      Downloader.refreshInfo({ silent: true });
    }, debounceMs);
  };

  // class 中的视频 id 变化是首选信号：xgplayer 的 MSE 模式不触发 playing，
  // 而 play 事件在同一视频重复播放时会误报
  const observedContainers = new WeakSet<Element>();
  const observeClassId = (el: Element, pattern: RegExp) => {
    if (observedContainers.has(el)) return;
    observedContainers.add(el);
    // className 在 SVG 元素上不是字符串，统一走 getAttribute
    const readId = () => (el.getAttribute('class')?.match(pattern) || [])[1] || '';
    let lastId = readId();
    new MutationObserver(() => {
      const id = readId();
      if (id && id !== lastId) {
        lastId = id;
        onVideoChange();
      }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  };

  const bindVideoPlay = (video: HTMLVideoElement) => {
    if ((video as any).__bdl_play_bound) return;
    (video as any).__bdl_play_bound = true;
    video.addEventListener('play', onVideoChange);
  };

  const scan = () => {
    const { classIdSelector, classIdPattern } = watch;
    if (classIdSelector && classIdPattern) {
      document.querySelectorAll(classIdSelector).forEach(el => observeClassId(el, classIdPattern));
    }
    if (watch.videoPlay) {
      document.querySelectorAll<HTMLVideoElement>('video').forEach(bindVideoPlay);
    }
  };

  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
}

function checkFFmpegAvailability(): void {
  const updateStatus = (ready: boolean, label?: string, tooltip?: string) => {
    const el = UI.query<HTMLElement>('[data-method="ffmpeg-merge"] .bdl-method-status');
    if (!el) return;

    el.textContent = label || (ready ? '就绪' : '不可用');
    el.className = ready ? 'bdl-method-status ready' : 'bdl-method-status';
    el.style.background = ready ? '' : 'var(--bdl-danger-bg)';
    el.style.color = ready ? '' : 'var(--bdl-danger-text)';
    if (tooltip) el.title = tooltip;
  };

  // 记录一下当前跨源隔离状态，便于排查（不再做短路，@ffmpeg/core-st 无 SAB 依赖）
  const hasSAB = typeof SharedArrayBuffer !== 'undefined';
  const isolated = typeof (globalThis as any).crossOriginIsolated === 'boolean'
    ? (globalThis as any).crossOriginIsolated
    : false;
  Diagnostics.info('ffmpeg', `环境: hasSAB=${hasSAB} crossOriginIsolated=${isolated}（使用单线程核心，无需跨源隔离）`);

  if (getFFmpegGlobal()) {
    FFmpegMerger.init().then(() => {
      Diagnostics.info('ffmpeg', 'FFmpeg 初始化成功（本地已存在）');
      updateStatus(true);
    }).catch(err => {
      Diagnostics.error('ffmpeg', 'FFmpeg 初始化失败', err);
      updateStatus(false);
    });
    return;
  }

  loadFFmpegLoader().then(() => {
    if (!getFFmpegGlobal()) {
      Diagnostics.warn('ffmpeg', 'FFmpeg 脚本加载后仍不可用');
      updateStatus(false);
      return;
    }
    return FFmpegMerger.init().then(() => {
      Diagnostics.info('ffmpeg', 'FFmpeg 初始化成功');
      updateStatus(true);
    }).catch(err => {
      Diagnostics.error('ffmpeg', 'FFmpeg 初始化失败', err);
      updateStatus(false);
    });
  }).catch(err => {
    Diagnostics.error('ffmpeg', 'FFmpeg 脚本加载失败', err);
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
  Diagnostics.info('main', `站点识别: ${siteContext.kind} / ${siteContext.platform ?? 'unknown'}`);
  ThreadManager.init();
  UI.init();
  if (siteContext.kind === 'short-video') UI.setShortVideoMode(siteContext.platform);
  bindUIEvents();
  if (siteContext.kind === 'bilibili') checkFFmpegAvailability();
  setTimeout(() => Downloader.refreshInfo({ silent: siteContext.kind === 'short-video' }), siteContext.kind === 'short-video' ? 900 : 500);
  console.log(
    '%c\n' +
    ' ██╗   ██╗██████╗ ██╗  ██╗\n' +
    ' ██║   ██║██╔══██╗██║  ██║\n' +
    ' ██║   ██║██║  ██║███████║\n' +
    ' ╚██╗ ██╔╝██║  ██║██╔══██║\n' +
    '  ╚████╔╝ ██████╔╝██║  ██║\n' +
    '   ╚═══╝  ╚═════╝ ╚═╝  ╚═╝\n' +
    ` Video Download Helper  ${GM_info.script.version}\n` +
    ' threads: ' + ThreadManager.maxThreads + '  cores: ' + Utils.getCPUCores() + '\n',
    'color:#00c8ff;font-family:monospace;font-size:11px;line-height:1.2'
  );
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
