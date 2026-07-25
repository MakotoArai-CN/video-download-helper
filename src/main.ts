import { Utils } from './utils.ts';
import { ThreadManager } from './thread-manager.ts';
import { UI } from './ui.ts';
import { Downloader } from './downloader.ts';
import { MergeManager } from './merge-manager.ts';
import { FFmpegMerger } from './merger.ts';
import { DouyinInterceptor } from './douyin-interceptor.ts';
import { Diagnostics } from './diagnostics.ts';

// 最早期启用诊断日志，覆盖到脚本入口的所有阶段
Diagnostics.init();

// 在页面最早期安装抖音拦截器（document-start）
if (Utils.getSiteContext().kind === 'short-video' && Utils.getSiteContext().platform === 'douyin') {
  DouyinInterceptor.install();
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

    UI.queryAll<HTMLElement>('.bdl-method-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    MergeManager.setMethod(method);
    UI.hideTips();
    (el.mergeRow as HTMLElement).style.display = method === 'separate' ? 'none' : 'block';
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

  let lastUrl = location.href;
  new MutationObserver(() => {
    syncMount();
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      UI.hidePopup();
      UI.ensureMounted();
      const isDouyin = Utils.getSiteContext().platform === 'douyin';
      setTimeout(() => {
        UI.ensureMounted();
        Downloader.refreshInfo({ silent: true });
      }, isDouyin ? 0 : 1500);
    }
  }).observe(document.body, { childList: true, subtree: true });

  // 抖音推荐页：URL 不变但视频会切换
  if (Utils.getSiteContext().platform === 'douyin') {
    let refreshTimer: number | null = null;

    const onVideoChange = () => {
      if (refreshTimer !== null) clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        Downloader.refreshInfo({ silent: true });
      }, 300);
    };

    // 主触发器：监听 sliderVideo 容器 class 中的 video_XXXX 变化
    // xgplayer 切换视频时会更新 class，比 play/playing 事件更可靠且不会重复触发
    const observedSliders = new WeakSet<Element>();

    const observeSlider = (el: Element) => {
      if (observedSliders.has(el)) return;
      observedSliders.add(el);
      let lastId = (el.className.match(/\bvideo_(\d{15,20})\b/) || [])[1] || '';
      new MutationObserver(() => {
        const newId = (el.className.match(/\bvideo_(\d{15,20})\b/) || [])[1] || '';
        if (newId && newId !== lastId) {
          lastId = newId;
          onVideoChange();
        }
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    };

    const scanSliders = () => {
      document.querySelectorAll<HTMLElement>('[class*="sliderVideo"]').forEach(observeSlider);
    };

    // 兜底：play 事件（sliderVideo 不存在时的非推荐页场景）
    // 注意：xgplayer MSE 模式不触发 playing，但 play 会触发
    const bindVideoPlay = (video: HTMLVideoElement) => {
      if ((video as any).__bdl_play_bound) return;
      (video as any).__bdl_play_bound = true;
      video.addEventListener('play', onVideoChange);
    };

    scanSliders();
    document.querySelectorAll<HTMLVideoElement>('video').forEach(bindVideoPlay);

    new MutationObserver(() => {
      scanSliders();
      document.querySelectorAll<HTMLVideoElement>('video').forEach(bindVideoPlay);
    }).observe(document.body, { childList: true, subtree: true });
  }

  // 微博：首页/视频流 URL 不变但视频会切换，监听 play 事件刷新
  if (Utils.getSiteContext().platform === 'weibo') {
    let weiboRefreshTimer: number | null = null;

    const onWeiboVideoPlay = () => {
      if (weiboRefreshTimer !== null) clearTimeout(weiboRefreshTimer);
      weiboRefreshTimer = window.setTimeout(() => {
        weiboRefreshTimer = null;
        Downloader.refreshInfo({ silent: true });
      }, 500);
    };

    const bindWeiboPlay = (video: HTMLVideoElement) => {
      if ((video as any).__bdl_wb_bound) return;
      (video as any).__bdl_wb_bound = true;
      video.addEventListener('play', onWeiboVideoPlay);
    };

    document.querySelectorAll<HTMLVideoElement>('video').forEach(bindWeiboPlay);
    new MutationObserver(() => {
      document.querySelectorAll<HTMLVideoElement>('video').forEach(bindWeiboPlay);
    }).observe(document.body, { childList: true, subtree: true });
  }
}

function loadFFmpeg(): Promise<void> {
  if (getFFmpegGlobal()) return Promise.resolve();
  if (ffmpegLoadPromise) return ffmpegLoadPromise;

  // loader 用 CDNJS（Bilibili CSP 白名单，之前验证可加载）
  // 核心用 @ffmpeg/core-st（单线程 wasm，无 SharedArrayBuffer 依赖）+ mainName: 'main'
  Diagnostics.info('ffmpeg', '开始加载 FFmpeg (0.11.6 loader / core-st)');
  ffmpegLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js';
    script.async = true;
    script.onload = () => {
      if (getFFmpegGlobal()) {
        Diagnostics.info('ffmpeg', 'FFmpeg 脚本加载完成');
        resolve();
      } else {
        Diagnostics.error('ffmpeg', 'FFmpeg 脚本已加载但全局对象不可用');
        reject(new Error('FFmpeg 加载后不可用'));
      }
    };
    script.onerror = () => {
      Diagnostics.error('ffmpeg', 'FFmpeg 脚本加载失败（网络或 CDN 被拦截）');
      reject(new Error('FFmpeg 加载失败'));
    };
    (document.head || document.documentElement).appendChild(script);
  });

  return ffmpegLoadPromise;
}

function checkFFmpegAvailability(): void {
  const updateStatus = (ready: boolean, label?: string, tooltip?: string) => {
    const el = UI.query<HTMLElement>('[data-method="ffmpeg-merge"] .bdl-method-status');
    if (!el) return;

    el.textContent = label || (ready ? '就绪' : '不可用');
    el.className = ready ? 'bdl-method-status ready' : 'bdl-method-status';
    el.style.background = ready ? '' : '#f8d7da';
    el.style.color = ready ? '' : '#721c24';
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

  loadFFmpeg().then(() => {
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
