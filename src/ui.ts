import { STYLES } from './styles.ts';
import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import type {
  VideoInfo,
  PageInfo,
  QualityItem,
  VideoCodecItem,
  AudioCodecItem,
  UGCEpisode,
  ShortVideoData,
  ShortVideoPlatform
} from './types.ts';

type ToolbarMode = 'video' | 'bangumi' | 'floating';
type MountTarget = {
  container: HTMLElement;
  anchor: HTMLElement | null;
  mode: ToolbarMode;
};

type ActionButton = {
  marker: string;
  label: string;
  onClick: () => void;
};

type DownloadingOptions = {
  allowQueue?: boolean;
  label?: string;
};

type PopupPlacement = 'top' | 'bottom' | 'side';
type DragTarget = 'popup' | 'entry';
type DragState = {
  target: DragTarget;
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
  hasMoved: boolean;
};
type Position = {
  left: number;
  top: number;
};

const BILIBILI_PLAYER_SELECTORS = [
  '.bpx-player-container',
  '#bilibili-player',
  '#playerWrap',
  '.player-wrap',
  '.bpx-player-video-wrap',
  '.player-container'
];
const DRAG_THRESHOLD = 5;

const PLATFORM_LABELS: Record<ShortVideoPlatform, string> = {
  douyin: '抖音',
  kuaishou: '快手',
  xiaohongshu: '小红书',
  weibo: '微博',
  toutiao: '今日头条',
  pipixia: '皮皮虾',
  pipigx: '皮皮搞笑'
};

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

function makeToolbarButton(): string {
  return `<button id="bdl-main-btn" class="bdl-toolbar-btn" type="button" title="下载视频" aria-expanded="false">
    <span class="bdl-toolbar-progress" id="bdl-progress-circle"></span>
    <span class="bdl-toolbar-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M12 3.5a1 1 0 0 1 1 1v7.09l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 1 1 1.4-1.42l2.3 2.3V4.5a1 1 0 0 1 1-1Zm-6.5 12a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-.5a1 1 0 1 1 2 0v.5a3.5 3.5 0 0 1-3.5 3.5H8A3.5 3.5 0 0 1 4.5 17v-.5a1 1 0 0 1 1-1Z" />
      </svg>
    </span>
    <span class="bdl-toolbar-text">下载</span>
  </button>`;
}

function makePopup(): string {
  return `<div class="bdl-popup" id="bdl-popup">
    <div class="bdl-header">
      <span class="bdl-header-title">视频下载助手</span>
      <button class="bdl-close" id="bdl-close" type="button" aria-label="关闭">×</button>
    </div>
    <div class="bdl-body">
      <div class="bdl-info-card">
        <div class="bdl-info-title" id="bdl-title">加载中...</div>
        <div class="bdl-info-meta">
          <span class="bdl-info-meta-item" id="bdl-author"><span class="bdl-meta-label">UP</span><span>--</span></span>
          <span class="bdl-info-meta-item" id="bdl-duration"><span class="bdl-meta-label">时长</span><span>--</span></span>
          <span class="bdl-info-meta-item" id="bdl-vip"></span>
        </div>
      </div>
      <div class="bdl-section bdl-short-items-section" id="bdl-short-items-section">
        <div class="bdl-section-header">
          <span class="bdl-section-title">内容选择</span>
          <span class="bdl-section-count" id="bdl-short-items-count"></span>
        </div>
        <div class="bdl-short-items" id="bdl-short-items"></div>
      </div>
      <div class="bdl-section" id="bdl-pages-section">
        <div class="bdl-section-header">
          <span class="bdl-section-title">分P选择</span>
          <span class="bdl-section-count" id="bdl-pages-count"></span>
        </div>
        <div class="bdl-pages-container" id="bdl-pages-list"></div>
        <div class="bdl-pages-actions">
          <button id="bdl-select-all" type="button">全选</button>
          <button id="bdl-select-none" type="button">取消</button>
          <button id="bdl-select-reverse" type="button">反选</button>
        </div>
      </div>
      <div class="bdl-section" id="bdl-ugc-section">
        <div class="bdl-section-header">
          <span class="bdl-section-title">合集选择</span>
          <span class="bdl-section-count" id="bdl-ugc-count"></span>
        </div>
        <div class="bdl-pages-container" id="bdl-ugc-list"></div>
        <div class="bdl-pages-actions">
          <button id="bdl-ugc-select-all" type="button">全选</button>
          <button id="bdl-ugc-select-none" type="button">取消</button>
          <button id="bdl-ugc-select-reverse" type="button">反选</button>
        </div>
      </div>
      <div class="bdl-section">
        <div class="bdl-section-header"><span class="bdl-section-title">清晰度</span></div>
        <div class="bdl-quality-grid" id="bdl-qualities"><button class="bdl-quality-btn" type="button">加载中</button></div>
      </div>
      <div class="bdl-section bdl-codec-selector">
        <div class="bdl-section-header"><span class="bdl-section-title">编码格式</span></div>
        <div class="bdl-codec-grid">
          <div class="bdl-codec-item">
            <span class="bdl-codec-label">视频编码</span>
            <select class="bdl-codec-select" id="bdl-video-codec"></select>
          </div>
          <div class="bdl-codec-item">
            <span class="bdl-codec-label">音频编码</span>
            <select class="bdl-codec-select" id="bdl-audio-codec"></select>
          </div>
        </div>
      </div>
      <div class="bdl-section">
        <div class="bdl-section-header"><span class="bdl-section-title">合并方式</span></div>
        <div class="bdl-method-list" id="bdl-methods">
          <div class="bdl-method-item active" data-method="js-merge">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">JS 原生合并 <span class="bdl-badge recommended">推荐</span></div>
              <div class="bdl-method-desc">直接在浏览器内合并，无需额外资源</div>
            </div>
            <span class="bdl-method-status ready">就绪</span>
          </div>
          <div class="bdl-method-item" data-method="ffmpeg-merge">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">FFmpeg 合并</div>
              <div class="bdl-method-desc">使用 FFmpeg 进行更稳定的封装</div>
            </div>
            <span class="bdl-method-status loading">加载中</span>
          </div>
          <div class="bdl-method-item" data-method="separate">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">分离下载</div>
              <div class="bdl-method-desc">分别保存视频和音频文件</div>
            </div>
            <span class="bdl-method-status ready">就绪</span>
          </div>
        </div>
      </div>
      <div class="bdl-extra-downloads" id="bdl-extra-downloads"></div>
      <div class="bdl-tips" id="bdl-tips" style="display:none;">
        <div class="bdl-tips-title">提示</div>
        <div id="bdl-tips-content"></div>
      </div>
      <div class="bdl-progress-section" id="bdl-progress">
        <div class="bdl-progress-row">
          <div class="bdl-progress-header">
            <span class="bdl-progress-label">视频流</span>
            <span class="bdl-progress-value" id="bdl-progress-video-text">0%</span>
          </div>
          <div class="bdl-progress-track"><div class="bdl-progress-bar video" id="bdl-progress-video"></div></div>
        </div>
        <div class="bdl-progress-row">
          <div class="bdl-progress-header">
            <span class="bdl-progress-label">音频流</span>
            <span class="bdl-progress-value" id="bdl-progress-audio-text">0%</span>
          </div>
          <div class="bdl-progress-track"><div class="bdl-progress-bar audio" id="bdl-progress-audio"></div></div>
        </div>
        <div class="bdl-progress-row" id="bdl-merge-row">
          <div class="bdl-progress-header">
            <span class="bdl-progress-label">合并</span>
            <span class="bdl-progress-value" id="bdl-progress-merge-text">0%</span>
          </div>
          <div class="bdl-progress-track"><div class="bdl-progress-bar merge" id="bdl-progress-merge"></div></div>
        </div>
      </div>
      <div class="bdl-alert" id="bdl-alert"></div>
      <button class="bdl-download-btn" id="bdl-download" type="button"><span>开始下载</span></button>
    </div>
    <div class="bdl-footer" id="bdl-footer">仅供学习研究，请支持正版内容创作者</div>
  </div>`;
}

