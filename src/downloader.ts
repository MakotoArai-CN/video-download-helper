import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import { ShortVideoAPI } from './short-video-api.ts';
import { MergeManager } from './merge-manager.ts';
import { ThreadManager } from './thread-manager.ts';
import { CompleteEffect } from './complete-effect.ts';
import { UI } from './ui.ts';
import { CONFIG } from './config.ts';
import { Network } from './network.ts';
import type {
  VideoInfo,
  PageInfo,
  UGCEpisode,
  UGCInfo,
  SubtitleItem,
  ShortVideoData,
  ShortVideoPlatform
} from './types.ts';

type RefreshShortVideoOptions = {
  silent?: boolean;
};

type ShortVideoDownloadTask = {
  data: ShortVideoData;
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
              UI.prepareUGCSection(ugcInfo.episodes, () => this.updateSelectedUGC());
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
      this.selectedShortVideoIndex = 0;
      this.shortVideoInfo = this.shortVideoItems[0] || data;
      this.shortVideoPageUrl = location.href;
      this.coverUrl = this.shortVideoInfo.cover || this.shortVideoInfo.music?.cover || null;

      this.renderShortVideoInfo(platform);
      UI.hideAlert();
      UI.positionPopup();
      return true;
    }).catch(error => {
      if (options.silent) console.warn('短视频解析跳过:', error);
      else console.error('短视频解析失败:', error);

      this.shortVideoInfo = null;
      this.shortVideoItems = [];
      this.selectedShortVideoIndex = 0;
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
    UI.prepareShortVideoItems(this.shortVideoItems, this.selectedShortVideoIndex, index => this.selectShortVideoItem(index));
    UI.setExtraActions(this.getShortVideoActions(this.shortVideoInfo, platform));
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

    if (!this.shortVideoInfo || this.shortVideoPageUrl !== location.href || !platform) {
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

    this.runShortVideoTask(this.createShortVideoTask(this.shortVideoInfo, platform, location.href));
  },

  prepareShortVideoTask(platform: ShortVideoPlatform): Promise<ShortVideoDownloadTask | null> {
    if (this.shortVideoInfo && this.shortVideoPageUrl === location.href) {
      return Promise.resolve(this.createShortVideoTask(this.shortVideoInfo, platform, location.href));
    }

    return this.refreshShortVideoInfo(platform, { silent: false }).then(success => {
      if (!success || !this.shortVideoInfo) return null;
      return this.createShortVideoTask(this.shortVideoInfo, platform, location.href);
    });
  },

  createShortVideoTask(data: ShortVideoData, platform: ShortVideoPlatform, pageUrl: string): ShortVideoDownloadTask {
    const label = data.title || data.desc || data.itemLabel || ShortVideoAPI.getPlatformLabel(platform);
    return {
      data: this.cloneShortVideoData(data),
      platform,
      pageUrl,
      label
    };
  },

  cloneShortVideoData(data: ShortVideoData): ShortVideoData {
    return {
      ...data,
      author: data.author ? { ...data.author } : undefined,
      video_backup: data.video_backup ? [...data.video_backup] : undefined,
      images: data.images ? [...data.images] : undefined,
      live_photo: data.live_photo ? data.live_photo.map(item => ({ ...item })) : undefined,
      music: data.music ? { ...data.music } : undefined,
      items: undefined
    };
  },

  getShortVideoTaskKey(task: ShortVideoDownloadTask): string {
    return [
      task.platform,
      task.pageUrl,
      task.data.url,
      task.data.images?.join('|'),
      task.data.live_photo?.map(item => `${item.image || ''}:${item.video || ''}`).join('|'),
      task.data.music?.url
    ].join('::');
  },

  enqueueShortVideoTask(task: ShortVideoDownloadTask): void {
    const taskKey = this.getShortVideoTaskKey(task);
    const activeKey = this.activeShortVideoTask ? this.getShortVideoTaskKey(this.activeShortVideoTask) : '';
    const exists = activeKey === taskKey || this.shortVideoQueue.some(item => this.getShortVideoTaskKey(item) === taskKey);

    if (exists) {
      UI.showAlert('当前内容已在下载或等待队列中', 'warning');
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
    const data = task.data;
    const platform = task.platform;
    const baseFilename = Utils.getShortVideoFilename(data.title || data.desc || data.itemLabel || ShortVideoAPI.getPlatformLabel(platform), data.author?.name);

    this.isDownloading = true;
    this.activeShortVideoTask = task;
    UI.setDownloading(true, { allowQueue: true, label: '下载中 0% · 再点排队' });
    UI.showProgress(true);
    UI.hideAlert();
    UI.updateProgress('video', 0, '准备下载...');
    UI.updateCircleProgress(0);
    this.updateShortVideoDownloadProgress(0, '准备下载');

    let downloadTask: Promise<void>;

    if ((data.type === 'video' || data.url || data.video_backup?.length) && (data.url || data.video_backup?.length)) {
      const candidates = [data.url, ...(data.video_backup || [])].filter(Boolean) as string[];
      const ext = candidates[0] ? Utils.inferExtension(candidates[0], 'mp4') : 'mp4';
      downloadTask = this.downloadBlobCandidates(candidates, `${baseFilename}.${ext}`, platform, '下载视频');
    } else if (data.type === 'image' && data.images && data.images.length > 0) {
      downloadTask = this.downloadImageCollection(data.images, baseFilename, platform, '图集');
    } else if (data.type === 'live' && data.live_photo && data.live_photo.length > 0) {
      downloadTask = this.downloadLivePhotoCollection(data.live_photo, baseFilename, platform);
    } else if (data.music?.url) {
      const ext = Utils.inferExtension(data.music.url, 'mp3');
      downloadTask = this.downloadBlobCandidates([data.music.url], `${baseFilename}_music.${ext}`, platform, '下载音频');
    } else {
      UI.showAlert('没有找到可下载的内容', 'warning');
      this.resetDownloadingState();
      UI.showProgress(false);
      return;
    }

    downloadTask.then(() => {
      this.finishShortVideoTask('下载完成！');
    }).catch(error => {
      console.error('下载失败:', error);
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
          UI.updateCircleProgress(audioUrl ? percent * 0.4 : percent);
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

      if (buffers.audioBuffer && MergeManager.currentMethod !== CONFIG.MERGE_METHODS.SEPARATE) {
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

  downloadBlobCandidates(
    urls: string[],
    filename: string,
    platform: ShortVideoPlatform,
    progressLabel: string,
    scope: { base: number; span: number } = { base: 0, span: 100 }
  ): Promise<void> {
    const candidates = [...new Set(urls.filter(Boolean))];
    if (candidates.length === 0) return Promise.reject(new Error('未找到可下载地址'));

    const headers = ShortVideoAPI.getMediaHeaders(platform);
    let lastError: Error | null = null;
    const getScopedPercent = (percent: number) => Math.min(100, Math.round(scope.base + percent * scope.span / 100));

    const tryDirect = (index: number): Promise<Blob> => {
      if (index >= candidates.length) {
        return Promise.reject(lastError || new Error('所有下载地址均不可用'));
      }

      const currentUrl = candidates[index];
      UI.updateProgress('video', 0, candidates.length > 1 ? `${progressLabel} (${index + 1}/${candidates.length})` : progressLabel);

      return Network.downloadBlob(currentUrl, (loaded, total) => {
        if (!total) return;
        const percent = Math.round(loaded / total * 100);
        const scopedPercent = getScopedPercent(percent);
        UI.updateProgress('video', percent, `${progressLabel} ${percent}%`);
        UI.updateCircleProgress(scopedPercent);
        this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} ${percent}%`);
      }, headers).catch(error => {
        lastError = error;
        return tryDirect(index + 1);
      });
    };

    return tryDirect(0).catch(error => {
      lastError = error;
      const proxyUrl = ShortVideoAPI.getProxyUrl(candidates[0], platform);
      if (!proxyUrl) throw error;

      UI.updateProgress('video', 0, `${progressLabel}（代理重试）`);
      return Network.downloadBlob(proxyUrl, (loaded, total) => {
        if (!total) return;
        const percent = Math.round(loaded / total * 100);
        const scopedPercent = getScopedPercent(percent);
        UI.updateProgress('video', percent, `${progressLabel} ${percent}%`);
        UI.updateCircleProgress(scopedPercent);
        this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} ${percent}%`);
      });
    }).then(blob => {
      UI.updateProgress('video', 100, '100%');
      const scopedPercent = getScopedPercent(100);
      UI.updateCircleProgress(scopedPercent);
      this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} 100%`);
      this.saveFile(blob, filename);
    });
  },

  downloadImageCollection(images: string[], baseFilename: string, platform: ShortVideoPlatform, marker: string): Promise<void> {
    const urls = images.filter(Boolean);
    if (urls.length === 0) return Promise.reject(new Error('没有可下载的图片'));

    let completed = 0;
    const total = urls.length;

    const downloadNext = (index: number): Promise<void> => {
      if (index >= urls.length) {
        UI.updateProgress('video', 100, '100%');
        UI.updateCircleProgress(100);
        return Promise.resolve();
      }

      const url = urls[index];
      const ext = Utils.inferExtension(url, 'jpg');
      const suffix = total > 1 ? `_${String(index + 1).padStart(2, '0')}` : '';
      const filename = `${baseFilename}${suffix}.${ext}`;

      UI.updateProgress('video', Math.round(completed / total * 100), `${marker} ${index + 1}/${total}`);

      return this.downloadBlobCandidates([url], filename, platform, `${marker} ${index + 1}/${total}`, {
        base: index / total * 100,
        span: 100 / total
      }).then(() => {
        completed += 1;
        this.updateShortVideoDownloadProgress(Math.round(completed / total * 100), `${marker} ${completed}/${total}`);
        return Utils.delay(150).then(() => downloadNext(index + 1));
      });
    };

    return downloadNext(0);
  },

  downloadLivePhotoCollection(livePhotos: Array<{ image?: string; video?: string }>, baseFilename: string, platform: ShortVideoPlatform): Promise<void> {
    const assets: Array<{ url: string; filename: string }> = [];

    livePhotos.forEach((item, index) => {
      const serial = String(index + 1).padStart(2, '0');
      if (item.image) {
        assets.push({
          url: item.image,
          filename: `${baseFilename}_${serial}.${Utils.inferExtension(item.image, 'jpg')}`
        });
      }
      if (item.video) {
        assets.push({
          url: item.video,
          filename: `${baseFilename}_${serial}_live.${Utils.inferExtension(item.video, 'mp4')}`
        });
      }
    });

    if (assets.length === 0) return Promise.reject(new Error('没有可下载的实况图内容'));

    let completed = 0;
    const total = assets.length;

    const downloadNext = (index: number): Promise<void> => {
      if (index >= assets.length) {
        UI.updateProgress('video', 100, '100%');
        UI.updateCircleProgress(100);
        return Promise.resolve();
      }

      const asset = assets[index];
      UI.updateProgress('video', Math.round(completed / total * 100), `实况图 ${index + 1}/${total}`);

      return this.downloadBlobCandidates([asset.url], asset.filename, platform, `实况图 ${index + 1}/${total}`, {
        base: index / total * 100,
        span: 100 / total
      }).then(() => {
        completed += 1;
        this.updateShortVideoDownloadProgress(Math.round(completed / total * 100), `实况图 ${completed}/${total}`);
        return Utils.delay(150).then(() => downloadNext(index + 1));
      });
    };

    return downloadNext(0);
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
    this.downloadImageCollection(this.shortVideoInfo.images, baseFilename, this.currentPlatform, '图片').then(() => {
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
    this.downloadLivePhotoCollection(this.shortVideoInfo.live_photo, baseFilename, this.currentPlatform).then(() => {
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
    setTimeout(() => {
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }, 1000);
  }
};
