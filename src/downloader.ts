import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import { ShortVideoAPI } from './short-video-api.ts';
import { MergeManager } from './merge-manager.ts';
import { GifManager } from './gif-manager.ts';
import { ThreadManager } from './thread-manager.ts';
import { CompleteEffect } from './complete-effect.ts';
import { UI } from './ui.ts';
import { CONFIG } from './config.ts';
import { PLATFORMS } from './platforms.ts';
import { Network } from './network.ts';
import { Diagnostics } from './diagnostics.ts';
import { createZip } from './zip.ts';
import type {
  VideoInfo,
  PageInfo,
  UGCEpisode,
  UGCInfo,
  SubtitleItem,
  MediaUnit,
  ShortVideoData,
  ShortVideoPlatform,
  GifOutput
} from './types.ts';

type RefreshShortVideoOptions = {
  silent?: boolean;
};

type ShortVideoDownloadTask = {
  /** 任务要保存的文件，创建任务时即由选中状态确定，之后不再受面板改动影响。 */
  units: MediaUnit[];
  /** 文件数超过阈值时打包成的 zip 名，不含扩展名。 */
  zipName: string;
  platform: ShortVideoPlatform;
  pageUrl: string;
  label: string;
};

export const Downloader = {
  isDownloading: false,
  videoInfo: null as VideoInfo | null,
  shortVideoInfo: null as ShortVideoData | null,
  shortVideoItems: [] as ShortVideoData[],
  selectedShortVideoIndex: 0,
  /** shortVideoItems 是同一个媒体的备选清晰度，而非彼此独立的媒体。 */
  shortItemsAreAlternatives: false,
  /** 第一层选中状态：shortVideoItems 中被勾选的下标。 */
  shortSelectedItems: new Set<number>(),
  /** 第二层选中状态：媒体项下标到其被勾选的图集图片 / 实况图条目下标。 */
  shortSelectedAssets: new Map<number, Set<number>>(),
  shortVideoPageUrl: null as string | null,
  shortVideoQueue: [] as ShortVideoDownloadTask[],
  activeShortVideoTask: null as ShortVideoDownloadTask | null,
  playData: null as any,
  selectedQuality: 80,
  selectedPages: [] as number[],
  selectedUGCEpisodes: [] as number[],
  videoType: 'video' as string,
  selectedVideoCodec: null as string | null,
  selectedAudioCodec: null as number | null,
  availableSubtitles: [] as SubtitleItem[],
  hasDanmaku: false,
  coverUrl: null as string | null,
  currentPlatform: null as ShortVideoPlatform | null,
  /** 站点上呈现为 GIF 的媒体的保存方式：原样保存无声视频，或按指定方式转码为 GIF。 */
  gifMethod: 'video' as GifOutput,

  isShortVideoMode(): boolean {
    return Utils.getSiteContext().kind === 'short-video';
  },

  refreshInfo(options: RefreshShortVideoOptions = {}): Promise<void> {
    const siteContext = Utils.getSiteContext();

    if (siteContext.kind === 'bilibili') {
      return this.refreshBilibiliInfo();
    }
    if (siteContext.kind === 'short-video') {
      return this.refreshShortVideoInfo(siteContext.platform, options).then(() => undefined);
    }

    UI.showAlert('当前页面暂不支持', 'warning');
    return Promise.resolve();
  },

  refreshBilibiliInfo(): Promise<void> {
    const videoId = Utils.getVideoId();
    if (!videoId) {
      UI.showAlert('无法识别视频ID', 'error');
      return Promise.resolve();
    }

    this.shortVideoInfo = null;
    this.shortVideoItems = [];
    this.selectedShortVideoIndex = 0;
    this.initShortVideoSelection();
    this.shortVideoPageUrl = null;
    this.currentPlatform = null;
    this.videoType = videoId.type;

    return BiliAPI.getUserInfo().then(() => {
      const infoPromise = videoId.type === 'bangumi' ? BiliAPI.getBangumiInfo(videoId.id) : BiliAPI.getVideoInfo(videoId.id);
      return infoPromise.then(videoInfo => {
        this.videoInfo = videoInfo;
        this.coverUrl = videoInfo.pic || videoInfo.cover || null;
        const ugcPromise: Promise<UGCInfo> = videoId.type === 'video'
          ? BiliAPI.getUGCSeasonInfo(videoId.id)
          : Promise.resolve({ hasUGC: false });

        return ugcPromise.then(ugcInfo => {
          const page = videoInfo.currentPage || Utils.getCurrentPage();
          const pageInfo = videoInfo.pages[page - 1];
          if (!pageInfo) {
            UI.showAlert('无法获取分P信息', 'error');
            return;
          }

          const playParams: any = { type: videoId.type, cid: pageInfo.cid, qn: 127 };
          if (videoId.type === 'bangumi') playParams.ep_id = pageInfo.ep_id;
          else playParams.bvid = videoId.id;

          return Promise.all([BiliAPI.getPlayUrl(playParams), BiliAPI.getSubtitles(videoId.id, pageInfo.cid)]).then(([playData, subtitles]) => {
            this.playData = playData;
            this.availableSubtitles = subtitles;
            this.hasDanmaku = true;

            const qualities = BiliAPI.getAvailableQualities(playData);
            const videoCodecs = BiliAPI.getVideoCodecs(playData);
            const audioCodecs = BiliAPI.getAudioCodecs(playData);

            UI.updateVideoInfo(videoInfo, pageInfo, BiliAPI.userVipType);
            UI.updateQualities(qualities, playData.quality ?? this.selectedQuality, qn => { this.selectedQuality = qn; });
            UI.updateCodecSelectors(videoCodecs, audioCodecs);

            if (videoCodecs.length > 0) this.selectedVideoCodec = videoCodecs[0].type;
            if (audioCodecs.length > 0) this.selectedAudioCodec = audioCodecs[0].id;

            if (videoInfo.pages.length > 1) {
              UI.preparePagesSection(videoInfo.pages, page - 1, () => this.updateSelectedPages());
              this.selectedPages = [page - 1];
            } else {
              UI.hidePagesSection();
              this.selectedPages = [0];
            }

            if (ugcInfo.hasUGC && ugcInfo.episodes) {
              this.videoInfo!.ugcEpisodes = ugcInfo.episodes;
              UI.prepareUGCSection(ugcInfo.episodes, () => this.updateSelectedUGC(), pageInfo.cid);
              this.selectedUGCEpisodes = [];
            } else {
              UI.hideUGCSection();
            }

            UI.updateExtraDownloads(
              subtitles.length > 0,
              this.hasDanmaku,
              Boolean(this.coverUrl),
              () => this.downloadCover(),
              () => this.downloadSubtitles(),
              () => this.downloadDanmaku()
            );

            if (qualities.length > 0) {
              for (const quality of qualities) {
                if (quality.available) {
                  this.selectedQuality = quality.qn;
                  break;
                }
              }
            }

            UI.positionPopup();
          });
        });
      });
    }).catch(error => {
      console.error('获取视频信息失败:', error);
      Diagnostics.error('downloader', '获取视频信息失败', error);
      UI.showAlert('获取视频信息失败: ' + error.message, 'error');
      UI.positionPopup();
    });
  },

  refreshShortVideoInfo(platform: ShortVideoPlatform, options: RefreshShortVideoOptions = {}): Promise<boolean> {
    this.videoInfo = null;
    this.playData = null;
    this.availableSubtitles = [];
    this.hasDanmaku = false;
    this.currentPlatform = platform;
    this.coverUrl = null;

    return ShortVideoAPI.parseUrl(location.href, platform).then(data => {
      this.shortVideoItems = data.items?.length ? data.items : [data];
      this.shortItemsAreAlternatives = !!data.alternativeSources && this.shortVideoItems.length > 1;
      this.selectedShortVideoIndex = 0;
      this.initShortVideoSelection();
      this.shortVideoInfo = this.shortVideoItems[0] || data;
      this.shortVideoPageUrl = location.href;
      this.coverUrl = this.shortVideoInfo.cover || this.shortVideoInfo.music?.cover || null;

      this.renderShortVideoInfo(platform);
      UI.hideAlert();
      UI.positionPopup();
      return true;
    }).catch(error => {
      if (options.silent) {
        console.warn('短视频解析跳过:', error);
        Diagnostics.debug('short-video', `解析跳过 (${platform})`, error);
      } else {
        console.error('短视频解析失败:', error);
        Diagnostics.error('short-video', `解析失败 (${platform})`, error);
      }

      this.shortVideoInfo = null;
      this.shortVideoItems = [];
      this.shortItemsAreAlternatives = false;
      this.selectedShortVideoIndex = 0;
      this.initShortVideoSelection();
      this.shortVideoPageUrl = null;
      UI.setShortVideoMode(platform);
      UI.setExtraActions([]);
      if (!options.silent) {
        UI.showAlert('解析失败: ' + error.message, 'error');
      } else {
        UI.hideAlert();
      }
      UI.positionPopup();
      return false;
    });
  },

  renderShortVideoInfo(platform: ShortVideoPlatform): void {
    if (!this.shortVideoInfo) return;
    UI.updateShortVideoInfo(this.shortVideoInfo, platform);
    UI.prepareShortVideoItems(this.shortVideoItems, {
      previewIndex: this.selectedShortVideoIndex,
      selectedItems: this.shortSelectedItems,
      selectedAssets: this.shortSelectedAssets,
      onPreview: index => this.selectShortVideoItem(index),
      onToggleItem: (index, selected) => this.toggleShortItem(index, selected),
      onToggleAsset: (itemIndex, assetIndex, selected) => this.toggleShortAsset(itemIndex, assetIndex, selected),
      onSelectAll: mode => this.setShortSelection(mode)
    });
    UI.setExtraActions(this.getShortVideoActions(this.shortVideoInfo, platform));
    this.syncShortSelectionLabels();
  },

  /**
   * 按当前选中内容显示 GIF 保存格式选择。
   *
   * 选中项里没有 GIF 时该选择无意义，连带把已选的 GIF 输出复位，
   * 避免换到别的内容后残留一个不可见的开关。
   */
  syncGifFormatSection(): void {
    const hasAnimated = this.shortVideoItems.some((item, index) => !!item.animated && this.shortSelectedItems.has(index));
    if (!hasAnimated) this.gifMethod = 'video';
    UI.setGifFormatVisible(hasAnimated);
  },

  /**
   * 切换 GIF 保存格式。
   *
   * @param output 'video' 保存原始无声视频，其余值为对应的 GIF 转码方式
   */
  setGifMethod(output: GifOutput): void {
    this.gifMethod = output;
    if (output !== 'video') GifManager.setMethod(output);
    UI.setGifFormat(output);
  },

  selectShortVideoItem(index: number): void {
    if (!this.currentPlatform || !this.shortVideoItems[index]) return;
    this.selectedShortVideoIndex = index;
    this.shortVideoInfo = this.shortVideoItems[index];
    this.coverUrl = this.shortVideoInfo.cover || this.shortVideoInfo.music?.cover || null;
    this.renderShortVideoInfo(this.currentPlatform);
    UI.hideAlert();
    UI.positionPopup();
  },

  /**
   * 按当前解析结果重置两层选中状态。
   *
   * 默认全选；shortItemsAreAlternatives 置位时只保留第一项，
   * 否则同一个视频的多路清晰度会被重复下载。
   */
  initShortVideoSelection(): void {
    this.selectAllShortItems();
    if (this.shortItemsAreAlternatives) {
      this.shortSelectedItems = new Set(this.shortVideoItems.length ? [0] : []);
    }
  },

  /** 勾选全部媒体项及其下的全部图集 / 实况图条目。 */
  selectAllShortItems(): void {
    this.shortSelectedItems = new Set(this.shortVideoItems.map((_, index) => index));
    this.shortSelectedAssets = new Map();
    this.shortVideoItems.forEach((item, index) => {
      const total = this.getItemAssetCount(item);
      if (total > 0) {
        this.shortSelectedAssets.set(index, new Set(Array.from({ length: total }, (_, i) => i)));
      }
    });
  },

  /**
   * 媒体项内可单独勾选的条目数。
   *
   * @returns 图集为图片数，实况图为条目数，其余类型为 0（整项作为一个单位）
   */
  getItemAssetCount(item: ShortVideoData): number {
    if (item.type === 'image') return item.images?.length || 0;
    if (item.type === 'live') return item.live_photo?.length || 0;
    return 0;
  },

  /**
   * 勾选或取消整个媒体项，其下的条目跟随一起变化。
   *
   * @param index 媒体项下标
   * @param selected 勾选还是取消
   */
  toggleShortItem(index: number, selected: boolean): void {
    const item = this.shortVideoItems[index];
    const total = item ? this.getItemAssetCount(item) : 0;
    if (selected) {
      this.shortSelectedItems.add(index);
      if (total > 0) {
        this.shortSelectedAssets.set(index, new Set(Array.from({ length: total }, (_, i) => i)));
      }
    } else {
      this.shortSelectedItems.delete(index);
      this.shortSelectedAssets.get(index)?.clear();
    }
    this.syncShortSelectionLabels();
  },

  /**
   * 勾选或取消某个媒体项下的单个条目。
   *
   * 勾中任一条目时自动把所属媒体项也勾上，全部取消后自动取消该媒体项，
   * 避免出现「项未选中但其下有选中条目」的状态。
   */
  toggleShortAsset(itemIndex: number, assetIndex: number, selected: boolean): void {
    let picked = this.shortSelectedAssets.get(itemIndex);
    if (!picked) {
      picked = new Set<number>();
      this.shortSelectedAssets.set(itemIndex, picked);
    }

    if (selected) {
      picked.add(assetIndex);
      this.shortSelectedItems.add(itemIndex);
    } else {
      picked.delete(assetIndex);
      if (picked.size === 0) this.shortSelectedItems.delete(itemIndex);
    }

    this.syncShortSelectionLabels();
  },

  /** 全选 / 全不选 / 反选，两层同时生效，之后需要重绘列表以刷新选中状态。 */
  setShortSelection(mode: 'all' | 'none' | 'invert'): void {
    if (mode === 'all') {
      this.selectAllShortItems();
    } else if (mode === 'none') {
      this.shortSelectedItems = new Set();
      this.shortSelectedAssets = new Map();
    } else {
      const nextItems = new Set<number>();
      const nextAssets = new Map<number, Set<number>>();
      this.shortVideoItems.forEach((item, index) => {
        const total = this.getItemAssetCount(item);
        if (total > 0) {
          const picked = this.shortSelectedAssets.get(index);
          const inverted = new Set<number>();
          for (let i = 0; i < total; i++) {
            if (!picked?.has(i)) inverted.add(i);
          }
          nextAssets.set(index, inverted);
          if (inverted.size > 0) nextItems.add(index);
        } else if (!this.shortSelectedItems.has(index)) {
          nextItems.add(index);
        }
      });
      this.shortSelectedItems = nextItems;
      this.shortSelectedAssets = nextAssets;
    }

    if (this.currentPlatform) this.renderShortVideoInfo(this.currentPlatform);
  },

  /** 把选中数量同步到主按钮与列表标题。 */
  syncShortSelectionLabels(): void {
    this.syncGifFormatSection();
    const count = this.buildMediaUnits().length;
    UI.updateShortSelectionSummary(count, this.shortVideoItems.length, CONFIG.ZIP_THRESHOLD);
    if (!this.isDownloading && this.shortVideoInfo) {
      UI.setPrimaryButtonLabel(UI.getShortVideoPrimaryLabel(this.shortVideoInfo, count));
    }
  },

  /**
   * 把两层选中状态展开成待保存的文件列表。
   *
   * 选中多个媒体项时给文件名补项序号，避免不同项的同名文件互相覆盖。
   *
   * @returns 文件列表，顺序与面板中的显示顺序一致
   */
  buildMediaUnits(): MediaUnit[] {
    const multi = this.shortVideoItems.length > 1;
    const units: MediaUnit[] = [];

    this.shortVideoItems.forEach((item, index) => {
      if (!this.shortSelectedItems.has(index)) return;
      const base = this.getItemBaseFilename(item);
      const scoped = multi ? `${base}_${String(index + 1).padStart(2, '0')}` : base;
      units.push(...this.buildItemUnits(item, scoped, this.shortSelectedAssets.get(index)));
    });

    return units;
  },

  getItemBaseFilename(item: ShortVideoData): string {
    const platform = item.platform || this.currentPlatform;
    const fallback = platform ? ShortVideoAPI.getPlatformLabel(platform) : '媒体';
    return Utils.getShortVideoFilename(item.title || item.desc || item.itemLabel || fallback, item.author?.name);
  },

  /**
   * 把单个媒体项展开成文件列表。
   *
   * @param item 媒体项
   * @param base 不含扩展名的文件名前缀
   * @param picked 图集 / 实况图中选中的条目下标，缺省表示全选
   */
  buildItemUnits(item: ShortVideoData, base: string, picked?: Set<number>): MediaUnit[] {
    if (item.type === 'image' && item.images?.length) {
      const total = item.images.length;
      return item.images
        .map((url, assetIndex) => ({ url, assetIndex }))
        .filter(entry => entry.url && (!picked || picked.has(entry.assetIndex)))
        .map(entry => ({
          candidates: [entry.url],
          filename: `${base}${total > 1 ? `_${String(entry.assetIndex + 1).padStart(2, '0')}` : ''}.${Utils.inferExtension(entry.url, 'jpg')}`,
          label: `图片 ${entry.assetIndex + 1}`
        }));
    }

    if (item.type === 'live' && item.live_photo?.length) {
      const units: MediaUnit[] = [];
      item.live_photo.forEach((entry, assetIndex) => {
        if (picked && !picked.has(assetIndex)) return;
        const serial = String(assetIndex + 1).padStart(2, '0');
        if (entry.image) {
          units.push({
            candidates: [entry.image],
            filename: `${base}_${serial}.${Utils.inferExtension(entry.image, 'jpg')}`,
            label: `实况图 ${assetIndex + 1}`
          });
        }
        if (entry.video) {
          units.push({
            candidates: [entry.video],
            filename: `${base}_${serial}_live.${Utils.inferExtension(entry.video, 'mp4')}`,
            label: `实况视频 ${assetIndex + 1}`
          });
        }
      });
      return units;
    }

    const candidates = [item.url, ...(item.video_backup || [])].filter(Boolean) as string[];
    if (candidates.length > 0) {
      const convert = item.animated && this.gifMethod !== 'video' ? this.gifMethod : null;
      return [{
        candidates,
        filename: `${base}.${convert ? 'gif' : Utils.inferExtension(candidates[0], 'mp4')}`,
        label: item.animated ? 'GIF' : '视频',
        ...(convert ? { convert } : {})
      }];
    }

    if (item.music?.url) {
      return [{
        candidates: [item.music.url],
        filename: `${base}_music.${Utils.inferExtension(item.music.url, 'mp3')}`,
        label: '音频'
      }];
    }

    return [];
  },

  getShortVideoActions(data: ShortVideoData, platform: ShortVideoPlatform) {
    const actions: Array<{ marker: string; label: string; onClick: () => void }> = [];

    if (data.cover) {
      actions.push({
        marker: '封面',
        label: '下载封面',
        onClick: () => this.downloadCover()
      });
    }

    if (data.music?.url) {
      actions.push({
        marker: '音频',
        label: '下载音频',
        onClick: () => this.downloadShortVideoMusic()
      });
    }

    if (data.type !== 'image' && data.images && data.images.length > 0) {
      actions.push({
        marker: '图片',
        label: `下载图片 (${data.images.length})`,
        onClick: () => this.downloadShortVideoImages()
      });
    }

    if (data.type !== 'live' && data.live_photo && data.live_photo.length > 0) {
      actions.push({
        marker: '实况',
        label: `下载实况图 (${data.live_photo.length})`,
        onClick: () => this.downloadShortVideoLivePhotos()
      });
    }

    return actions;
  },

  updateSelectedPages(): void {
    const checkboxes = (UI.elements.pagesList as HTMLElement).querySelectorAll('.bdl-page-checkbox') as NodeListOf<HTMLInputElement>;
    this.selectedPages = [];
    checkboxes.forEach(cb => {
      if (cb.checked) this.selectedPages.push(parseInt(cb.dataset.index!));
    });
  },

  updateSelectedUGC(): void {
    const checkboxes = (UI.elements.ugcList as HTMLElement).querySelectorAll('.bdl-page-checkbox') as NodeListOf<HTMLInputElement>;
    this.selectedUGCEpisodes = [];
    checkboxes.forEach(cb => {
      if (cb.checked) this.selectedUGCEpisodes.push(parseInt(cb.dataset.index!));
    });
  },

  start(): void {
    if (this.isShortVideoMode()) {
      this.startShortVideoDownload();
      return;
    }

    if (this.isDownloading) return;
    this.startBilibiliDownload();
  },

  startBilibiliDownload(): void {
    const totalTasks = this.selectedPages.length + this.selectedUGCEpisodes.length;
    if (totalTasks === 0) {
      UI.showAlert('请至少选择一个分P或合集视频', 'warning');
      return;
    }

    this.isDownloading = true;
    UI.setDownloading(true);
    UI.showProgress(true);
    UI.hideAlert();

    const allTasks: Array<{ type: string; index: number; data: any }> = [];
    for (const idx of this.selectedPages) allTasks.push({ type: 'page', index: idx, data: this.videoInfo!.pages[idx] });
    for (const idx of this.selectedUGCEpisodes) allTasks.push({ type: 'ugc', index: idx, data: this.videoInfo!.ugcEpisodes![idx] });

    const downloadNext = (index: number) => {
      if (index >= allTasks.length) {
        this.finishDownload('全部下载完成！');
        return;
      }

      const task = allTasks[index];
      if (allTasks.length > 1) {
        const name = task.type === 'page' ? task.data.part : task.data.title;
        UI.showAlert('正在下载 ' + (index + 1) + '/' + allTasks.length + ': ' + (name || task.data.page), 'info');
      }

      this.downloadSinglePage(task.data).then(() => {
        if (index < allTasks.length - 1) Utils.delay(1000).then(() => downloadNext(index + 1));
        else downloadNext(index + 1);
      }).catch(error => {
        console.error('下载失败:', error);
        Diagnostics.error('downloader', `下载失败 (task ${index + 1}/${allTasks.length}): ${error?.message ?? error}`, error);
        UI.showAlert('下载失败: ' + error.message, 'error');
        this.resetDownloadingState();
        UI.updateCircleProgress(0);
        setTimeout(() => UI.showProgress(false), 2000);
      });
    };

    downloadNext(0);
  },

  startShortVideoDownload(): void {
    const siteContext = Utils.getSiteContext();
    const platform = siteContext.kind === 'short-video' ? siteContext.platform : this.currentPlatform;

    if (this.isDownloading) {
      if (!platform) {
        UI.showAlert('当前页面暂不支持', 'warning');
        return;
      }

      UI.showAlert('正在解析并加入等待队列...', 'info');
      this.prepareShortVideoTask(platform).then(task => {
        if (!task) return;
        this.enqueueShortVideoTask(task);
      });
      return;
    }

    if (!this.shortVideoInfo || !platform) {
      if (!platform) {
        UI.showAlert('当前页面暂不支持', 'warning');
        return;
      }

      UI.setShortVideoMode(platform);
      UI.setExtraActions([]);
      UI.showAlert('正在解析当前页面...', 'info');
      this.refreshShortVideoInfo(platform, { silent: false }).then(success => {
        if (success) UI.showAlert('解析完成，请确认内容后再点击下载', 'success');
      });
      return;
    }
    // URL 变化但已有解析结果（如精选页 modal_id 消失）时直接使用缓存数据

    const task = this.createShortVideoTask(platform, this.shortVideoPageUrl || location.href);
    if (!task) {
      UI.showAlert('没有选中可下载的内容', 'warning');
      return;
    }
    this.runShortVideoTask(task);
  },

  prepareShortVideoTask(platform: ShortVideoPlatform): Promise<ShortVideoDownloadTask | null> {
    if (this.shortVideoInfo) {
      return Promise.resolve(this.createShortVideoTask(platform, this.shortVideoPageUrl || location.href));
    }

    return this.refreshShortVideoInfo(platform, { silent: false }).then(success => {
      if (!success || !this.shortVideoInfo) return null;
      return this.createShortVideoTask(platform, this.shortVideoPageUrl || location.href);
    });
  },

  /**
   * 按当前选中状态生成一个下载任务。
   *
   * 文件列表在此刻定型，入队后再改动面板勾选不会影响已排队的任务。
   *
   * @returns 没有选中任何内容时返回 null
   */
  createShortVideoTask(platform: ShortVideoPlatform, pageUrl: string): ShortVideoDownloadTask | null {
    const units = this.buildMediaUnits();
    if (units.length === 0) return null;

    const primary = this.shortVideoItems[this.selectedShortVideoIndex] || this.shortVideoItems[0] || this.shortVideoInfo;
    const label = primary?.title || primary?.desc || primary?.itemLabel || ShortVideoAPI.getPlatformLabel(platform);
    return {
      units,
      zipName: primary ? this.getItemBaseFilename(primary) : Utils.getShortVideoFilename(label),
      platform,
      pageUrl,
      label: units.length > 1 ? `${label}（${units.length} 个文件）` : label
    };
  },

  getShortVideoTaskKey(task: ShortVideoDownloadTask): string {
    return [
      task.platform,
      task.pageUrl,
      ...task.units.map(unit => unit.candidates[0])
    ].join('::');
  },

  // 队列里每个任务下载完成前都持有自己的 Blob，排太多会把内存吃光
  maxQueueLength: 8,

  enqueueShortVideoTask(task: ShortVideoDownloadTask): void {
    const taskKey = this.getShortVideoTaskKey(task);
    const activeKey = this.activeShortVideoTask ? this.getShortVideoTaskKey(this.activeShortVideoTask) : '';
    const exists = activeKey === taskKey || this.shortVideoQueue.some(item => this.getShortVideoTaskKey(item) === taskKey);

    if (exists) {
      UI.showAlert('当前内容已在下载或等待队列中', 'warning');
      return;
    }

    if (this.shortVideoQueue.length >= this.maxQueueLength) {
      UI.showAlert(`等待队列已满（${this.maxQueueLength}），请等当前任务完成后再添加`, 'warning');
      return;
    }

    this.shortVideoQueue.push(task);
    UI.showAlert(`已加入等待队列（${this.shortVideoQueue.length}）: ${task.label}`, 'success');
    UI.updateDownloadButtonProgress(0, `下载中 · 队列 ${this.shortVideoQueue.length}`);
  },

  updateShortVideoDownloadProgress(percent: number, label: string): void {
    const queueText = this.shortVideoQueue.length > 0 ? ` · 队列 ${this.shortVideoQueue.length}` : '';
    UI.updateDownloadButtonProgress(percent, `${label}${queueText}`);
  },

  runShortVideoTask(task: ShortVideoDownloadTask): void {
    this.isDownloading = true;
    this.activeShortVideoTask = task;
    UI.setDownloading(true, { allowQueue: true, label: '下载中 0% · 再点排队' });
    UI.showProgress(true);
    UI.hideAlert();
    UI.updateProgress('video', 0, '准备下载...');
    UI.updateCircleProgress(0);
    this.updateShortVideoDownloadProgress(0, '准备下载');

    this.downloadUnits(task.units, task.platform, task.zipName).then(() => {
      this.finishShortVideoTask('下载完成！');
    }).catch(error => {
      console.error('下载失败:', error);
      Diagnostics.error('short-video-download', '短视频下载失败', error);
      UI.showAlert('下载失败: ' + error.message, 'error');
      const hasQueuedTask = this.shortVideoQueue.length > 0;
      this.resetDownloadingState();
      UI.updateCircleProgress(0);
      if (!hasQueuedTask) setTimeout(() => UI.showProgress(false), 2000);
      this.startNextShortVideoTask();
    });
  },

  finishShortVideoTask(message: string): void {
    UI.showAlert(this.shortVideoQueue.length > 0 ? `${message} 继续下载队列...` : message, 'success');
    CompleteEffect.show(UI.root, UI.elements.progressCircle as HTMLElement | null);
    this.resetDownloadingState();
    setTimeout(() => UI.updateCircleProgress(0), 1000);
    if (this.shortVideoQueue.length === 0) setTimeout(() => UI.showProgress(false), 3000);
    this.startNextShortVideoTask();
  },

  startNextShortVideoTask(): void {
    const next = this.shortVideoQueue.shift();
    if (!next) return;

    setTimeout(() => {
      UI.showAlert(`开始队列任务（剩余 ${this.shortVideoQueue.length}）: ${next.label}`, 'info');
      this.runShortVideoTask(next);
    }, 600);
  },

  downloadSinglePage(pageInfo: PageInfo & { ep_id?: number; bvid?: string }): Promise<void> {
    const videoId = Utils.getVideoId()!;
    UI.updateProgress('video', 0, '获取下载地址...');
    UI.updateProgress('audio', 0);
    UI.updateProgress('merge', 0);

    const playParams: any = { type: this.videoType, cid: pageInfo.cid, qn: this.selectedQuality };
    if (this.videoType === 'bangumi') playParams.ep_id = pageInfo.ep_id;
    else playParams.bvid = videoId.id;

    return BiliAPI.getPlayUrl(playParams).then(playData => {
      const streams = BiliAPI.getStreams(playData, this.selectedQuality, this.selectedVideoCodec, this.selectedAudioCodec);
      if (!streams.video) throw new Error('无法获取视频流');

      const videoUrl = (streams.video as any).baseUrl || (streams.video as any).base_url;
      const videoBackups: string[] = (streams.video as any).backupUrl || (streams.video as any).backup_url || [];
      const videoUrls = [videoUrl, ...videoBackups].filter(Boolean) as string[];

      const audioMainUrl = streams.audio ? ((streams.audio as any).baseUrl || (streams.audio as any).base_url) : null;
      const audioBackups: string[] = streams.audio ? ((streams.audio as any).backupUrl || (streams.audio as any).backup_url || []) : [];
      const audioUrls = audioMainUrl ? [audioMainUrl, ...audioBackups].filter(Boolean) as string[] : null;

      UI.updateProgress('video', 0, '下载视频...');
      UI.updateCircleProgress(0);

      return ThreadManager.downloadWithThread(
        videoUrls,
        audioUrls,
        (loaded, total) => {
          const percent = Math.round(loaded / total * 100);
          UI.updateProgress('video', percent);
          UI.updateCircleProgress(audioUrls ? percent * 0.4 : percent);
        },
        (loaded, total) => {
          const percent = Math.round(loaded / total * 100);
          UI.updateProgress('audio', percent);
          UI.updateCircleProgress(40 + percent * 0.4);
        }
      ).then(buffers => {
        UI.updateProgress('video', 100);
        if (buffers.audioBuffer) UI.updateProgress('audio', 100);
        return buffers;
      });
    }).then(buffers => {
      const metadata = {
        title: this.videoInfo!.title + (pageInfo.part ? ' - ' + pageInfo.part : ''),
        author: this.videoInfo!.owner.name,
        description: this.videoInfo!.desc,
        duration: pageInfo.duration
      };

      let filename = this.videoInfo!.title;
      if (this.videoInfo!.pages.length > 1 && pageInfo.part) filename += ' - ' + pageInfo.part;
      filename += ' - ' + this.videoInfo!.owner.name;
      filename = Utils.sanitizeFilename(filename);

      const mergeBytes = buffers.videoBuffer.byteLength + (buffers.audioBuffer?.byteLength || 0);
      const mergeLimit = MergeManager.currentMethod === CONFIG.MERGE_METHODS.FFMPEG
        ? CONFIG.MAX_FFMPEG_MERGE_BYTES
        : CONFIG.MAX_MERGE_BYTES;

      if (buffers.audioBuffer && mergeBytes > mergeLimit) {
        // 合并峰值内存约为文件总大小的两倍，超限直接分离保存以免标签页崩溃
        Diagnostics.warn('merge', `文件过大（${Utils.formatBytes(mergeBytes)} > ${Utils.formatBytes(mergeLimit)}），跳过合并`);
        UI.showAlert(`文件较大（${Utils.formatBytes(mergeBytes)}），为避免浏览器内存溢出已分别保存`, 'warning');
        this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
      } else if (buffers.audioBuffer && MergeManager.currentMethod !== CONFIG.MERGE_METHODS.SEPARATE) {
        UI.updateProgress('merge', 0, '合并中...');
        return MergeManager.merge(buffers.videoBuffer, buffers.audioBuffer, metadata).then(result => {
          if (result.separate) {
            this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer!, filename);
          } else {
            UI.updateProgress('merge', 100);
            UI.updateCircleProgress(100);
            this.saveFile(result.data!, filename + '.mp4');
          }
        }).catch(mergeError => {
          console.error('合并失败:', mergeError);
          Diagnostics.error('merge', `合并失败（method=${MergeManager.currentMethod}），已回退分离保存`, mergeError);
          UI.showAlert('合并失败，已分别保存。错误: ' + mergeError.message, 'warning');
          this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer!, filename);
        });
      } else if (buffers.audioBuffer) {
        this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
      } else {
        this.saveFile(buffers.videoBuffer, filename + '.mp4');
      }
    });
  },

  finishDownload(message: string): void {
    UI.showAlert(message, 'success');
    CompleteEffect.show(UI.root, UI.elements.progressCircle as HTMLElement | null);
    this.resetDownloadingState();
    setTimeout(() => UI.updateCircleProgress(0), 1000);
    setTimeout(() => UI.showProgress(false), 3000);
  },

  resetDownloadingState(): void {
    this.isDownloading = false;
    this.activeShortVideoTask = null;
    UI.setDownloading(false);
    if (this.isShortVideoMode() && this.shortVideoInfo && this.currentPlatform) {
      UI.setPrimaryButtonLabel(UI.getShortVideoPrimaryLabel(this.shortVideoInfo));
    }
  },

  /**
   * 按候选地址顺序取回一个文件，首个成功的即为结果。
   *
   * 只负责取数据与上报进度，不写 UI、不保存，便于并发复用。
   *
   * @param urls 候选地址，重复项会去重
   * @param platform 决定媒体请求头与是否需要页面上下文
   * @param onProgress 进度回调，attempt / attemptCount 为当前候选序号与总数
   */
  fetchBlobCandidates(
    urls: string[],
    platform: ShortVideoPlatform,
    onProgress: (percent: number, attempt: number, attemptCount: number) => void
  ): Promise<Blob> {
    const candidates = [...new Set(urls.filter(Boolean))];
    if (candidates.length === 0) return Promise.reject(new Error('未找到可下载地址'));

    const headers = ShortVideoAPI.getMediaHeaders(platform);
    let lastError: Error | null = null;

    // 部分 CDN 拒绝脚本沙箱发出的请求，需页面上下文（继承 tab 网络栈）才能下载
    const pattern = PLATFORMS[platform].pageContextMedia;
    const needsPageContext = (url: string) => {
      if (!pattern) return false;
      try { return pattern.test(new URL(url).hostname); } catch { return false; }
    };

    const tryDirect = (index: number): Promise<Blob> => {
      if (index >= candidates.length) {
        return Promise.reject(lastError || new Error('所有下载地址均不可用'));
      }

      const currentUrl = candidates[index];
      const progressCallback = (loaded: number, total: number) => {
        if (!total) return;
        onProgress(Math.round(loaded / total * 100), index + 1, candidates.length);
      };
      onProgress(0, index + 1, candidates.length);

      const primary = needsPageContext(currentUrl)
        ? Network.downloadBlobInPageContext(currentUrl, progressCallback).catch(err => {
            // 页面上下文失败时回退到 GM_xmlhttpRequest
            return Network.downloadBlob(currentUrl, progressCallback, headers).catch(gmErr => {
              throw gmErr instanceof Error ? gmErr : err;
            });
          })
        : Network.downloadBlob(currentUrl, progressCallback, headers);

      return primary.catch(error => {
        lastError = error;
        return tryDirect(index + 1);
      });
    };

    return tryDirect(0);
  },

  /** 取回单个文件并立即保存，进度占据整条进度条的 scope 区间。 */
  downloadBlobCandidates(
    urls: string[],
    filename: string,
    platform: ShortVideoPlatform,
    progressLabel: string,
    scope: { base: number; span: number } = { base: 0, span: 100 }
  ): Promise<void> {
    const getScopedPercent = (percent: number) => Math.min(100, Math.round(scope.base + percent * scope.span / 100));

    return this.fetchBlobCandidates(urls, platform, (percent, attempt, attemptCount) => {
      const suffix = attemptCount > 1 ? ` (${attempt}/${attemptCount})` : '';
      const scopedPercent = getScopedPercent(percent);
      UI.updateProgress('video', percent, `${progressLabel}${suffix} ${percent}%`);
      UI.updateCircleProgress(scopedPercent);
      this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} ${percent}%`);
    }).then(blob => {
      UI.updateProgress('video', 100, '100%');
      const scopedPercent = getScopedPercent(100);
      UI.updateCircleProgress(scopedPercent);
      this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} 100%`);
      this.saveFile(blob, filename);
    });
  },

  /**
   * 并发下载一批文件，按数量决定逐个保存还是打成一个 zip。
   *
   * 所有请求都经 ThreadManager 排队，并发上限由 CPU 核心数决定。
   * 逐个保存时下载仍是并发的，只有触发保存的动作按 150ms 间隔串行，
   * 避免浏览器把同时发起的多个下载判为异常而拦截。
   *
   * @param units 待下载的文件列表
   * @param platform 媒体请求头所属平台
   * @param zipName 需要打包时的 zip 文件名，不含扩展名
   */
  downloadUnits(units: MediaUnit[], platform: ShortVideoPlatform, zipName: string): Promise<void> {
    if (units.length === 0) return Promise.reject(new Error('没有选中可下载的内容'));

    const total = units.length;
    const shouldZip = total > CONFIG.ZIP_THRESHOLD;
    const percents = new Array<number>(total).fill(0);
    let done = 0;
    let saveChain: Promise<void> = Promise.resolve();
    let convertChain: Promise<void> = Promise.resolve();
    let convertLabel = '';

    const report = () => {
      const overall = Math.round(percents.reduce((sum, value) => sum + value, 0) / total);
      const label = convertLabel || (total > 1
        ? `${shouldZip ? '打包下载' : '下载'} ${done}/${total}`
        : units[0].label);
      UI.updateProgress('video', overall, `${label} · ${overall}%`);
      UI.updateCircleProgress(overall);
      this.updateShortVideoDownloadProgress(overall, label);
    };

    report();

    // 转码排成一条串行链：FFmpeg 每条命令都要新建实例，JS 编码器也要独占一份帧缓存，
    // 并行会同时占用多份内存
    const convert = (unit: MediaUnit, blob: Blob): Promise<Blob> => {
      const method = unit.convert;
      if (!method) return Promise.resolve(blob);
      const task = convertChain.then(() => {
        convertLabel = '转换 GIF';
        report();
        return blob.arrayBuffer()
          .then(buffer => GifManager.convert(buffer, method, ratio => {
            convertLabel = `转换 GIF ${Math.round(ratio * 100)}%`;
            report();
          }))
          .then(gif => new Blob([gif], { type: 'image/gif' }));
      });
      convertChain = task.then(() => { convertLabel = ''; report(); }, () => { convertLabel = ''; });
      return task;
    };

    const tasks = units.map((unit, index) => ThreadManager.runTask(
      () => this.fetchBlobCandidates(unit.candidates, platform, percent => {
        percents[index] = percent;
        report();
      })
    ).then(blob => convert(unit, blob)).then(blob => {
      percents[index] = 100;
      done += 1;
      report();
      if (!shouldZip) {
        saveChain = saveChain.then(() => {
          this.saveFile(blob, unit.filename);
          return Utils.delay(150);
        });
      }
      return blob;
    }));

    return Promise.all(tasks).then(blobs => (
      shouldZip ? this.saveUnitsAsZip(units, blobs, zipName) : saveChain
    ));
  },

  /**
   * 把已下载的文件打成一个 zip 并保存。
   *
   * @param units 与 blobs 一一对应的文件信息，只取其中的 filename
   * @param blobs 已下载的文件内容
   * @param zipName zip 文件名，不含扩展名
   */
  saveUnitsAsZip(units: MediaUnit[], blobs: Blob[], zipName: string): Promise<void> {
    UI.updateProgress('video', 100, '正在打包...');
    this.updateShortVideoDownloadProgress(100, '正在打包');

    return Promise.all(blobs.map(blob => blob.arrayBuffer())).then(buffers => {
      const zip = createZip(buffers.map((buffer, index) => ({
        name: units[index].filename,
        data: new Uint8Array(buffer)
      })));
      this.saveFile(zip, `${zipName}.zip`);
    });
  },

  downloadShortVideoImages(): void {
    if (!this.shortVideoInfo || !this.currentPlatform || !this.shortVideoInfo.images?.length) {
      UI.showAlert('当前内容没有可下载的图片', 'warning');
      return;
    }

    const baseFilename = Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || '图集', this.shortVideoInfo.author?.name);
    UI.showAlert('正在下载图片...', 'info');
    UI.showProgress(true);
    UI.updateCircleProgress(0);
    this.downloadUnits(this.buildItemUnits(this.shortVideoInfo, baseFilename), this.currentPlatform, baseFilename).then(() => {
      UI.showAlert('图片下载完成', 'success');
      setTimeout(() => UI.showProgress(false), 1200);
    }).catch(error => UI.showAlert('下载图片失败: ' + error.message, 'error'));
  },

  downloadShortVideoLivePhotos(): void {
    if (!this.shortVideoInfo || !this.currentPlatform || !this.shortVideoInfo.live_photo?.length) {
      UI.showAlert('当前内容没有可下载的实况图', 'warning');
      return;
    }

    const baseFilename = Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || '实况图', this.shortVideoInfo.author?.name);
    UI.showAlert('正在下载实况图...', 'info');
    UI.showProgress(true);
    UI.updateCircleProgress(0);
    this.downloadUnits(this.buildItemUnits(this.shortVideoInfo, baseFilename), this.currentPlatform, baseFilename).then(() => {
      UI.showAlert('实况图下载完成', 'success');
      setTimeout(() => UI.showProgress(false), 1200);
    }).catch(error => UI.showAlert('下载实况图失败: ' + error.message, 'error'));
  },

  downloadCover(): void {
    if (this.isShortVideoMode()) {
      this.downloadShortVideoCover();
      return;
    }

    if (!this.coverUrl) {
      UI.showAlert('没有找到封面', 'warning');
      return;
    }

    UI.showAlert('正在下载封面...', 'info');
    fetch(this.coverUrl).then(r => r.blob()).then(blob => {
      const ext = this.coverUrl!.match(/\.(jpg|jpeg|png|webp)($|\?)/i);
      this.saveFile(blob, Utils.sanitizeFilename(this.videoInfo!.title) + '_cover.' + (ext ? ext[1] : 'jpg'));
      UI.showAlert('封面下载完成', 'success');
    }).catch(e => UI.showAlert('下载封面失败: ' + e.message, 'error'));
  },

  downloadShortVideoCover(): void {
    if (!this.shortVideoInfo?.cover || !this.currentPlatform) {
      UI.showAlert('没有找到封面', 'warning');
      return;
    }

    const ext = Utils.inferExtension(this.shortVideoInfo.cover, 'jpg');
    const filename = `${Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || 'cover', this.shortVideoInfo.author?.name)}_cover.${ext}`;
    UI.showAlert('正在下载封面...', 'info');
    UI.showProgress(true);
    UI.updateCircleProgress(0);
    this.downloadBlobCandidates([this.shortVideoInfo.cover], filename, this.currentPlatform, '下载封面')
      .then(() => {
        UI.showAlert('封面下载完成', 'success');
        setTimeout(() => UI.showProgress(false), 1200);
      })
      .catch(error => UI.showAlert('下载封面失败: ' + error.message, 'error'));
  },

  downloadSubtitles(): void {
    if (this.availableSubtitles.length === 0) {
      UI.showAlert('没有可用的字幕', 'warning');
      return;
    }

    UI.showAlert('正在下载字幕...', 'info');
    const promises = this.availableSubtitles.map(sub => {
      let url = sub.subtitle_url;
      if (!url.startsWith('http')) url = 'https:' + url;
      return fetch(url).then(r => r.json()).then(data => ({ lan: sub.lan_doc || sub.lan, data }));
    });

    Promise.all(promises).then(results => {
      results.forEach(result => {
        const srt = this.convertJsonToSrt(result.data);
        this.saveFile(new Blob([srt], { type: 'text/plain;charset=utf-8' }), Utils.sanitizeFilename(this.videoInfo!.title) + '_' + result.lan + '.srt');
      });
      UI.showAlert('字幕下载完成', 'success');
    }).catch(error => UI.showAlert('下载字幕失败: ' + error.message, 'error'));
  },

  downloadShortVideoMusic(): void {
    if (!this.shortVideoInfo?.music?.url || !this.currentPlatform) {
      UI.showAlert('当前内容没有可下载的音频', 'warning');
      return;
    }

    const ext = Utils.inferExtension(this.shortVideoInfo.music.url, 'mp3');
    const filename = `${Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || 'audio', this.shortVideoInfo.author?.name)}_music.${ext}`;
    UI.showAlert('正在下载音频...', 'info');
    UI.showProgress(true);
    UI.updateCircleProgress(0);
    this.downloadBlobCandidates([this.shortVideoInfo.music.url], filename, this.currentPlatform, '下载音频')
      .then(() => {
        UI.showAlert('音频下载完成', 'success');
        setTimeout(() => UI.showProgress(false), 1200);
      })
      .catch(error => UI.showAlert('下载音频失败: ' + error.message, 'error'));
  },

  downloadDanmaku(): void {
    const page = this.videoInfo!.currentPage || Utils.getCurrentPage();
    const pageInfo = this.videoInfo!.pages[page - 1];
    UI.showAlert('正在下载弹幕...', 'info');

    BiliAPI.getDanmaku(pageInfo.cid).then(xmlData => {
      let filename = Utils.sanitizeFilename(this.videoInfo!.title);
      if (this.videoInfo!.pages.length > 1 && pageInfo.part) filename += ' - ' + pageInfo.part;
      this.saveFile(new Blob([xmlData], { type: 'text/xml;charset=utf-8' }), filename + '.xml');
      UI.showAlert('弹幕下载完成', 'success');
    }).catch(error => UI.showAlert('下载弹幕失败: ' + error.message, 'error'));
  },

  convertJsonToSrt(jsonData: any): string {
    let srt = '';
    if (jsonData.body && Array.isArray(jsonData.body)) {
      jsonData.body.forEach((item: any, index: number) => {
        srt += (index + 1) + '\n' + this.formatSrtTime(item.from) + ' --> ' + this.formatSrtTime(item.to) + '\n' + item.content + '\n\n';
      });
    }
    return srt;
  },

  formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + ',' + String(ms).padStart(3, '0');
  },

  saveSeparate(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, filename: string): void {
    this.saveFile(videoBuffer, filename + '_video.mp4');
    setTimeout(() => this.saveFile(audioBuffer, filename + '_audio.m4a'), 500);
  },

  saveFile(buffer: ArrayBuffer | Blob, filename: string): void {
    const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();

    // object URL 会一直钉住整个 Blob 不让 GC 回收，必须 revoke。
    // 但 revoke 太早浏览器还没来得及把数据落盘，下载会中断 ——
    // 大文件需要更长的宽限期，按体积放宽到最多 30s。
    const graceMs = Math.min(30_000, Math.max(2_000, Math.round(blob.size / (8 * 1024 * 1024)) * 1000));
    setTimeout(() => {
      if (anchor.parentNode) document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, graceMs);
  }
};