export const UI = {
  elements: {} as Record<string, any>,
  pagesSectionEnabled: false,
  ugcSectionEnabled: false,
  multiSelectUnlocked: false,
  footerSecretClicks: 0,
  footerSecretLastClickAt: 0,
  currentMountMode: null as ToolbarMode | null,
  mountedAt: null as HTMLElement | null,
  host: null as HTMLElement | null,
  root: null as ShadowRoot | null,
  dragState: null as DragState | null,
  popupManualPosition: null as Position | null,
  entryManualPosition: null as Position | null,
  suppressNextEntryClick: false,
  circleProgressValue: 0,
  entryProgressActive: false,

  init(): void {
    this.createPanel();
    this.bindDragHandlers();
    this.ensureMounted();
  },

  createPanel(): void {
    document.getElementById('bdl-shadow-host')?.remove();

    const host = document.createElement('div');
    host.id = 'bdl-shadow-host';
    host.style.cssText = [
      'position:fixed!important',
      'inset:0!important',
      'display:block!important',
      'width:100vw!important',
      'height:100vh!important',
      'overflow:visible!important',
      'pointer-events:none!important',
      'z-index:2147483647!important'
    ].join(';') + ';';
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    root.appendChild(style);

    const entry = document.createElement('div');
    entry.id = 'bdl-entry';
    entry.innerHTML = makeToolbarButton();

    const panel = document.createElement('div');
    panel.id = 'bdl-panel';
    panel.innerHTML = makePopup();

    root.appendChild(entry);
    root.appendChild(panel);
    document.body.appendChild(host);

    this.host = host;
    this.root = root;

    const g = (id: string) => root.getElementById(id);

    this.elements = {
      entry,
      panel,
      btn: g('bdl-main-btn'),
      popup: g('bdl-popup'),
      close: g('bdl-close'),
      title: g('bdl-title'),
      author: g('bdl-author'),
      duration: g('bdl-duration'),
      vip: g('bdl-vip'),
      pagesSection: g('bdl-pages-section'),
      shortItemsSection: g('bdl-short-items-section'),
      shortItems: g('bdl-short-items'),
      shortItemsCount: g('bdl-short-items-count'),
      qualitySection: g('bdl-qualities')?.closest('.bdl-section') || null,
      codecSection: g('bdl-video-codec')?.closest('.bdl-section') || null,
      methodSection: g('bdl-methods')?.closest('.bdl-section') || null,
      pagesList: g('bdl-pages-list'),
      pagesCount: g('bdl-pages-count'),
      selectAll: g('bdl-select-all'),
      selectNone: g('bdl-select-none'),
      selectReverse: g('bdl-select-reverse'),
      ugcSection: g('bdl-ugc-section'),
      ugcList: g('bdl-ugc-list'),
      ugcCount: g('bdl-ugc-count'),
      ugcSelectAll: g('bdl-ugc-select-all'),
      ugcSelectNone: g('bdl-ugc-select-none'),
      ugcSelectReverse: g('bdl-ugc-select-reverse'),
      qualities: g('bdl-qualities'),
      videoCodec: g('bdl-video-codec'),
      audioCodec: g('bdl-audio-codec'),
      methods: g('bdl-methods'),
      extraDownloads: g('bdl-extra-downloads'),
      progress: g('bdl-progress'),
      progressVideo: g('bdl-progress-video'),
      progressVideoText: g('bdl-progress-video-text'),
      progressAudio: g('bdl-progress-audio'),
      progressAudioText: g('bdl-progress-audio-text'),
      progressAudioRow: g('bdl-progress-audio')?.closest('.bdl-progress-row') || null,
      progressMerge: g('bdl-progress-merge'),
      progressMergeText: g('bdl-progress-merge-text'),
      mergeRow: g('bdl-merge-row'),
      alert: g('bdl-alert'),
      download: g('bdl-download'),
      tips: g('bdl-tips'),
      tipsContent: g('bdl-tips-content'),
      progressCircle: g('bdl-progress-circle'),
      footer: g('bdl-footer')
    };
  },

  query<T extends Element = Element>(selector: string): T | null {
    return this.root?.querySelector<T>(selector) || null;
  },

  queryAll<T extends Element = Element>(selector: string): T[] {
    return Array.from(this.root?.querySelectorAll<T>(selector) || []);
  },

  bindDragHandlers(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const header = popup?.querySelector<HTMLElement>('.bdl-header') || null;
    const entry = this.elements.entry as HTMLElement | null;

    header?.addEventListener('pointerdown', event => {
      if ((event.target as Element | null)?.closest('.bdl-close')) return;
      this.startDrag('popup', event);
    });

    entry?.addEventListener('pointerdown', event => {
      if (this.currentMountMode !== 'floating') return;
      this.startDrag('entry', event);
    });
  },

  startDrag(target: DragTarget, event: PointerEvent): void {
    if (event.button !== 0) return;

    const element = target === 'popup'
      ? this.elements.popup as HTMLElement | null
      : this.elements.entry as HTMLElement | null;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    this.dragState = {
      target,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      hasMoved: false
    };

    window.addEventListener('pointermove', this.handleDragMove, true);
    window.addEventListener('pointerup', this.handleDragEnd, true);
    window.addEventListener('pointercancel', this.handleDragEnd, true);
  },

  handleDragMove: (event: PointerEvent): void => {
    UI.updateDrag(event);
  },

  handleDragEnd: (event: PointerEvent): void => {
    UI.endDrag(event);
  },

  updateDrag(event: PointerEvent): void {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    const element = state.target === 'popup'
      ? this.elements.popup as HTMLElement | null
      : this.elements.entry as HTMLElement | null;
    if (!element) return;

    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    if (!state.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    if (!state.hasMoved) {
      state.hasMoved = true;
      element.classList.add('is-dragging');
      element.setPointerCapture?.(event.pointerId);
    }

    const nextLeft = state.originLeft + deltaX;
    const nextTop = state.originTop + deltaY;
    const position = this.clampElementPosition(element, nextLeft, nextTop);

    if (state.target === 'popup') {
      this.popupManualPosition = position;
      element.dataset.placement = 'manual';
    } else {
      this.entryManualPosition = position;
      element.style.right = 'auto';
      element.style.bottom = 'auto';
    }

    this.applyElementPosition(element, position);
    event.preventDefault();
    event.stopPropagation();
  },

  endDrag(event: PointerEvent): void {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    const element = state.target === 'popup'
      ? this.elements.popup as HTMLElement | null
      : this.elements.entry as HTMLElement | null;
    if (element) {
      element.classList.remove('is-dragging');
      element.releasePointerCapture?.(event.pointerId);
    }
    window.removeEventListener('pointermove', this.handleDragMove, true);
    window.removeEventListener('pointerup', this.handleDragEnd, true);
    window.removeEventListener('pointercancel', this.handleDragEnd, true);

    if (state.hasMoved && state.target === 'entry') {
      this.suppressNextEntryClick = true;
      setTimeout(() => {
        this.suppressNextEntryClick = false;
      }, 0);
    }

    this.dragState = null;
    if (state.hasMoved) {
      event.preventDefault();
      event.stopPropagation();
    }
  },

  consumeEntryClickSuppression(): boolean {
    const suppressed = this.suppressNextEntryClick;
    this.suppressNextEntryClick = false;
    return suppressed;
  },

  clampElementPosition(element: HTMLElement, left: number, top: number): Position {
    const viewportPadding = 8;
    const rect = element.getBoundingClientRect();
    const width = rect.width || element.offsetWidth || 80;
    const height = rect.height || element.offsetHeight || 40;

    return {
      left: clamp(left, viewportPadding, window.innerWidth - width - viewportPadding),
      top: clamp(top, viewportPadding, window.innerHeight - height - viewportPadding)
    };
  },

  applyElementPosition(element: HTMLElement, position: Position): void {
    element.style.left = `${Math.round(position.left)}px`;
    element.style.top = `${Math.round(position.top)}px`;
  },

  getMountTarget(): MountTarget | null {
    const siteContext = Utils.getSiteContext();

    if (siteContext.kind === 'short-video') {
      return { container: document.body, anchor: null, mode: 'floating' };
    }

    const videoContainer = document.querySelector<HTMLElement>('#arc_toolbar_report .video-toolbar-left-main');
    if (videoContainer) {
      const shareWrap = videoContainer.querySelector('.video-share-wrap')?.closest('.toolbar-left-item-wrap') as HTMLElement | null;
      return { container: videoContainer, anchor: shareWrap, mode: 'video' };
    }

    const bangumiContainer = document.querySelector<HTMLElement>('.player-left-components .toolbar-left');
    if (bangumiContainer) {
      const watchTogether = document.getElementById('watch_together_tab');
      const anchor = watchTogether?.parentElement instanceof HTMLElement ? watchTogether.parentElement : null;
      return { container: bangumiContainer, anchor, mode: 'bangumi' };
    }

    return null;
  },

  ensureMounted(): boolean {
    const entry = this.elements.entry as HTMLElement | undefined;
    const btn = this.elements.btn as HTMLElement | undefined;
    if (!entry || !btn) return false;

    const mount = this.getMountTarget();
    if (!mount) {
      entry.className = '';
      entry.removeAttribute('data-mode');
      entry.removeAttribute('data-mounted');
      entry.style.left = '';
      entry.style.top = '';
      entry.style.right = '';
      entry.style.bottom = '';
      entry.style.visibility = '';
      this.mountedAt = null;
      this.currentMountMode = null;
      this.hidePopup();
      return false;
    }

    entry.dataset.mode = mount.mode;
    entry.dataset.mounted = 'true';
    if (mount.mode === 'floating') {
      entry.className = 'bdl-floating-entry';
      btn.className = 'bdl-toolbar-btn bdl-floating-btn';
    } else {
      // Keep Bilibili's Vue-owned toolbar DOM untouched. The entry is positioned as a portal.
      entry.className = mount.mode === 'video' ? 'bdl-toolbar-wrap bdl-bilibili-entry' : 'bdl-toolbar-wrap bdl-bangumi-entry';
      btn.className = mount.mode === 'video' ? 'bdl-toolbar-btn bdl-toolbar-btn-video' : 'bdl-toolbar-btn bdl-toolbar-btn-bangumi';
    }
    entry.classList.toggle('is-downloading', this.entryProgressActive);

    this.mountedAt = mount.container;
    this.currentMountMode = mount.mode;
    this.positionEntry(mount);
    this.positionPopup();
    this.syncEntryProgressVisibility();
    return true;
  },

  positionEntry(mount?: MountTarget | null): void {
    const entry = this.elements.entry as HTMLElement | undefined;
    if (!entry) return;

    const target = mount === undefined ? this.getMountTarget() : mount;
    if (!target || target.mode === 'floating') {
      if (target?.mode === 'floating' && this.entryManualPosition) {
        const position = this.clampElementPosition(entry, this.entryManualPosition.left, this.entryManualPosition.top);
        this.entryManualPosition = position;
        this.applyElementPosition(entry, position);
        entry.style.right = 'auto';
        entry.style.bottom = 'auto';
      } else {
        entry.style.left = '';
        entry.style.top = '';
        entry.style.right = '';
        entry.style.bottom = '';
      }
      entry.style.visibility = '';
      return;
    }

    const anchorRect = target.anchor?.getBoundingClientRect();
    const containerRect = target.container.getBoundingClientRect();
    const baseRect = anchorRect && anchorRect.width > 0 && anchorRect.height > 0 ? anchorRect : containerRect;

    if (baseRect.width <= 0 && baseRect.height <= 0) {
      entry.style.visibility = 'hidden';
      return;
    }

    entry.style.visibility = 'hidden';
    entry.style.left = '0px';
    entry.style.top = '0px';
    const entryRect = entry.getBoundingClientRect();
    const width = entryRect.width || 74;
    const height = entryRect.height || 32;
    const gap = 8;
    const viewportPadding = 12;

    let left = baseRect.right + gap;
    if (left + width > window.innerWidth - viewportPadding) {
      left = baseRect.left - width - gap;
    }
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));

    let top = baseRect.top + (baseRect.height - height) / 2;
    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - height - viewportPadding));

    entry.style.left = `${Math.round(left)}px`;
    entry.style.top = `${Math.round(top)}px`;
    entry.style.right = 'auto';
    entry.style.bottom = 'auto';
    entry.style.visibility = 'visible';
  },

  showPopup(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const btn = this.elements.btn as HTMLButtonElement | null;
    if (!popup || !btn) return;

    popup.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
    this.positionPopup();
    this.syncEntryProgressVisibility();
  },

  hidePopup(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const btn = this.elements.btn as HTMLButtonElement | null;
    if (popup) popup.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    this.syncEntryProgressVisibility();
  },

  togglePopup(): boolean {
    if (!this.ensureMounted()) return false;
    const popup = this.elements.popup as HTMLElement | null;
    if (!popup) return false;

    const willShow = !popup.classList.contains('show');
    if (willShow) this.showPopup();
    else this.hidePopup();
    return willShow;
  },

  getBilibiliPlayerRect(): DOMRect | null {
    let bestRect: DOMRect | null = null;
    let bestArea = 0;

    for (const selector of BILIBILI_PLAYER_SELECTORS) {
      document.querySelectorAll<HTMLElement>(selector).forEach(element => {
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        if (rect.width < 320 || rect.height < 180 || visibleWidth <= 0 || visibleHeight <= 0) return;

        const area = rect.width * rect.height;
        if (area > bestArea) {
          bestRect = rect;
          bestArea = area;
        }
      });
    }

    return bestRect;
  },

  setPopupMaxHeight(maxHeight: number): number {
    const popup = this.elements.popup as HTMLElement | null;
    if (!popup) return maxHeight;

    const safeMaxHeight = Math.max(220, Math.floor(maxHeight));
    popup.style.maxHeight = `${safeMaxHeight}px`;

    const body = popup.querySelector<HTMLElement>('.bdl-body');
    if (body) body.style.maxHeight = `${Math.max(120, safeMaxHeight - 108)}px`;

    return safeMaxHeight;
  },

  setPopupWidth(width: number): number {
    const popup = this.elements.popup as HTMLElement | null;
    if (!popup) return width;

    const safeWidth = clamp(Math.floor(width), 300, window.innerWidth - 32);
    popup.style.width = `${safeWidth}px`;
    return safeWidth;
  },

  positionPopup(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const btn = this.elements.btn as HTMLElement | null;
    if (!popup || !btn || !popup.classList.contains('show')) return;

    const gap = 12;
    const viewportPadding = 16;
    const buttonRect = btn.getBoundingClientRect();
    let popupWidth = this.setPopupWidth(Math.min(432, window.innerWidth - viewportPadding * 2));
    const maxViewportHeight = this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2);
    let popupHeight = Math.min(popup.offsetHeight || 620, maxViewportHeight);
    let placement: PopupPlacement = 'bottom';

    if (this.popupManualPosition) {
      const position = this.clampElementPosition(popup, this.popupManualPosition.left, this.popupManualPosition.top);
      this.popupManualPosition = position;
      popup.dataset.placement = 'manual';
      this.applyElementPosition(popup, position);
      return;
    }

    let left = buttonRect.right - popupWidth;
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popupWidth - viewportPadding));

    let top = buttonRect.bottom + gap;
    const playerRect = Utils.getSiteContext().kind === 'bilibili' ? this.getBilibiliPlayerRect() : null;

    if (playerRect) {
      const rightLeft = playerRect.right + gap;
      const rightSpace = window.innerWidth - rightLeft - viewportPadding;

      if (rightSpace >= 300) {
        popupWidth = this.setPopupWidth(Math.min(432, rightSpace));
        popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2));
        left = rightLeft;
        top = clamp(playerRect.top, viewportPadding, window.innerHeight - popupHeight - viewportPadding);
        placement = 'side';
      } else {
        const belowTop = Math.max(playerRect.bottom + gap, buttonRect.bottom + gap);
        const belowSpace = window.innerHeight - belowTop - viewportPadding;

        if (belowSpace >= 220) {
          popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(belowSpace));
          top = belowTop;
          placement = 'bottom';
        } else {
          const topSpace = playerRect.top - gap - viewportPadding;
          if (topSpace >= 220) {
            popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(topSpace));
            top = playerRect.top - popupHeight - gap;
            placement = 'top';
          } else {
            popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2));
            top = clamp(buttonRect.bottom + gap, viewportPadding, window.innerHeight - popupHeight - viewportPadding);
            placement = 'bottom';
          }
        }

        left = clamp(buttonRect.right - popupWidth, viewportPadding, window.innerWidth - popupWidth - viewportPadding);
      }
    } else if (top + popupHeight > window.innerHeight - viewportPadding && buttonRect.top > popupHeight + gap) {
      top = buttonRect.top - popupHeight - gap;
      placement = 'top';
    }

    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - popupHeight - viewportPadding));

    popup.dataset.placement = placement;
    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
  },

  updateVideoInfo(videoInfo: VideoInfo, pageInfo: PageInfo, vipType: number): void {
    this.setBilibiliMode();
    let title = videoInfo.title;
    if (videoInfo.pages.length > 1 && pageInfo.part) title += ' - ' + pageInfo.part;

    this.elements.title.textContent = title;
    this.elements.title.title = title;
    this.elements.author.innerHTML = `<span class="bdl-meta-label">UP</span><span>${videoInfo.owner.name}</span>`;
    this.elements.duration.innerHTML = `<span class="bdl-meta-label">时长</span><span>${Utils.formatDuration(videoInfo.duration)}</span>`;

    let badge = '';
    if (vipType === 0) badge = '<span class="bdl-vip-badge guest">游客</span>';
    else if (vipType === 1) badge = '<span class="bdl-vip-badge normal">会员</span>';
    else if (vipType === 2) badge = '<span class="bdl-vip-badge vip">大会员</span>';
    this.elements.vip.innerHTML = badge;
  },

  updateShortVideoInfo(data: ShortVideoData, platform: ShortVideoPlatform): void {
    this.setShortVideoMode(platform);

    const title = data.title || data.desc || '未获取到内容标题';
    const authorName = data.author?.name || '--';
    const typeLabelMap: Record<string, string> = {
      video: '短视频',
      image: '图集',
      live: '实况图',
      unknown: '内容'
    };
    const typeLabel = typeLabelMap[data.type || 'unknown'] || '内容';
    const durationText = data.duration ? Utils.formatDurationMs(data.duration) : null;

    this.elements.title.textContent = title;
    this.elements.title.title = title;
    this.elements.author.innerHTML = `<span class="bdl-meta-label">作者</span><span>${authorName}</span>`;
    this.elements.duration.innerHTML = `<span class="bdl-meta-label">类型</span><span>${durationText ? `${typeLabel} · ${durationText}` : typeLabel}</span>`;
    this.elements.vip.innerHTML = `<span class="bdl-vip-badge site">${PLATFORM_LABELS[platform]}</span>`;
    this.setPrimaryButtonLabel(this.getShortVideoPrimaryLabel(data));
  },

  prepareShortVideoItems(items: ShortVideoData[], currentIndex: number, onSelect: (index: number) => void): void {
    const section = this.elements.shortItemsSection as HTMLElement | null;
    const list = this.elements.shortItems as HTMLElement | null;
    const count = this.elements.shortItemsCount as HTMLElement | null;
    if (!section || !list) return;

    list.innerHTML = '';
    if (items.length <= 1) {
      section.classList.remove('show');
      return;
    }

    section.classList.add('show');
    if (count) count.textContent = `共 ${items.length} 项`;

    items.forEach((item, index) => {
      const typeLabel = item.type === 'image'
        ? `图集${item.images?.length ? ` ${item.images.length}张` : ''}`
        : item.type === 'live'
          ? `实况${item.live_photo?.length ? ` ${item.live_photo.length}项` : ''}`
          : '视频';
      const title = item.title || item.desc || item.itemLabel || `${typeLabel} ${index + 1}`;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bdl-short-item${index === currentIndex ? ' active' : ''}`;
      const marker = document.createElement('span');
      marker.className = 'bdl-short-item-mark';
      marker.textContent = typeLabel;
      const titleEl = document.createElement('span');
      titleEl.className = 'bdl-short-item-title';
      titleEl.textContent = title;
      button.append(marker, titleEl);
      button.addEventListener('click', () => onSelect(index));
      list.appendChild(button);
    });
  },

  hideShortVideoItems(): void {
    const section = this.elements.shortItemsSection as HTMLElement | null;
    const list = this.elements.shortItems as HTMLElement | null;
    const count = this.elements.shortItemsCount as HTMLElement | null;
    if (section) section.classList.remove('show');
    if (list) list.innerHTML = '';
    if (count) count.textContent = '';
  },

  getShortVideoPrimaryLabel(data: ShortVideoData): string {
    if (data.type === 'image') return `下载图集${data.images?.length ? ` (${data.images.length})` : ''}`;
    if (data.type === 'live') return `下载实况图${data.live_photo?.length ? ` (${data.live_photo.length})` : ''}`;
    if (data.music?.url && !data.url) return '下载音频';
    return '下载视频';
  },

  preparePagesSection(pages: PageInfo[], currentIndex: number, onUpdate: () => void): void {
    this.pagesSectionEnabled = true;
    this.resetFooterSecret();
    this.elements.pagesSection.classList.remove('show');
    this.elements.pagesCount.textContent = `共 ${pages.length} 个分P`;
    this.elements.pagesList.innerHTML = '';

    pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = `bdl-page-item${index === currentIndex ? ' active' : ''}`;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'bdl-page-checkbox';
      cb.dataset.index = String(index);
      cb.checked = index === currentIndex;

      const info = document.createElement('div');
      info.className = 'bdl-page-info';

      const num = document.createElement('div');
      num.className = 'bdl-page-num';
      num.textContent = `P${page.page}`;

      const pageTitle = document.createElement('div');
      pageTitle.className = 'bdl-page-title';
      pageTitle.textContent = page.part || `第${page.page}话`;
      pageTitle.title = pageTitle.textContent;

      const duration = document.createElement('span');
      duration.className = 'bdl-page-duration';
      duration.textContent = Utils.formatDuration(page.duration);

      info.appendChild(num);
      info.appendChild(pageTitle);
      item.appendChild(cb);
      item.appendChild(info);
      item.appendChild(duration);

      cb.addEventListener('change', onUpdate);
      item.addEventListener('click', e => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
          onUpdate();
        }
      });

      this.elements.pagesList.appendChild(item);
    });

    onUpdate();
  },

  prepareUGCSection(episodes: UGCEpisode[], onUpdate: () => void): void {
    this.ugcSectionEnabled = true;
    this.resetFooterSecret();
    this.elements.ugcSection.classList.remove('show');
    this.elements.ugcCount.textContent = `共 ${episodes.length} 个视频`;
    this.elements.ugcList.innerHTML = '';

    episodes.forEach((ep, index) => {
      const item = document.createElement('div');
      item.className = 'bdl-page-item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'bdl-page-checkbox';
      cb.dataset.index = String(index);
      cb.checked = false;

      const info = document.createElement('div');
      info.className = 'bdl-page-info';

      const num = document.createElement('div');
      num.className = 'bdl-page-num';
      num.textContent = `E${index + 1}`;

      const epTitle = document.createElement('div');
      epTitle.className = 'bdl-page-title';
      epTitle.textContent = ep.title;
      epTitle.title = ep.title;

      const duration = document.createElement('span');
      duration.className = 'bdl-page-duration';
      duration.textContent = Utils.formatDuration(ep.arc.duration);

      info.appendChild(num);
      info.appendChild(epTitle);
      item.appendChild(cb);
      item.appendChild(info);
      item.appendChild(duration);

      cb.addEventListener('change', onUpdate);
      item.addEventListener('click', e => {
        if (e.target !== cb) {
          cb.checked = !cb.checked;
          onUpdate();
        }
      });

      this.elements.ugcList.appendChild(item);
    });

    onUpdate();
  },

  toggleExtendedSections(): void {
    const pagesVisible = this.elements.pagesSection.classList.contains('show');
    const ugcVisible = this.elements.ugcSection.classList.contains('show');

    if (pagesVisible || ugcVisible) {
      this.elements.pagesSection.classList.remove('show');
      this.elements.ugcSection.classList.remove('show');
      return;
    }

    if (this.pagesSectionEnabled) this.elements.pagesSection.classList.add('show');
    if (this.ugcSectionEnabled) this.elements.ugcSection.classList.add('show');
  },

  resetFooterSecret(): void {
    this.multiSelectUnlocked = false;
    this.footerSecretClicks = 0;
    this.footerSecretLastClickAt = 0;
  },

  handleFooterSecretClick(): boolean {
    if (!this.pagesSectionEnabled && !this.ugcSectionEnabled) return false;

    if (this.multiSelectUnlocked) {
      this.toggleExtendedSections();
      return true;
    }

    const now = Date.now();
    if (now - this.footerSecretLastClickAt > 1200) {
      this.footerSecretClicks = 0;
    }

    this.footerSecretLastClickAt = now;
    this.footerSecretClicks += 1;

    if (this.footerSecretClicks < 5) return false;

    this.multiSelectUnlocked = true;
    this.footerSecretClicks = 0;
    this.toggleExtendedSections();
    return true;
  },

  hidePagesSection(): void {
    this.pagesSectionEnabled = false;
    this.elements.pagesSection.classList.remove('show');
    this.elements.pagesList.innerHTML = '';
    this.elements.pagesCount.textContent = '';
  },

  hideUGCSection(): void {
    this.ugcSectionEnabled = false;
    this.elements.ugcSection.classList.remove('show');
    this.elements.ugcList.innerHTML = '';
    this.elements.ugcCount.textContent = '';
  },

  setBilibiliMode(): void {
    this.hideShortVideoItems();
    this.elements.pagesSection.style.display = '';
    this.elements.ugcSection.style.display = '';
    if (this.elements.qualitySection) this.elements.qualitySection.style.display = '';
    if (this.elements.codecSection) this.elements.codecSection.style.display = '';
    if (this.elements.methodSection) this.elements.methodSection.style.display = '';
    if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = '';
    this.elements.mergeRow.style.display = '';
    this.setPrimaryProgressLabel('视频流');
    this.setPrimaryButtonLabel('开始下载');
  },

  setShortVideoMode(platform: ShortVideoPlatform): void {
    this.hidePagesSection();
    this.hideUGCSection();
    this.hideShortVideoItems();
    this.elements.pagesSection.style.display = 'none';
    this.elements.ugcSection.style.display = 'none';
    if (this.elements.qualitySection) this.elements.qualitySection.style.display = 'none';
    if (this.elements.codecSection) this.elements.codecSection.style.display = 'none';
    if (this.elements.methodSection) this.elements.methodSection.style.display = 'none';
    if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = 'none';
    this.elements.mergeRow.style.display = 'none';
    this.hideTips();
    this.setPrimaryProgressLabel(`${PLATFORM_LABELS[platform]}下载`);
    this.elements.title.textContent = `${PLATFORM_LABELS[platform]}内容待解析`;
    this.elements.title.title = this.elements.title.textContent;
    this.elements.author.innerHTML = '<span class="bdl-meta-label">状态</span><span>打开具体内容页后可解析</span>';
    this.elements.duration.innerHTML = '<span class="bdl-meta-label">类型</span><span>短视频/图集</span>';
    this.elements.vip.innerHTML = `<span class="bdl-vip-badge site">${PLATFORM_LABELS[platform]}</span>`;
    this.setPrimaryButtonLabel('解析内容');
  },

  resetSectionsVisibility(): void {
    this.elements.pagesSection.style.display = '';
    this.elements.ugcSection.style.display = '';
    if (this.elements.qualitySection) this.elements.qualitySection.style.display = '';
    if (this.elements.codecSection) this.elements.codecSection.style.display = '';
    if (this.elements.methodSection) this.elements.methodSection.style.display = '';
    if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = '';
    this.elements.mergeRow.style.display = '';
  },

  updateQualities(qualities: QualityItem[], currentQn: number, onSelect: (qn: number) => void): void {
    this.elements.qualities.innerHTML = '';

    qualities.forEach((quality, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bdl-quality-btn${quality.available ? '' : ' disabled'}`;

      if ((quality.qn === currentQn && quality.available) || (index === 0 && quality.available)) {
        btn.classList.add('active');
        onSelect(quality.qn);
      }

      btn.textContent = quality.desc;
      btn.dataset.qn = String(quality.qn);

      btn.addEventListener('click', () => {
        if (!quality.available) {
          const vipTypeText = BiliAPI.userVipType === 0 ? '游客' : BiliAPI.userVipType === 1 ? '普通会员' : '大会员';
          this.showAlert(`当前账号(${vipTypeText})无权限观看此清晰度`, 'warning');
          return;
        }

        this.elements.qualities.querySelectorAll('.bdl-quality-btn').forEach((button: Element) => button.classList.remove('active'));
        btn.classList.add('active');
        onSelect(quality.qn);
      });

      this.elements.qualities.appendChild(btn);
    });
  },

  updateCodecSelectors(videoCodecs: VideoCodecItem[], audioCodecs: AudioCodecItem[]): void {
    this.elements.videoCodec.innerHTML = '';
    videoCodecs.forEach((codec, index) => {
      const option = document.createElement('option');
      option.value = codec.type;
      option.textContent = codec.name;
      if (index === 0) option.selected = true;
      this.elements.videoCodec.appendChild(option);
    });

    this.elements.audioCodec.innerHTML = '';
    audioCodecs.forEach((codec, index) => {
      const option = document.createElement('option');
      option.value = String(codec.id);
      option.textContent = codec.name;
      if (index === 0) option.selected = true;
      this.elements.audioCodec.appendChild(option);
    });
  },

  updateExtraDownloads(
    hasSubtitles: boolean,
    hasDanmaku: boolean,
    hasCover: boolean,
    onCover: () => void,
    onSubtitles: () => void,
    onDanmaku: () => void
  ): void {
    this.elements.extraDownloads.innerHTML = '';

    if (hasCover) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      button.innerHTML = '<span class="bdl-extra-btn-mark">封面</span><span>下载封面</span>';
      button.addEventListener('click', onCover);
      this.elements.extraDownloads.appendChild(button);
    }

    if (hasSubtitles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      button.innerHTML = '<span class="bdl-extra-btn-mark">字幕</span><span>下载字幕</span>';
      button.addEventListener('click', onSubtitles);
      this.elements.extraDownloads.appendChild(button);
    }

    if (hasDanmaku) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      button.innerHTML = '<span class="bdl-extra-btn-mark">弹幕</span><span>下载弹幕</span>';
      button.addEventListener('click', onDanmaku);
      this.elements.extraDownloads.appendChild(button);
    }
  },

  setExtraActions(actions: ActionButton[]): void {
    this.elements.extraDownloads.innerHTML = '';
    actions.forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      button.innerHTML = `<span class="bdl-extra-btn-mark">${action.marker}</span><span>${action.label}</span>`;
      button.addEventListener('click', action.onClick);
      this.elements.extraDownloads.appendChild(button);
    });
  },

  showProgress(show: boolean): void {
    if (show) {
      this.elements.progress.classList.add('show');
      this.updateProgress('video', 0);
      this.updateProgress('audio', 0);
      this.updateProgress('merge', 0);
      return;
    }

    this.elements.progress.classList.remove('show');
  },

  updateProgress(type: string, percent: number, label?: string): void {
    const id = `progress${type.charAt(0).toUpperCase()}${type.slice(1)}`;
    const bar = this.elements[id];
    const text = this.elements[`${id}Text`];

    if (bar) bar.style.width = `${percent}%`;
    if (text) text.textContent = label || `${percent}%`;
  },

  setPrimaryProgressLabel(label: string): void {
    const progressLabel = this.elements.progressVideo?.closest('.bdl-progress-row')?.querySelector('.bdl-progress-label') as HTMLElement | null;
    if (progressLabel) progressLabel.textContent = label;
  },

  isPopupShown(): boolean {
    return Boolean((this.elements.popup as HTMLElement | null)?.classList.contains('show'));
  },

  syncEntryProgressVisibility(): void {
    const circle = this.elements.progressCircle as HTMLElement | null;
    const entry = this.elements.entry as HTMLElement | null;
    if (!circle) return;

    const showOnEntry = !this.isPopupShown()
      && this.entryProgressActive;
    const visibleProgress = showOnEntry ? Math.max(4, this.circleProgressValue) : 0;
    circle.style.height = `${visibleProgress}%`;
    entry?.classList.toggle('has-entry-progress', showOnEntry);
  },

  updateCircleProgress(percent: number): void {
    this.circleProgressValue = clamp(percent, 0, 100);
    this.syncEntryProgressVisibility();
  },

  showAlert(message: string, type: string): void {
    this.elements.alert.textContent = message;
    this.elements.alert.className = `bdl-alert show ${type}`;
  },

  hideAlert(): void {
    this.elements.alert.className = 'bdl-alert';
  },

  hideTips(): void {
    this.elements.tips.style.display = 'none';
  },

  setPrimaryButtonLabel(label: string): void {
    if (this.elements.download.disabled || this.elements.download.classList.contains('is-active')) return;
    this.renderDownloadButton(label);
  },

  renderDownloadButton(label: string, progress = 0): void {
    const safeProgress = clamp(progress, 0, 100);
    const download = this.elements.download as HTMLElement;
    const fill = document.createElement('span');
    const labelEl = document.createElement('span');
    fill.className = 'bdl-download-progress-fill';
    labelEl.className = 'bdl-download-label';
    labelEl.textContent = label;
    download.style.setProperty('--bdl-download-progress', `${safeProgress}%`);
    download.replaceChildren(fill, labelEl);
  },

  updateDownloadButtonProgress(percent: number, label?: string): void {
    const download = this.elements.download as HTMLElement | null;
    if (!download?.classList.contains('is-active')) return;

    const queueMode = download.classList.contains('can-queue');
    const safeProgress = clamp(percent, 0, 100);
    const text = label || `下载中 ${safeProgress}%`;
    this.renderDownloadButton(queueMode ? `${text} · 再点排队` : text, safeProgress);
  },

  setDownloading(isDownloading: boolean, options: DownloadingOptions = {}): void {
    const allowQueue = Boolean(options.allowQueue);
    this.elements.download.disabled = isDownloading && !allowQueue;
    this.elements.download.classList.toggle('is-active', isDownloading);
    this.elements.download.classList.toggle('can-queue', isDownloading && allowQueue);
    this.renderDownloadButton(isDownloading ? (options.label || '下载中...') : '开始下载', isDownloading ? 0 : 0);
    this.elements.btn.disabled = false;
    this.entryProgressActive = isDownloading;
    this.elements.entry.classList.toggle('is-downloading', isDownloading);
    if (!isDownloading) {
      this.circleProgressValue = 0;
      this.elements.entry.classList.remove('has-entry-progress');
    }
    this.syncEntryProgressVisibility();
  }
};
