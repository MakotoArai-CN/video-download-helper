import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import { MergeManager } from './merge-manager.ts';
import { ThreadManager } from './thread-manager.ts';
import { CompleteEffect } from './complete-effect.ts';
import { UI } from './ui.ts';
import { CONFIG } from './config.ts';
import type { VideoInfo, PageInfo, UGCEpisode, SubtitleItem } from './types.ts';

export const Downloader = {
  isDownloading: false,
  videoInfo: null as VideoInfo | null,
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

  refreshInfo(): Promise<void> {
    const videoId = Utils.getVideoId();
    if (!videoId) { UI.showAlert('无法识别视频ID', 'error'); return Promise.resolve(); }
    this.videoType = videoId.type;
    return BiliAPI.getUserInfo().then(() => {
      const infoPromise = videoId.type === 'bangumi' ? BiliAPI.getBangumiInfo(videoId.id) : BiliAPI.getVideoInfo(videoId.id);
      return infoPromise.then(videoInfo => {
        this.videoInfo = videoInfo;
        this.coverUrl = videoInfo.pic || videoInfo.cover || null;
        const ugcPromise = videoId.type === 'video' ? BiliAPI.getUGCSeasonInfo(videoId.id) : Promise.resolve({ hasUGC: false });
        return ugcPromise.then(ugcInfo => {
          const page = videoInfo.currentPage || Utils.getCurrentPage();
          const pageInfo = videoInfo.pages[page - 1];
          if (!pageInfo) { UI.showAlert('无法获取分P信息', 'error'); return; }
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
            UI.updateQualities(qualities, playData.quality, qn => { this.selectedQuality = qn; });
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
              subtitles.length > 0, this.hasDanmaku, this.coverUrl || false,
              () => this.downloadCover(),
              () => this.downloadSubtitles(),
              () => this.downloadDanmaku()
            );
            if (qualities.length > 0) {
              for (const q of qualities) { if (q.available) { this.selectedQuality = q.qn; break; } }
            }
          });
        });
      });
    }).catch(error => {
      console.error('获取视频信息失败:', error);
      UI.showAlert('获取视频信息失败: ' + error.message, 'error');
    });
  },

  updateSelectedPages(): void {
    const checkboxes = (UI.elements.pagesList as HTMLElement).querySelectorAll('.bdl-page-checkbox') as NodeListOf<HTMLInputElement>;
    this.selectedPages = [];
    checkboxes.forEach(cb => { if (cb.checked) this.selectedPages.push(parseInt(cb.dataset.index!)); });
  },

  updateSelectedUGC(): void {
    const checkboxes = (UI.elements.ugcList as HTMLElement).querySelectorAll('.bdl-page-checkbox') as NodeListOf<HTMLInputElement>;
    this.selectedUGCEpisodes = [];
    checkboxes.forEach(cb => { if (cb.checked) this.selectedUGCEpisodes.push(parseInt(cb.dataset.index!)); });
  },

  start(): void {
    if (this.isDownloading) return;
    const totalTasks = this.selectedPages.length + this.selectedUGCEpisodes.length;
    if (totalTasks === 0) { UI.showAlert('请至少选择一个分P或合集视频', 'warning'); return; }
    this.isDownloading = true;
    UI.setDownloading(true); UI.showProgress(true); UI.hideAlert();
    const allTasks: Array<{ type: string; index: number; data: any }> = [];
    for (const idx of this.selectedPages) allTasks.push({ type: 'page', index: idx, data: this.videoInfo!.pages[idx] });
    for (const idx of this.selectedUGCEpisodes) allTasks.push({ type: 'ugc', index: idx, data: this.videoInfo!.ugcEpisodes![idx] });
    const downloadNext = (index: number) => {
      if (index >= allTasks.length) {
        UI.showAlert('全部下载完成！', 'success');
        CompleteEffect.show();
        this.isDownloading = false; UI.setDownloading(false);
        setTimeout(() => UI.updateCircleProgress(0), 1000);
        setTimeout(() => UI.showProgress(false), 3000);
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
        this.isDownloading = false; UI.setDownloading(false); UI.updateCircleProgress(0);
        setTimeout(() => UI.showProgress(false), 2000);
      });
    };
    downloadNext(0);
  },

  downloadSinglePage(pageInfo: PageInfo & { ep_id?: number; bvid?: string }): Promise<void> {
    const videoId = Utils.getVideoId()!;
    UI.updateProgress('video', 0, '获取下载地址...');
    UI.updateProgress('audio', 0); UI.updateProgress('merge', 0);
    const playParams: any = { type: this.videoType, cid: pageInfo.cid, qn: this.selectedQuality };
    if (this.videoType === 'bangumi') playParams.ep_id = pageInfo.ep_id;
    else playParams.bvid = videoId.id;
    return BiliAPI.getPlayUrl(playParams).then(playData => {
      const streams = BiliAPI.getStreams(playData, this.selectedQuality, this.selectedVideoCodec, this.selectedAudioCodec);
      if (!streams.video) throw new Error('无法获取视频流');
      const videoUrl = (streams.video as any).baseUrl || (streams.video as any).base_url;
      const audioUrl = streams.audio ? ((streams.audio as any).baseUrl || (streams.audio as any).base_url) : null;
      UI.updateProgress('video', 0, '下载视频...'); UI.updateCircleProgress(0);
      return ThreadManager.downloadWithThread(
        videoUrl, audioUrl,
        (loaded, total) => { const p = Math.round(loaded / total * 100); UI.updateProgress('video', p); UI.updateCircleProgress(audioUrl ? p * 0.4 : p); },
        (loaded, total) => { const p = Math.round(loaded / total * 100); UI.updateProgress('audio', p); UI.updateCircleProgress(40 + p * 0.4); }
      ).then(buffers => { UI.updateProgress('video', 100); if (buffers.audioBuffer) UI.updateProgress('audio', 100); return buffers; });
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
          if (result.separate) { this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer!, filename); }
          else { UI.updateProgress('merge', 100); UI.updateCircleProgress(100); this.saveFile(result.data!, filename + '.mp4'); }
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

  downloadCover(): void {
    if (!this.coverUrl) { UI.showAlert('没有找到封面', 'warning'); return; }
    UI.showAlert('正在下载封面...', 'info');
    fetch(this.coverUrl).then(r => r.blob()).then(blob => {
      const ext = this.coverUrl!.match(/\.(jpg|jpeg|png|webp)($|\?)/i);
      this.saveFile(blob, Utils.sanitizeFilename(this.videoInfo!.title) + '_cover.' + (ext ? ext[1] : 'jpg'));
      UI.showAlert('封面下载完成', 'success');
    }).catch(e => UI.showAlert('下载封面失败: ' + e.message, 'error'));
  },

  downloadSubtitles(): void {
    if (this.availableSubtitles.length === 0) { UI.showAlert('没有可用的字幕', 'warning'); return; }
    UI.showAlert('正在下载字幕...', 'info');
    const promises = this.availableSubtitles.map(sub => {
      let url = sub.subtitle_url;
      if (!url.startsWith('http')) url = 'https:' + url;
      return fetch(url).then(r => r.json()).then(data => ({ lan: sub.lan_doc || sub.lan, data }));
    });
    Promise.all(promises).then(results => {
      results.forEach(r => {
        const srt = this.convertJsonToSrt(r.data);
        this.saveFile(new Blob([srt], { type: 'text/plain;charset=utf-8' }), Utils.sanitizeFilename(this.videoInfo!.title) + '_' + r.lan + '.srt');
      });
      UI.showAlert('字幕下载完成', 'success');
    }).catch(e => UI.showAlert('下载字幕失败: ' + e.message, 'error'));
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
    }).catch(e => UI.showAlert('下载弹幕失败: ' + e.message, 'error'));
  },

  convertJsonToSrt(jsonData: any): string {
    let srt = '';
    if (jsonData.body && Array.isArray(jsonData.body)) {
      jsonData.body.forEach((item: any, i: number) => {
        srt += (i + 1) + '\n' + this.formatSrtTime(item.from) + ' --> ' + this.formatSrtTime(item.to) + '\n' + item.content + '\n\n';
      });
    }
    return srt;
  },

  formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60), ms = Math.floor((seconds % 1) * 1000);
    return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')+','+String(ms).padStart(3,'0');
  },

  saveSeparate(videoBuffer: ArrayBuffer, audioBuffer: ArrayBuffer, filename: string): void {
    this.saveFile(videoBuffer, filename + '_video.mp4');
    setTimeout(() => this.saveFile(audioBuffer, filename + '_audio.m4a'), 500);
  },

  saveFile(buffer: ArrayBuffer | Blob, filename: string): void {
    const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }
};
