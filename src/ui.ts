import { STYLES } from './styles.ts';
import { Utils } from './utils.ts';
import { BiliAPI } from './api.ts';
import type { VideoInfo, PageInfo, QualityItem, VideoCodecItem, AudioCodecItem, UGCEpisode } from './types.ts';

declare function GM_addStyle(css: string): void;

export const UI = {
  elements: {} as Record<string, any>,
  pagesSectionEnabled: false,
  ugcSectionEnabled: false,

  init(): void { GM_addStyle(STYLES); this.createPanel(); },

  createPanel(): void {
    const panel = document.createElement('div');
    panel.id = 'bdl-panel';
    panel.innerHTML = '<button id="bdl-main-btn" title="下载视频">' +
                '<div id="bdl-progress-circle"></div>' +
                '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14l-4-4h3V8h2v4h3l-4 4z"/></svg>' +
                '</button>' +
                '<div class="bdl-popup" id="bdl-popup">' +
                '<div class="bdl-header">' +
                '<span class="bdl-header-title"><span>📥</span><span>视频下载助手</span></span>' +
                '<button class="bdl-close" id="bdl-close">×</button>' +
                '</div>' +
                '<div class="bdl-body">' +
                '<div class="bdl-info-card">' +
                '<div class="bdl-info-title" id="bdl-title">加载中...</div>' +
                '<div class="bdl-info-meta">' +
                '<span class="bdl-info-meta-item" id="bdl-author"><span>👤</span><span>--</span></span>' +
                '<span class="bdl-info-meta-item" id="bdl-duration"><span>⏱</span><span>--</span></span>' +
                '<span class="bdl-info-meta-item" id="bdl-vip"></span>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section" id="bdl-pages-section">' +
                '<div class="bdl-section-header">' +
                '<span class="bdl-section-title">选择分P</span>' +
                '<span style="font-size: 12px; color: #999;" id="bdl-pages-count"></span>' +
                '</div>' +
                '<div class="bdl-pages-container" id="bdl-pages-list"></div>' +
                '<div class="bdl-pages-actions">' +
                '<button id="bdl-select-all">全选</button>' +
                '<button id="bdl-select-none">取消全选</button>' +
                '<button id="bdl-select-reverse">反选</button>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section" id="bdl-ugc-section">' +
                '<div class="bdl-section-header">' +
                '<span class="bdl-section-title">选择合集</span>' +
                '<span style="font-size: 12px; color: #999;" id="bdl-ugc-count"></span>' +
                '</div>' +
                '<div class="bdl-pages-container" id="bdl-ugc-list"></div>' +
                '<div class="bdl-pages-actions">' +
                '<button id="bdl-ugc-select-all">全选</button>' +
                '<button id="bdl-ugc-select-none">取消全选</button>' +
                '<button id="bdl-ugc-select-reverse">反选</button>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section">' +
                '<div class="bdl-section-header"><span class="bdl-section-title">选择清晰度</span></div>' +
                '<div class="bdl-quality-grid" id="bdl-qualities"><button class="bdl-quality-btn">加载中</button></div>' +
                '</div>' +
                '<div class="bdl-section bdl-codec-selector">' +
                '<div class="bdl-section-header"><span class="bdl-section-title">编码格式</span></div>' +
                '<div class="bdl-codec-grid">' +
                '<div class="bdl-codec-item">' +
                '<span class="bdl-codec-label">视频编码</span>' +
                '<select class="bdl-codec-select" id="bdl-video-codec"></select>' +
                '</div>' +
                '<div class="bdl-codec-item">' +
                '<span class="bdl-codec-label">音频编码</span>' +
                '<select class="bdl-codec-select" id="bdl-audio-codec"></select>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-section">' +
                '<div class="bdl-section-header"><span class="bdl-section-title">合并方式</span></div>' +
                '<div class="bdl-method-list" id="bdl-methods">' +
                '<div class="bdl-method-item active" data-method="js-merge">' +
                '<div class="bdl-method-radio"></div>' +
                '<div class="bdl-method-content">' +
                '<div class="bdl-method-name">JS原生合并<span class="bdl-badge recommended">推荐</span></div>' +
                '<div class="bdl-method-desc">浏览器内直接合并，无需加载额外资源</div>' +
                '</div>' +
                '<span class="bdl-method-status ready">就绪</span>' +
                '</div>' +
                '<div class="bdl-method-item" data-method="ffmpeg-merge">' +
                '<div class="bdl-method-radio"></div>' +
                '<div class="bdl-method-content">' +
                '<div class="bdl-method-name">FFmpeg合并</div>' +
                '<div class="bdl-method-desc">使用FFmpeg进行专业合并</div>' +
                '</div>' +
                '<span class="bdl-method-status loading">加载中</span>' +
                '</div>' +
                '<div class="bdl-method-item" data-method="separate">' +
                '<div class="bdl-method-radio"></div>' +
                '<div class="bdl-method-content">' +
                '<div class="bdl-method-name">分离下载</div>' +
                '<div class="bdl-method-desc">分别保存视频和音频，可用其他工具合并</div>' +
                '</div>' +
                '<span class="bdl-method-status ready">就绪</span>' +
                '</div>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-extra-downloads" id="bdl-extra-downloads"></div>' +
                '<div class="bdl-tips" id="bdl-tips" style="display:none;">' +
                '<div class="bdl-tips-title">💡 提示</div>' +
                '<div id="bdl-tips-content"></div>' +
                '</div>' +
                '<div class="bdl-progress-section" id="bdl-progress">' +
                '<div class="bdl-progress-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">📹 视频</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-video-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar video" id="bdl-progress-video"></div></div>' +
                '</div>' +
                '<div class="bdl-progress-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">🎵 音频</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-audio-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar audio" id="bdl-progress-audio"></div></div>' +
                '</div>' +
                '<div class="bdl-progress-row" id="bdl-merge-row">' +
                '<div class="bdl-progress-header">' +
                '<span class="bdl-progress-label">🔧 合并</span>' +
                '<span class="bdl-progress-value" id="bdl-progress-merge-text">0%</span>' +
                '</div>' +
                '<div class="bdl-progress-track"><div class="bdl-progress-bar merge" id="bdl-progress-merge"></div></div>' +
                '</div>' +
                '</div>' +
                '<div class="bdl-alert" id="bdl-alert"></div>' +
                '<button class="bdl-download-btn" id="bdl-download"><span>开始下载</span></button>' +
                '</div>' +
                '<div class="bdl-footer" id="bdl-footer">本工具仅供学习研究使用，请支持正版内容创作者</div>' +
                '</div>';
    document.body.appendChild(panel);
    const g = (id: string) => document.getElementById(id);
    this.elements = { panel, btn: g('bdl-main-btn'), popup: g('bdl-popup'), close: g('bdl-close'), title: g('bdl-title'), author: g('bdl-author'), duration: g('bdl-duration'), vip: g('bdl-vip'), pagesSection: g('bdl-pages-section'), pagesList: g('bdl-pages-list'), pagesCount: g('bdl-pages-count'), selectAll: g('bdl-select-all'), selectNone: g('bdl-select-none'), selectReverse: g('bdl-select-reverse'), ugcSection: g('bdl-ugc-section'), ugcList: g('bdl-ugc-list'), ugcCount: g('bdl-ugc-count'), ugcSelectAll: g('bdl-ugc-select-all'), ugcSelectNone: g('bdl-ugc-select-none'), ugcSelectReverse: g('bdl-ugc-select-reverse'), qualities: g('bdl-qualities'), videoCodec: g('bdl-video-codec'), audioCodec: g('bdl-audio-codec'), methods: g('bdl-methods'), extraDownloads: g('bdl-extra-downloads'), progress: g('bdl-progress'), progressVideo: g('bdl-progress-video'), progressVideoText: g('bdl-progress-video-text'), progressAudio: g('bdl-progress-audio'), progressAudioText: g('bdl-progress-audio-text'), progressMerge: g('bdl-progress-merge'), progressMergeText: g('bdl-progress-merge-text'), mergeRow: g('bdl-merge-row'), alert: g('bdl-alert'), download: g('bdl-download'), tips: g('bdl-tips'), tipsContent: g('bdl-tips-content'), progressCircle: g('bdl-progress-circle'), footer: g('bdl-footer') };
  },
  updateVideoInfo(videoInfo, pageInfo, vipType) {
    let title = videoInfo.title;
    if (videoInfo.pages.length > 1 && pageInfo.part) title += " - " + pageInfo.part;
    this.elements.title.textContent = title;
    this.elements.title.title = title;
    this.elements.author.innerHTML = "<span>👤</span><span>" + videoInfo.owner.name + "</span>";
    this.elements.duration.innerHTML = "<span>⏱</span><span>" + Utils.formatDuration(videoInfo.duration) + "</span>";
    let b = "";
    if (vipType === 0) b = "<span class=\"bdl-vip-badge guest\">游客</span>";
    else if (vipType === 1) b = "<span class=\"bdl-vip-badge normal\">会员</span>";
    else if (vipType === 2) b = "<span class=\"bdl-vip-badge vip\">大会员</span>";
    this.elements.vip.innerHTML = b;
  },

  preparePagesSection(pages, currentIndex, onUpdate) {
    this.pagesSectionEnabled = true;
    this.elements.pagesCount.textContent = "共" + pages.length + "个分P";
    this.elements.pagesList.innerHTML = "";
    pages.forEach((page, index) => {
      const item = document.createElement("div");
      item.className = "bdl-page-item" + (index === currentIndex ? " active" : "");
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "bdl-page-checkbox";
      cb.dataset.index = String(index); cb.checked = index === currentIndex;
      const info = document.createElement("div"); info.className = "bdl-page-info";
      const num = document.createElement("div"); num.className = "bdl-page-num"; num.textContent = "P" + page.page;
      const pt = document.createElement("div"); pt.className = "bdl-page-title";
      pt.textContent = pt.title = page.part || "第" + page.page + "话";
      info.appendChild(num); info.appendChild(pt);
      const dur = document.createElement("span"); dur.className = "bdl-page-duration";
      dur.textContent = Utils.formatDuration(page.duration);
      item.appendChild(cb); item.appendChild(info); item.appendChild(dur);
      cb.addEventListener("change", onUpdate);
      item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; onUpdate(); } });
      this.elements.pagesList.appendChild(item);
    });
  },

  prepareUGCSection(episodes, onUpdate) {
    this.ugcSectionEnabled = true;
    this.elements.ugcCount.textContent = "共" + episodes.length + "个视频";
    this.elements.ugcList.innerHTML = "";
    episodes.forEach((ep, index) => {
      const item = document.createElement("div"); item.className = "bdl-page-item";
      const cb = document.createElement("input"); cb.type = "checkbox"; cb.className = "bdl-page-checkbox";
      cb.dataset.index = String(index); cb.checked = false;
      const info = document.createElement("div"); info.className = "bdl-page-info";
      const num = document.createElement("div"); num.className = "bdl-page-num"; num.textContent = "E" + (index + 1);
      const et = document.createElement("div"); et.className = "bdl-page-title"; et.textContent = et.title = ep.title;
      info.appendChild(num); info.appendChild(et);
      const dur = document.createElement("span"); dur.className = "bdl-page-duration";
      dur.textContent = Utils.formatDuration(ep.arc.duration);
      item.appendChild(cb); item.appendChild(info); item.appendChild(dur);
      cb.addEventListener("change", onUpdate);
      item.addEventListener("click", e => { if (e.target !== cb) { cb.checked = !cb.checked; onUpdate(); } });
      this.elements.ugcList.appendChild(item);
    });
  },

  toggleExtendedSections() {
    const pv = this.elements.pagesSection.classList.contains("show");
    const uv = this.elements.ugcSection.classList.contains("show");
    if (pv || uv) { this.elements.pagesSection.classList.remove("show"); this.elements.ugcSection.classList.remove("show"); }
    else { if (this.pagesSectionEnabled) this.elements.pagesSection.classList.add("show"); if (this.ugcSectionEnabled) this.elements.ugcSection.classList.add("show"); }
  },
  hidePagesSection() { this.pagesSectionEnabled = false; this.elements.pagesSection.classList.remove("show"); },
  hideUGCSection() { this.ugcSectionEnabled = false; this.elements.ugcSection.classList.remove("show"); },

  updateQualities(qualities, currentQn, onSelect) {
    this.elements.qualities.innerHTML = "";
    qualities.forEach((q, index) => {
      const btn = document.createElement("button");
      btn.className = "bdl-quality-btn" + (!q.available ? " disabled" : "");
      if ((q.qn === currentQn && q.available) || (index === 0 && q.available)) { btn.classList.add("active"); onSelect(q.qn); }
      btn.textContent = q.desc; btn.dataset.qn = String(q.qn);
      btn.addEventListener("click", () => {
        if (!q.available) { const t = BiliAPI.userVipType === 0 ? "游客" : BiliAPI.userVipType === 1 ? "普通会员" : "大会员"; this.showAlert("当前账号(" + t + ")无权限观看此清晰度", "warning"); return; }
        document.querySelectorAll(".bdl-quality-btn").forEach(b => b.classList.remove("active")); btn.classList.add("active"); onSelect(q.qn);
      });
      this.elements.qualities.appendChild(btn);
    });
  },

  updateCodecSelectors(videoCodecs, audioCodecs) {
    this.elements.videoCodec.innerHTML = "";
    videoCodecs.forEach((c, i) => { const o = document.createElement("option"); o.value = c.type; o.textContent = c.name; if (i === 0) o.selected = true; this.elements.videoCodec.appendChild(o); });
    this.elements.audioCodec.innerHTML = "";
    audioCodecs.forEach((c, i) => { const o = document.createElement("option"); o.value = String(c.id); o.textContent = c.name; if (i === 0) o.selected = true; this.elements.audioCodec.appendChild(o); });
  },

  updateExtraDownloads(hasSubtitles, hasDanmaku, hasCover, onCover, onSubtitles, onDanmaku) {
    this.elements.extraDownloads.innerHTML = "";
    if (hasCover) { const b = document.createElement("button"); b.className = "bdl-extra-btn"; b.innerHTML = "<span>🖼️</span><span>下载封面</span>"; b.addEventListener("click", onCover); this.elements.extraDownloads.appendChild(b); }
    if (hasSubtitles) { const b = document.createElement("button"); b.className = "bdl-extra-btn"; b.innerHTML = "<span>📝</span><span>下载字幕</span>"; b.addEventListener("click", onSubtitles); this.elements.extraDownloads.appendChild(b); }
    if (hasDanmaku) { const b = document.createElement("button"); b.className = "bdl-extra-btn"; b.innerHTML = "<span>💬</span><span>下载弹幕</span>"; b.addEventListener("click", onDanmaku); this.elements.extraDownloads.appendChild(b); }
  },

  showProgress(show) {
    if (show) { this.elements.progress.classList.add("show"); this.updateProgress("video",0); this.updateProgress("audio",0); this.updateProgress("merge",0); }
    else { this.elements.progress.classList.remove("show"); }
  },

  updateProgress(type, percent, label) {
    const id = "progress" + type.charAt(0).toUpperCase() + type.slice(1);
    const bar = this.elements[id]; const txt = this.elements[id + "Text"];
    if (bar) bar.style.width = percent + "%";
    if (txt) txt.textContent = label || (percent + "%");
  },

  updateCircleProgress(p) { if (this.elements.progressCircle) this.elements.progressCircle.style.height = p + "%"; },
  showAlert(msg, type) { this.elements.alert.textContent = msg; this.elements.alert.className = "bdl-alert show " + type; },
  hideAlert() { this.elements.alert.className = "bdl-alert"; },
  hideTips() { this.elements.tips.style.display = "none"; },

  setDownloading(v) {
    this.elements.download.disabled = v;
    this.elements.download.innerHTML = v ? "<span class=\"bdl-spinner\"></span><span>下载中...</span>" : "<span>开始下载</span>";
    this.elements.btn.disabled = v;
  }
};