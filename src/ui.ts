import { STYLES } from './styles.ts';
import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import { Diagnostics, type DiagnosticEntry } from './diagnostics.ts';
import { NEUTRAL_BRAND, NEUTRAL_SKIN, PLATFORMS, getBrand, getSkin } from './platforms.ts';
import { applyBrand, applySkin, applySurface, isDarkSite, sampleNativeStyle } from './native-skin.ts';
import type { BrandColors, SkinKey, SkinVars } from './types.ts';
import type {
  VideoInfo,
  PageInfo,
  QualityItem,
  VideoCodecItem,
  AudioCodecItem,
  UGCEpisode,
  ShortVideoData,
  ShortVideoPlatform,
  MountPointConfig,
  GifOutput
} from './types.ts';

type ToolbarMode = 'video' | 'bangumi' | 'floating' | 'native-bar';
type MountTarget = {
  container: HTMLElement;
  anchor: HTMLElement | null;
  mode: ToolbarMode;
  /** native-bar 模式：把按钮插入站点 DOM，并取样该原生按钮的样式。 */
  inline?: boolean;
  sample?: HTMLElement | null;
  /**
   * 视觉取样元素，用于取尺寸 / 颜色 / 图标大小。省略时等同于 sample。
   *
   * X 的定位样板（sample）是整个绝对定位层，视觉需另取层内的原生按钮。
   */
  skinSample?: HTMLElement | null;
  direction?: 'row' | 'column';
  /** 插入到 container 的哪个子节点之前；null 或省略表示追加到末尾。 */
  insertBefore?: Element | null;
  /** 行内样式：存在 skeleton 时写在其根节点上，否则写在 inlineHost 上。 */
  hostStyle?: Record<string, string>;
  /** 已嫁接 inlineHost 的外壳克隆体。存在时插入该节点而非裸宿主。 */
  skeleton?: HTMLElement | null;
  /** 挂载期间需隐藏的样板兄弟，取消挂载时还原。 */
  hideSample?: HTMLElement | null;
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

/** 内容选择列表中一个可单独选中的条目。 */
type ShortItemAsset = {
  /** 缩略图地址，取不到时只显示序号。 */
  thumb?: string;
  label: string;
};

/** 内容选择列表的选中状态与交互回调。 */
type ShortItemsOptions = {
  /** 当前用于预览的媒体项下标。 */
  previewIndex: number;
  /** 被选中的媒体项下标。 */
  selectedItems: Set<number>;
  /** 媒体项下标到其被选中的条目下标。 */
  selectedAssets: Map<number, Set<number>>;
  onPreview: (index: number) => void;
  onToggleItem: (index: number, selected: boolean) => void;
  onToggleAsset: (itemIndex: number, assetIndex: number, selected: boolean) => void;
  onSelectAll: (mode: 'all' | 'none' | 'invert') => void;
};

/**
 * 列出媒体项内可单独选中的条目。
 *
 * @returns 图集为每张图，实况图为每个条目，其余类型为空数组（整项作为一个单位）
 */
function getItemAssets(item: ShortVideoData): ShortItemAsset[] {
  if (item.type === 'image') {
    return (item.images || []).map((url, index) => ({ thumb: url, label: `图 ${index + 1}` }));
  }
  if (item.type === 'live') {
    return (item.live_photo || []).map((entry, index) => ({ thumb: entry.image, label: `实况 ${index + 1}` }));
  }
  return [];
}

/** 媒体项的类型徽标文字，含条目数量。 */
function getItemTypeLabel(item: ShortVideoData): string {
  if (item.type === 'image') return `图集${item.images?.length ? ` ${item.images.length}张` : ''}`;
  if (item.type === 'live') return `实况${item.live_photo?.length ? ` ${item.live_photo.length}项` : ''}`;
  return '视频';
}

/**
 * 创建一个条目单元格：缩略图加序号，选中状态由外框体现。
 *
 * 缩略图加载失败时移除图片元素，只留序号，避免出现破图占位。
 *
 * @param asset 条目信息
 * @param index 条目下标
 * @param selected 是否已选中
 * @param onToggle 点击后的选中状态回调
 */
function createAssetCell(
  asset: ShortItemAsset,
  index: number,
  selected: boolean,
  onToggle: (selected: boolean) => void
): HTMLElement {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = `bdl-short-asset${selected ? ' selected' : ''}`;
  cell.title = asset.label;
  cell.dataset.index = String(index);
  cell.addEventListener('click', () => {
    const next = !cell.classList.contains('selected');
    cell.classList.toggle('selected', next);
    onToggle(next);
  });

  const badge = document.createElement('span');
  badge.className = 'bdl-short-asset-index';
  badge.textContent = String(index + 1);

  if (asset.thumb) {
    const img = document.createElement('img');
    img.className = 'bdl-short-asset-thumb';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.alt = asset.label;
    img.src = asset.thumb;
    img.addEventListener('error', () => img.remove());
    cell.appendChild(img);
  }
  cell.appendChild(badge);
  return cell;
}

/** 站点显示名，取自平台注册表。 */
function getPlatformLabel(platform: ShortVideoPlatform): string {
  return PLATFORMS[platform].label;
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

// 部分站点启用了 Trusted Types，直接给 innerHTML 赋字符串会抛
// 「This document requires 'TrustedHTML' assignment」，导致整个面板渲染不出来。
// 建一个放行策略，把脚本内部的静态 HTML 包一层。
// 这些 HTML 全部来自脚本自身的模板常量，不含任何外部输入。
let htmlPolicy: { createHTML(s: string): any } | null = null;
let policyReady = false;

function getHtmlPolicy() {
  if (policyReady) return htmlPolicy;
  policyReady = true;
  try {
    const tt = (window as any).trustedTypes;
    if (tt?.createPolicy) {
      htmlPolicy = tt.createPolicy('vdh-ui', { createHTML: (s: string) => s });
    }
  } catch {
    // 站点用 require-trusted-types-for 且禁止创建新策略时会失败，只能降级
    htmlPolicy = null;
  }
  return htmlPolicy;
}

// 统一的 innerHTML 赋值入口：有 Trusted Types 就走策略，没有就直接赋值
export function setHTML(el: Element, html: string): void {
  const policy = getHtmlPolicy();
  try {
    (el as any).innerHTML = policy ? policy.createHTML(html) : html;
  } catch {
    // 兜底：策略不可用时用 DOMParser 解析后搬运节点，绕过 innerHTML 限制
    try {
      el.textContent = '';
      const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
      while (doc.body.firstChild) el.appendChild(doc.body.firstChild);
    } catch {}
  }
}

function makeToolbarButton(): string {
  return `<button id="bdl-main-btn" type="button" title="下载视频" aria-expanded="false">
    <span class="bdl-toolbar-progress" id="bdl-progress-circle"></span>
    <span class="bdl-toolbar-icon" aria-hidden="true" style="text-align:center">
      <svg viewBox="0 0 24 24">
        <path d="M12 3.5a1 1 0 0 1 1 1v7.09l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 3.98a1 1 0 0 1-1.4 0l-4-3.98a1 1 0 1 1 1.4-1.42l2.3 2.3V4.5a1 1 0 0 1 1-1Zm-6.5 12a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-.5a1 1 0 1 1 2 0v.5a3.5 3.5 0 0 1-3.5 3.5H8A3.5 3.5 0 0 1 4.5 17v-.5a1 1 0 0 1 1-1Z" />
      </svg>
    </span>
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
        <div class="bdl-short-items-toolbar" id="bdl-short-items-toolbar">
          <button type="button" class="bdl-short-select-btn" data-mode="all">全选</button>
          <button type="button" class="bdl-short-select-btn" data-mode="none">全不选</button>
          <button type="button" class="bdl-short-select-btn" data-mode="invert">反选</button>
        </div>
        <div class="bdl-short-items" id="bdl-short-items"></div>
      </div>
      <div class="bdl-section bdl-gif-section" id="bdl-gif-section" style="display:none;">
        <div class="bdl-section-header"><span class="bdl-section-title">GIF 保存格式</span></div>
        <div class="bdl-method-list" id="bdl-gif-formats">
          <div class="bdl-method-item active" data-gif="video">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">原始视频 <span class="bdl-badge recommended">推荐</span></div>
              <div class="bdl-method-desc">保存站点提供的无声 MP4，体积小</div>
            </div>
          </div>
          <div class="bdl-method-item" data-gif="js-gif">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">转为 GIF（JS 原生）</div>
              <div class="bdl-method-desc">浏览器内直接转码，无需下载 FFmpeg</div>
            </div>
          </div>
          <div class="bdl-method-item" data-gif="ffmpeg-gif">
            <div class="bdl-method-radio"></div>
            <div class="bdl-method-content">
              <div class="bdl-method-name">转为 GIF（FFmpeg）</div>
              <div class="bdl-method-desc">调色板更准，需先加载 FFmpeg 核心</div>
            </div>
          </div>
        </div>
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
    <div class="bdl-footer" id="bdl-footer">
      <span class="bdl-footer-text">仅供学习研究，请支持正版内容创作者</span>
      <button class="bdl-diag-trigger" id="bdl-diag-trigger" type="button" title="遇到问题？打开诊断面板">诊断</button>
    </div>
  </div>`;
}

function makeDiagModal(): string {
  return `<div class="bdl-diag-modal" id="bdl-diag-modal" role="dialog" aria-modal="true" aria-labelledby="bdl-diag-title">
    <div class="bdl-diag-card">
      <div class="bdl-diag-header">
        <span class="bdl-diag-title" id="bdl-diag-title">智能诊断</span>
        <button class="bdl-diag-close" id="bdl-diag-close" type="button" aria-label="关闭">×</button>
      </div>
      <div class="bdl-diag-body">
        <div class="bdl-diag-desc">
          遇到下载失败、解析异常或功能不可用？可以在下方描述你的操作、期望结果，然后一键复制或提交诊断报告给开发者。
          日志已自动屏蔽 <code>SESSDATA</code> / <code>bili_jct</code> / <code>token</code> 等常见敏感字段，建议提交前再自行确认。
        </div>
        <label class="bdl-diag-note-label" for="bdl-diag-note">问题描述（可选）</label>
        <textarea class="bdl-diag-note" id="bdl-diag-note" placeholder="例：在 xxx 视频页点下载后卡在合并阶段..."></textarea>
        <div class="bdl-diag-toolbar">
          <button class="bdl-diag-btn primary" id="bdl-diag-submit" type="button">提交到 GitHub</button>
          <button class="bdl-diag-btn" id="bdl-diag-copy" type="button">复制报告</button>
          <button class="bdl-diag-btn" id="bdl-diag-download" type="button">下载报告</button>
          <div class="bdl-diag-toolbar-spacer"></div>
          <button class="bdl-diag-btn danger" id="bdl-diag-clear" type="button">清空日志</button>
        </div>
        <div class="bdl-diag-toast" id="bdl-diag-toast"></div>
        <div class="bdl-diag-log" id="bdl-diag-log"></div>
      </div>
    </div>
  </div>`;
}

export const UI = {
  elements: {} as Record<string, any>,
  pagesSectionEnabled: false,
  ugcSectionEnabled: false,
  /** 全选工具条的回调，每次重绘列表时更新，监听器只绑定一次。 */
  shortSelectAllHandler: null as ((mode: 'all' | 'none' | 'invert') => void) | null,
  shortToolbarBound: false,
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
    setHTML(entry, makeToolbarButton());

    const panel = document.createElement('div');
    panel.id = 'bdl-panel';
    setHTML(panel, makePopup());

    const diagHost = document.createElement('div');
    diagHost.id = 'bdl-diag-host';
    setHTML(diagHost, makeDiagModal());

    root.appendChild(entry);
    root.appendChild(panel);
    root.appendChild(diagHost);
    document.body.appendChild(host);

    this.host = host;
    this.root = root;

    // 第二个 shadow host：体积小，可作为普通行内元素插入站点操作栏。
    // 主 host 是铺满视口的 fixed 覆盖层（承载弹窗），无法插入站点工具栏。
    const inlineHost = document.createElement('div');
    // 此处只设置对所有站点都成立的属性。定位（position / bottom / transform 等）
    // 一律由挂载时的 hostStyle 或外壳克隆体提供，避免某一站点的定位与 class 名
    // 泄漏到其他站点。
    inlineHost.style.cssText = 'display:inline-flex!important;align-items:center!important;pointer-events:auto!important;';
    const inlineRoot = inlineHost.attachShadow({ mode: 'open' });
    const inlineStyle = document.createElement('style');
    inlineStyle.textContent = STYLES;
    inlineRoot.appendChild(inlineStyle);
    this.inlineHost = inlineHost;
    this.inlineRoot = inlineRoot;

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
      shortItemsToolbar: g('bdl-short-items-toolbar'),
      gifSection: g('bdl-gif-section'),
      gifFormats: g('bdl-gif-formats'),
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
      footer: g('bdl-footer'),
      diagTrigger: g('bdl-diag-trigger'),
      diagModal: g('bdl-diag-modal'),
      diagClose: g('bdl-diag-close'),
      diagNote: g('bdl-diag-note'),
      diagSubmit: g('bdl-diag-submit'),
      diagCopy: g('bdl-diag-copy'),
      diagDownload: g('bdl-diag-download'),
      diagClear: g('bdl-diag-clear'),
      diagToast: g('bdl-diag-toast'),
      diagLog: g('bdl-diag-log')
    };

    this.bindDiagnosticHandlers();
  },

  diagUnsubscribe: null as (() => void) | null,
  diagToastTimer: null as number | null,

  bindDiagnosticHandlers(): void {
    const el = this.elements;
    const trigger = el.diagTrigger as HTMLElement | null;
    const modal = el.diagModal as HTMLElement | null;
    const close = el.diagClose as HTMLElement | null;
    const submit = el.diagSubmit as HTMLElement | null;
    const copy = el.diagCopy as HTMLElement | null;
    const download = el.diagDownload as HTMLElement | null;
    const clear = el.diagClear as HTMLElement | null;

    trigger?.addEventListener('click', event => {
      event.stopPropagation();
      this.showDiagModal();
    });

    close?.addEventListener('click', () => this.hideDiagModal());

    modal?.addEventListener('click', event => {
      if (event.target === modal) this.hideDiagModal();
    });

    submit?.addEventListener('click', () => {
      const note = (el.diagNote as HTMLTextAreaElement | null)?.value || '';
      const url = Diagnostics.buildIssueUrl(note);
      try {
        window.open(url, '_blank', 'noopener');
        this.showDiagToast('已在新标签页打开 GitHub Issue', 'success');
      } catch {
        this.showDiagToast('无法打开新标签页，请手动复制报告后到仓库提交 Issue', 'error');
      }
    });

    copy?.addEventListener('click', async () => {
      const note = (el.diagNote as HTMLTextAreaElement | null)?.value || '';
      const ok = await Diagnostics.copyReport(note);
      this.showDiagToast(ok ? '诊断报告已复制到剪贴板' : '复制失败，请尝试下载报告', ok ? 'success' : 'error');
    });

    download?.addEventListener('click', () => {
      const note = (el.diagNote as HTMLTextAreaElement | null)?.value || '';
      Diagnostics.downloadReport(note);
      this.showDiagToast('已下载 Markdown 报告', 'success');
    });

    clear?.addEventListener('click', () => {
      Diagnostics.clear();
      this.showDiagToast('日志已清空', 'success');
    });
  },

  showDiagModal(): void {
    const modal = this.elements.diagModal as HTMLElement | null;
    if (!modal) return;
    modal.classList.add('show');
    this.showDiagToast('', 'success');
    if (!this.diagUnsubscribe) {
      this.diagUnsubscribe = Diagnostics.subscribe(entries => this.renderDiagLog(entries));
    }
  },

  hideDiagModal(): void {
    const modal = this.elements.diagModal as HTMLElement | null;
    if (!modal) return;
    modal.classList.remove('show');
    if (this.diagUnsubscribe) {
      this.diagUnsubscribe();
      this.diagUnsubscribe = null;
    }
  },

  renderDiagLog(entries: DiagnosticEntry[]): void {
    const log = this.elements.diagLog as HTMLElement | null;
    if (!log) return;
    log.textContent = '';
    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'bdl-diag-log-empty';
      empty.textContent = '(暂无日志)';
      log.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const entry of entries) {
      const line = document.createElement('span');
      line.className = `bdl-diag-log-line level-${entry.level}`;
      const timestamp = new Date(entry.time).toLocaleTimeString('zh-CN', { hour12: false });
      line.textContent = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`;
      frag.appendChild(line);
      if (entry.detail) {
        const detail = document.createElement('span');
        detail.className = 'bdl-diag-log-detail';
        detail.textContent = entry.detail;
        frag.appendChild(detail);
      }
    }
    log.appendChild(frag);
    log.scrollTop = log.scrollHeight;
  },

  showDiagToast(message: string, kind: 'success' | 'error'): void {
    const toast = this.elements.diagToast as HTMLElement | null;
    if (!toast) return;
    toast.textContent = message;
    toast.className = `bdl-diag-toast${kind === 'error' ? ' error' : ''}`;
    if (this.diagToastTimer !== null) {
      clearTimeout(this.diagToastTimer);
      this.diagToastTimer = null;
    }
    if (message) {
      this.diagToastTimer = window.setTimeout(() => {
        toast.textContent = '';
        this.diagToastTimer = null;
      }, 3500);
    }
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

  /**
   * 按平台注册表中的 mount 配置解析挂载点。
   *
   * 选择器失效、层级不足、操作栏尚未渲染等任一情况均返回 null，
   * 由调用方回退为浮动按钮。
   */
  resolveMountPoint(platform: ShortVideoPlatform): MountTarget | null {
    const config = PLATFORMS[platform].mount;
    if (!config?.selector) return null;
    if (config.urlPattern && !config.urlPattern.test(location.href)) return null;

    let matches: HTMLElement[];
    try {
      matches = Array.from(document.querySelectorAll<HTMLElement>(config.selector));
    } catch {
      return null;
    }
    if (!matches.length) return null;

    // matchIndex 显式给出时只取该项（负数从后往前）；省略时按顺序取第一个能解析出
    // 非空按钮列的匹配：X 的 #layers 下有多个兄弟层，承载按钮列的是哪一层取决于
    // 当前打开的层，固定下标容易落空。
    const candidates = config.matchVisible ? this.sortByViewportOverlap(matches) : matches;
    const roots = config.matchIndex === undefined
      ? candidates
      : [candidates[config.matchIndex < 0 ? candidates.length + config.matchIndex : config.matchIndex]];

    for (const root of roots) {
      const resolved = root ? this.resolveMountPointAt(root, config) : null;
      if (resolved) return resolved;
    }
    return null;
  },

  /**
   * 按与视口的交叠面积降序排列，完全不可见的命中项排除在外。
   *
   * @returns 可见的命中项，最靠近视口中心的在前；全部不可见时原样返回入参
   */
  sortByViewportOverlap(matches: HTMLElement[]): HTMLElement[] {
    const vw = window.innerWidth || document.documentElement.clientWidth;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const scored = matches
      .map(el => {
        const r = el.getBoundingClientRect();
        const w = Math.min(r.right, vw) - Math.max(r.left, 0);
        const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
        return { el, area: w > 0 && h > 0 ? w * h : 0 };
      })
      .filter(item => item.area > 0);
    if (!scored.length) return matches;
    return scored.sort((a, b) => b.area - a.area).map(item => item.el);
  },

  resolveMountPointAt(root: HTMLElement, config: MountPointConfig): MountTarget | null {
    // 按 childPath 逐层下钻到插入按钮的父元素
    let container: HTMLElement = root;
    for (const step of config.childPath || []) {
      const kids = container.children;
      const child = kids[step < 0 ? kids.length + step : step];
      if (!(child instanceof HTMLElement)) return null;
      container = child;
    }

    // 排除自身的宿主与外壳克隆体，余下的才是站点的原生按钮。
    // 外壳同样要排除：cloneSampleSkeleton 生效时 container 的子节点是外壳而非宿主，
    // 漏排会导致下一轮把自身外壳当作样板取样。
    const natives = Array.from(container.children)
      .filter(el => el !== this.inlineHost && el !== this.inlineSkeleton);
    // 按钮列为空：页面尚未渲染完成，或选择器已失效，两种情况都不插入
    if (!natives.length) return null;

    let insertBefore: HTMLElement | null;
    let sample: HTMLElement;
    if (config.anchorSelector) {
      // 选择器可能含 :has()、:scope 等较新语法，旧引擎会抛异常；此时视为未命中。
      let anchor: HTMLElement | null = null;
      try {
        anchor = container.querySelector<HTMLElement>(config.anchorSelector);
      } catch {
        anchor = null;
      }
      // 命中自身宿主或外壳时作废：否则按钮会以自己为样板并插到自己前面。
      if (!anchor?.parentElement) return null;
      if (this.inlineHost?.contains(anchor) || this.inlineSkeleton?.contains(anchor)) return null;
      container = anchor.parentElement;
      insertBefore = anchor;
      sample = anchor;
    } else {
      const insertAt = config.insertAt ?? 'start';
      const insertIndex = insertAt === 'start' ? 0 : insertAt === 'end' ? natives.length : insertAt;
      insertBefore = (natives[insertIndex] as HTMLElement) || null;

      const sampleIndex = config.sampleIndex ?? insertIndex;
      sample = natives[clamp(sampleIndex, 0, natives.length - 1)] as HTMLElement;
    }

    // 视觉取样：定位样板不一定形似按钮。X 的 sample 是整个绝对定位层，
    // 按其尺寸取样会得到超尺寸按钮，故用 skinSampleSelector 在容器内另取原生按钮；
    // 未命中时置为 null，由调用方改用固定皮肤。
    let skinSample: HTMLElement | null = config.fixedSkin ? null : sample;
    if (config.skinSampleSelector) {
      // 选择器可能含 :has() 等较新语法，旧引擎会抛异常；此时视为未命中，
      // 不让取样影响整个挂载流程。
      let found: HTMLElement | null = null;
      try {
        found = container.querySelector<HTMLElement>(config.skinSampleSelector);
      } catch {
        found = null;
      }
      skinSample = found && !this.inlineHost?.contains(found) ? found : null;
    }

    const hostStyle: Record<string, string> = {};
    // 站点常把按钮列的绝对定位写在行内，整份复制才能落到同一列
    if (config.cloneSampleStyle) {
      for (const name of Array.from(sample.style)) hostStyle[name] = sample.style.getPropertyValue(name);
    }
    Object.assign(hostStyle, config.styleOverride || {});

    // 外壳克隆：X 等站点把按钮包在多层 wrapper 中（layer > wrapper > 定位盒 > button），
    // 仅复制最外层行内 style 得不到内层定位盒，按钮会在整宽的空层内浮动。
    let skeleton: HTMLElement | null = null;
    if (config.cloneSampleSkeleton) {
      skeleton = this.buildSkeleton(sample, config.cloneSampleSkeleton, container);
      // 已配置外壳但构建失败（站点改版、样板层内无按钮）时作废整个挂载点：
      // 裸宿主会带着从样板复制的 position: absolute 整宽铺开，形态不可控。
      if (!skeleton) return null;
    }

    return {
      container,
      anchor: sample,
      mode: 'native-bar',
      inline: true,
      sample,
      skinSample,
      insertBefore,
      hostStyle,
      skeleton,
      hideSample: config.hideSample ? sample : null
    };
  },

  /**
   * 深克隆样板节点，并把克隆体中匹配 leafSelector 的首个节点替换为按钮宿主，
   * 使宿主继承样板按钮在外壳中的确切位置。class 名随发版变化，故只能在运行时克隆。
   *
   * @returns 外壳克隆体；未命中叶子时返回 null，调用方据此作废整个挂载点
   */
  buildSkeleton(sample: HTMLElement, leafSelector: string, container: HTMLElement): HTMLElement | null {
    const host = this.inlineHost;
    if (!host) return null;

    // 旧外壳仍挂在同一容器内且宿主仍在其中时直接复用：每次 DOM 变动都重建会持续
    // 替换节点，中断 CSS 过渡并导致按钮反复重挂。
    if (this.inlineSkeleton
      && this.inlineSkeleton.parentElement === container
      && this.inlineSkeleton.contains(host)) {
      return this.inlineSkeleton;
    }

    let clone: HTMLElement;
    let leaf: HTMLElement | null;
    try {
      clone = sample.cloneNode(true) as HTMLElement;
      leaf = clone.querySelector<HTMLElement>(leafSelector);
    } catch {
      return null;
    }
    if (!leaf) return null;

    // 只复制 class，不复制 aria-label / data-testid / type：这些属性属于身份标识，
    // 复制后会对无障碍工具冒充站点原生按钮，也会被站点自身的
    // querySelector('[data-testid=...]') 命中。
    host.className = leaf.className;
    host.setAttribute('aria-label', '下载');
    leaf.replaceWith(host);

    // 同理清除克隆体上残留的 id / data-testid，含克隆体根节点
    const marked = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('[id],[data-testid]'))];
    for (const el of marked) {
      el.removeAttribute('id');
      el.removeAttribute('data-testid');
    }
    return clone;
  },

  getMountTarget(): MountTarget | null {
    const siteContext = Utils.getSiteContext();

    if (siteContext.kind === 'short-video') {
      // 已配置挂载点的平台（X / 抖音）优先内联进站点自身的按钮列
      const configured = this.resolveMountPoint(siteContext.platform);
      if (configured) return configured;

      // 未配置挂载点的平台使用浮动按钮。信息流页面同时存在多条内容及各自的操作栏，
      // 无法据结构特征判定哪一条是当前内容；插到错误位置比不插入更差。
      return { container: document.body, anchor: null, mode: 'floating' };
    }

    // B 站视频页：并入工具栏，与点赞 / 投币 / 收藏 / 分享同级。
    // 该工具栏为 flex 容器，子项为 .toolbar-left-item-wrap（margin-right: 8px），
    // 追加同结构元素不影响 Vue 的既有节点。
    const videoContainer = document.querySelector<HTMLElement>('#arc_toolbar_report .video-toolbar-left-main');
    if (videoContainer) {
      const shareWrap = videoContainer.querySelector('.video-share-wrap')?.closest('.toolbar-left-item-wrap') as HTMLElement | null;
      return {
        container: videoContainer,
        anchor: shareWrap,
        mode: 'video',
        inline: true,
        sample: (videoContainer.querySelector('.video-toolbar-left-item') as HTMLElement | null) || shareWrap,
        direction: 'row'
      };
    }

    const bangumiContainer = document.querySelector<HTMLElement>('.player-left-components .toolbar-left');
    if (bangumiContainer) {
      const watchTogether = document.getElementById('watch_together_tab');
      const anchor = watchTogether?.parentElement instanceof HTMLElement ? watchTogether.parentElement : null;
      return {
        container: bangumiContainer,
        anchor,
        mode: 'bangumi',
        inline: true,
        sample: (bangumiContainer.querySelector('[class*="toolbar-left-item"]') as HTMLElement | null) || anchor,
        direction: 'row'
      };
    }

    return null;
  },

  inlineHost: null as HTMLElement | null,
  inlineRoot: null as ShadowRoot | null,
  /** 记录已写入 inlineHost 的行内样式键，切换站点或模式时用于清理。 */
  inlineHostStyleKeys: [] as string[],
  /** 当前挂在站点 DOM 中的外壳克隆体，cloneSampleSkeleton 生效时存在。 */
  inlineSkeleton: null as HTMLElement | null,
  inlineSkeletonStyleKeys: [] as string[],
  /** 因 hideSample 隐藏的站点节点。 */
  hiddenSample: null as HTMLElement | null,
  /** 上述节点被隐藏前的行内 display 值，还原时写回。 */
  hiddenSampleDisplay: '',
  /** 已写入品牌色的站点键，用于避免重复写属性。 */
  brandAppliedFor: null as SkinKey | null,

  /**
   * 把承载按钮的宿主插入站点操作栏，并将 entry 从主 host 迁移过去。
   *
   * 采用迁移而非复制，以保证事件绑定与进度状态随之转移，始终只有一个按钮实例。
   */
  attachHostInline(mount: MountTarget): void {
    const entry = this.elements.entry as HTMLElement | undefined;
    if (!entry || !this.inlineHost || !this.inlineRoot) return;

    // 须在下方「已在正确位置」的提前返回之前执行，否则重复解析同一挂载点时
    // 样板不会被隐藏
    this.setHiddenSample(mount.hideSample ?? null);

    if (entry.parentNode !== this.inlineRoot) this.inlineRoot.appendChild(entry);

    const skeleton = mount.skeleton || null;
    // 形态变化（有壳 ↔ 无壳、或更换容器）时先移除旧外壳，避免页面残留空壳。
    // buildSkeleton 此时已将宿主移入新外壳，旧外壳内不含按钮，可安全移除。
    if (this.inlineSkeleton && this.inlineSkeleton !== skeleton) {
      this.applyOwnedStyle(this.inlineSkeleton, undefined, 'inlineSkeletonStyleKeys');
      this.inlineSkeleton.remove();
    }
    this.inlineSkeleton = skeleton;

    // 定位样式写在实际插入站点 DOM 的节点上：有外壳时是外壳根节点
    // （它才是层级上对应原生层的元素），无外壳时是宿主自身。
    if (skeleton) {
      this.applyInlineHostStyle(undefined);
      this.applyOwnedStyle(skeleton, mount.hostStyle, 'inlineSkeletonStyleKeys');
    } else {
      // 上一轮可能自 leaf 复制过 class / aria-label（X），切换到无外壳的挂载点时
      // 必须清除，否则会把 X 的 class 名带到 B 站 / 抖音
      this.inlineHost.className = '';
      this.inlineHost.removeAttribute('aria-label');
      this.applyInlineHostStyle(mount.hostStyle);
    }

    const node: HTMLElement = skeleton || this.inlineHost;
    const container = mount.container;
    // 参照节点可能已被站点重新渲染，失效时退化为追加
    const before = mount.insertBefore?.parentElement === container ? mount.insertBefore : null;
    // 已在正确位置则不再移动，避免每次 DOM 变动都重插（会中断 CSS 过渡）
    if (node.parentElement === container) {
      if (!before || node.nextElementSibling === before) return;
    }
    if (before) container.insertBefore(node, before);
    else container.appendChild(node);
  },

  /**
   * 隐藏挂载点声明的样板兄弟，并还原上一次隐藏的节点。
   *
   * 只改行内 display 并记下原值，取消挂载时原样写回。
   *
   * @param el 要隐藏的节点，传 null 表示只还原
   */
  setHiddenSample(el: HTMLElement | null): void {
    if (this.hiddenSample === el) return;
    if (this.hiddenSample) this.hiddenSample.style.display = this.hiddenSampleDisplay;
    this.hiddenSample = el;
    if (!el) return;
    this.hiddenSampleDisplay = el.style.display;
    el.style.display = 'none';
  },

  /**
   * 覆盖上一次写入的行内样式：先清除旧键，再写入新键。
   *
   * 否则 SPA 内切换平台时，上一站点的绝对定位会残留。
   */
  applyOwnedStyle(
    el: HTMLElement,
    style: Record<string, string> | undefined,
    keysField: 'inlineHostStyleKeys' | 'inlineSkeletonStyleKeys'
  ): void {
    for (const key of this[keysField]) {
      if (!style || !(key in style)) el.style.removeProperty(key);
    }
    this[keysField] = style ? Object.keys(style) : [];
    if (!style) return;
    for (const [key, value] of Object.entries(style)) el.style.setProperty(key, value);
  },

  applyInlineHostStyle(style?: Record<string, string>): void {
    const host = this.inlineHost;
    if (!host) return;
    this.applyOwnedStyle(host, style, 'inlineHostStyleKeys');
  },

  /** entry 迁回主 host，用于从 native-bar 切回 floating / bilibili 模式。 */
  detachHostInline(): void {
    const entry = this.elements.entry as HTMLElement | undefined;
    if (!entry || !this.root) return;
    this.setHiddenSample(null);
    if (entry.parentNode !== this.root) {
      // 插入 panel 之前，保持原有 DOM 顺序
      const panel = this.elements.panel as HTMLElement | undefined;
      if (panel && panel.parentNode === this.root) this.root.insertBefore(entry, panel);
      else this.root.appendChild(entry);
    }
    this.applyInlineHostStyle(undefined);
    // class 与 aria-label 均由 buildSkeleton 写入，需一并清除：只清 class 会让宿主
    // 在浮动模式下仍带「下载」标签，而浮动按钮在 shadow root 内已有无障碍名。
    if (this.inlineHost) {
      this.inlineHost.className = '';
      this.inlineHost.removeAttribute('aria-label');
    }
    // 顺序有要求：entry 已先迁回主 host，此处移除外壳不会连带移除按钮
    this.inlineHost?.remove();
    if (this.inlineSkeleton) {
      this.applyOwnedStyle(this.inlineSkeleton, undefined, 'inlineSkeletonStyleKeys');
      this.inlineSkeleton.remove();
      this.inlineSkeleton = null;
    }
  },

  /** 当前站点的皮肤键，无法识别站点时返回 null。 */
  getSkinKey(): SkinKey | null {
    const ctx = Utils.getSiteContext();
    if (ctx.kind === 'bilibili') return ctx.sourceType === 'bangumi' ? 'bangumi' : 'bilibili';
    if (ctx.kind === 'short-video') return ctx.platform;
    return null;
  },

  /** 站点基础皮肤：注册表中已配置的站点用其固定值，其余用中性兜底。 */
  getBaseSkin(): SkinVars {
    const key = this.getSkinKey();
    return (key && getSkin(key)) || NEUTRAL_SKIN;
  },

  /** 站点品牌色。 */
  getBaseBrand(): BrandColors {
    const key = this.getSkinKey();
    return key ? getBrand(key) : NEUTRAL_BRAND;
  },

  /**
   * 弹层是否使用深色配色。
   *
   * 平台显式声明 surface 时以声明为准；为 'auto' 或缺省时按站点背景色亮度判定。
   * bilibili 与番剧页固定为浅色。
   *
   * @param key 当前站点的皮肤键
   */
  resolveDarkSurface(key: SkinKey | null): boolean {
    if (key === null || key === 'bilibili' || key === 'bangumi') return false;
    const scheme = PLATFORMS[key].surface;
    if (scheme === 'dark') return true;
    if (scheme === 'light') return false;
    return isDarkSite();
  },

  /**
   * 把当前站点的品牌色写入两个 shadow host。
   *
   * 弹层在主 host 内，入口按钮在内联模式下位于 inlineHost 内，两者互不继承，
   * 故需分别写入。皮肤随挂载点变化、每次 ensureMounted 都要重算，
   * 品牌色只随站点变化，因此按键缓存，避免在 MutationObserver 里重复写属性。
   */
  syncBrand(): void {
    const key = this.getSkinKey();
    if (key !== this.brandAppliedFor) {
      this.brandAppliedFor = key;
      const brand = this.getBaseBrand();
      applyBrand(this.host as HTMLElement | null, brand);
      applyBrand(this.inlineHost, brand);
    }
    // 深浅色不随品牌色一起按键缓存：X 等站点支持在页内切换主题，
    // surface 为 'auto' 时判定结果会在停留期间变化。
    // 标记类只写主 host——inlineHost 的 className 在挂载切换时会被重置。
    applySurface(this.host as HTMLElement | null, this.resolveDarkSurface(key));
  },

  ensureMounted(): boolean {
    const entry = this.elements.entry as HTMLElement | undefined;
    const btn = this.elements.btn as HTMLElement | undefined;
    if (!entry || !btn) return false;

    const mount = this.getMountTarget();
    if (!mount) {
      this.detachHostInline();
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
    this.syncBrand();
    if (mount.inline) {
      // 将 shadow host 插入站点工具栏，与原生按钮同级并排。
      // shadow DOM 提供双向样式隔离；进入 DOM 流后滚动与布局变化由浏览器处理，
      // 不再需要 JS 跟随定位。
      entry.dataset.mode = 'native-bar';
      entry.style.left = '';
      entry.style.top = '';
      entry.style.right = '';
      entry.style.bottom = '';
      entry.style.visibility = '';
      this.attachHostInline(mount);
      // 取样相邻原生按钮的样式。CSS 变量须写在 inlineHost 上：按钮渲染在它的
      // shadow root 内，写主 host 无效。
      //
      // 此处必须区分 undefined 与 null，不能使用 ??：
      //   undefined —— 该挂载点没有独立的视觉样板（B 站 / 微博等固定挂载点），沿用 sample
      //   null      —— 该挂载点声明了 fixedSkin，或已配置 skinSampleSelector 但当前
      //                页面未命中原生按钮；两种情况都应使用固定皮肤，
      //                回退到 sample 会取到整个定位层的尺寸
      const skinSource = mount.skinSample === undefined ? (mount.sample ?? null) : mount.skinSample;
      applySkin(this.inlineHost, sampleNativeStyle(skinSource, this.getBaseSkin()));
      this.mountedAt = mount.container;
      this.currentMountMode = mount.mode;
      entry.classList.toggle('is-downloading', this.entryProgressActive);
      if (!this.isPopupVisible()) this.positionPopup();
      this.syncEntryProgressVisibility();
      return true;
    }

    // 非 inline 模式：确保 entry 回到主 host，并清掉站点里插入的小 host
    // B 站的工具栏 DOM 由 Vue 托管，不写入其中，entry 以浮层方式定位到按钮位置。
    this.detachHostInline();

    entry.classList.toggle('is-downloading', this.entryProgressActive);

    // 让 B 站 header 能覆盖工具栏按钮（跟官方按钮一起藏），floating 场景保持最高层级
    if (this.host) {
      const isBili = mount.mode === 'video' || mount.mode === 'bangumi';
      this.host.style.setProperty('z-index', isBili ? '90' : '2147483647', 'important');
    }

    this.mountedAt = mount.container;
    this.currentMountMode = mount.mode;
    this.positionEntry(mount);
    if (!this.isPopupVisible()) this.positionPopup();
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
    // 水平钳制到 viewport 内（左右不会跟丢）
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));

    // 垂直方向严格跟随锚点，不做 viewport 钳制
    // 这样滚动时按钮跟着锚点走，锚点被 header 遮住时按钮也会一起藏进 header
    const top = baseRect.top + (baseRect.height - height) / 2;

    // 检测锚点是否已完全离开可视区（或被 header 遮挡），此时隐藏按钮避免残留在 header 下方
    const bilibiliHeaderHeight = 64;
    const anchorBottom = baseRect.top + baseRect.height;
    const isAnchorHidden = anchorBottom < bilibiliHeaderHeight || baseRect.top > window.innerHeight;

    entry.style.left = `${Math.round(left)}px`;
    entry.style.top = `${Math.round(top)}px`;
    entry.style.right = 'auto';
    entry.style.bottom = 'auto';
    entry.style.visibility = isAnchorHidden ? 'hidden' : 'visible';
  },

  showPopup(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const btn = this.elements.btn as HTMLButtonElement | null;
    if (!popup || !btn) return;

    popup.classList.add('show');
    btn.setAttribute('aria-expanded', 'true');
    this.popupManualPosition = null; // reset so positionPopup computes fresh
    this.positionPopup();
    // lock the computed position so DOM mutations don't move the popup
    if (!this.popupManualPosition) {
      const left = parseFloat(popup.style.left) || 0;
      const top = parseFloat(popup.style.top) || 0;
      this.popupManualPosition = { left, top };
    }
    this.syncEntryProgressVisibility();
  },

  hidePopup(): void {
    const popup = this.elements.popup as HTMLElement | null;
    const btn = this.elements.btn as HTMLButtonElement | null;
    if (popup) popup.classList.remove('show');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    this.popupManualPosition = null; // allow fresh positioning next open
    this.syncEntryProgressVisibility();
  },

  isPopupVisible(): boolean {
    const popup = this.elements.popup as HTMLElement | null;
    return popup?.classList.contains('show') ?? false;
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
    setHTML(this.elements.author, `<span class="bdl-meta-label">UP</span><span>${videoInfo.owner.name}</span>`);
    setHTML(this.elements.duration, `<span class="bdl-meta-label">时长</span><span>${Utils.formatDuration(videoInfo.duration)}</span>`);

    let badge = '';
    if (vipType === 0) badge = '<span class="bdl-vip-badge guest">游客</span>';
    else if (vipType === 1) badge = '<span class="bdl-vip-badge normal">会员</span>';
    else if (vipType === 2) badge = '<span class="bdl-vip-badge vip">大会员</span>';
    setHTML(this.elements.vip, badge);
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
    setHTML(this.elements.author, `<span class="bdl-meta-label">作者</span><span>${authorName}</span>`);
    setHTML(this.elements.duration, `<span class="bdl-meta-label">类型</span><span>${durationText ? `${typeLabel} · ${durationText}` : typeLabel}</span>`);
    setHTML(this.elements.vip, `<span class="bdl-vip-badge site">${getPlatformLabel(platform)}</span>`);
    this.setPrimaryButtonLabel(this.getShortVideoPrimaryLabel(data));
  },

  /**
   * 渲染内容选择列表：媒体项一层选中，图集与实况图再展开出条目一层选中。
   *
   * 选中状态由外框体现，不使用复选框。
   * 选中回调不重绘列表，避免缩略图重新加载；
   * 全选 / 全不选 / 反选由调用方在改动状态后重绘。
   *
   * @param items 解析出的媒体项
   * @param options 选中状态与交互回调
   */
  prepareShortVideoItems(items: ShortVideoData[], options: ShortItemsOptions): void {
    const section = this.elements.shortItemsSection as HTMLElement | null;
    const list = this.elements.shortItems as HTMLElement | null;
    if (!section || !list) return;

    list.textContent = '';
    this.shortSelectAllHandler = options.onSelectAll;
    this.bindShortItemsToolbar();

    const assets = items.map(item => getItemAssets(item));
    // 单个媒体项也要能展开，否则单条图集无法逐张选中。
    if (items.length <= 1 && !assets.some(entries => entries.length > 1)) {
      section.classList.remove('show');
      return;
    }

    section.classList.add('show');
    items.forEach((item, index) => {
      list.appendChild(this.createShortItemRow(item, index, assets[index], options));
    });
  },

  /**
   * 创建一个媒体项的行：整项选中区与展开的条目网格。
   *
   * @param item 媒体项
   * @param index 媒体项下标
   * @param assets 该项内可单独选中的条目
   * @param options 选中状态与交互回调
   */
  createShortItemRow(item: ShortVideoData, index: number, assets: ShortItemAsset[], options: ShortItemsOptions): HTMLElement {
    const picked = options.selectedAssets.get(index);
    const row = document.createElement('div');
    row.className = 'bdl-short-item-row';

    const head = document.createElement('div');
    head.className = 'bdl-short-item';
    if (options.selectedItems.has(index)) head.classList.add('selected');
    if (assets.length > 1 && !!picked && picked.size > 0 && picked.size < assets.length) head.classList.add('partial');
    if (index === options.previewIndex) head.classList.add('previewing');

    const mark = document.createElement('span');
    mark.className = 'bdl-short-item-mark';
    mark.textContent = getItemTypeLabel(item);

    const title = document.createElement('span');
    title.className = 'bdl-short-item-title';
    title.textContent = item.title || item.desc || item.itemLabel || `${mark.textContent} ${index + 1}`;
    head.title = title.textContent;

    head.append(mark, title);

    // 同一作品的多路清晰度标题相同，附上画质标识才能区分
    if (item.itemLabel && item.itemLabel !== title.textContent) {
      const label = document.createElement('span');
      label.className = 'bdl-short-item-label';
      label.textContent = item.itemLabel;
      head.title = `${title.textContent} · ${item.itemLabel}`;
      head.append(label);
    }
    let grid: HTMLElement | null = null;

    head.addEventListener('click', () => {
      const next = !head.classList.contains('selected');
      head.classList.toggle('selected', next);
      head.classList.remove('partial');
      grid?.querySelectorAll<HTMLElement>('.bdl-short-asset').forEach(cell => {
        cell.classList.toggle('selected', next);
      });
      options.onToggleItem(index, next);
      // 选中的同时切换预览，取消选中时保持当前预览不变。
      if (next && index !== options.previewIndex) options.onPreview(index);
    });

    if (assets.length > 1) {
      grid = document.createElement('div');
      grid.className = 'bdl-short-assets';
      assets.forEach((asset, assetIndex) => {
        const cell = createAssetCell(asset, assetIndex, picked?.has(assetIndex) ?? false, selected => {
          options.onToggleAsset(index, assetIndex, selected);
          const current = options.selectedAssets.get(index);
          const size = current?.size ?? 0;
          head.classList.toggle('selected', options.selectedItems.has(index));
          head.classList.toggle('partial', size > 0 && size < assets.length);
        });
        grid!.appendChild(cell);
      });
    }

    row.appendChild(head);
    if (grid) row.appendChild(grid);
    return row;
  },

  /** 绑定全选工具条，监听器只绑定一次，回调取自最近一次渲染。 */
  bindShortItemsToolbar(): void {
    const toolbar = this.elements.shortItemsToolbar as HTMLElement | null;
    if (!toolbar || this.shortToolbarBound) return;
    this.shortToolbarBound = true;
    toolbar.addEventListener('click', event => {
      const button = (event.target as HTMLElement | null)?.closest('[data-mode]') as HTMLElement | null;
      const mode = button?.dataset.mode;
      if (mode === 'all' || mode === 'none' || mode === 'invert') this.shortSelectAllHandler?.(mode);
    });
  },

  /**
   * 更新列表标题上的选中数量提示。
   *
   * @param count 选中的文件数
   * @param itemCount 媒体项总数
   * @param zipThreshold 超过此数量时打包成 zip
   */
  updateShortSelectionSummary(count: number, itemCount: number, zipThreshold: number): void {
    const label = this.elements.shortItemsCount as HTMLElement | null;
    if (!label) return;
    const suffix = count > zipThreshold ? ' · 打包为 ZIP' : '';
    label.textContent = `共 ${itemCount} 项 · 已选 ${count} 个文件${suffix}`;
  },

  hideShortVideoItems(): void {
    const section = this.elements.shortItemsSection as HTMLElement | null;
    const list = this.elements.shortItems as HTMLElement | null;
    const count = this.elements.shortItemsCount as HTMLElement | null;
    this.shortSelectAllHandler = null;
    if (section) section.classList.remove('show');
    if (list) list.textContent = '';
    if (count) count.textContent = '';
  },

  /**
   * 显示或隐藏 GIF 保存格式选择，隐藏时把选中项复位为原始视频。
   *
   * @param visible 选中的内容里是否有在站点上呈现为 GIF 的项
   */
  setGifFormatVisible(visible: boolean): void {
    const section = this.elements.gifSection as HTMLElement | null;
    if (section) section.style.display = visible ? '' : 'none';
    if (!visible) this.setGifFormat('video');
  },

  /**
   * 同步 GIF 保存格式的选中态。
   *
   * @param format 'video' 保存原始文件，其余值为对应的 GIF 转码方式
   */
  setGifFormat(format: GifOutput): void {
    const list = this.elements.gifFormats as HTMLElement | null;
    if (!list) return;
    list.querySelectorAll<HTMLElement>('.bdl-method-item').forEach(item => {
      item.classList.toggle('active', item.dataset.gif === format);
    });
  },

  /**
   * 主按钮文字。
   *
   * @param data 当前媒体信息
   * @param selectedUnits 选中的文件数，缺省时按内容类型给出默认文字
   */
  getShortVideoPrimaryLabel(data: ShortVideoData, selectedUnits?: number): string {
    if (selectedUnits != null) {
      if (selectedUnits === 0) return '未选中内容';
      if (selectedUnits > 1 || getItemAssets(data).length > 1) return `下载选中 (${selectedUnits})`;
    }
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
    this.elements.pagesList.textContent = '';

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

  prepareUGCSection(episodes: UGCEpisode[], onUpdate: () => void, currentCid?: number): void {
    const wasVisible = this.elements.ugcSection.classList.contains('show');
    this.ugcSectionEnabled = true;
    this.resetFooterSecret();
    this.elements.ugcCount.textContent = `共 ${episodes.length} 个视频`;
    this.elements.ugcList.textContent = '';

    let currentItem: HTMLElement | null = null;

    episodes.forEach((ep, index) => {
      const isCurrent = currentCid != null && ep.cid === currentCid;

      const item = document.createElement('div');
      item.className = 'bdl-page-item';
      if (isCurrent) item.classList.add('active');

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'bdl-page-checkbox';
      cb.dataset.index = String(index);
      cb.checked = isCurrent;

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
      if (isCurrent) currentItem = item;
    });

    onUpdate();

    // 保持原来的展开状态；初次加载时自动展开并定位到当前播放项
    if (!wasVisible) {
      if (currentItem) {
        // 第一次：自动展开并定位
        this.elements.ugcSection.classList.add('show');
        requestAnimationFrame(() => {
          const list = this.elements.ugcList as HTMLElement;
          const item = currentItem as HTMLElement;
          list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
        });
      }
      // currentItem が無い場合は閉じたままにする（既存動作維持）
    } else {
      // すでに展開済みなら展開状態を維持、定位だけ行う
      this.elements.ugcSection.classList.add('show');
      if (currentItem) {
        requestAnimationFrame(() => {
          const list = this.elements.ugcList as HTMLElement;
          const item = currentItem as HTMLElement;
          list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2;
        });
      }
    }
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
    this.elements.pagesList.textContent = '';
    this.elements.pagesCount.textContent = '';
  },

  hideUGCSection(): void {
    this.ugcSectionEnabled = false;
    this.elements.ugcSection.classList.remove('show');
    this.elements.ugcList.textContent = '';
    this.elements.ugcCount.textContent = '';
  },

  setBilibiliMode(): void {
    this.hideShortVideoItems();
    this.setGifFormatVisible(false);
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
    this.setGifFormatVisible(false);
    this.elements.pagesSection.style.display = 'none';
    this.elements.ugcSection.style.display = 'none';
    if (this.elements.qualitySection) this.elements.qualitySection.style.display = 'none';
    if (this.elements.codecSection) this.elements.codecSection.style.display = 'none';
    if (this.elements.methodSection) this.elements.methodSection.style.display = 'none';
    if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = 'none';
    this.elements.mergeRow.style.display = 'none';
    this.hideTips();
    this.setPrimaryProgressLabel(`${getPlatformLabel(platform)}下载`);
    this.elements.title.textContent = `${getPlatformLabel(platform)}内容待解析`;
    this.elements.title.title = this.elements.title.textContent;
    setHTML(this.elements.author, '<span class="bdl-meta-label">状态</span><span>打开具体内容页后可解析</span>');
    setHTML(this.elements.duration, '<span class="bdl-meta-label">类型</span><span>短视频/图集</span>');
    setHTML(this.elements.vip, `<span class="bdl-vip-badge site">${getPlatformLabel(platform)}</span>`);
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
    this.elements.qualities.textContent = '';

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
    this.elements.videoCodec.textContent = '';
    videoCodecs.forEach((codec, index) => {
      const option = document.createElement('option');
      option.value = codec.type;
      option.textContent = codec.name;
      if (index === 0) option.selected = true;
      this.elements.videoCodec.appendChild(option);
    });

    this.elements.audioCodec.textContent = '';
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
    this.elements.extraDownloads.textContent = '';

    if (hasCover) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      setHTML(button, '<span class="bdl-extra-btn-mark">封面</span><span>下载封面</span>');
      button.addEventListener('click', onCover);
      this.elements.extraDownloads.appendChild(button);
    }

    if (hasSubtitles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      setHTML(button, '<span class="bdl-extra-btn-mark">字幕</span><span>下载字幕</span>');
      button.addEventListener('click', onSubtitles);
      this.elements.extraDownloads.appendChild(button);
    }

    if (hasDanmaku) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      setHTML(button, '<span class="bdl-extra-btn-mark">弹幕</span><span>下载弹幕</span>');
      button.addEventListener('click', onDanmaku);
      this.elements.extraDownloads.appendChild(button);
    }
  },

  setExtraActions(actions: ActionButton[]): void {
    this.elements.extraDownloads.textContent = '';
    actions.forEach(action => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'bdl-extra-btn';
      setHTML(button, `<span class="bdl-extra-btn-mark">${action.marker}</span><span>${action.label}</span>`);
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
