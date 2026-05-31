// ==UserScript==
// @name         视频下载助手 - 多平台
// @namespace    https://github.com/MakotoArai-CN/video-download-helper
// @version      0.2.0
// @description  支持哔哩哔哩原生下载，以及抖音、快手、小红书、微博、今日头条、皮皮虾、皮皮搞笑等站点的内容解析下载，脚本仅供学习研究使用。
// @author       Makoto
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/bangumi/play/*
// @match        *://douyin.com/*
// @match        *://*.douyin.com/*
// @match        *://iesdouyin.com/*
// @match        *://*.iesdouyin.com/*
// @match        *://kuaishou.com/*
// @match        *://*.kuaishou.com/*
// @match        *://xiaohongshu.com/*
// @match        *://*.xiaohongshu.com/*
// @match        *://xhslink.com/*
// @match        *://*.xhslink.com/*
// @match        *://xhs.cn/*
// @match        *://*.xhs.cn/*
// @match        *://weibo.com/*
// @match        *://*.weibo.com/*
// @match        *://weibo.cn/*
// @match        *://*.weibo.cn/*
// @match        *://toutiao.com/*
// @match        *://*.toutiao.com/*
// @match        *://pipix.com/*
// @match        *://*.pipix.com/*
// @match        *://ippzone.com/*
// @match        *://*.ippzone.com/*
// @match        *://pipigx.com/*
// @match        *://*.pipigx.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @icon         https://www.bilibili.com/favicon.ico
// @grant        unsafeWindow
// @connect      api.bilibili.com
// @connect      bilivideo.com
// @connect      bilivideo.cn
// @connect      bilivideo.net
// @connect      akamaized.net
// @connect      api.bugpk.com
// @connect      *
// @run-at       document-start
// @license      MIT
// ==/UserScript==
(function() {
	"use strict";
	//#region src/utils.ts
	var Utils = {
		getVideoId() {
			const pathname = window.location.pathname;
			const bvidMatch = pathname.match(/\/video\/(BV[\w]+)/i);
			if (bvidMatch) return {
				type: "video",
				id: bvidMatch[1]
			};
			const epMatch = pathname.match(/\/bangumi\/play\/ep(\d+)/i);
			if (epMatch) return {
				type: "bangumi",
				id: "ep" + epMatch[1]
			};
			const ssMatch = pathname.match(/\/bangumi\/play\/ss(\d+)/i);
			if (ssMatch) return {
				type: "bangumi",
				id: "ss" + ssMatch[1]
			};
			return null;
		},
		getSiteContext() {
			const host = window.location.hostname.toLowerCase();
			const videoId = this.getVideoId();
			if (host.endsWith("bilibili.com") && videoId) return {
				kind: "bilibili",
				platform: "bilibili",
				sourceType: videoId.type
			};
			if (host.endsWith("douyin.com") || host.endsWith("iesdouyin.com")) return {
				kind: "short-video",
				platform: "douyin"
			};
			if (host.endsWith("kuaishou.com")) return {
				kind: "short-video",
				platform: "kuaishou"
			};
			if (host.endsWith("xiaohongshu.com") || host.endsWith("xhslink.com") || host.endsWith("xhs.cn")) return {
				kind: "short-video",
				platform: "xiaohongshu"
			};
			if (host.endsWith("weibo.com") || host.endsWith("weibo.cn")) return {
				kind: "short-video",
				platform: "weibo"
			};
			if (host.endsWith("toutiao.com")) return {
				kind: "short-video",
				platform: "toutiao"
			};
			if (host.endsWith("pipix.com")) return {
				kind: "short-video",
				platform: "pipixia"
			};
			if (host.endsWith("ippzone.com") || host.endsWith("pipigx.com")) return {
				kind: "short-video",
				platform: "pipigx"
			};
			return {
				kind: "unsupported",
				platform: null
			};
		},
		getCurrentPage() {
			const urlParams = new URLSearchParams(window.location.search);
			return parseInt(urlParams.get("p") || "1") || 1;
		},
		formatDuration(seconds) {
			if (!seconds) return "00:00";
			const h = Math.floor(seconds / 3600);
			const m = Math.floor(seconds % 3600 / 60);
			const s = Math.floor(seconds % 60);
			if (h > 0) return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
			return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
		},
		formatDurationMs(milliseconds) {
			if (!milliseconds) return "--";
			return this.formatDuration(milliseconds >= 1e3 ? Math.round(milliseconds / 1e3) : milliseconds);
		},
		formatBytes(bytes) {
			if (!bytes) return "0 B";
			const k = 1024;
			const sizes = [
				"B",
				"KB",
				"MB",
				"GB"
			];
			const i = Math.floor(Math.log(bytes) / Math.log(k));
			return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
		},
		sanitizeFilename(filename) {
			return filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().substring(0, 180);
		},
		inferExtension(url, fallback) {
			const match = url.split("#")[0].split("?")[0].match(/\.([a-zA-Z0-9]{2,6})$/);
			if (!match) return fallback;
			return match[1].toLowerCase();
		},
		getShortVideoFilename(title, author) {
			const parts = [title, author].filter(Boolean).join(" - ");
			return this.sanitizeFilename(parts || "short-video");
		},
		delay(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		},
		getCPUCores() {
			return navigator.hardwareConcurrency || 2;
		},
		getOptimalThreads() {
			const cores = this.getCPUCores();
			if (cores <= 4) return 1;
			return Math.floor(cores * .6 / 2) * 2;
		}
	};
	//#endregion
	//#region src/network.ts
	var Network = {
		fetchJSON(url, headers) {
			return new Promise((resolve, reject) => {
				GM_xmlhttpRequest({
					method: "GET",
					url,
					headers: {
						"Referer": "https://www.bilibili.com",
						"User-Agent": navigator.userAgent,
						...headers
					},
					responseType: "json",
					onload(res) {
						if (res.status >= 200 && res.status < 300) {
							let data = res.response;
							if (typeof data === "string") data = JSON.parse(data);
							resolve(data);
						} else reject(/* @__PURE__ */ new Error("HTTP " + res.status));
					},
					onerror() {
						reject(/* @__PURE__ */ new Error("网络错误"));
					},
					ontimeout() {
						reject(/* @__PURE__ */ new Error("请求超时"));
					}
				});
			});
		},
		downloadBuffer(url, onProgress, headers) {
			return new Promise((resolve, reject) => {
				GM_xmlhttpRequest({
					method: "GET",
					url,
					headers: {
						"Referer": "https://www.bilibili.com",
						"Origin": "https://www.bilibili.com",
						"User-Agent": navigator.userAgent,
						...headers
					},
					responseType: "arraybuffer",
					onprogress(e) {
						if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
					},
					onload(res) {
						if (res.status >= 200 && res.status < 300) resolve(res.response);
						else reject(/* @__PURE__ */ new Error("下载失败: " + res.status));
					},
					onerror() {
						reject(/* @__PURE__ */ new Error("下载网络错误"));
					},
					ontimeout() {
						reject(/* @__PURE__ */ new Error("下载超时"));
					}
				});
			});
		},
		downloadBlob(url, onProgress, headers) {
			return new Promise((resolve, reject) => {
				GM_xmlhttpRequest({
					method: "GET",
					url,
					headers: {
						"Referer": "https://www.bilibili.com",
						"Origin": "https://www.bilibili.com",
						"User-Agent": navigator.userAgent,
						...headers
					},
					responseType: "blob",
					onprogress(e) {
						if (e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
					},
					onload(res) {
						if (res.status >= 200 && res.status < 300) resolve(res.response);
						else reject(/* @__PURE__ */ new Error("下载失败: " + res.status));
					},
					onerror() {
						reject(/* @__PURE__ */ new Error("下载网络错误"));
					},
					ontimeout() {
						reject(/* @__PURE__ */ new Error("下载超时"));
					}
				});
			});
		},
		fetchFileWithProgress(url, onProgress, headers) {
			return fetch(url, { headers: {
				"Referer": "https://www.bilibili.com",
				"Origin": "https://www.bilibili.com",
				...headers
			} }).then((response) => {
				const reader = response.body.getReader();
				const contentLength = parseInt(response.headers.get("Content-Length") || "0");
				if (!contentLength) return response.arrayBuffer().then((data) => new Uint8Array(data));
				let receivedLength = 0;
				const chunks = [];
				function processChunk(result) {
					if (result.done) {
						const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
						const combined = new Uint8Array(totalLength);
						let position = 0;
						for (const chunk of chunks) {
							combined.set(chunk, position);
							position += chunk.length;
						}
						return combined;
					}
					const chunk = result.value;
					chunks.push(chunk);
					receivedLength += chunk.length;
					if (onProgress) onProgress(receivedLength, contentLength);
					return reader.read().then(processChunk);
				}
				return reader.read().then(processChunk);
			});
		}
	};
	//#endregion
	//#region src/thread-manager.ts
	var ThreadManager = {
		maxThreads: 1,
		activeThreads: 0,
		queue: [],
		init() {
			const cores = Utils.getCPUCores();
			if (cores <= 4) this.maxThreads = 1;
			else {
				this.maxThreads = Math.floor(cores * .6);
				if (this.maxThreads % 2 !== 0) this.maxThreads -= 1;
			}
			console.log("线程管理器初始化，最大线程数:", this.maxThreads);
		},
		canRunTask() {
			return this.activeThreads < this.maxThreads;
		},
		runTask(task) {
			if (this.canRunTask()) {
				this.activeThreads++;
				return task().finally(() => {
					this.activeThreads--;
					this.processQueue();
				});
			} else return new Promise((resolve, reject) => {
				this.queue.push(() => task().then(resolve).catch(reject));
			});
		},
		processQueue() {
			if (this.queue.length > 0 && this.canRunTask()) {
				const nextTask = this.queue.shift();
				this.activeThreads++;
				nextTask().finally(() => {
					this.activeThreads--;
					this.processQueue();
				});
			}
		},
		downloadWithThread(videoUrl, audioUrl, onVideoProgress, onAudioProgress) {
			let videoPromise;
			let audioPromise;
			if (this.maxThreads > 1) {
				videoPromise = this.runTask(() => Network.downloadBuffer(videoUrl, onVideoProgress));
				audioPromise = audioUrl ? this.runTask(() => Network.downloadBuffer(audioUrl, onAudioProgress)) : Promise.resolve(null);
			} else {
				videoPromise = Network.downloadBuffer(videoUrl, onVideoProgress);
				audioPromise = audioUrl ? videoPromise.then(() => Network.downloadBuffer(audioUrl, onAudioProgress)) : Promise.resolve(null);
			}
			return Promise.all([videoPromise, audioPromise]).then(([videoBuffer, audioBuffer]) => ({
				videoBuffer,
				audioBuffer
			}));
		}
	};
	//#endregion
	//#region src/styles.ts
	var STYLES = `
        :host {
            all: initial;
            color-scheme: light;
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
            line-height: 1.4;
            -webkit-font-smoothing: antialiased;
            text-rendering: optimizeLegibility;
        }

        :host,
        :host * {
            box-sizing: border-box;
        }

        :host button,
        :host input,
        :host select {
            font: inherit;
        }

        #bdl-entry,
        .bdl-popup,
        .bdl-complete-overlay {
            pointer-events: auto;
        }

        #bdl-panel {
            position: fixed;
            right: 20px;
            bottom: 80px;
            z-index: 100000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        }

        #bdl-main-btn {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            border: none;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(0, 161, 214, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }

        #bdl-main-btn:hover {
            transform: scale(1.08) translateY(-2px);
            box-shadow: 0 6px 25px rgba(0, 161, 214, 0.6);
        }

        #bdl-main-btn:active {
            transform: scale(1.02);
        }

        #bdl-main-btn:disabled {
            cursor: not-allowed;
        }

        #bdl-main-btn svg {
            width: 30px;
            height: 30px;
            fill: white;
            position: relative;
            z-index: 2;
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        #bdl-main-btn:hover svg {
            transform: translateY(-1px);
        }

        #bdl-progress-circle {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            background: linear-gradient(180deg, #fb7299 0%, #f25d8e 100%);
            transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            height: 0%;
            border-radius: 0 0 30px 30px;
            overflow: hidden;
            box-shadow: 0 -2px 10px rgba(251, 114, 153, 0.3) inset;
        }

        #bdl-progress-circle::before {
            content: '';
            position: absolute;
            top: -15px;
            left: -50%;
            width: 200%;
            height: 30px;
            background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.5) 0%, transparent 50%);
            border-radius: 45%;
            animation: bdlCircleWave 2.5s ease-in-out infinite;
        }

        #bdl-progress-circle::after {
            content: '';
            position: absolute;
            top: -12px;
            left: -50%;
            width: 200%;
            height: 25px;
            background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.3) 0%, transparent 50%);
            border-radius: 40%;
            animation: bdlCircleWave 3s ease-in-out infinite reverse;
        }

        @keyframes bdlCircleWave {
            0%, 100% {
                transform: translateX(0) translateY(0) rotate(0deg);
            }
            25% {
                transform: translateX(-15%) translateY(-2px) rotate(-2deg);
            }
            50% {
                transform: translateX(-25%) translateY(-4px) rotate(0deg);
            }
            75% {
                transform: translateX(-35%) translateY(-2px) rotate(2deg);
            }
        }

        .bdl-progress-bubble {
            position: absolute;
            bottom: 0;
            width: 4px;
            height: 4px;
            background: rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            animation: bdlBubbleRise 3s ease-in infinite;
            opacity: 0;
        }

        .bdl-progress-bubble:nth-child(1) {
            left: 20%;
            animation-delay: 0s;
            animation-duration: 2.5s;
        }

        .bdl-progress-bubble:nth-child(2) {
            left: 50%;
            animation-delay: 0.8s;
            animation-duration: 3s;
        }

        .bdl-progress-bubble:nth-child(3) {
            left: 70%;
            animation-delay: 1.5s;
            animation-duration: 2.8s;
        }

        @keyframes bdlBubbleRise {
            0% {
                bottom: 0;
                opacity: 0;
                transform: translateX(0) scale(0.5);
            }
            10% {
                opacity: 1;
            }
            50% {
                opacity: 0.8;
                transform: translateX(10px) scale(1);
            }
            100% {
                bottom: 100%;
                opacity: 0;
                transform: translateX(-10px) scale(0.5);
            }
        }

        .bdl-popup {
            position: absolute;
            bottom: 75px;
            right: 0;
            width: 420px;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 10px 50px rgba(0, 0, 0, 0.2);
            display: none;
            overflow: hidden;
        }

        .bdl-popup.show {
            display: block;
            animation: bdlFadeIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes bdlFadeIn {
            from { 
                opacity: 0; 
                transform: translateY(10px) scale(0.98); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0) scale(1); 
            }
        }

        @keyframes bdlFadeOut {
            from { opacity: 1; transform: scale(1); }
            to { opacity: 0; transform: scale(0.95); }
        }

        .bdl-header {
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            color: white;
            padding: 18px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .bdl-header-title {
            font-size: 17px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bdl-close {
            width: 30px;
            height: 30px;
            border: none;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            cursor: pointer;
            font-size: 18px;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .bdl-close:hover {
            background: rgba(255,255,255,0.3);
            transform: rotate(90deg);
        }

        .bdl-body {
            padding: 20px;
            max-height: 65vh;
            overflow-y: auto;
        }

        .bdl-info-card {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 18px;
        }

        .bdl-info-title {
            font-size: 15px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            line-height: 1.5;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .bdl-info-meta {
            display: flex;
            gap: 15px;
            font-size: 13px;
            color: #666;
        }

        .bdl-info-meta-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .bdl-vip-badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 4px;
            font-weight: 600;
            margin-left: 5px;
        }

        .bdl-vip-badge.guest {
            background: #ccc;
            color: #666;
        }

        .bdl-vip-badge.normal {
            background: #ff9eb5;
            color: white;
        }

        .bdl-vip-badge.vip {
            background: #fb7299;
            color: white;
        }

        .bdl-section {
            margin-bottom: 18px;
        }

        .bdl-section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .bdl-section-title {
            font-size: 14px;
            font-weight: 600;
            color: #444;
        }

        .bdl-pages-container {
            max-height: 200px;
            overflow-y: auto;
            border: 1px solid #e8e8e8;
            border-radius: 10px;
            padding: 10px;
            background: #fafafa;
        }

        .bdl-page-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 8px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }

        .bdl-page-item:last-child {
            margin-bottom: 0;
        }

        .bdl-page-item:hover {
            border-color: #00a1d6;
        }

        .bdl-page-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
        }

        .bdl-page-checkbox {
            width: 18px;
            height: 18px;
            margin-right: 12px;
            cursor: pointer;
            accent-color: #00a1d6;
        }

        .bdl-page-info {
            flex: 1;
            min-width: 0;
        }

        .bdl-page-num {
            font-size: 12px;
            color: #999;
            margin-bottom: 3px;
        }

        .bdl-page-title {
            font-size: 13px;
            color: #333;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .bdl-page-duration {
            font-size: 12px;
            color: #999;
            margin-left: 10px;
        }

        .bdl-short-items-section {
            display: none;
        }

        .bdl-short-items-section.show {
            display: block;
        }

        .bdl-short-items {
            max-height: 180px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            border: 1px solid #e8e8e8;
            border-radius: 10px;
            background: #fafafa;
        }

        .bdl-short-item {
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            background: #fff;
            color: #333;
            cursor: pointer;
            text-align: left;
            transition: all 0.2s;
        }

        .bdl-short-item:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-short-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
        }

        .bdl-short-item-mark {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 42px;
            height: 24px;
            padding: 0 8px;
            border-radius: 999px;
            background: rgba(0, 161, 214, 0.1);
            color: #0081b3;
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-short-item-title {
            min-width: 0;
            flex: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            font-size: 13px;
        }

        .bdl-pages-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .bdl-pages-actions button {
            flex: 1;
            padding: 8px;
            border: 1px solid #00a1d6;
            border-radius: 6px;
            background: white;
            color: #00a1d6;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-pages-actions button:hover {
            background: #00a1d6;
            color: white;
        }

        .bdl-quality-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
        }

        .bdl-quality-btn {
            padding: 10px 8px;
            border: 2px solid #e8e8e8;
            border-radius: 10px;
            background: white;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            text-align: center;
            color: #555;
        }

        .bdl-quality-btn:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-quality-btn.active {
            border-color: #00a1d6;
            background: #00a1d6;
            color: white;
        }

        .bdl-quality-btn.disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }

        .bdl-codec-selector {
            margin-bottom: 18px;
        }

        .bdl-codec-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }

        .bdl-codec-item {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .bdl-codec-label {
            font-size: 12px;
            color: #666;
            font-weight: 500;
        }

        .bdl-codec-select {
            padding: 8px 10px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            background: white;
            font-size: 13px;
            color: #333;
            cursor: pointer;
            transition: all 0.2s;
        }

        .bdl-codec-select:hover {
            border-color: #00a1d6;
        }

        .bdl-codec-select:focus {
            outline: none;
            border-color: #00a1d6;
        }

        .bdl-method-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .bdl-method-item {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            border: 2px solid #e8e8e8;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s;
            background: white;
        }

        .bdl-method-item:hover {
            border-color: #00a1d6;
        }

        .bdl-method-item.active {
            border-color: #00a1d6;
            background: linear-gradient(135deg, rgba(0,161,214,0.08) 0%, rgba(0,129,179,0.08) 100%);
        }

        .bdl-method-radio {
            width: 20px;
            height: 20px;
            border: 2px solid #ccc;
            border-radius: 50%;
            margin-right: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .bdl-method-item.active .bdl-method-radio {
            border-color: #00a1d6;
        }

        .bdl-method-item.active .bdl-method-radio::after {
            content: '';
            width: 10px;
            height: 10px;
            background: #00a1d6;
            border-radius: 50%;
        }

        .bdl-method-content {
            flex: 1;
        }

        .bdl-method-name {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .bdl-method-desc {
            font-size: 12px;
            color: #888;
        }

        .bdl-method-status {
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 10px;
            font-weight: 500;
        }

        .bdl-method-status.ready {
            background: #d4edda;
            color: #155724;
        }

        .bdl-method-status.loading {
            background: #fff3cd;
            color: #856404;
        }

        .bdl-extra-downloads {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 18px;
        }

        .bdl-extra-btn {
            flex: 1;
            min-width: calc(50% - 4px);
            padding: 10px;
            border: 2px solid #e8e8e8;
            border-radius: 8px;
            background: white;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        .bdl-extra-btn:hover {
            border-color: #00a1d6;
            color: #00a1d6;
        }

        .bdl-progress-section {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 15px;
            margin-bottom: 18px;
            display: none;
        }

        .bdl-progress-section.show {
            display: block;
        }

        .bdl-progress-row {
            margin-bottom: 12px;
        }

        .bdl-progress-row:last-child {
            margin-bottom: 0;
        }

        .bdl-progress-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
            font-size: 13px;
        }

        .bdl-progress-label {
            color: #555;
            font-weight: 500;
        }

        .bdl-progress-value {
            color: #888;
        }

        .bdl-progress-track {
            height: 10px;
            background: #e0e0e0;
            border-radius: 5px;
            overflow: hidden;
            position: relative;
        }

        .bdl-progress-bar {
            height: 100%;
            border-radius: 5px;
            transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            width: 0%;
            position: relative;
            overflow: hidden;
            background: linear-gradient(90deg, #fb7299, #ff9eb5);
        }

        .bdl-progress-bar::before {
            content: '';
            position: absolute;
            top: -50%;
            left: 0;
            width: 100%;
            height: 200%;
            background: repeating-linear-gradient(
                90deg,
                transparent,
                transparent 10px,
                rgba(255,255,255,0.15) 10px,
                rgba(255,255,255,0.15) 20px
            );
            animation: bdlStripe 1s linear infinite;
        }

        .bdl-progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 50%;
            background: linear-gradient(to bottom, rgba(255,255,255,0.3), transparent);
            border-radius: 5px 5px 0 0;
        }

        @keyframes bdlStripe {
            0% {
                transform: translateX(-20px);
            }
            100% {
                transform: translateX(0);
            }
        }

        .bdl-progress-bar.video {
            background: linear-gradient(90deg, #fb7299, #ff9eb5);
        }

        .bdl-progress-bar.audio {
            background: linear-gradient(90deg, #00a1d6, #66d4ff);
        }

        .bdl-progress-bar.merge {
            background: linear-gradient(90deg, #fb7299, #00a1d6);
        }

        .bdl-alert {
            padding: 12px 15px;
            border-radius: 10px;
            font-size: 13px;
            margin-bottom: 18px;
            display: none;
            line-height: 1.5;
        }

        .bdl-alert.show {
            display: block;
        }

        .bdl-alert.info {
            background: #e6f7ff;
            border: 1px solid #91d5ff;
            color: #0050b3;
        }

        .bdl-alert.success {
            background: #fff0f6;
            border: 1px solid #ffadd2;
            color: #c41d7f;
        }

        .bdl-alert.warning {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            color: #ad6800;
        }

        .bdl-alert.error {
            background: #fff1f0;
            border: 1px solid #ffa39e;
            color: #cf1322;
        }

        .bdl-download-btn {
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: linear-gradient(135deg, #00a1d6 0%, #0081b3 100%);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            position: relative;
            overflow: hidden;
        }

        .bdl-download-progress-fill {
            position: absolute;
            inset: 0 auto 0 0;
            width: var(--bdl-download-progress, 0%);
            background: linear-gradient(90deg, rgba(255,255,255,0.24), rgba(255,255,255,0.36));
            transition: width 0.25s ease;
            pointer-events: none;
        }

        .bdl-download-label {
            position: relative;
            z-index: 1;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .bdl-download-btn.is-active.can-queue {
            cursor: pointer;
        }

        .bdl-download-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0, 161, 214, 0.4);
        }

        .bdl-download-btn:disabled {
            background: linear-gradient(135deg, #ccc 0%, #aaa 100%);
            cursor: not-allowed;
            transform: none;
        }

        .bdl-footer {
            text-align: center;
            padding: 15px 20px;
            background: #f8f9fa;
            font-size: 12px;
            color: #999;
            line-height: 1.6;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s;
        }

        .bdl-footer:hover {
            background: #f0f1f2;
            color: #666;
        }

        .bdl-tips {
            background: #fffbe6;
            border: 1px solid #ffe58f;
            border-radius: 10px;
            padding: 12px 15px;
            margin-bottom: 18px;
            font-size: 12px;
            color: #ad6800;
            line-height: 1.6;
        }

        .bdl-tips-title {
            font-weight: 600;
            margin-bottom: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .bdl-spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid #fff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: bdlSpin 0.8s linear infinite;
        }

        @keyframes bdlSpin {
            to { transform: rotate(360deg); }
        }

        .bdl-badge {
            display: inline-block;
            padding: 2px 6px;
            font-size: 10px;
            border-radius: 4px;
            font-weight: 600;
        }

        .bdl-badge.recommended {
            background: #52c41a;
            color: white;
        }

        .bdl-complete-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle at center, rgba(251, 114, 153, 0.15) 0%, rgba(0, 161, 214, 0.15) 100%);
            backdrop-filter: blur(8px);
            z-index: 100001;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bdlOverlayIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes bdlOverlayIn {
            from { 
                opacity: 0;
                backdrop-filter: blur(0px);
            }
            to { 
                opacity: 1;
                backdrop-filter: blur(8px);
            }
        }

        .bdl-complete-container {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .bdl-complete-icon {
            width: 140px;
            height: 140px;
            background: linear-gradient(135deg, #fb7299 0%, #f25d8e 50%, #00a1d6 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: bdlIconPop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 
                0 20px 60px rgba(251, 114, 153, 0.4),
                0 0 0 0 rgba(251, 114, 153, 0.4);
            position: relative;
            z-index: 2;
        }

        .bdl-complete-icon::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: linear-gradient(135deg, #fb7299 0%, #00a1d6 100%);
            animation: bdlIconPulse 2s ease-in-out infinite;
            z-index: -1;
        }

        @keyframes bdlIconPop {
            0% {
                transform: scale(0) rotate(-180deg);
                opacity: 0;
            }
            50% {
                transform: scale(1.15) rotate(10deg);
            }
            100% {
                transform: scale(1) rotate(0deg);
                opacity: 1;
            }
        }

        @keyframes bdlIconPulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(251, 114, 153, 0.7);
            }
            50% {
                box-shadow: 0 0 0 30px rgba(251, 114, 153, 0);
            }
        }

        .bdl-complete-icon svg {
            width: 80px;
            height: 80px;
            fill: none;
            stroke: white;
            stroke-width: 5;
            stroke-linecap: round;
            stroke-linejoin: round;
            filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.2));
        }

        .bdl-complete-icon svg path {
            stroke-dasharray: 80;
            stroke-dashoffset: 80;
            animation: bdlCheckDraw 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s forwards;
        }

        @keyframes bdlCheckDraw {
            to {
                stroke-dashoffset: 0;
            }
        }

        .bdl-complete-ripple {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 140px;
            height: 140px;
            margin: -70px 0 0 -70px;
            border-radius: 50%;
            border: 3px solid #fb7299;
            animation: bdlRippleOut 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            z-index: 1;
        }

        .bdl-complete-ripple:nth-child(2) {
            border-color: #00a1d6;
            animation-delay: 0.15s;
        }

        .bdl-complete-ripple:nth-child(3) {
            border-color: #fb7299;
            animation-delay: 0.3s;
        }

        @keyframes bdlRippleOut {
            0% {
                transform: scale(1);
                opacity: 1;
            }
            100% {
                transform: scale(2.8);
                opacity: 0;
            }
        }

        .bdl-complete-particles {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            z-index: 3;
        }

        .bdl-particle {
            position: absolute;
            border-radius: 50%;
            animation: bdlParticleFly 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes bdlParticleFly {
            0% {
                transform: translate(0, 0) scale(1) rotate(0deg);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0) rotate(360deg);
                opacity: 0;
            }
        }

        .bdl-complete-text {
            position: absolute;
            top: calc(50% + 110px);
            left: 50%;
            transform: translateX(-50%);
            font-size: 24px;
            font-weight: 700;
            background: linear-gradient(135deg, #fb7299 0%, #00a1d6 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 2px 20px rgba(251, 114, 153, 0.3);
            animation: bdlTextFade 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.5s both;
            white-space: nowrap;
            letter-spacing: 2px;
        }

        @keyframes bdlTextFade {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }

        .bdl-complete-sparkles {
            position: absolute;
            top: 50%;
            left: 50%;
            width: 200px;
            height: 200px;
            margin: -100px 0 0 -100px;
            z-index: 4;
        }

        .bdl-sparkle {
            position: absolute;
            width: 6px;
            height: 6px;
            background: linear-gradient(135deg, #fb7299, #00a1d6);
            clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%);
            animation: bdlSparkle 1.5s ease-in-out infinite;
            opacity: 0;
        }

        @keyframes bdlSparkle {
            0%, 100% {
                opacity: 0;
                transform: scale(0) rotate(0deg);
            }
            50% {
                opacity: 1;
                transform: scale(1) rotate(180deg);
            }
        }

        #bdl-pages-section {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s ease, 
                        margin-bottom 0.3s ease;
            margin-bottom: 0;
        }

        #bdl-pages-section.show {
            max-height: 500px;
            opacity: 1;
            margin-bottom: 18px;
        }

        #bdl-ugc-section {
            max-height: 0;
            overflow: hidden;
            opacity: 0;
            transition: max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), 
                        opacity 0.3s ease, 
                        margin-bottom 0.3s ease;
            margin-bottom: 0;
        }

        #bdl-ugc-section.show {
            max-height: 500px;
            opacity: 1;
            margin-bottom: 18px;
        }

        #bdl-panel,
        #bdl-entry {
            --bdl-brand: #fb7299;
            --bdl-brand-deep: #e85f8c;
            --bdl-brand-soft: rgba(251, 114, 153, 0.12);
            --bdl-border: rgba(24, 25, 28, 0.08);
            --bdl-border-strong: rgba(24, 25, 28, 0.12);
            --bdl-text: #18191c;
            --bdl-subtext: #61666d;
            --bdl-soft-text: #9499a0;
            --bdl-surface: #f6f7f8;
            --bdl-surface-strong: #f1f2f3;
            font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        #bdl-entry {
            display: none;
            flex: none;
            position: relative;
            margin-right: 16px;
        }

        #bdl-entry[data-mounted="true"] {
            display: flex;
        }

        #bdl-entry[data-mode="bangumi"] {
            align-items: center;
        }

        #bdl-entry[data-mode="video"],
        #bdl-entry[data-mode="bangumi"] {
            position: fixed;
            margin-right: 0;
            z-index: 100000;
        }

        #bdl-entry[data-mode="floating"] {
            position: fixed;
            right: 24px;
            bottom: 112px;
            margin-right: 0;
            z-index: 100000;
            touch-action: none;
            cursor: grab;
            user-select: none;
        }

        #bdl-entry[data-mode="floating"].is-dragging {
            cursor: grabbing;
        }

        #bdl-entry[data-mode="floating"] #bdl-main-btn {
            cursor: grab;
        }

        #bdl-entry[data-mode="floating"].is-dragging #bdl-main-btn {
            cursor: grabbing;
        }

        #bdl-main-btn {
            width: auto;
            height: 32px;
            padding: 0 14px 0 10px;
            border-radius: 999px;
            border: 1px solid transparent;
            background: transparent;
            box-shadow: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            color: var(--bdl-subtext);
            font-size: 13px;
            font-weight: 500;
            overflow: hidden;
        }

        #bdl-entry[data-mode="bangumi"] #bdl-main-btn {
            height: 30px;
            padding: 0 12px 0 8px;
        }

        #bdl-entry[data-mode="floating"] #bdl-main-btn {
            min-width: 88px;
            height: 40px;
            padding: 0 16px 0 12px;
            background: linear-gradient(180deg, #fb7299 0%, #f46290 100%);
            color: #fff;
            box-shadow: 0 12px 24px rgba(251, 114, 153, 0.28);
        }

        #bdl-entry[data-mode="floating"] #bdl-main-btn:hover {
            background: linear-gradient(180deg, #fb7299 0%, #ec5f8d 100%);
            color: #fff;
            border-color: transparent;
            box-shadow: 0 14px 28px rgba(251, 114, 153, 0.34);
        }

        #bdl-main-btn:hover {
            transform: none;
            box-shadow: none;
            color: var(--bdl-brand);
            background: var(--bdl-brand-soft);
            border-color: rgba(251, 114, 153, 0.2);
        }

        #bdl-main-btn:active {
            transform: scale(0.98);
        }

        #bdl-main-btn[aria-expanded="true"] {
            color: var(--bdl-brand);
            background: var(--bdl-brand-soft);
            border-color: rgba(251, 114, 153, 0.22);
        }

        #bdl-main-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        #bdl-main-btn svg {
            width: 18px;
            height: 18px;
            fill: currentColor;
            z-index: 2;
            position: relative;
        }

        #bdl-main-btn:hover svg {
            transform: none;
        }

        .bdl-toolbar-icon,
        .bdl-toolbar-text {
            position: relative;
            z-index: 2;
        }

        .bdl-toolbar-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
        }

        .bdl-toolbar-text {
            letter-spacing: 0.2px;
        }

        #bdl-progress-circle {
            position: absolute;
            inset: auto 0 0;
            width: 100%;
            height: 0%;
            border-radius: inherit;
            background: linear-gradient(180deg, rgba(16, 185, 129, 0.42) 0%, rgba(5, 150, 105, 0.86) 100%);
            box-shadow: 0 -1px 0 rgba(255, 255, 255, 0.55) inset;
            transition: height 0.25s ease;
            z-index: 1;
            pointer-events: none;
        }

        #bdl-entry.has-entry-progress[data-mode="floating"] #bdl-main-btn {
            background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
            box-shadow: 0 14px 28px rgba(17, 24, 39, 0.3);
        }

        #bdl-entry.has-entry-progress[data-mode="floating"] #bdl-main-btn:hover {
            background: linear-gradient(180deg, #111827 0%, #263244 100%);
            box-shadow: 0 16px 32px rgba(17, 24, 39, 0.36);
        }

        #bdl-progress-circle::before,
        #bdl-progress-circle::after {
            display: none;
        }

        #bdl-panel {
            position: static;
            inset: auto;
            z-index: 100000;
        }

        .bdl-popup {
            position: fixed;
            top: 0;
            left: 0;
            right: auto;
            bottom: auto;
            width: min(432px, calc(100vw - 24px));
            max-height: min(78vh, 760px);
            border-radius: 18px;
            border: 1px solid var(--bdl-border);
            background: #fff;
            box-shadow: 0 24px 56px rgba(0, 0, 0, 0.18);
            overflow: hidden;
            display: none;
            transform-origin: top right;
        }

        .bdl-popup.is-dragging {
            user-select: none;
            transition: none;
            cursor: grabbing;
        }

        .bdl-popup.show {
            display: flex;
            flex-direction: column;
            animation: bdlFadeIn 0.18s ease-out;
        }

        .bdl-header {
            background: linear-gradient(180deg, rgba(251, 114, 153, 0.12) 0%, rgba(251, 114, 153, 0.04) 100%);
            color: var(--bdl-text);
            border-bottom: 1px solid var(--bdl-border);
            padding: 16px 18px 14px;
            cursor: grab;
            user-select: none;
            touch-action: none;
        }

        .bdl-popup.is-dragging .bdl-header {
            cursor: grabbing;
        }

        .bdl-header-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--bdl-text);
            gap: 0;
        }

        .bdl-close {
            width: 30px;
            height: 30px;
            background: rgba(24, 25, 28, 0.05);
            color: var(--bdl-subtext);
            border-radius: 50%;
        }

        .bdl-close:hover {
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand);
            transform: none;
        }

        .bdl-body {
            padding: 16px 18px 18px;
            max-height: min(70vh, 660px);
            overflow-y: auto;
            background: #fff;
        }

        .bdl-body::-webkit-scrollbar,
        .bdl-pages-container::-webkit-scrollbar {
            width: 6px;
        }

        .bdl-body::-webkit-scrollbar-thumb,
        .bdl-pages-container::-webkit-scrollbar-thumb {
            background: rgba(24, 25, 28, 0.14);
            border-radius: 999px;
        }

        .bdl-info-card {
            background: linear-gradient(180deg, #fff 0%, #fafbfc 100%);
            border: 1px solid var(--bdl-border);
            border-radius: 16px;
            padding: 14px 14px 12px;
            margin-bottom: 16px;
        }

        .bdl-info-title {
            font-size: 16px;
            line-height: 1.6;
            color: var(--bdl-text);
            margin-bottom: 12px;
        }

        .bdl-info-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 12px;
            color: var(--bdl-subtext);
        }

        .bdl-info-meta-item {
            gap: 6px;
            padding: 6px 10px;
            border-radius: 999px;
            background: #fff;
            border: 1px solid var(--bdl-border);
        }

        .bdl-meta-label {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 20px;
            padding: 0 6px;
            border-radius: 999px;
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
            font-size: 11px;
            font-weight: 600;
            line-height: 20px;
        }

        .bdl-vip-badge {
            margin-left: 0;
            padding: 4px 8px;
            border-radius: 999px;
            font-size: 11px;
            line-height: 1;
        }

        .bdl-vip-badge.site {
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
        }

        .bdl-section {
            margin-bottom: 16px;
        }

        .bdl-section-header {
            margin-bottom: 10px;
        }

        .bdl-section-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--bdl-text);
        }

        .bdl-section-count {
            font-size: 12px;
            color: var(--bdl-soft-text);
        }

        .bdl-pages-container {
            max-height: 208px;
            padding: 10px;
            border: 1px solid var(--bdl-border);
            border-radius: 14px;
            background: var(--bdl-surface);
        }

        .bdl-page-item {
            padding: 11px 12px;
            margin-bottom: 8px;
            border: 1px solid transparent;
            border-radius: 12px;
            background: #fff;
        }

        .bdl-page-item:hover {
            border-color: rgba(251, 114, 153, 0.24);
            background: rgba(251, 114, 153, 0.04);
        }

        .bdl-page-item.active {
            border-color: rgba(251, 114, 153, 0.28);
            background: rgba(251, 114, 153, 0.08);
        }

        .bdl-page-checkbox {
            accent-color: var(--bdl-brand);
        }

        .bdl-page-num,
        .bdl-page-duration {
            color: var(--bdl-soft-text);
        }

        .bdl-page-title {
            color: var(--bdl-text);
        }

        .bdl-pages-actions {
            gap: 8px;
            margin-top: 10px;
        }

        .bdl-pages-actions button,
        .bdl-quality-btn,
        .bdl-extra-btn,
        .bdl-codec-select {
            border-radius: 12px;
            border: 1px solid var(--bdl-border);
            background: #fff;
            color: var(--bdl-subtext);
        }

        .bdl-pages-actions button {
            padding: 9px 8px;
            color: var(--bdl-subtext);
        }

        .bdl-pages-actions button:hover,
        .bdl-quality-btn:hover,
        .bdl-extra-btn:hover {
            background: var(--bdl-brand-soft);
            border-color: rgba(251, 114, 153, 0.24);
            color: var(--bdl-brand);
        }

        .bdl-quality-grid {
            gap: 8px;
        }

        .bdl-quality-btn {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-subtext);
        }

        .bdl-quality-btn.active {
            border-color: transparent;
            background: var(--bdl-brand);
            color: #fff;
        }

        .bdl-codec-label {
            color: var(--bdl-subtext);
        }

        .bdl-codec-select {
            min-height: 40px;
            border-width: 1px;
            color: var(--bdl-text);
        }

        .bdl-codec-select:hover,
        .bdl-codec-select:focus {
            border-color: rgba(251, 114, 153, 0.24);
        }

        .bdl-method-item {
            padding: 12px 14px;
            border-width: 1px;
            border-radius: 14px;
            background: #fff;
        }

        .bdl-method-item:hover {
            border-color: rgba(251, 114, 153, 0.24);
        }

        .bdl-method-item.active {
            border-color: rgba(251, 114, 153, 0.3);
            background: rgba(251, 114, 153, 0.06);
        }

        .bdl-method-radio {
            margin-right: 10px;
        }

        .bdl-method-item.active .bdl-method-radio {
            border-color: var(--bdl-brand);
        }

        .bdl-method-item.active .bdl-method-radio::after {
            background: var(--bdl-brand);
        }

        .bdl-method-name,
        .bdl-method-desc {
            color: var(--bdl-text);
        }

        .bdl-method-desc {
            color: var(--bdl-soft-text);
        }

        .bdl-method-status.ready {
            background: rgba(35, 173, 100, 0.12);
            color: #1f8a57;
        }

        .bdl-method-status.loading {
            background: rgba(255, 184, 72, 0.16);
            color: #b06f00;
        }

        .bdl-extra-downloads {
            gap: 8px;
            margin-bottom: 16px;
        }

        .bdl-extra-btn {
            min-width: calc(50% - 4px);
            min-height: 42px;
            padding: 10px 12px;
            justify-content: flex-start;
            gap: 10px;
        }

        .bdl-extra-btn-mark {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 34px;
            height: 22px;
            padding: 0 8px;
            border-radius: 999px;
            background: rgba(251, 114, 153, 0.12);
            color: var(--bdl-brand-deep);
            font-size: 11px;
            font-weight: 600;
        }

        .bdl-progress-section {
            padding: 14px;
            border: 1px solid var(--bdl-border);
            border-radius: 16px;
            background: linear-gradient(180deg, #fff 0%, #fafbfc 100%);
            margin-bottom: 16px;
        }

        .bdl-progress-label {
            color: var(--bdl-subtext);
        }

        .bdl-progress-track {
            background: rgba(24, 25, 28, 0.08);
        }

        .bdl-alert {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-download-btn {
            min-height: 46px;
            border-radius: 14px;
            background: linear-gradient(180deg, #fb7299 0%, #f46290 100%);
            box-shadow: 0 10px 24px rgba(251, 114, 153, 0.22);
        }

        .bdl-download-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(251, 114, 153, 0.28);
        }

        .bdl-footer {
            padding: 12px 18px 16px;
            background: #fff;
            border-top: 1px solid var(--bdl-border);
            color: var(--bdl-soft-text);
            cursor: default;
        }

        .bdl-footer:hover {
            background: #fff;
            color: var(--bdl-soft-text);
        }

        .bdl-tips {
            border-radius: 14px;
            margin-bottom: 16px;
        }

        .bdl-tips-title {
            gap: 0;
            color: #8a5a00;
        }

        #bdl-pages-section,
        #bdl-ugc-section {
            transition: max-height 0.25s ease, opacity 0.2s ease, margin-bottom 0.2s ease;
        }

        @media (max-width: 720px) {
            #bdl-entry {
                margin-right: 10px;
            }

            #bdl-entry[data-mode="floating"] {
                right: 16px;
                bottom: 92px;
            }

            #bdl-main-btn {
                padding: 0 10px;
            }

            .bdl-toolbar-text {
                display: none;
            }

            .bdl-popup {
                width: calc(100vw - 20px);
                max-height: calc(100vh - 24px);
                border-radius: 16px;
            }

            .bdl-body {
                max-height: calc(100vh - 100px);
            }
        }
    `;
	//#endregion
	//#region src/config.ts
	var LEARNING_DISCLAIMER = "本视频通过学习工具下载，仅供个人学习研究使用，请勿用于商业用途，请支持正版内容创作者。";
	var CONFIG = {
		SHORT_VIDEO_API_BASE: "https://api.bugpk.com/api",
		SHORT_VIDEO_PLATFORMS: {
			douyin: {
				label: "抖音",
				endpoint: "douyin",
				mediaReferer: "https://www.douyin.com/",
				mediaOrigin: "https://www.douyin.com",
				proxyType: "douyin"
			},
			kuaishou: {
				label: "快手",
				endpoint: "kuaishou",
				fallbackEndpoints: ["ksjx"],
				mediaReferer: "https://www.kuaishou.com/",
				mediaOrigin: "https://www.kuaishou.com"
			},
			xiaohongshu: {
				label: "小红书",
				endpoint: "xhsjx",
				mediaReferer: "https://www.xiaohongshu.com/",
				mediaOrigin: "https://www.xiaohongshu.com"
			},
			weibo: {
				label: "微博",
				endpoint: "weibo",
				mediaReferer: "https://weibo.com/",
				mediaOrigin: "https://weibo.com",
				proxyType: "weibo"
			},
			toutiao: {
				label: "今日头条",
				endpoint: "toutiao",
				mediaReferer: "https://www.toutiao.com/",
				mediaOrigin: "https://www.toutiao.com"
			},
			pipixia: {
				label: "皮皮虾",
				endpoint: "ppxia",
				mediaReferer: "https://h5.pipix.com/",
				mediaOrigin: "https://h5.pipix.com"
			},
			pipigx: {
				label: "皮皮搞笑",
				endpoint: "pipigx",
				mediaReferer: "https://h5.pipigx.com/",
				mediaOrigin: "https://h5.pipigx.com"
			}
		},
		QUALITY_MAP: {
			127: "8K 超高清",
			126: "杜比视界",
			125: "HDR 真彩色",
			120: "4K 超清",
			116: "1080P 60帧",
			112: "1080P 高码率",
			80: "1080P 高清",
			74: "720P 60帧",
			64: "720P 高清",
			32: "480P 清晰",
			16: "360P 流畅"
		},
		QUALITY_LIMIT: {
			0: 32,
			1: 80,
			2: 127
		},
		VIDEO_CODEC_MAP: {
			"avc1": "H.264/AVC",
			"hev1": "H.265/HEVC",
			"hvc1": "H.265/HEVC",
			"av01": "AV1"
		},
		AUDIO_CODEC_MAP: {
			30280: "AAC 64K",
			30232: "AAC 132K",
			30216: "AAC 192K",
			30250: "AAC Dolby",
			30251: "FLAC"
		},
		MERGE_METHODS: {
			JSMERGE: "js-merge",
			FFMPEG: "ffmpeg-merge",
			SEPARATE: "separate"
		}
	};
	//#endregion
	//#region src/api.ts
	var BiliAPI = {
		userVipType: 0,
		getUserInfo() {
			return Network.fetchJSON("https://api.bilibili.com/x/web-interface/nav").then((res) => {
				if (res.code === 0 && res.data) if (res.data.vipStatus === 1 && res.data.vipType === 2) this.userVipType = 2;
				else if (res.data.isLogin) this.userVipType = 1;
				else this.userVipType = 0;
				return this.userVipType;
			}).catch(() => {
				this.userVipType = 0;
				return 0;
			});
		},
		getVideoInfo(bvid) {
			return Network.fetchJSON("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid).then((res) => {
				if (res.code !== 0) throw new Error(res.message || "获取视频信息失败");
				return res.data;
			});
		},
		getUGCSeasonInfo(bvid) {
			return Network.fetchJSON("https://api.bilibili.com/x/web-interface/view?bvid=" + bvid).then((res) => {
				if (res.code !== 0) throw new Error(res.message || "获取合集信息失败");
				const data = res.data;
				if (data.ugc_season) return {
					hasUGC: true,
					title: data.ugc_season.title,
					episodes: data.ugc_season.sections[0].episodes,
					cover: data.ugc_season.cover
				};
				return { hasUGC: false };
			});
		},
		getBangumiInfo(videoId) {
			const isEp = videoId.indexOf("ep") === 0;
			const id = videoId.replace(/^(ep|ss)/, "");
			let url = "https://api.bilibili.com/pgc/view/web/season?";
			url += isEp ? "ep_id=" + id : "season_id=" + id;
			return Network.fetchJSON(url).then((res) => {
				if (res.code !== 0) throw new Error(res.message || "获取番剧信息失败");
				const result = res.result;
				const episodes = result.episodes || [];
				const pages = [];
				let currentEpId = null;
				if (isEp) currentEpId = parseInt(id);
				else {
					const urlMatch = window.location.pathname.match(/ep(\d+)/);
					if (urlMatch) currentEpId = parseInt(urlMatch[1]);
				}
				for (let i = 0; i < episodes.length; i++) {
					const ep = episodes[i];
					pages.push({
						cid: ep.cid,
						page: i + 1,
						part: ep.long_title || ep.title || "第" + (i + 1) + "集",
						duration: ep.duration / 1e3,
						ep_id: ep.id,
						bvid: ep.bvid
					});
				}
				let currentIndex = 0;
				if (currentEpId) {
					for (let j = 0; j < pages.length; j++) if (pages[j].ep_id === currentEpId) {
						currentIndex = j;
						break;
					}
				}
				const totalDuration = episodes.reduce((acc, ep) => acc + ep.duration / 1e3, 0);
				return {
					title: result.season_title || result.title,
					pages,
					owner: { name: result.up_info ? result.up_info.uname : "番剧" },
					duration: totalDuration,
					desc: result.evaluate || "",
					currentPage: currentIndex + 1,
					type: "bangumi",
					cover: result.cover
				};
			});
		},
		getPlayUrl(params) {
			let url;
			if (params.type === "bangumi") url = "https://api.bilibili.com/pgc/player/web/playurl?ep_id=" + params.ep_id + "&cid=" + params.cid + "&qn=" + params.qn + "&fnval=4048&fnver=0&fourk=1";
			else url = "https://api.bilibili.com/x/player/playurl?bvid=" + params.bvid + "&cid=" + params.cid + "&qn=" + params.qn + "&fnval=4048&fnver=0&fourk=1";
			return Network.fetchJSON(url).then((res) => {
				if (res.code !== 0) throw new Error(res.message || "获取播放地址失败");
				return res.result || res.data;
			});
		},
		getSubtitles(bvid, cid) {
			return Network.fetchJSON("https://api.bilibili.com/x/player/v2?bvid=" + bvid + "&cid=" + cid).then((res) => {
				if (res.code === 0 && res.data?.subtitle?.subtitles) return res.data.subtitle.subtitles;
				return [];
			}).catch(() => []);
		},
		getDanmaku(cid) {
			return new Promise((resolve, reject) => {
				GM_xmlhttpRequest({
					method: "GET",
					url: "https://api.bilibili.com/x/v1/dm/list.so?oid=" + cid,
					onload(res) {
						if (res.status >= 200 && res.status < 300) resolve(res.responseText);
						else reject(/* @__PURE__ */ new Error("获取弹幕失败"));
					},
					onerror() {
						reject(/* @__PURE__ */ new Error("获取弹幕网络错误"));
					}
				});
			});
		},
		getAvailableQualities(playData) {
			const list = [];
			const userLimit = CONFIG.QUALITY_LIMIT[this.userVipType] || 32;
			if (playData.accept_quality && playData.accept_description) for (let i = 0; i < playData.accept_quality.length; i++) {
				const qn = playData.accept_quality[i];
				list.push({
					qn,
					desc: playData.accept_description[i] || CONFIG.QUALITY_MAP[qn] || qn + "P",
					available: qn <= userLimit
				});
			}
			return list;
		},
		getVideoCodecs(playData) {
			const dash = playData.dash;
			if (!dash?.video) return [];
			const codecsMap = {};
			for (const video of dash.video) {
				const codecType = video.codecs.split(".")[0];
				if (!codecsMap[codecType]) codecsMap[codecType] = {
					type: codecType,
					name: CONFIG.VIDEO_CODEC_MAP[codecType] || codecType,
					videos: []
				};
				codecsMap[codecType].videos.push(video);
			}
			return Object.values(codecsMap).sort((a, b) => {
				const order = {
					"avc1": 0,
					"hev1": 1,
					"hvc1": 1,
					"av01": 2
				};
				return (order[a.type] || 99) - (order[b.type] || 99);
			});
		},
		getAudioCodecs(playData) {
			const dash = playData.dash;
			if (!dash) return [];
			const codecs = [];
			if (dash.audio) for (const a of dash.audio) codecs.push({
				id: a.id,
				name: CONFIG.AUDIO_CODEC_MAP[a.id] || "AAC",
				data: a
			});
			if (dash.dolby?.audio?.[0]) codecs.push({
				id: 30250,
				name: "Dolby Atmos",
				data: dash.dolby.audio[0]
			});
			if (dash.flac?.audio) codecs.push({
				id: 30251,
				name: "FLAC",
				data: dash.flac.audio
			});
			return codecs.sort((a, b) => b.data.bandwidth - a.data.bandwidth);
		},
		getStreams(playData, targetQn, videoCodec, audioCodec) {
			const dash = playData.dash;
			if (!dash) throw new Error("该视频不支持DASH格式");
			let video = null;
			let audio = null;
			if (dash.video && dash.video.length > 0) {
				const sorted = dash.video.slice().sort((a, b) => b.id !== a.id ? b.id - a.id : b.bandwidth - a.bandwidth);
				if (videoCodec) video = sorted.find((v) => v.id === targetQn && v.codecs.split(".")[0] === videoCodec) || null;
				if (!video) video = sorted.find((v) => v.id === targetQn && v.codecs?.startsWith("avc1")) || null;
				if (!video) video = sorted.find((v) => v.id === targetQn) || null;
				if (!video) video = sorted.find((v) => v.id <= targetQn && v.codecs?.startsWith("avc1")) || null;
				if (!video) video = sorted.find((v) => v.id <= targetQn) || null;
				if (!video) video = sorted[sorted.length - 1];
			}
			if (audioCodec) {
				if (audioCodec === 30250 && dash.dolby?.audio?.[0]) audio = dash.dolby.audio[0];
				else if (audioCodec === 30251 && dash.flac?.audio) audio = dash.flac.audio;
				else if (dash.audio) audio = dash.audio.find((a) => a.id === audioCodec) || null;
			}
			if (!audio) {
				if (dash.audio?.length) audio = dash.audio.slice().sort((a, b) => b.bandwidth - a.bandwidth)[0];
				if (dash.dolby?.audio?.[0] && (!audio || dash.dolby.audio[0].bandwidth > audio.bandwidth)) audio = dash.dolby.audio[0];
				if (dash.flac?.audio && (!audio || dash.flac.audio.bandwidth > audio.bandwidth)) audio = dash.flac.audio;
			}
			return {
				video,
				audio
			};
		}
	};
	//#endregion
	//#region src/ui.ts
	var BILIBILI_PLAYER_SELECTORS = [
		".bpx-player-container",
		"#bilibili-player",
		"#playerWrap",
		".player-wrap",
		".bpx-player-video-wrap",
		".player-container"
	];
	var DRAG_THRESHOLD = 5;
	var PLATFORM_LABELS = {
		douyin: "抖音",
		kuaishou: "快手",
		xiaohongshu: "小红书",
		weibo: "微博",
		toutiao: "今日头条",
		pipixia: "皮皮虾",
		pipigx: "皮皮搞笑"
	};
	function clamp(value, min, max) {
		if (max < min) return min;
		return Math.max(min, Math.min(value, max));
	}
	function makeToolbarButton() {
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
	function makePopup() {
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
	var UI = {
		elements: {},
		pagesSectionEnabled: false,
		ugcSectionEnabled: false,
		multiSelectUnlocked: false,
		footerSecretClicks: 0,
		footerSecretLastClickAt: 0,
		currentMountMode: null,
		mountedAt: null,
		host: null,
		root: null,
		dragState: null,
		popupManualPosition: null,
		entryManualPosition: null,
		suppressNextEntryClick: false,
		circleProgressValue: 0,
		entryProgressActive: false,
		init() {
			this.createPanel();
			this.bindDragHandlers();
			this.ensureMounted();
		},
		createPanel() {
			document.getElementById("bdl-shadow-host")?.remove();
			const host = document.createElement("div");
			host.id = "bdl-shadow-host";
			host.style.cssText = [
				"position:fixed!important",
				"inset:0!important",
				"display:block!important",
				"width:100vw!important",
				"height:100vh!important",
				"overflow:visible!important",
				"pointer-events:none!important",
				"z-index:2147483647!important"
			].join(";") + ";";
			const root = host.attachShadow({ mode: "open" });
			const style = document.createElement("style");
			style.textContent = STYLES;
			root.appendChild(style);
			const entry = document.createElement("div");
			entry.id = "bdl-entry";
			entry.innerHTML = makeToolbarButton();
			const panel = document.createElement("div");
			panel.id = "bdl-panel";
			panel.innerHTML = makePopup();
			root.appendChild(entry);
			root.appendChild(panel);
			document.body.appendChild(host);
			this.host = host;
			this.root = root;
			const g = (id) => root.getElementById(id);
			this.elements = {
				entry,
				panel,
				btn: g("bdl-main-btn"),
				popup: g("bdl-popup"),
				close: g("bdl-close"),
				title: g("bdl-title"),
				author: g("bdl-author"),
				duration: g("bdl-duration"),
				vip: g("bdl-vip"),
				pagesSection: g("bdl-pages-section"),
				shortItemsSection: g("bdl-short-items-section"),
				shortItems: g("bdl-short-items"),
				shortItemsCount: g("bdl-short-items-count"),
				qualitySection: g("bdl-qualities")?.closest(".bdl-section") || null,
				codecSection: g("bdl-video-codec")?.closest(".bdl-section") || null,
				methodSection: g("bdl-methods")?.closest(".bdl-section") || null,
				pagesList: g("bdl-pages-list"),
				pagesCount: g("bdl-pages-count"),
				selectAll: g("bdl-select-all"),
				selectNone: g("bdl-select-none"),
				selectReverse: g("bdl-select-reverse"),
				ugcSection: g("bdl-ugc-section"),
				ugcList: g("bdl-ugc-list"),
				ugcCount: g("bdl-ugc-count"),
				ugcSelectAll: g("bdl-ugc-select-all"),
				ugcSelectNone: g("bdl-ugc-select-none"),
				ugcSelectReverse: g("bdl-ugc-select-reverse"),
				qualities: g("bdl-qualities"),
				videoCodec: g("bdl-video-codec"),
				audioCodec: g("bdl-audio-codec"),
				methods: g("bdl-methods"),
				extraDownloads: g("bdl-extra-downloads"),
				progress: g("bdl-progress"),
				progressVideo: g("bdl-progress-video"),
				progressVideoText: g("bdl-progress-video-text"),
				progressAudio: g("bdl-progress-audio"),
				progressAudioText: g("bdl-progress-audio-text"),
				progressAudioRow: g("bdl-progress-audio")?.closest(".bdl-progress-row") || null,
				progressMerge: g("bdl-progress-merge"),
				progressMergeText: g("bdl-progress-merge-text"),
				mergeRow: g("bdl-merge-row"),
				alert: g("bdl-alert"),
				download: g("bdl-download"),
				tips: g("bdl-tips"),
				tipsContent: g("bdl-tips-content"),
				progressCircle: g("bdl-progress-circle"),
				footer: g("bdl-footer")
			};
		},
		query(selector) {
			return this.root?.querySelector(selector) || null;
		},
		queryAll(selector) {
			return Array.from(this.root?.querySelectorAll(selector) || []);
		},
		bindDragHandlers() {
			const header = this.elements.popup?.querySelector(".bdl-header") || null;
			const entry = this.elements.entry;
			header?.addEventListener("pointerdown", (event) => {
				if (event.target?.closest(".bdl-close")) return;
				this.startDrag("popup", event);
			});
			entry?.addEventListener("pointerdown", (event) => {
				if (this.currentMountMode !== "floating") return;
				this.startDrag("entry", event);
			});
		},
		startDrag(target, event) {
			if (event.button !== 0) return;
			const element = target === "popup" ? this.elements.popup : this.elements.entry;
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
			window.addEventListener("pointermove", this.handleDragMove, true);
			window.addEventListener("pointerup", this.handleDragEnd, true);
			window.addEventListener("pointercancel", this.handleDragEnd, true);
		},
		handleDragMove: (event) => {
			UI.updateDrag(event);
		},
		handleDragEnd: (event) => {
			UI.endDrag(event);
		},
		updateDrag(event) {
			const state = this.dragState;
			if (!state || event.pointerId !== state.pointerId) return;
			const element = state.target === "popup" ? this.elements.popup : this.elements.entry;
			if (!element) return;
			const deltaX = event.clientX - state.startX;
			const deltaY = event.clientY - state.startY;
			if (!state.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
			if (!state.hasMoved) {
				state.hasMoved = true;
				element.classList.add("is-dragging");
				element.setPointerCapture?.(event.pointerId);
			}
			const nextLeft = state.originLeft + deltaX;
			const nextTop = state.originTop + deltaY;
			const position = this.clampElementPosition(element, nextLeft, nextTop);
			if (state.target === "popup") {
				this.popupManualPosition = position;
				element.dataset.placement = "manual";
			} else {
				this.entryManualPosition = position;
				element.style.right = "auto";
				element.style.bottom = "auto";
			}
			this.applyElementPosition(element, position);
			event.preventDefault();
			event.stopPropagation();
		},
		endDrag(event) {
			const state = this.dragState;
			if (!state || event.pointerId !== state.pointerId) return;
			const element = state.target === "popup" ? this.elements.popup : this.elements.entry;
			if (element) {
				element.classList.remove("is-dragging");
				element.releasePointerCapture?.(event.pointerId);
			}
			window.removeEventListener("pointermove", this.handleDragMove, true);
			window.removeEventListener("pointerup", this.handleDragEnd, true);
			window.removeEventListener("pointercancel", this.handleDragEnd, true);
			if (state.hasMoved && state.target === "entry") {
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
		consumeEntryClickSuppression() {
			const suppressed = this.suppressNextEntryClick;
			this.suppressNextEntryClick = false;
			return suppressed;
		},
		clampElementPosition(element, left, top) {
			const viewportPadding = 8;
			const rect = element.getBoundingClientRect();
			const width = rect.width || element.offsetWidth || 80;
			const height = rect.height || element.offsetHeight || 40;
			return {
				left: clamp(left, viewportPadding, window.innerWidth - width - viewportPadding),
				top: clamp(top, viewportPadding, window.innerHeight - height - viewportPadding)
			};
		},
		applyElementPosition(element, position) {
			element.style.left = `${Math.round(position.left)}px`;
			element.style.top = `${Math.round(position.top)}px`;
		},
		getMountTarget() {
			if (Utils.getSiteContext().kind === "short-video") return {
				container: document.body,
				anchor: null,
				mode: "floating"
			};
			const videoContainer = document.querySelector("#arc_toolbar_report .video-toolbar-left-main");
			if (videoContainer) return {
				container: videoContainer,
				anchor: videoContainer.querySelector(".video-share-wrap")?.closest(".toolbar-left-item-wrap"),
				mode: "video"
			};
			const bangumiContainer = document.querySelector(".player-left-components .toolbar-left");
			if (bangumiContainer) {
				const watchTogether = document.getElementById("watch_together_tab");
				return {
					container: bangumiContainer,
					anchor: watchTogether?.parentElement instanceof HTMLElement ? watchTogether.parentElement : null,
					mode: "bangumi"
				};
			}
			return null;
		},
		ensureMounted() {
			const entry = this.elements.entry;
			const btn = this.elements.btn;
			if (!entry || !btn) return false;
			const mount = this.getMountTarget();
			if (!mount) {
				entry.className = "";
				entry.removeAttribute("data-mode");
				entry.removeAttribute("data-mounted");
				entry.style.left = "";
				entry.style.top = "";
				entry.style.right = "";
				entry.style.bottom = "";
				entry.style.visibility = "";
				this.mountedAt = null;
				this.currentMountMode = null;
				this.hidePopup();
				return false;
			}
			entry.dataset.mode = mount.mode;
			entry.dataset.mounted = "true";
			if (mount.mode === "floating") {
				entry.className = "bdl-floating-entry";
				btn.className = "bdl-toolbar-btn bdl-floating-btn";
			} else {
				entry.className = mount.mode === "video" ? "bdl-toolbar-wrap bdl-bilibili-entry" : "bdl-toolbar-wrap bdl-bangumi-entry";
				btn.className = mount.mode === "video" ? "bdl-toolbar-btn bdl-toolbar-btn-video" : "bdl-toolbar-btn bdl-toolbar-btn-bangumi";
			}
			entry.classList.toggle("is-downloading", this.entryProgressActive);
			this.mountedAt = mount.container;
			this.currentMountMode = mount.mode;
			this.positionEntry(mount);
			this.positionPopup();
			this.syncEntryProgressVisibility();
			return true;
		},
		positionEntry(mount) {
			const entry = this.elements.entry;
			if (!entry) return;
			const target = mount === void 0 ? this.getMountTarget() : mount;
			if (!target || target.mode === "floating") {
				if (target?.mode === "floating" && this.entryManualPosition) {
					const position = this.clampElementPosition(entry, this.entryManualPosition.left, this.entryManualPosition.top);
					this.entryManualPosition = position;
					this.applyElementPosition(entry, position);
					entry.style.right = "auto";
					entry.style.bottom = "auto";
				} else {
					entry.style.left = "";
					entry.style.top = "";
					entry.style.right = "";
					entry.style.bottom = "";
				}
				entry.style.visibility = "";
				return;
			}
			const anchorRect = target.anchor?.getBoundingClientRect();
			const containerRect = target.container.getBoundingClientRect();
			const baseRect = anchorRect && anchorRect.width > 0 && anchorRect.height > 0 ? anchorRect : containerRect;
			if (baseRect.width <= 0 && baseRect.height <= 0) {
				entry.style.visibility = "hidden";
				return;
			}
			entry.style.visibility = "hidden";
			entry.style.left = "0px";
			entry.style.top = "0px";
			const entryRect = entry.getBoundingClientRect();
			const width = entryRect.width || 74;
			const height = entryRect.height || 32;
			const gap = 8;
			const viewportPadding = 12;
			let left = baseRect.right + gap;
			if (left + width > window.innerWidth - viewportPadding) left = baseRect.left - width - gap;
			left = Math.max(viewportPadding, Math.min(left, window.innerWidth - width - viewportPadding));
			let top = baseRect.top + (baseRect.height - height) / 2;
			top = Math.max(viewportPadding, Math.min(top, window.innerHeight - height - viewportPadding));
			entry.style.left = `${Math.round(left)}px`;
			entry.style.top = `${Math.round(top)}px`;
			entry.style.right = "auto";
			entry.style.bottom = "auto";
			entry.style.visibility = "visible";
		},
		showPopup() {
			const popup = this.elements.popup;
			const btn = this.elements.btn;
			if (!popup || !btn) return;
			popup.classList.add("show");
			btn.setAttribute("aria-expanded", "true");
			this.positionPopup();
			this.syncEntryProgressVisibility();
		},
		hidePopup() {
			const popup = this.elements.popup;
			const btn = this.elements.btn;
			if (popup) popup.classList.remove("show");
			if (btn) btn.setAttribute("aria-expanded", "false");
			this.syncEntryProgressVisibility();
		},
		togglePopup() {
			if (!this.ensureMounted()) return false;
			const popup = this.elements.popup;
			if (!popup) return false;
			const willShow = !popup.classList.contains("show");
			if (willShow) this.showPopup();
			else this.hidePopup();
			return willShow;
		},
		getBilibiliPlayerRect() {
			let bestRect = null;
			let bestArea = 0;
			for (const selector of BILIBILI_PLAYER_SELECTORS) document.querySelectorAll(selector).forEach((element) => {
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
			return bestRect;
		},
		setPopupMaxHeight(maxHeight) {
			const popup = this.elements.popup;
			if (!popup) return maxHeight;
			const safeMaxHeight = Math.max(220, Math.floor(maxHeight));
			popup.style.maxHeight = `${safeMaxHeight}px`;
			const body = popup.querySelector(".bdl-body");
			if (body) body.style.maxHeight = `${Math.max(120, safeMaxHeight - 108)}px`;
			return safeMaxHeight;
		},
		setPopupWidth(width) {
			const popup = this.elements.popup;
			if (!popup) return width;
			const safeWidth = clamp(Math.floor(width), 300, window.innerWidth - 32);
			popup.style.width = `${safeWidth}px`;
			return safeWidth;
		},
		positionPopup() {
			const popup = this.elements.popup;
			const btn = this.elements.btn;
			if (!popup || !btn || !popup.classList.contains("show")) return;
			const gap = 12;
			const viewportPadding = 16;
			const buttonRect = btn.getBoundingClientRect();
			let popupWidth = this.setPopupWidth(Math.min(432, window.innerWidth - viewportPadding * 2));
			const maxViewportHeight = this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2);
			let popupHeight = Math.min(popup.offsetHeight || 620, maxViewportHeight);
			let placement = "bottom";
			if (this.popupManualPosition) {
				const position = this.clampElementPosition(popup, this.popupManualPosition.left, this.popupManualPosition.top);
				this.popupManualPosition = position;
				popup.dataset.placement = "manual";
				this.applyElementPosition(popup, position);
				return;
			}
			let left = buttonRect.right - popupWidth;
			left = Math.max(viewportPadding, Math.min(left, window.innerWidth - popupWidth - viewportPadding));
			let top = buttonRect.bottom + gap;
			const playerRect = Utils.getSiteContext().kind === "bilibili" ? this.getBilibiliPlayerRect() : null;
			if (playerRect) {
				const rightLeft = playerRect.right + gap;
				const rightSpace = window.innerWidth - rightLeft - viewportPadding;
				if (rightSpace >= 300) {
					popupWidth = this.setPopupWidth(Math.min(432, rightSpace));
					popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2));
					left = rightLeft;
					top = clamp(playerRect.top, viewportPadding, window.innerHeight - popupHeight - viewportPadding);
					placement = "side";
				} else {
					const belowTop = Math.max(playerRect.bottom + gap, buttonRect.bottom + gap);
					const belowSpace = window.innerHeight - belowTop - viewportPadding;
					if (belowSpace >= 220) {
						popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(belowSpace));
						top = belowTop;
						placement = "bottom";
					} else {
						const topSpace = playerRect.top - gap - viewportPadding;
						if (topSpace >= 220) {
							popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(topSpace));
							top = playerRect.top - popupHeight - gap;
							placement = "top";
						} else {
							popupHeight = Math.min(popup.offsetHeight || 620, this.setPopupMaxHeight(window.innerHeight - viewportPadding * 2));
							top = clamp(buttonRect.bottom + gap, viewportPadding, window.innerHeight - popupHeight - viewportPadding);
							placement = "bottom";
						}
					}
					left = clamp(buttonRect.right - popupWidth, viewportPadding, window.innerWidth - popupWidth - viewportPadding);
				}
			} else if (top + popupHeight > window.innerHeight - viewportPadding && buttonRect.top > popupHeight + gap) {
				top = buttonRect.top - popupHeight - gap;
				placement = "top";
			}
			top = Math.max(viewportPadding, Math.min(top, window.innerHeight - popupHeight - viewportPadding));
			popup.dataset.placement = placement;
			popup.style.left = `${Math.round(left)}px`;
			popup.style.top = `${Math.round(top)}px`;
		},
		updateVideoInfo(videoInfo, pageInfo, vipType) {
			this.setBilibiliMode();
			let title = videoInfo.title;
			if (videoInfo.pages.length > 1 && pageInfo.part) title += " - " + pageInfo.part;
			this.elements.title.textContent = title;
			this.elements.title.title = title;
			this.elements.author.innerHTML = `<span class="bdl-meta-label">UP</span><span>${videoInfo.owner.name}</span>`;
			this.elements.duration.innerHTML = `<span class="bdl-meta-label">时长</span><span>${Utils.formatDuration(videoInfo.duration)}</span>`;
			let badge = "";
			if (vipType === 0) badge = "<span class=\"bdl-vip-badge guest\">游客</span>";
			else if (vipType === 1) badge = "<span class=\"bdl-vip-badge normal\">会员</span>";
			else if (vipType === 2) badge = "<span class=\"bdl-vip-badge vip\">大会员</span>";
			this.elements.vip.innerHTML = badge;
		},
		updateShortVideoInfo(data, platform) {
			this.setShortVideoMode(platform);
			const title = data.title || data.desc || "未获取到内容标题";
			const authorName = data.author?.name || "--";
			const typeLabel = {
				video: "短视频",
				image: "图集",
				live: "实况图",
				unknown: "内容"
			}[data.type || "unknown"] || "内容";
			const durationText = data.duration ? Utils.formatDurationMs(data.duration) : null;
			this.elements.title.textContent = title;
			this.elements.title.title = title;
			this.elements.author.innerHTML = `<span class="bdl-meta-label">作者</span><span>${authorName}</span>`;
			this.elements.duration.innerHTML = `<span class="bdl-meta-label">类型</span><span>${durationText ? `${typeLabel} · ${durationText}` : typeLabel}</span>`;
			this.elements.vip.innerHTML = `<span class="bdl-vip-badge site">${PLATFORM_LABELS[platform]}</span>`;
			this.setPrimaryButtonLabel(this.getShortVideoPrimaryLabel(data));
		},
		prepareShortVideoItems(items, currentIndex, onSelect) {
			const section = this.elements.shortItemsSection;
			const list = this.elements.shortItems;
			const count = this.elements.shortItemsCount;
			if (!section || !list) return;
			list.innerHTML = "";
			if (items.length <= 1) {
				section.classList.remove("show");
				return;
			}
			section.classList.add("show");
			if (count) count.textContent = `共 ${items.length} 项`;
			items.forEach((item, index) => {
				const typeLabel = item.type === "image" ? `图集${item.images?.length ? ` ${item.images.length}张` : ""}` : item.type === "live" ? `实况${item.live_photo?.length ? ` ${item.live_photo.length}项` : ""}` : "视频";
				const title = item.title || item.desc || item.itemLabel || `${typeLabel} ${index + 1}`;
				const button = document.createElement("button");
				button.type = "button";
				button.className = `bdl-short-item${index === currentIndex ? " active" : ""}`;
				const marker = document.createElement("span");
				marker.className = "bdl-short-item-mark";
				marker.textContent = typeLabel;
				const titleEl = document.createElement("span");
				titleEl.className = "bdl-short-item-title";
				titleEl.textContent = title;
				button.append(marker, titleEl);
				button.addEventListener("click", () => onSelect(index));
				list.appendChild(button);
			});
		},
		hideShortVideoItems() {
			const section = this.elements.shortItemsSection;
			const list = this.elements.shortItems;
			const count = this.elements.shortItemsCount;
			if (section) section.classList.remove("show");
			if (list) list.innerHTML = "";
			if (count) count.textContent = "";
		},
		getShortVideoPrimaryLabel(data) {
			if (data.type === "image") return `下载图集${data.images?.length ? ` (${data.images.length})` : ""}`;
			if (data.type === "live") return `下载实况图${data.live_photo?.length ? ` (${data.live_photo.length})` : ""}`;
			if (data.music?.url && !data.url) return "下载音频";
			return "下载视频";
		},
		preparePagesSection(pages, currentIndex, onUpdate) {
			this.pagesSectionEnabled = true;
			this.resetFooterSecret();
			this.elements.pagesSection.classList.remove("show");
			this.elements.pagesCount.textContent = `共 ${pages.length} 个分P`;
			this.elements.pagesList.innerHTML = "";
			pages.forEach((page, index) => {
				const item = document.createElement("div");
				item.className = `bdl-page-item${index === currentIndex ? " active" : ""}`;
				const cb = document.createElement("input");
				cb.type = "checkbox";
				cb.className = "bdl-page-checkbox";
				cb.dataset.index = String(index);
				cb.checked = index === currentIndex;
				const info = document.createElement("div");
				info.className = "bdl-page-info";
				const num = document.createElement("div");
				num.className = "bdl-page-num";
				num.textContent = `P${page.page}`;
				const pageTitle = document.createElement("div");
				pageTitle.className = "bdl-page-title";
				pageTitle.textContent = page.part || `第${page.page}话`;
				pageTitle.title = pageTitle.textContent;
				const duration = document.createElement("span");
				duration.className = "bdl-page-duration";
				duration.textContent = Utils.formatDuration(page.duration);
				info.appendChild(num);
				info.appendChild(pageTitle);
				item.appendChild(cb);
				item.appendChild(info);
				item.appendChild(duration);
				cb.addEventListener("change", onUpdate);
				item.addEventListener("click", (e) => {
					if (e.target !== cb) {
						cb.checked = !cb.checked;
						onUpdate();
					}
				});
				this.elements.pagesList.appendChild(item);
			});
			onUpdate();
		},
		prepareUGCSection(episodes, onUpdate) {
			this.ugcSectionEnabled = true;
			this.resetFooterSecret();
			this.elements.ugcSection.classList.remove("show");
			this.elements.ugcCount.textContent = `共 ${episodes.length} 个视频`;
			this.elements.ugcList.innerHTML = "";
			episodes.forEach((ep, index) => {
				const item = document.createElement("div");
				item.className = "bdl-page-item";
				const cb = document.createElement("input");
				cb.type = "checkbox";
				cb.className = "bdl-page-checkbox";
				cb.dataset.index = String(index);
				cb.checked = false;
				const info = document.createElement("div");
				info.className = "bdl-page-info";
				const num = document.createElement("div");
				num.className = "bdl-page-num";
				num.textContent = `E${index + 1}`;
				const epTitle = document.createElement("div");
				epTitle.className = "bdl-page-title";
				epTitle.textContent = ep.title;
				epTitle.title = ep.title;
				const duration = document.createElement("span");
				duration.className = "bdl-page-duration";
				duration.textContent = Utils.formatDuration(ep.arc.duration);
				info.appendChild(num);
				info.appendChild(epTitle);
				item.appendChild(cb);
				item.appendChild(info);
				item.appendChild(duration);
				cb.addEventListener("change", onUpdate);
				item.addEventListener("click", (e) => {
					if (e.target !== cb) {
						cb.checked = !cb.checked;
						onUpdate();
					}
				});
				this.elements.ugcList.appendChild(item);
			});
			onUpdate();
		},
		toggleExtendedSections() {
			const pagesVisible = this.elements.pagesSection.classList.contains("show");
			const ugcVisible = this.elements.ugcSection.classList.contains("show");
			if (pagesVisible || ugcVisible) {
				this.elements.pagesSection.classList.remove("show");
				this.elements.ugcSection.classList.remove("show");
				return;
			}
			if (this.pagesSectionEnabled) this.elements.pagesSection.classList.add("show");
			if (this.ugcSectionEnabled) this.elements.ugcSection.classList.add("show");
		},
		resetFooterSecret() {
			this.multiSelectUnlocked = false;
			this.footerSecretClicks = 0;
			this.footerSecretLastClickAt = 0;
		},
		handleFooterSecretClick() {
			if (!this.pagesSectionEnabled && !this.ugcSectionEnabled) return false;
			if (this.multiSelectUnlocked) {
				this.toggleExtendedSections();
				return true;
			}
			const now = Date.now();
			if (now - this.footerSecretLastClickAt > 1200) this.footerSecretClicks = 0;
			this.footerSecretLastClickAt = now;
			this.footerSecretClicks += 1;
			if (this.footerSecretClicks < 5) return false;
			this.multiSelectUnlocked = true;
			this.footerSecretClicks = 0;
			this.toggleExtendedSections();
			return true;
		},
		hidePagesSection() {
			this.pagesSectionEnabled = false;
			this.elements.pagesSection.classList.remove("show");
			this.elements.pagesList.innerHTML = "";
			this.elements.pagesCount.textContent = "";
		},
		hideUGCSection() {
			this.ugcSectionEnabled = false;
			this.elements.ugcSection.classList.remove("show");
			this.elements.ugcList.innerHTML = "";
			this.elements.ugcCount.textContent = "";
		},
		setBilibiliMode() {
			this.hideShortVideoItems();
			this.elements.pagesSection.style.display = "";
			this.elements.ugcSection.style.display = "";
			if (this.elements.qualitySection) this.elements.qualitySection.style.display = "";
			if (this.elements.codecSection) this.elements.codecSection.style.display = "";
			if (this.elements.methodSection) this.elements.methodSection.style.display = "";
			if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = "";
			this.elements.mergeRow.style.display = "";
			this.setPrimaryProgressLabel("视频流");
			this.setPrimaryButtonLabel("开始下载");
		},
		setShortVideoMode(platform) {
			this.hidePagesSection();
			this.hideUGCSection();
			this.hideShortVideoItems();
			this.elements.pagesSection.style.display = "none";
			this.elements.ugcSection.style.display = "none";
			if (this.elements.qualitySection) this.elements.qualitySection.style.display = "none";
			if (this.elements.codecSection) this.elements.codecSection.style.display = "none";
			if (this.elements.methodSection) this.elements.methodSection.style.display = "none";
			if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = "none";
			this.elements.mergeRow.style.display = "none";
			this.hideTips();
			this.setPrimaryProgressLabel(`${PLATFORM_LABELS[platform]}下载`);
			this.elements.title.textContent = `${PLATFORM_LABELS[platform]}内容待解析`;
			this.elements.title.title = this.elements.title.textContent;
			this.elements.author.innerHTML = "<span class=\"bdl-meta-label\">状态</span><span>打开具体内容页后可解析</span>";
			this.elements.duration.innerHTML = "<span class=\"bdl-meta-label\">类型</span><span>短视频/图集</span>";
			this.elements.vip.innerHTML = `<span class="bdl-vip-badge site">${PLATFORM_LABELS[platform]}</span>`;
			this.setPrimaryButtonLabel("解析内容");
		},
		resetSectionsVisibility() {
			this.elements.pagesSection.style.display = "";
			this.elements.ugcSection.style.display = "";
			if (this.elements.qualitySection) this.elements.qualitySection.style.display = "";
			if (this.elements.codecSection) this.elements.codecSection.style.display = "";
			if (this.elements.methodSection) this.elements.methodSection.style.display = "";
			if (this.elements.progressAudioRow) this.elements.progressAudioRow.style.display = "";
			this.elements.mergeRow.style.display = "";
		},
		updateQualities(qualities, currentQn, onSelect) {
			this.elements.qualities.innerHTML = "";
			qualities.forEach((quality, index) => {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = `bdl-quality-btn${quality.available ? "" : " disabled"}`;
				if (quality.qn === currentQn && quality.available || index === 0 && quality.available) {
					btn.classList.add("active");
					onSelect(quality.qn);
				}
				btn.textContent = quality.desc;
				btn.dataset.qn = String(quality.qn);
				btn.addEventListener("click", () => {
					if (!quality.available) {
						const vipTypeText = BiliAPI.userVipType === 0 ? "游客" : BiliAPI.userVipType === 1 ? "普通会员" : "大会员";
						this.showAlert(`当前账号(${vipTypeText})无权限观看此清晰度`, "warning");
						return;
					}
					this.elements.qualities.querySelectorAll(".bdl-quality-btn").forEach((button) => button.classList.remove("active"));
					btn.classList.add("active");
					onSelect(quality.qn);
				});
				this.elements.qualities.appendChild(btn);
			});
		},
		updateCodecSelectors(videoCodecs, audioCodecs) {
			this.elements.videoCodec.innerHTML = "";
			videoCodecs.forEach((codec, index) => {
				const option = document.createElement("option");
				option.value = codec.type;
				option.textContent = codec.name;
				if (index === 0) option.selected = true;
				this.elements.videoCodec.appendChild(option);
			});
			this.elements.audioCodec.innerHTML = "";
			audioCodecs.forEach((codec, index) => {
				const option = document.createElement("option");
				option.value = String(codec.id);
				option.textContent = codec.name;
				if (index === 0) option.selected = true;
				this.elements.audioCodec.appendChild(option);
			});
		},
		updateExtraDownloads(hasSubtitles, hasDanmaku, hasCover, onCover, onSubtitles, onDanmaku) {
			this.elements.extraDownloads.innerHTML = "";
			if (hasCover) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "bdl-extra-btn";
				button.innerHTML = "<span class=\"bdl-extra-btn-mark\">封面</span><span>下载封面</span>";
				button.addEventListener("click", onCover);
				this.elements.extraDownloads.appendChild(button);
			}
			if (hasSubtitles) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "bdl-extra-btn";
				button.innerHTML = "<span class=\"bdl-extra-btn-mark\">字幕</span><span>下载字幕</span>";
				button.addEventListener("click", onSubtitles);
				this.elements.extraDownloads.appendChild(button);
			}
			if (hasDanmaku) {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "bdl-extra-btn";
				button.innerHTML = "<span class=\"bdl-extra-btn-mark\">弹幕</span><span>下载弹幕</span>";
				button.addEventListener("click", onDanmaku);
				this.elements.extraDownloads.appendChild(button);
			}
		},
		setExtraActions(actions) {
			this.elements.extraDownloads.innerHTML = "";
			actions.forEach((action) => {
				const button = document.createElement("button");
				button.type = "button";
				button.className = "bdl-extra-btn";
				button.innerHTML = `<span class="bdl-extra-btn-mark">${action.marker}</span><span>${action.label}</span>`;
				button.addEventListener("click", action.onClick);
				this.elements.extraDownloads.appendChild(button);
			});
		},
		showProgress(show) {
			if (show) {
				this.elements.progress.classList.add("show");
				this.updateProgress("video", 0);
				this.updateProgress("audio", 0);
				this.updateProgress("merge", 0);
				return;
			}
			this.elements.progress.classList.remove("show");
		},
		updateProgress(type, percent, label) {
			const id = `progress${type.charAt(0).toUpperCase()}${type.slice(1)}`;
			const bar = this.elements[id];
			const text = this.elements[`${id}Text`];
			if (bar) bar.style.width = `${percent}%`;
			if (text) text.textContent = label || `${percent}%`;
		},
		setPrimaryProgressLabel(label) {
			const progressLabel = this.elements.progressVideo?.closest(".bdl-progress-row")?.querySelector(".bdl-progress-label");
			if (progressLabel) progressLabel.textContent = label;
		},
		isPopupShown() {
			return Boolean(this.elements.popup?.classList.contains("show"));
		},
		syncEntryProgressVisibility() {
			const circle = this.elements.progressCircle;
			const entry = this.elements.entry;
			if (!circle) return;
			const showOnEntry = !this.isPopupShown() && this.entryProgressActive;
			const visibleProgress = showOnEntry ? Math.max(4, this.circleProgressValue) : 0;
			circle.style.height = `${visibleProgress}%`;
			entry?.classList.toggle("has-entry-progress", showOnEntry);
		},
		updateCircleProgress(percent) {
			this.circleProgressValue = clamp(percent, 0, 100);
			this.syncEntryProgressVisibility();
		},
		showAlert(message, type) {
			this.elements.alert.textContent = message;
			this.elements.alert.className = `bdl-alert show ${type}`;
		},
		hideAlert() {
			this.elements.alert.className = "bdl-alert";
		},
		hideTips() {
			this.elements.tips.style.display = "none";
		},
		setPrimaryButtonLabel(label) {
			if (this.elements.download.disabled || this.elements.download.classList.contains("is-active")) return;
			this.renderDownloadButton(label);
		},
		renderDownloadButton(label, progress = 0) {
			const safeProgress = clamp(progress, 0, 100);
			const download = this.elements.download;
			const fill = document.createElement("span");
			const labelEl = document.createElement("span");
			fill.className = "bdl-download-progress-fill";
			labelEl.className = "bdl-download-label";
			labelEl.textContent = label;
			download.style.setProperty("--bdl-download-progress", `${safeProgress}%`);
			download.replaceChildren(fill, labelEl);
		},
		updateDownloadButtonProgress(percent, label) {
			const download = this.elements.download;
			if (!download?.classList.contains("is-active")) return;
			const queueMode = download.classList.contains("can-queue");
			const safeProgress = clamp(percent, 0, 100);
			const text = label || `下载中 ${safeProgress}%`;
			this.renderDownloadButton(queueMode ? `${text} · 再点排队` : text, safeProgress);
		},
		setDownloading(isDownloading, options = {}) {
			const allowQueue = Boolean(options.allowQueue);
			this.elements.download.disabled = isDownloading && !allowQueue;
			this.elements.download.classList.toggle("is-active", isDownloading);
			this.elements.download.classList.toggle("can-queue", isDownloading && allowQueue);
			this.renderDownloadButton(isDownloading ? options.label || "下载中..." : "开始下载", isDownloading ? 0 : 0);
			this.elements.btn.disabled = false;
			this.entryProgressActive = isDownloading;
			this.elements.entry.classList.toggle("is-downloading", isDownloading);
			if (!isDownloading) {
				this.circleProgressValue = 0;
				this.elements.entry.classList.remove("has-entry-progress");
			}
			this.syncEntryProgressVisibility();
		}
	};
	//#endregion
	//#region src/short-video-api.ts
	var ITEM_ARRAY_KEYS = [
		"items",
		"list",
		"data",
		"videos",
		"video_list",
		"videoList",
		"aweme_list",
		"awemeList",
		"statuses",
		"cards",
		"feeds"
	];
	function unique(values) {
		return values.filter((value, index) => Boolean(value) && values.indexOf(value) === index);
	}
	function isRecord(value) {
		return Boolean(value && typeof value === "object" && !Array.isArray(value));
	}
	function isHttpUrl(value) {
		return typeof value === "string" && /^(https?:)?\/\//i.test(value.trim());
	}
	function normalizeUrl(value) {
		if (!isHttpUrl(value)) return "";
		const url = value.trim();
		return url.startsWith("//") ? `https:${url}` : url;
	}
	function pushUrl(target, value) {
		if (Array.isArray(value)) {
			value.forEach((item) => pushUrl(target, item));
			return;
		}
		if (value && typeof value === "object") {
			Object.values(value).forEach((item) => pushUrl(target, item));
			return;
		}
		const url = normalizeUrl(value);
		if (url && !target.includes(url)) target.push(url);
	}
	function normalizeAuthor(data) {
		const author = data.author;
		if (author && typeof author === "object") return {
			...author,
			name: author.name || author.nickname || author.screen_name || author.user_name || data.nickname || data.author_name || "",
			avatar: author.avatar || author.avatar_url || data.avatar || data.author_avatar || ""
		};
		return {
			name: typeof author === "string" ? author : data.nickname || data.author_name || data.screen_name || "",
			id: data.author_id || data.uid || data.user_id || "",
			avatar: data.avatar || data.author_avatar || ""
		};
	}
	function normalizeLivePhotos(value) {
		if (!Array.isArray(value)) return [];
		return value.map((item) => {
			if (!item || typeof item !== "object") return null;
			return {
				image: normalizeUrl(item.image || item.cover || item.url),
				video: normalizeUrl(item.video || item.video_url || item.play_url)
			};
		}).filter((item) => Boolean(item && (item.image || item.video)));
	}
	function getVisibleArea(element) {
		const rect = element.getBoundingClientRect();
		return Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
	}
	function getBestVisibleVideo() {
		const videos = Array.from(document.querySelectorAll("video"));
		return videos.map((video) => ({
			video,
			area: getVisibleArea(video)
		})).filter((item) => item.area > 1e3).sort((a, b) => b.area - a.area)[0]?.video || videos[0] || null;
	}
	function getElementTreeSource(element, maxDepth = 6) {
		const parts = [];
		let current = element;
		let depth = 0;
		while (current && depth < maxDepth) {
			parts.push(current.outerHTML.slice(0, 6e4));
			current = current.parentElement;
			depth += 1;
		}
		return parts.join("\n");
	}
	function findNearbyText(element, selectors, maxLength, maxDepth = 7) {
		let current = element;
		let depth = 0;
		while (current && depth < maxDepth) {
			for (const selector of selectors) {
				const nodes = Array.from(current.querySelectorAll(selector));
				for (const node of nodes) {
					const text = node.innerText?.replace(/\s+/g, " ").trim();
					if (text && text.length <= maxLength) return text;
				}
			}
			current = current.parentElement;
			depth += 1;
		}
		return "";
	}
	function getVideoCandidates(data) {
		const candidates = [];
		const qualityUrls = data.quality_urls || data.qualityUrls || null;
		if (qualityUrls && typeof qualityUrls === "object" && !Array.isArray(qualityUrls)) pushUrl(candidates, qualityUrls[data.default_quality || data.defaultQuality || "高清 720P"]);
		pushUrl(candidates, data.download_url || data.downloadUrl);
		pushUrl(candidates, data.url);
		pushUrl(candidates, data.video_url || data.videoUrl);
		pushUrl(candidates, data.play_url || data.playUrl);
		pushUrl(candidates, data.media_url || data.mediaUrl);
		pushUrl(candidates, data.hd_url || data.hdUrl);
		pushUrl(candidates, data.sd_url || data.sdUrl);
		pushUrl(candidates, data.mp4);
		pushUrl(candidates, data.src);
		pushUrl(candidates, data.video);
		pushUrl(candidates, data.video_backup || data.videoBackup);
		pushUrl(candidates, data.video_urls || data.videoUrls);
		pushUrl(candidates, data.downloads);
		pushUrl(candidates, qualityUrls);
		pushUrl(candidates, data.urls);
		pushUrl(candidates, data.download_urls || data.downloadUrls);
		return candidates;
	}
	function getImageCandidates(data) {
		const candidates = [];
		pushUrl(candidates, data.images || data.image_urls || data.imageUrls);
		pushUrl(candidates, data.pics || data.pictures || data.pic_urls || data.picUrls);
		pushUrl(candidates, data.photo || data.photos || data.photo_list || data.photoList);
		pushUrl(candidates, data.image || data.image_url || data.imageUrl);
		pushUrl(candidates, data.image_list || data.imageList || data.images_list || data.imagesList);
		pushUrl(candidates, data.album || data.album_images || data.albumImages);
		return candidates;
	}
	function unwrapRawItem(item) {
		if (!isRecord(item)) return null;
		if (isRecord(item.mblog)) return item.mblog;
		if (isRecord(item.status)) return item.status;
		if (isRecord(item.video)) return {
			...item,
			...item.video
		};
		if (isRecord(item.aweme_detail)) return item.aweme_detail;
		return item;
	}
	function pickParentFallback(data) {
		return {
			title: data.title,
			desc: data.desc,
			author: data.author,
			nickname: data.nickname,
			author_name: data.author_name,
			screen_name: data.screen_name,
			avatar: data.avatar,
			author_avatar: data.author_avatar,
			cover: data.cover,
			cover_image: data.cover_image,
			coverImage: data.coverImage
		};
	}
	function getNestedRawItems(data) {
		for (const key of ITEM_ARRAY_KEYS) {
			if (!Array.isArray(data[key])) continue;
			const fallback = pickParentFallback(data);
			const items = data[key].map(unwrapRawItem).filter((item) => Boolean(item)).map((item) => ({
				...fallback,
				...item
			}));
			if (items.length > 0) return items;
		}
		return [];
	}
	function collectRawItems(raw) {
		const sourceItems = Array.isArray(raw) ? raw : [raw || {}];
		const items = [];
		sourceItems.forEach((item) => {
			const rawItem = unwrapRawItem(item);
			if (!rawItem) return;
			const nested = getNestedRawItems(rawItem);
			if (nested.length > 0) items.push(...nested);
			else items.push(rawItem);
		});
		return items.length > 0 ? items : [{}];
	}
	function getShortVideoItemKey(item) {
		return [
			item.url,
			item.images?.join("|"),
			item.live_photo?.map((live) => `${live.image || ""}:${live.video || ""}`).join("|"),
			item.music?.url,
			item.sourceUrl,
			item.title
		].find(Boolean) || "";
	}
	function dedupeShortVideoItems(items) {
		const seen = /* @__PURE__ */ new Set();
		return items.filter((item) => {
			const key = getShortVideoItemKey(item);
			if (!key) return true;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}
	function combineShortVideoItems(items, platform, url) {
		const deduped = dedupeShortVideoItems(items);
		return {
			...deduped[0] || {
				type: "unknown",
				title: "",
				platform,
				sourceUrl: url
			},
			items: deduped
		};
	}
	function getEndpointCandidates(endpoint, fallbackEndpoints = []) {
		const endpoints = [endpoint, ...fallbackEndpoints].map((value) => value.replace(/^\/+/, "")).filter(Boolean).map((cleanEndpoint) => ({
			cleanEndpoint,
			withoutPhp: cleanEndpoint.endsWith(".php") ? cleanEndpoint.slice(0, -4) : cleanEndpoint
		}));
		return unique([
			...endpoints.map((item) => item.withoutPhp),
			...endpoints.map((item) => item.cleanEndpoint),
			...endpoints.map((item) => `${item.withoutPhp}.php`),
			"short_videos"
		]);
	}
	function getDocumentSource() {
		return [
			document.querySelector("meta[property=\"og:video:url\"]")?.content || "",
			document.querySelector("meta[property=\"og:url\"]")?.content || "",
			document.querySelector("meta[name=\"twitter:url\"]")?.content || "",
			document.documentElement?.innerHTML || ""
		].join("\n");
	}
	function normalizeWeiboFid(value) {
		return value.replace(/%253A|%3A|\\u003a/gi, ":");
	}
	function extractWeiboFids(source) {
		return unique((source.match(/1034(?::|%3A|%253A|\\u003a)\d{6,}/gi) || []).map(normalizeWeiboFid));
	}
	function getWeiboResolvableUrls(url) {
		const parsed = new URL(url);
		const directFid = parsed.searchParams.get("fid") || parsed.searchParams.get("oid");
		const urls = [];
		if (directFid && /^1034(?::|%3A|%253A|\\u003a)\d{6,}$/i.test(directFid)) urls.push(`https://weibo.com/tv/show/${normalizeWeiboFid(directFid)}`);
		if (url.match(/weibo\.com\/tv\/show\/([^?&#/]+)/i)?.[1]) urls.push(url);
		extractWeiboFids(`${url}\n${getDocumentSource()}`).forEach((fid) => {
			urls.push(`https://weibo.com/tv/show/${fid}`);
		});
		urls.push(url);
		return unique(urls);
	}
	function getDouyinResolvableUrls(url) {
		const parsed = new URL(url);
		const urls = [];
		const modalId = parsed.searchParams.get("modal_id") || parsed.searchParams.get("aweme_id");
		const videoMatch = parsed.pathname.match(/\/video\/(\d+)/i);
		if (modalId) urls.push(`https://www.douyin.com/video/${modalId}`);
		if (videoMatch?.[1]) urls.push(`https://www.douyin.com/video/${videoMatch[1]}`);
		urls.push(url);
		return unique(urls);
	}
	function getPageWindow() {
		if (typeof unsafeWindow !== "undefined") return unsafeWindow;
		return window;
	}
	function extractKuaishouPhotoIds(source) {
		const ids = [];
		[
			/\/short-video\/([A-Za-z0-9_-]+)/gi,
			/(?:VisionVideoDetailPhoto|VisionPhoto|RecoPhoto|FeedPhoto|PhotoEntity|Photo):([A-Za-z0-9_-]{6,})/gi,
			/(?:photoId|photo_id|photoIdStr)["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{6,})/gi,
			/(?:[?&]|&amp;)(?:photoId|photo_id)=([A-Za-z0-9_-]{6,})/gi,
			/clientCacheKey=([A-Za-z0-9-]+?)(?:_[A-Za-z0-9]+)?\.(?:mp4|jpg|jpeg|kvif|webp)/gi
		].forEach((pattern) => {
			let match;
			while (match = pattern.exec(source)) ids.push(match[1]);
		});
		return unique(ids);
	}
	function collectKuaishouPhotoIdsFromValue(value, ids, seen = /* @__PURE__ */ new WeakSet(), depth = 0) {
		if (ids.length >= 30 || depth > 6 || value == null) return;
		if (typeof value === "string") {
			extractKuaishouPhotoIds(value).forEach((id) => ids.push(id));
			return;
		}
		if (typeof value !== "object") return;
		if (seen.has(value)) return;
		seen.add(value);
		const entries = Object.entries(value).slice(0, 300);
		for (const [key, item] of entries) {
			if (/^(photoId|photo_id|photoIdStr)$/i.test(key) && typeof item === "string" && /^[A-Za-z0-9_-]{6,}$/.test(item)) ids.push(item);
			collectKuaishouPhotoIdsFromValue(item, ids, seen, depth + 1);
			if (ids.length >= 30) return;
		}
	}
	function getKuaishouWindowStatePhotoIds() {
		const pageWindow = getPageWindow();
		const stateNames = [
			"INIT_STATE",
			"__APOLLO_STATE__",
			"__INITIAL_STATE__",
			"__NEXT_DATA__",
			"__NUXT__"
		];
		const ids = [];
		stateNames.forEach((name) => collectKuaishouPhotoIdsFromValue(pageWindow?.[name], ids));
		return unique(ids);
	}
	function getKuaishouStorageSource() {
		const parts = [];
		[window.localStorage, window.sessionStorage].forEach((storage) => {
			try {
				for (let index = 0; index < storage.length; index += 1) {
					const key = storage.key(index) || "";
					const value = storage.getItem(key) || "";
					if (/(kuaishou|kwai|ks|photo|video|feed|reco|apollo)/i.test(`${key}\n${value}`)) parts.push(`${key}\n${value.slice(0, 1e5)}`);
				}
			} catch {}
		});
		return parts.join("\n");
	}
	function getKuaishouActiveSource() {
		const video = getBestVisibleVideo();
		if (!video) return "";
		return [
			video.currentSrc || "",
			video.src || "",
			video.poster || "",
			getElementTreeSource(video)
		].join("\n");
	}
	function getKuaishouResolvableUrls(url) {
		const urls = [];
		unique([
			...extractKuaishouPhotoIds(url),
			...extractKuaishouPhotoIds(getKuaishouActiveSource()),
			...getKuaishouWindowStatePhotoIds(),
			...extractKuaishouPhotoIds(`${getDocumentSource()}\n${getKuaishouStorageSource()}`)
		]).forEach((photoId) => {
			urls.push(`https://www.kuaishou.com/short-video/${photoId}`);
		});
		urls.push(url);
		return unique(urls);
	}
	function isKuaishouVideoUrl(value) {
		const url = normalizeUrl(value);
		return Boolean(url && /\.(mp4)(?:[?#]|$)/i.test(url) && /(kwaicdn\.com|kwimgs\.com|yximgs\.com|chenzhongtech\.com)/i.test(url));
	}
	function getKuaishouPerformanceVideoUrls() {
		try {
			return unique(performance.getEntriesByType("resource").map((entry) => entry.name).filter(isKuaishouVideoUrl));
		} catch {
			return [];
		}
	}
	function getKuaishouDomTitle(video) {
		const nearbyTitle = findNearbyText(video?.parentElement || null, [
			"[class*=\"photo-desc\"]",
			"[class*=\"video-desc\"]",
			"[class*=\"caption\"]",
			"[class*=\"desc\"]",
			"[class*=\"title\"]",
			"[data-e2e*=\"desc\"]",
			"h1",
			"h2"
		], 180);
		if (nearbyTitle) return nearbyTitle;
		return document.title.replace(/[-_｜|]?\s*快手.*$/i, "").trim() || "快手视频";
	}
	function getKuaishouDomAuthor(video) {
		const name = findNearbyText(video?.parentElement || null, [
			"a[href*=\"/profile/\"]",
			"a[href*=\"/user/\"]",
			"[class*=\"author\"]",
			"[class*=\"nickname\"]",
			"[class*=\"user\"]",
			"[class*=\"name\"]",
			"[data-e2e*=\"author\"]",
			"[data-e2e*=\"user\"]"
		], 80);
		return name ? { name } : {};
	}
	function getKuaishouDomMediaFallback(url) {
		const video = getBestVisibleVideo();
		const videoUrls = unique([
			normalizeUrl(video?.currentSrc),
			normalizeUrl(video?.src),
			...getKuaishouPerformanceVideoUrls()
		].filter(isKuaishouVideoUrl));
		if (videoUrls.length === 0) return null;
		const title = getKuaishouDomTitle(video);
		return {
			type: "video",
			title,
			desc: title,
			author: getKuaishouDomAuthor(video),
			cover: normalizeUrl(video?.poster) || "",
			url: videoUrls[0],
			video_backup: videoUrls.slice(1),
			platform: "kuaishou",
			sourceUrl: url,
			itemLabel: "当前播放视频"
		};
	}
	function isKuaishouFeedPage(url) {
		const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
		return pathname === "/new-reco" || pathname === "/";
	}
	function getResolvableUrls(url, platform) {
		if (platform === "douyin") return getDouyinResolvableUrls(url);
		if (platform === "kuaishou") return getKuaishouResolvableUrls(url);
		if (platform === "weibo") return getWeiboResolvableUrls(url);
		return [url];
	}
	function isWeiboNonContentPage(url, candidates) {
		if (candidates.some((candidate) => /weibo\.com\/tv\/show\/1034:/i.test(candidate))) return false;
		const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
		return pathname === "/" || /^\/newlogin/i.test(pathname) || /^\/login/i.test(pathname) || /^\/u\/?\d*$/i.test(pathname);
	}
	var ShortVideoAPI = {
		getPlatformConfig(platform) {
			return CONFIG.SHORT_VIDEO_PLATFORMS[platform];
		},
		getPlatformLabel(platform) {
			return this.getPlatformConfig(platform).label;
		},
		getMediaHeaders(platform) {
			const config = this.getPlatformConfig(platform);
			return {
				Referer: config.mediaReferer,
				Origin: config.mediaOrigin,
				"User-Agent": navigator.userAgent
			};
		},
		getProxyUrl(url, platform) {
			const config = this.getPlatformConfig(platform);
			if (!config.proxyType) return null;
			if (!/^https?:\/\//i.test(url)) return null;
			if (/api\.bugpk\.com\/api\/(?:weibo|svproxyurl)\.php/i.test(url) || /api\.bugpk\.com\/api\/weibo\?/i.test(url)) return null;
			return `${CONFIG.SHORT_VIDEO_API_BASE}/svproxyurl.php?proxyurl=${encodeURIComponent(url)}&type=${config.proxyType}`;
		},
		async parseUrl(url, platform) {
			const config = this.getPlatformConfig(platform);
			const parseUrls = getResolvableUrls(url, platform);
			const endpoints = getEndpointCandidates(config.endpoint, config.fallbackEndpoints);
			const collectedItems = [];
			let lastError = null;
			if (platform === "weibo" && isWeiboNonContentPage(url, parseUrls)) throw new Error("当前微博页面不是具体视频内容页，请打开视频详情页后再试");
			if (platform === "kuaishou" && isKuaishouFeedPage(url)) {
				const domFallback = getKuaishouDomMediaFallback(url);
				if (domFallback) return combineShortVideoItems([domFallback], platform, url);
			}
			for (const parseUrl of parseUrls) {
				for (const endpoint of endpoints) {
					const apiUrl = `${CONFIG.SHORT_VIDEO_API_BASE}/${endpoint}?url=${encodeURIComponent(parseUrl)}`;
					try {
						const response = await Network.fetchJSON(apiUrl);
						const code = Number(response?.code);
						if (!response || !Number.isFinite(code)) throw new Error("解析接口返回异常");
						if (code !== 200) throw new Error(response.msg || "解析失败");
						const normalized = this.normalizeResponse(response.data, platform, parseUrl);
						collectedItems.push(...normalized.items?.length ? normalized.items : [normalized]);
						break;
					} catch (error) {
						lastError = error instanceof Error ? error : new Error(String(error));
					}
				}
				if (collectedItems.length > 0 && platform !== "weibo") return combineShortVideoItems(collectedItems, platform, url);
			}
			if (collectedItems.length > 0) return combineShortVideoItems(collectedItems, platform, url);
			if (platform === "kuaishou") {
				const domFallback = getKuaishouDomMediaFallback(url);
				if (domFallback) return combineShortVideoItems([domFallback], platform, url);
			}
			throw lastError || /* @__PURE__ */ new Error("解析失败");
		},
		normalizeResponse(raw, platform, url) {
			return combineShortVideoItems(collectRawItems(raw).map((data, index) => this.normalizeRawItem(data, platform, url, index)), platform, url);
		},
		normalizeRawItem(data, platform, url, index = 0) {
			const videoCandidates = getVideoCandidates(data);
			const images = getImageCandidates(data);
			const livePhotos = normalizeLivePhotos(data.live_photo || data.livePhoto || data.live_photos || data.livePhotos);
			const author = normalizeAuthor(data);
			const rawType = typeof data.type === "string" ? data.type : "";
			const type = [
				"video",
				"image",
				"live"
			].includes(rawType) ? rawType : livePhotos.length > 0 ? "live" : images.length > 0 && videoCandidates.length === 0 ? "image" : videoCandidates.length > 0 ? "video" : "unknown";
			const normalized = {
				...data,
				type,
				title: data.title || data.desc || this.getPlatformLabel(platform),
				desc: data.desc || data.title || "",
				author,
				cover: normalizeUrl(data.cover || data.cover_image || data.coverImage || data.pic || data.thumbnail || data.avatar) || "",
				url: data.url || "",
				duration: typeof data.duration === "number" ? data.duration : null,
				video_backup: videoCandidates.slice(1),
				images,
				live_photo: livePhotos,
				music: data.music && typeof data.music === "object" ? {
					...data.music,
					url: normalizeUrl(data.music.url || data.music.play_url || data.music.playUrl),
					cover: normalizeUrl(data.music.cover || data.music.cover_url || data.music.coverUrl)
				} : {},
				platform,
				sourceUrl: url,
				itemLabel: data.itemLabel || data.label || data.quality || `${type === "image" ? "图集" : "视频"} ${index + 1}`
			};
			normalized.url = videoCandidates[0] || normalizeUrl(data.url) || "";
			if (!normalized.title) normalized.title = this.getPlatformLabel(platform);
			return normalized;
		}
	};
	//#endregion
	//#region src/merger.ts
	var JSMerger = {
		name: "JS原生合并",
		status: "ready",
		readBox(buffer, offset) {
			const view = new DataView(buffer);
			if (offset + 8 > buffer.byteLength) return null;
			let size = view.getUint32(offset);
			const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
			let headerSize = 8;
			if (size === 1 && offset + 16 <= buffer.byteLength) {
				size = Number(view.getBigUint64(offset + 8));
				headerSize = 16;
			} else if (size === 0) size = buffer.byteLength - offset;
			return {
				size,
				type,
				headerSize,
				offset
			};
		},
		parseBoxes(buffer) {
			const boxes = [];
			let offset = 0;
			while (offset < buffer.byteLength) {
				const box = this.readBox(buffer, offset);
				if (!box || box.size < 8) break;
				boxes.push({
					size: box.size,
					type: box.type,
					headerSize: box.headerSize,
					offset: box.offset,
					data: new Uint8Array(buffer, offset, box.size)
				});
				offset += box.size;
			}
			return boxes;
		},
		findBox(boxes, type) {
			return boxes.find((b) => b.type === type) || null;
		},
		findAllBoxes(boxes, type) {
			return boxes.filter((b) => b.type === type);
		},
		parseContainerBox(boxData, headerOffset = 8) {
			const childBoxes = [];
			let offset = headerOffset;
			while (offset < boxData.length) {
				if (offset + 8 > boxData.length) break;
				let size = new DataView(boxData.buffer, boxData.byteOffset + offset).getUint32(0);
				const type = String.fromCharCode(boxData[offset + 4], boxData[offset + 5], boxData[offset + 6], boxData[offset + 7]);
				if (size === 0) size = boxData.length - offset;
				if (size < 8 || offset + size > boxData.length) break;
				childBoxes.push({
					size,
					type,
					offset,
					data: boxData.slice(offset, offset + size)
				});
				offset += size;
			}
			return childBoxes;
		},
		createBox(type, content) {
			const size = 8 + content.length;
			const box = new Uint8Array(size);
			new DataView(box.buffer).setUint32(0, size);
			box[4] = type.charCodeAt(0);
			box[5] = type.charCodeAt(1);
			box[6] = type.charCodeAt(2);
			box[7] = type.charCodeAt(3);
			box.set(content, 8);
			return box;
		},
		concat(...arrays) {
			const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
			const result = new Uint8Array(totalLen);
			let offset = 0;
			for (const a of arrays) {
				result.set(a, offset);
				offset += a.length;
			}
			return result;
		},
		toArrayBuffer(data) {
			const buffer = new ArrayBuffer(data.byteLength);
			new Uint8Array(buffer).set(data);
			return buffer;
		},
		modifyTrackId(trakData, newId) {
			const result = new Uint8Array(trakData);
			for (const box of this.parseContainerBox(result)) if (box.type === "tkhd") {
				const version = result[box.offset + 8];
				const trackIdOffset = box.offset + 8 + (version === 0 ? 12 : 20);
				new DataView(result.buffer, result.byteOffset + trackIdOffset).setUint32(0, newId);
			}
			return result;
		},
		modifyTrexTrackId(trexData, newId) {
			const result = new Uint8Array(trexData);
			new DataView(result.buffer, result.byteOffset + 12).setUint32(0, newId);
			return result;
		},
		getTrackType(trakData) {
			for (const box of this.parseContainerBox(trakData)) if (box.type === "mdia") {
				for (const mdiaBox of this.parseContainerBox(box.data)) if (mdiaBox.type === "hdlr") return String.fromCharCode(mdiaBox.data[16], mdiaBox.data[17], mdiaBox.data[18], mdiaBox.data[19]);
			}
			return null;
		},
		buildMvex(videoMvex, audioMvex) {
			const mvexParts = [];
			if (videoMvex) {
				for (const box of this.parseContainerBox(videoMvex.data)) if (box.type === "trex") mvexParts.push(this.modifyTrexTrackId(box.data, 1));
				else if (box.type === "mehd") mvexParts.push(box.data);
			}
			if (audioMvex) {
				for (const box of this.parseContainerBox(audioMvex.data)) if (box.type === "trex") mvexParts.push(this.modifyTrexTrackId(box.data, 2));
			}
			if (mvexParts.length > 0) return this.createBox("mvex", this.concat(...mvexParts));
			return null;
		},
		buildUdta(metadata) {
			const encoder = new TextEncoder();
			const buildDataBox = (value) => {
				if (!value) return null;
				const valueBytes = encoder.encode(value);
				const payload = new Uint8Array(8 + valueBytes.length);
				const view = new DataView(payload.buffer);
				view.setUint32(0, 1);
				view.setUint32(4, 0);
				payload.set(valueBytes, 8);
				return this.createBox("data", payload);
			};
			const buildMetaTag = (tag, value) => {
				if (!value) return new Uint8Array(0);
				const dataBox = buildDataBox(value);
				if (!dataBox) return new Uint8Array(0);
				return this.createBox(tag, dataBox);
			};
			const commentText = metadata.description ? metadata.description + "\n\n" + LEARNING_DISCLAIMER : LEARNING_DISCLAIMER;
			const ilstContent = this.concat(buildMetaTag("©nam", metadata.title), buildMetaTag("©ART", metadata.author), buildMetaTag("©alb", "Bilibili"), buildMetaTag("©day", (/* @__PURE__ */ new Date()).getFullYear().toString()), buildMetaTag("©cmt", commentText), buildMetaTag("©too", "Bilibili Video Downloader"));
			const ilstBox = this.createBox("ilst", ilstContent);
			const hdlrContent = new Uint8Array(24);
			const hdlrView = new DataView(hdlrContent.buffer);
			hdlrView.setUint32(0, 0);
			hdlrView.setUint32(4, 0);
			hdlrContent.set([
				109,
				100,
				105,
				114
			], 8);
			hdlrContent.set([
				97,
				112,
				112,
				108
			], 12);
			hdlrView.setUint32(16, 0);
			hdlrView.setUint32(20, 0);
			const hdlrBox = this.createBox("hdlr", hdlrContent);
			const metaContent = this.concat(new Uint8Array([
				0,
				0,
				0,
				0
			]), hdlrBox, ilstBox);
			return this.createBox("udta", this.createBox("meta", metaContent));
		},
		buildMoov(videoMoov, audioMoov, metadata) {
			const videoMoovBoxes = this.parseContainerBox(videoMoov.data);
			const audioMoovBoxes = this.parseContainerBox(audioMoov.data);
			const mvhd = this.findBox(videoMoovBoxes, "mvhd");
			if (!mvhd) throw new Error("找不到mvhd box");
			const videoTrak = videoMoovBoxes.find((b) => b.type === "trak" && this.getTrackType(b.data) === "vide") || null;
			const audioTrak = audioMoovBoxes.find((b) => b.type === "trak" && this.getTrackType(b.data) === "soun") || null;
			if (!videoTrak) throw new Error("找不到视频轨道");
			const videoTrakData = this.modifyTrackId(videoTrak.data, 1);
			const audioTrakData = audioTrak ? this.modifyTrackId(audioTrak.data, 2) : null;
			const mvhdData = new Uint8Array(mvhd.data);
			const nextTrackIdOffset = mvhdData[8] === 0 ? 104 : 116;
			new DataView(mvhdData.buffer, mvhdData.byteOffset + nextTrackIdOffset - 4).setUint32(0, audioTrakData ? 3 : 2);
			const videoMvex = this.findBox(videoMoovBoxes, "mvex");
			const audioMvex = this.findBox(audioMoovBoxes, "mvex");
			const mvexData = videoMvex || audioMvex ? this.buildMvex(videoMvex, audioMvex) : null;
			const udtaContent = this.buildUdta(metadata);
			const moovParts = [mvhdData, videoTrakData];
			if (audioTrakData) moovParts.push(audioTrakData);
			if (mvexData) moovParts.push(mvexData);
			moovParts.push(udtaContent);
			return this.createBox("moov", this.concat(...moovParts));
		},
		modifyMoofTrackId(moofData, newId) {
			const result = new Uint8Array(moofData);
			for (const box of this.parseContainerBox(result)) if (box.type === "traf") {
				for (const trafBox of this.parseContainerBox(box.data)) if (trafBox.type === "tfhd") new DataView(result.buffer, result.byteOffset + box.offset + trafBox.offset + 12).setUint32(0, newId);
			}
			return result;
		},
		merge(videoBuffer, audioBuffer, metadata) {
			return new Promise((resolve, reject) => {
				try {
					const videoBoxes = this.parseBoxes(videoBuffer);
					const audioBoxes = this.parseBoxes(audioBuffer);
					const videoFtyp = this.findBox(videoBoxes, "ftyp");
					const videoMoov = this.findBox(videoBoxes, "moov");
					const videoMdat = this.findAllBoxes(videoBoxes, "mdat");
					const videoMoof = this.findAllBoxes(videoBoxes, "moof");
					const audioMoov = this.findBox(audioBoxes, "moov");
					const audioMdat = this.findAllBoxes(audioBoxes, "mdat");
					const audioMoof = this.findAllBoxes(audioBoxes, "moof");
					if (!videoFtyp || !videoMoov) throw new Error("视频文件结构不完整");
					if (videoMoof.length > 0 || audioMoof.length > 0) {
						const parts = [videoFtyp.data];
						parts.push(audioMoov ? this.buildMoov(videoMoov, audioMoov, metadata) : videoMoov.data);
						for (let i = 0; i < videoMoof.length; i++) {
							parts.push(videoMoof[i].data);
							if (videoMdat[i]) parts.push(videoMdat[i].data);
						}
						for (let j = 0; j < audioMoof.length; j++) {
							parts.push(this.modifyMoofTrackId(audioMoof[j].data, 2));
							if (audioMdat[j]) parts.push(audioMdat[j].data);
						}
						resolve(this.toArrayBuffer(this.concat(...parts)));
					} else {
						const mergedMoov = audioMoov ? this.buildMoov(videoMoov, audioMoov, metadata) : videoMoov.data;
						const allMdat = [...videoMdat, ...audioMdat].map((m) => m.data.slice(8));
						const mdatContent = this.concat(...allMdat);
						const mergedMdat = this.createBox("mdat", mdatContent);
						resolve(this.toArrayBuffer(this.concat(videoFtyp.data, mergedMoov, mergedMdat)));
					}
				} catch (error) {
					console.error("JS合并失败:", error);
					reject(error);
				}
			});
		}
	};
	var FFmpegMerger = {
		name: "FFmpeg合并",
		status: "loading",
		ffmpeg: null,
		init() {
			if (typeof FFmpeg === "undefined") {
				this.status = "unavailable";
				return Promise.reject(/* @__PURE__ */ new Error("FFmpeg未加载"));
			}
			if (!this.ffmpeg) this.ffmpeg = FFmpeg.createFFmpeg({ log: false });
			if (!this.ffmpeg.isLoaded()) {
				this.status = "loading";
				return this.ffmpeg.load().then(() => {
					this.status = "ready";
					return true;
				}).catch((e) => {
					this.status = "error";
					throw e;
				});
			}
			this.status = "ready";
			return Promise.resolve(true);
		},
		merge(videoBuffer, audioBuffer, metadata) {
			return this.init().then(() => {
				this.ffmpeg.FS("writeFile", "video.mp4", new Uint8Array(videoBuffer));
				this.ffmpeg.FS("writeFile", "audio.m4a", new Uint8Array(audioBuffer));
				return this.ffmpeg.run("-i", "video.mp4", "-i", "audio.m4a", "-c", "copy", "-map", "0:v:0", "-map", "1:a:0", "-metadata", "title=" + (metadata.title || ""), "-metadata", "artist=" + (metadata.author || ""), "-metadata", "comment=" + LEARNING_DISCLAIMER, "output.mp4");
			}).then(() => {
				const data = this.ffmpeg.FS("readFile", "output.mp4");
				try {
					this.ffmpeg.FS("unlink", "video.mp4");
					this.ffmpeg.FS("unlink", "audio.m4a");
					this.ffmpeg.FS("unlink", "output.mp4");
				} catch (e) {}
				return data.buffer;
			});
		}
	};
	//#endregion
	//#region src/merge-manager.ts
	var MergeManager = {
		currentMethod: CONFIG.MERGE_METHODS.JSMERGE,
		methods: {
			"js-merge": {
				name: "JS原生合并",
				desc: "浏览器内直接合并，兼容性好",
				handler: JSMerger,
				recommended: true
			},
			"ffmpeg-merge": {
				name: "FFmpeg合并",
				desc: "使用FFmpeg进行专业合并",
				handler: FFmpegMerger,
				recommended: false
			},
			"separate": {
				name: "分离下载",
				desc: "分别保存视频和音频文件",
				handler: null,
				recommended: false
			}
		},
		setMethod(method) {
			this.currentMethod = method;
		},
		getMethodStatus(method) {
			if (method === CONFIG.MERGE_METHODS.SEPARATE) return "ready";
			const handler = this.methods[method]?.handler;
			return handler ? handler.status : "unavailable";
		},
		merge(videoBuffer, audioBuffer, metadata) {
			const method = this.methods[this.currentMethod];
			if (this.currentMethod === CONFIG.MERGE_METHODS.SEPARATE) return Promise.resolve({
				separate: true,
				video: videoBuffer,
				audio: audioBuffer
			});
			if (!method.handler) return Promise.reject(/* @__PURE__ */ new Error("未找到合并处理器"));
			return method.handler.merge(videoBuffer, audioBuffer, metadata).then((result) => ({
				separate: false,
				data: result
			})).catch((error) => {
				console.error(method.name + " 合并失败:", error);
				throw error;
			});
		}
	};
	//#endregion
	//#region src/complete-effect.ts
	var CompleteEffect = {
		show(root, progressCircle) {
			const overlay = document.createElement("div");
			overlay.className = "bdl-complete-overlay";
			overlay.innerHTML = "<div class=\"bdl-complete-container\"><div class=\"bdl-complete-ripple\"></div><div class=\"bdl-complete-ripple\"></div><div class=\"bdl-complete-ripple\"></div><div class=\"bdl-complete-particles\"></div><div class=\"bdl-complete-sparkles\"></div><div class=\"bdl-complete-icon\"><svg viewBox=\"0 0 24 24\"><path d=\"M5 12l5 5L20 7\"/></svg></div></div><div class=\"bdl-complete-text\">✨ 下载完成 ✨</div>";
			(root || document.body).appendChild(overlay);
			this.createParticles(overlay.querySelector(".bdl-complete-particles"));
			this.createSparkles(overlay.querySelector(".bdl-complete-sparkles"));
			this.addBubbles(progressCircle);
			setTimeout(() => {
				overlay.style.animation = "bdlFadeOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards";
				setTimeout(() => {
					overlay.parentNode?.removeChild(overlay);
				}, 500);
			}, 2500);
		},
		createParticles(container) {
			const colors = [
				"#fb7299",
				"#ff9eb5",
				"#00a1d6",
				"#66d4ff",
				"#f25d8e",
				"#0081b3"
			];
			for (let i = 0; i < 30; i++) {
				const particle = document.createElement("div");
				particle.className = "bdl-particle";
				const angle = Math.PI * 2 * i / 30;
				const velocity = 120 + Math.random() * 80;
				const size = 6 + Math.random() * 10;
				particle.style.width = size + "px";
				particle.style.height = size + "px";
				particle.style.background = colors[Math.floor(Math.random() * colors.length)];
				particle.style.boxShadow = "0 0 10px " + colors[Math.floor(Math.random() * colors.length)];
				particle.style.setProperty("--tx", Math.cos(angle) * velocity + "px");
				particle.style.setProperty("--ty", Math.sin(angle) * velocity + "px");
				particle.style.animationDelay = Math.random() * .3 + "s";
				container.appendChild(particle);
			}
		},
		createSparkles(container) {
			for (const pos of [
				{
					top: "10%",
					left: "15%",
					delay: .2,
					duration: 1.5
				},
				{
					top: "20%",
					right: "20%",
					delay: .4,
					duration: 1.8
				},
				{
					top: "40%",
					left: "10%",
					delay: .6,
					duration: 1.6
				},
				{
					top: "60%",
					right: "15%",
					delay: .3,
					duration: 1.7
				},
				{
					bottom: "30%",
					left: "25%",
					delay: .5,
					duration: 1.9
				},
				{
					bottom: "20%",
					right: "25%",
					delay: .7,
					duration: 1.4
				},
				{
					top: "30%",
					left: "50%",
					delay: .1,
					duration: 2
				},
				{
					bottom: "40%",
					right: "50%",
					delay: .8,
					duration: 1.3
				}
			]) {
				const sparkle = document.createElement("div");
				sparkle.className = "bdl-sparkle";
				if (pos.top) sparkle.style.top = pos.top;
				if (pos.bottom) sparkle.style.bottom = pos.bottom;
				if (pos.left) sparkle.style.left = pos.left;
				if (pos.right) sparkle.style.right = pos.right;
				sparkle.style.animationDelay = pos.delay + "s";
				sparkle.style.animationDuration = pos.duration + "s";
				container.appendChild(sparkle);
			}
		},
		addBubbles(progressCircle) {
			const circleProgress = progressCircle || document.getElementById("bdl-progress-circle");
			if (!circleProgress) return;
			for (let i = 1; i <= 3; i++) {
				const bubble = document.createElement("div");
				bubble.className = "bdl-progress-bubble";
				circleProgress.appendChild(bubble);
			}
		}
	};
	//#endregion
	//#region src/downloader.ts
	var Downloader = {
		isDownloading: false,
		videoInfo: null,
		shortVideoInfo: null,
		shortVideoItems: [],
		selectedShortVideoIndex: 0,
		shortVideoPageUrl: null,
		shortVideoQueue: [],
		activeShortVideoTask: null,
		playData: null,
		selectedQuality: 80,
		selectedPages: [],
		selectedUGCEpisodes: [],
		videoType: "video",
		selectedVideoCodec: null,
		selectedAudioCodec: null,
		availableSubtitles: [],
		hasDanmaku: false,
		coverUrl: null,
		currentPlatform: null,
		isShortVideoMode() {
			return Utils.getSiteContext().kind === "short-video";
		},
		refreshInfo(options = {}) {
			const siteContext = Utils.getSiteContext();
			if (siteContext.kind === "bilibili") return this.refreshBilibiliInfo();
			if (siteContext.kind === "short-video") return this.refreshShortVideoInfo(siteContext.platform, options).then(() => void 0);
			UI.showAlert("当前页面暂不支持", "warning");
			return Promise.resolve();
		},
		refreshBilibiliInfo() {
			const videoId = Utils.getVideoId();
			if (!videoId) {
				UI.showAlert("无法识别视频ID", "error");
				return Promise.resolve();
			}
			this.shortVideoInfo = null;
			this.shortVideoItems = [];
			this.selectedShortVideoIndex = 0;
			this.shortVideoPageUrl = null;
			this.currentPlatform = null;
			this.videoType = videoId.type;
			return BiliAPI.getUserInfo().then(() => {
				return (videoId.type === "bangumi" ? BiliAPI.getBangumiInfo(videoId.id) : BiliAPI.getVideoInfo(videoId.id)).then((videoInfo) => {
					this.videoInfo = videoInfo;
					this.coverUrl = videoInfo.pic || videoInfo.cover || null;
					return (videoId.type === "video" ? BiliAPI.getUGCSeasonInfo(videoId.id) : Promise.resolve({ hasUGC: false })).then((ugcInfo) => {
						const page = videoInfo.currentPage || Utils.getCurrentPage();
						const pageInfo = videoInfo.pages[page - 1];
						if (!pageInfo) {
							UI.showAlert("无法获取分P信息", "error");
							return;
						}
						const playParams = {
							type: videoId.type,
							cid: pageInfo.cid,
							qn: 127
						};
						if (videoId.type === "bangumi") playParams.ep_id = pageInfo.ep_id;
						else playParams.bvid = videoId.id;
						return Promise.all([BiliAPI.getPlayUrl(playParams), BiliAPI.getSubtitles(videoId.id, pageInfo.cid)]).then(([playData, subtitles]) => {
							this.playData = playData;
							this.availableSubtitles = subtitles;
							this.hasDanmaku = true;
							const qualities = BiliAPI.getAvailableQualities(playData);
							const videoCodecs = BiliAPI.getVideoCodecs(playData);
							const audioCodecs = BiliAPI.getAudioCodecs(playData);
							UI.updateVideoInfo(videoInfo, pageInfo, BiliAPI.userVipType);
							UI.updateQualities(qualities, playData.quality ?? this.selectedQuality, (qn) => {
								this.selectedQuality = qn;
							});
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
								this.videoInfo.ugcEpisodes = ugcInfo.episodes;
								UI.prepareUGCSection(ugcInfo.episodes, () => this.updateSelectedUGC());
								this.selectedUGCEpisodes = [];
							} else UI.hideUGCSection();
							UI.updateExtraDownloads(subtitles.length > 0, this.hasDanmaku, Boolean(this.coverUrl), () => this.downloadCover(), () => this.downloadSubtitles(), () => this.downloadDanmaku());
							if (qualities.length > 0) {
								for (const quality of qualities) if (quality.available) {
									this.selectedQuality = quality.qn;
									break;
								}
							}
							UI.positionPopup();
						});
					});
				});
			}).catch((error) => {
				console.error("获取视频信息失败:", error);
				UI.showAlert("获取视频信息失败: " + error.message, "error");
				UI.positionPopup();
			});
		},
		refreshShortVideoInfo(platform, options = {}) {
			this.videoInfo = null;
			this.playData = null;
			this.availableSubtitles = [];
			this.hasDanmaku = false;
			this.currentPlatform = platform;
			this.coverUrl = null;
			return ShortVideoAPI.parseUrl(location.href, platform).then((data) => {
				this.shortVideoItems = data.items?.length ? data.items : [data];
				this.selectedShortVideoIndex = 0;
				this.shortVideoInfo = this.shortVideoItems[0] || data;
				this.shortVideoPageUrl = location.href;
				this.coverUrl = this.shortVideoInfo.cover || this.shortVideoInfo.music?.cover || null;
				this.renderShortVideoInfo(platform);
				UI.hideAlert();
				UI.positionPopup();
				return true;
			}).catch((error) => {
				if (options.silent) console.warn("短视频解析跳过:", error);
				else console.error("短视频解析失败:", error);
				this.shortVideoInfo = null;
				this.shortVideoItems = [];
				this.selectedShortVideoIndex = 0;
				this.shortVideoPageUrl = null;
				UI.setShortVideoMode(platform);
				UI.setExtraActions([]);
				if (!options.silent) UI.showAlert("解析失败: " + error.message, "error");
				else UI.hideAlert();
				UI.positionPopup();
				return false;
			});
		},
		renderShortVideoInfo(platform) {
			if (!this.shortVideoInfo) return;
			UI.updateShortVideoInfo(this.shortVideoInfo, platform);
			UI.prepareShortVideoItems(this.shortVideoItems, this.selectedShortVideoIndex, (index) => this.selectShortVideoItem(index));
			UI.setExtraActions(this.getShortVideoActions(this.shortVideoInfo, platform));
		},
		selectShortVideoItem(index) {
			if (!this.currentPlatform || !this.shortVideoItems[index]) return;
			this.selectedShortVideoIndex = index;
			this.shortVideoInfo = this.shortVideoItems[index];
			this.coverUrl = this.shortVideoInfo.cover || this.shortVideoInfo.music?.cover || null;
			this.renderShortVideoInfo(this.currentPlatform);
			UI.hideAlert();
			UI.positionPopup();
		},
		getShortVideoActions(data, platform) {
			const actions = [];
			if (data.cover) actions.push({
				marker: "封面",
				label: "下载封面",
				onClick: () => this.downloadCover()
			});
			if (data.music?.url) actions.push({
				marker: "音频",
				label: "下载音频",
				onClick: () => this.downloadShortVideoMusic()
			});
			if (data.type !== "image" && data.images && data.images.length > 0) actions.push({
				marker: "图片",
				label: `下载图片 (${data.images.length})`,
				onClick: () => this.downloadShortVideoImages()
			});
			if (data.type !== "live" && data.live_photo && data.live_photo.length > 0) actions.push({
				marker: "实况",
				label: `下载实况图 (${data.live_photo.length})`,
				onClick: () => this.downloadShortVideoLivePhotos()
			});
			return actions;
		},
		updateSelectedPages() {
			const checkboxes = UI.elements.pagesList.querySelectorAll(".bdl-page-checkbox");
			this.selectedPages = [];
			checkboxes.forEach((cb) => {
				if (cb.checked) this.selectedPages.push(parseInt(cb.dataset.index));
			});
		},
		updateSelectedUGC() {
			const checkboxes = UI.elements.ugcList.querySelectorAll(".bdl-page-checkbox");
			this.selectedUGCEpisodes = [];
			checkboxes.forEach((cb) => {
				if (cb.checked) this.selectedUGCEpisodes.push(parseInt(cb.dataset.index));
			});
		},
		start() {
			if (this.isShortVideoMode()) {
				this.startShortVideoDownload();
				return;
			}
			if (this.isDownloading) return;
			this.startBilibiliDownload();
		},
		startBilibiliDownload() {
			if (this.selectedPages.length + this.selectedUGCEpisodes.length === 0) {
				UI.showAlert("请至少选择一个分P或合集视频", "warning");
				return;
			}
			this.isDownloading = true;
			UI.setDownloading(true);
			UI.showProgress(true);
			UI.hideAlert();
			const allTasks = [];
			for (const idx of this.selectedPages) allTasks.push({
				type: "page",
				index: idx,
				data: this.videoInfo.pages[idx]
			});
			for (const idx of this.selectedUGCEpisodes) allTasks.push({
				type: "ugc",
				index: idx,
				data: this.videoInfo.ugcEpisodes[idx]
			});
			const downloadNext = (index) => {
				if (index >= allTasks.length) {
					this.finishDownload("全部下载完成！");
					return;
				}
				const task = allTasks[index];
				if (allTasks.length > 1) {
					const name = task.type === "page" ? task.data.part : task.data.title;
					UI.showAlert("正在下载 " + (index + 1) + "/" + allTasks.length + ": " + (name || task.data.page), "info");
				}
				this.downloadSinglePage(task.data).then(() => {
					if (index < allTasks.length - 1) Utils.delay(1e3).then(() => downloadNext(index + 1));
					else downloadNext(index + 1);
				}).catch((error) => {
					console.error("下载失败:", error);
					UI.showAlert("下载失败: " + error.message, "error");
					this.resetDownloadingState();
					UI.updateCircleProgress(0);
					setTimeout(() => UI.showProgress(false), 2e3);
				});
			};
			downloadNext(0);
		},
		startShortVideoDownload() {
			const siteContext = Utils.getSiteContext();
			const platform = siteContext.kind === "short-video" ? siteContext.platform : this.currentPlatform;
			if (this.isDownloading) {
				if (!platform) {
					UI.showAlert("当前页面暂不支持", "warning");
					return;
				}
				UI.showAlert("正在解析并加入等待队列...", "info");
				this.prepareShortVideoTask(platform).then((task) => {
					if (!task) return;
					this.enqueueShortVideoTask(task);
				});
				return;
			}
			if (!this.shortVideoInfo || this.shortVideoPageUrl !== location.href || !platform) {
				if (!platform) {
					UI.showAlert("当前页面暂不支持", "warning");
					return;
				}
				UI.setShortVideoMode(platform);
				UI.setExtraActions([]);
				UI.showAlert("正在解析当前页面...", "info");
				this.refreshShortVideoInfo(platform, { silent: false }).then((success) => {
					if (success) UI.showAlert("解析完成，请确认内容后再点击下载", "success");
				});
				return;
			}
			this.runShortVideoTask(this.createShortVideoTask(this.shortVideoInfo, platform, location.href));
		},
		prepareShortVideoTask(platform) {
			if (this.shortVideoInfo && this.shortVideoPageUrl === location.href) return Promise.resolve(this.createShortVideoTask(this.shortVideoInfo, platform, location.href));
			return this.refreshShortVideoInfo(platform, { silent: false }).then((success) => {
				if (!success || !this.shortVideoInfo) return null;
				return this.createShortVideoTask(this.shortVideoInfo, platform, location.href);
			});
		},
		createShortVideoTask(data, platform, pageUrl) {
			const label = data.title || data.desc || data.itemLabel || ShortVideoAPI.getPlatformLabel(platform);
			return {
				data: this.cloneShortVideoData(data),
				platform,
				pageUrl,
				label
			};
		},
		cloneShortVideoData(data) {
			return {
				...data,
				author: data.author ? { ...data.author } : void 0,
				video_backup: data.video_backup ? [...data.video_backup] : void 0,
				images: data.images ? [...data.images] : void 0,
				live_photo: data.live_photo ? data.live_photo.map((item) => ({ ...item })) : void 0,
				music: data.music ? { ...data.music } : void 0,
				items: void 0
			};
		},
		getShortVideoTaskKey(task) {
			return [
				task.platform,
				task.pageUrl,
				task.data.url,
				task.data.images?.join("|"),
				task.data.live_photo?.map((item) => `${item.image || ""}:${item.video || ""}`).join("|"),
				task.data.music?.url
			].join("::");
		},
		enqueueShortVideoTask(task) {
			const taskKey = this.getShortVideoTaskKey(task);
			if ((this.activeShortVideoTask ? this.getShortVideoTaskKey(this.activeShortVideoTask) : "") === taskKey || this.shortVideoQueue.some((item) => this.getShortVideoTaskKey(item) === taskKey)) {
				UI.showAlert("当前内容已在下载或等待队列中", "warning");
				return;
			}
			this.shortVideoQueue.push(task);
			UI.showAlert(`已加入等待队列（${this.shortVideoQueue.length}）: ${task.label}`, "success");
			UI.updateDownloadButtonProgress(0, `下载中 · 队列 ${this.shortVideoQueue.length}`);
		},
		updateShortVideoDownloadProgress(percent, label) {
			const queueText = this.shortVideoQueue.length > 0 ? ` · 队列 ${this.shortVideoQueue.length}` : "";
			UI.updateDownloadButtonProgress(percent, `${label}${queueText}`);
		},
		runShortVideoTask(task) {
			const data = task.data;
			const platform = task.platform;
			const baseFilename = Utils.getShortVideoFilename(data.title || data.desc || data.itemLabel || ShortVideoAPI.getPlatformLabel(platform), data.author?.name);
			this.isDownloading = true;
			this.activeShortVideoTask = task;
			UI.setDownloading(true, {
				allowQueue: true,
				label: "下载中 0% · 再点排队"
			});
			UI.showProgress(true);
			UI.hideAlert();
			UI.updateProgress("video", 0, "准备下载...");
			UI.updateCircleProgress(0);
			this.updateShortVideoDownloadProgress(0, "准备下载");
			let downloadTask;
			if ((data.type === "video" || data.url || data.video_backup?.length) && (data.url || data.video_backup?.length)) {
				const candidates = [data.url, ...data.video_backup || []].filter(Boolean);
				const ext = candidates[0] ? Utils.inferExtension(candidates[0], "mp4") : "mp4";
				downloadTask = this.downloadBlobCandidates(candidates, `${baseFilename}.${ext}`, platform, "下载视频");
			} else if (data.type === "image" && data.images && data.images.length > 0) downloadTask = this.downloadImageCollection(data.images, baseFilename, platform, "图集");
			else if (data.type === "live" && data.live_photo && data.live_photo.length > 0) downloadTask = this.downloadLivePhotoCollection(data.live_photo, baseFilename, platform);
			else if (data.music?.url) {
				const ext = Utils.inferExtension(data.music.url, "mp3");
				downloadTask = this.downloadBlobCandidates([data.music.url], `${baseFilename}_music.${ext}`, platform, "下载音频");
			} else {
				UI.showAlert("没有找到可下载的内容", "warning");
				this.resetDownloadingState();
				UI.showProgress(false);
				return;
			}
			downloadTask.then(() => {
				this.finishShortVideoTask("下载完成！");
			}).catch((error) => {
				console.error("下载失败:", error);
				UI.showAlert("下载失败: " + error.message, "error");
				const hasQueuedTask = this.shortVideoQueue.length > 0;
				this.resetDownloadingState();
				UI.updateCircleProgress(0);
				if (!hasQueuedTask) setTimeout(() => UI.showProgress(false), 2e3);
				this.startNextShortVideoTask();
			});
		},
		finishShortVideoTask(message) {
			UI.showAlert(this.shortVideoQueue.length > 0 ? `${message} 继续下载队列...` : message, "success");
			CompleteEffect.show(UI.root, UI.elements.progressCircle);
			this.resetDownloadingState();
			setTimeout(() => UI.updateCircleProgress(0), 1e3);
			if (this.shortVideoQueue.length === 0) setTimeout(() => UI.showProgress(false), 3e3);
			this.startNextShortVideoTask();
		},
		startNextShortVideoTask() {
			const next = this.shortVideoQueue.shift();
			if (!next) return;
			setTimeout(() => {
				UI.showAlert(`开始队列任务（剩余 ${this.shortVideoQueue.length}）: ${next.label}`, "info");
				this.runShortVideoTask(next);
			}, 600);
		},
		downloadSinglePage(pageInfo) {
			const videoId = Utils.getVideoId();
			UI.updateProgress("video", 0, "获取下载地址...");
			UI.updateProgress("audio", 0);
			UI.updateProgress("merge", 0);
			const playParams = {
				type: this.videoType,
				cid: pageInfo.cid,
				qn: this.selectedQuality
			};
			if (this.videoType === "bangumi") playParams.ep_id = pageInfo.ep_id;
			else playParams.bvid = videoId.id;
			return BiliAPI.getPlayUrl(playParams).then((playData) => {
				const streams = BiliAPI.getStreams(playData, this.selectedQuality, this.selectedVideoCodec, this.selectedAudioCodec);
				if (!streams.video) throw new Error("无法获取视频流");
				const videoUrl = streams.video.baseUrl || streams.video.base_url;
				const audioUrl = streams.audio ? streams.audio.baseUrl || streams.audio.base_url : null;
				UI.updateProgress("video", 0, "下载视频...");
				UI.updateCircleProgress(0);
				return ThreadManager.downloadWithThread(videoUrl, audioUrl, (loaded, total) => {
					const percent = Math.round(loaded / total * 100);
					UI.updateProgress("video", percent);
					UI.updateCircleProgress(audioUrl ? percent * .4 : percent);
				}, (loaded, total) => {
					const percent = Math.round(loaded / total * 100);
					UI.updateProgress("audio", percent);
					UI.updateCircleProgress(40 + percent * .4);
				}).then((buffers) => {
					UI.updateProgress("video", 100);
					if (buffers.audioBuffer) UI.updateProgress("audio", 100);
					return buffers;
				});
			}).then((buffers) => {
				const metadata = {
					title: this.videoInfo.title + (pageInfo.part ? " - " + pageInfo.part : ""),
					author: this.videoInfo.owner.name,
					description: this.videoInfo.desc,
					duration: pageInfo.duration
				};
				let filename = this.videoInfo.title;
				if (this.videoInfo.pages.length > 1 && pageInfo.part) filename += " - " + pageInfo.part;
				filename += " - " + this.videoInfo.owner.name;
				filename = Utils.sanitizeFilename(filename);
				if (buffers.audioBuffer && MergeManager.currentMethod !== CONFIG.MERGE_METHODS.SEPARATE) {
					UI.updateProgress("merge", 0, "合并中...");
					return MergeManager.merge(buffers.videoBuffer, buffers.audioBuffer, metadata).then((result) => {
						if (result.separate) this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
						else {
							UI.updateProgress("merge", 100);
							UI.updateCircleProgress(100);
							this.saveFile(result.data, filename + ".mp4");
						}
					}).catch((mergeError) => {
						console.error("合并失败:", mergeError);
						UI.showAlert("合并失败，已分别保存。错误: " + mergeError.message, "warning");
						this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
					});
				} else if (buffers.audioBuffer) this.saveSeparate(buffers.videoBuffer, buffers.audioBuffer, filename);
				else this.saveFile(buffers.videoBuffer, filename + ".mp4");
			});
		},
		finishDownload(message) {
			UI.showAlert(message, "success");
			CompleteEffect.show(UI.root, UI.elements.progressCircle);
			this.resetDownloadingState();
			setTimeout(() => UI.updateCircleProgress(0), 1e3);
			setTimeout(() => UI.showProgress(false), 3e3);
		},
		resetDownloadingState() {
			this.isDownloading = false;
			this.activeShortVideoTask = null;
			UI.setDownloading(false);
			if (this.isShortVideoMode() && this.shortVideoInfo && this.currentPlatform) UI.setPrimaryButtonLabel(UI.getShortVideoPrimaryLabel(this.shortVideoInfo));
		},
		downloadBlobCandidates(urls, filename, platform, progressLabel, scope = {
			base: 0,
			span: 100
		}) {
			const candidates = [...new Set(urls.filter(Boolean))];
			if (candidates.length === 0) return Promise.reject(/* @__PURE__ */ new Error("未找到可下载地址"));
			const headers = ShortVideoAPI.getMediaHeaders(platform);
			let lastError = null;
			const getScopedPercent = (percent) => Math.min(100, Math.round(scope.base + percent * scope.span / 100));
			const tryDirect = (index) => {
				if (index >= candidates.length) return Promise.reject(lastError || /* @__PURE__ */ new Error("所有下载地址均不可用"));
				const currentUrl = candidates[index];
				UI.updateProgress("video", 0, candidates.length > 1 ? `${progressLabel} (${index + 1}/${candidates.length})` : progressLabel);
				return Network.downloadBlob(currentUrl, (loaded, total) => {
					if (!total) return;
					const percent = Math.round(loaded / total * 100);
					const scopedPercent = getScopedPercent(percent);
					UI.updateProgress("video", percent, `${progressLabel} ${percent}%`);
					UI.updateCircleProgress(scopedPercent);
					this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} ${percent}%`);
				}, headers).catch((error) => {
					lastError = error;
					return tryDirect(index + 1);
				});
			};
			return tryDirect(0).catch((error) => {
				lastError = error;
				const proxyUrl = ShortVideoAPI.getProxyUrl(candidates[0], platform);
				if (!proxyUrl) throw error;
				UI.updateProgress("video", 0, `${progressLabel}（代理重试）`);
				return Network.downloadBlob(proxyUrl, (loaded, total) => {
					if (!total) return;
					const percent = Math.round(loaded / total * 100);
					const scopedPercent = getScopedPercent(percent);
					UI.updateProgress("video", percent, `${progressLabel} ${percent}%`);
					UI.updateCircleProgress(scopedPercent);
					this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} ${percent}%`);
				});
			}).then((blob) => {
				UI.updateProgress("video", 100, "100%");
				const scopedPercent = getScopedPercent(100);
				UI.updateCircleProgress(scopedPercent);
				this.updateShortVideoDownloadProgress(scopedPercent, `${progressLabel} 100%`);
				this.saveFile(blob, filename);
			});
		},
		downloadImageCollection(images, baseFilename, platform, marker) {
			const urls = images.filter(Boolean);
			if (urls.length === 0) return Promise.reject(/* @__PURE__ */ new Error("没有可下载的图片"));
			let completed = 0;
			const total = urls.length;
			const downloadNext = (index) => {
				if (index >= urls.length) {
					UI.updateProgress("video", 100, "100%");
					UI.updateCircleProgress(100);
					return Promise.resolve();
				}
				const url = urls[index];
				const ext = Utils.inferExtension(url, "jpg");
				const filename = `${baseFilename}${total > 1 ? `_${String(index + 1).padStart(2, "0")}` : ""}.${ext}`;
				UI.updateProgress("video", Math.round(completed / total * 100), `${marker} ${index + 1}/${total}`);
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
		downloadLivePhotoCollection(livePhotos, baseFilename, platform) {
			const assets = [];
			livePhotos.forEach((item, index) => {
				const serial = String(index + 1).padStart(2, "0");
				if (item.image) assets.push({
					url: item.image,
					filename: `${baseFilename}_${serial}.${Utils.inferExtension(item.image, "jpg")}`
				});
				if (item.video) assets.push({
					url: item.video,
					filename: `${baseFilename}_${serial}_live.${Utils.inferExtension(item.video, "mp4")}`
				});
			});
			if (assets.length === 0) return Promise.reject(/* @__PURE__ */ new Error("没有可下载的实况图内容"));
			let completed = 0;
			const total = assets.length;
			const downloadNext = (index) => {
				if (index >= assets.length) {
					UI.updateProgress("video", 100, "100%");
					UI.updateCircleProgress(100);
					return Promise.resolve();
				}
				const asset = assets[index];
				UI.updateProgress("video", Math.round(completed / total * 100), `实况图 ${index + 1}/${total}`);
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
		downloadShortVideoImages() {
			if (!this.shortVideoInfo || !this.currentPlatform || !this.shortVideoInfo.images?.length) {
				UI.showAlert("当前内容没有可下载的图片", "warning");
				return;
			}
			const baseFilename = Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || "图集", this.shortVideoInfo.author?.name);
			UI.showAlert("正在下载图片...", "info");
			UI.showProgress(true);
			UI.updateCircleProgress(0);
			this.downloadImageCollection(this.shortVideoInfo.images, baseFilename, this.currentPlatform, "图片").then(() => {
				UI.showAlert("图片下载完成", "success");
				setTimeout(() => UI.showProgress(false), 1200);
			}).catch((error) => UI.showAlert("下载图片失败: " + error.message, "error"));
		},
		downloadShortVideoLivePhotos() {
			if (!this.shortVideoInfo || !this.currentPlatform || !this.shortVideoInfo.live_photo?.length) {
				UI.showAlert("当前内容没有可下载的实况图", "warning");
				return;
			}
			const baseFilename = Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || "实况图", this.shortVideoInfo.author?.name);
			UI.showAlert("正在下载实况图...", "info");
			UI.showProgress(true);
			UI.updateCircleProgress(0);
			this.downloadLivePhotoCollection(this.shortVideoInfo.live_photo, baseFilename, this.currentPlatform).then(() => {
				UI.showAlert("实况图下载完成", "success");
				setTimeout(() => UI.showProgress(false), 1200);
			}).catch((error) => UI.showAlert("下载实况图失败: " + error.message, "error"));
		},
		downloadCover() {
			if (this.isShortVideoMode()) {
				this.downloadShortVideoCover();
				return;
			}
			if (!this.coverUrl) {
				UI.showAlert("没有找到封面", "warning");
				return;
			}
			UI.showAlert("正在下载封面...", "info");
			fetch(this.coverUrl).then((r) => r.blob()).then((blob) => {
				const ext = this.coverUrl.match(/\.(jpg|jpeg|png|webp)($|\?)/i);
				this.saveFile(blob, Utils.sanitizeFilename(this.videoInfo.title) + "_cover." + (ext ? ext[1] : "jpg"));
				UI.showAlert("封面下载完成", "success");
			}).catch((e) => UI.showAlert("下载封面失败: " + e.message, "error"));
		},
		downloadShortVideoCover() {
			if (!this.shortVideoInfo?.cover || !this.currentPlatform) {
				UI.showAlert("没有找到封面", "warning");
				return;
			}
			const ext = Utils.inferExtension(this.shortVideoInfo.cover, "jpg");
			const filename = `${Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || "cover", this.shortVideoInfo.author?.name)}_cover.${ext}`;
			UI.showAlert("正在下载封面...", "info");
			UI.showProgress(true);
			UI.updateCircleProgress(0);
			this.downloadBlobCandidates([this.shortVideoInfo.cover], filename, this.currentPlatform, "下载封面").then(() => {
				UI.showAlert("封面下载完成", "success");
				setTimeout(() => UI.showProgress(false), 1200);
			}).catch((error) => UI.showAlert("下载封面失败: " + error.message, "error"));
		},
		downloadSubtitles() {
			if (this.availableSubtitles.length === 0) {
				UI.showAlert("没有可用的字幕", "warning");
				return;
			}
			UI.showAlert("正在下载字幕...", "info");
			const promises = this.availableSubtitles.map((sub) => {
				let url = sub.subtitle_url;
				if (!url.startsWith("http")) url = "https:" + url;
				return fetch(url).then((r) => r.json()).then((data) => ({
					lan: sub.lan_doc || sub.lan,
					data
				}));
			});
			Promise.all(promises).then((results) => {
				results.forEach((result) => {
					const srt = this.convertJsonToSrt(result.data);
					this.saveFile(new Blob([srt], { type: "text/plain;charset=utf-8" }), Utils.sanitizeFilename(this.videoInfo.title) + "_" + result.lan + ".srt");
				});
				UI.showAlert("字幕下载完成", "success");
			}).catch((error) => UI.showAlert("下载字幕失败: " + error.message, "error"));
		},
		downloadShortVideoMusic() {
			if (!this.shortVideoInfo?.music?.url || !this.currentPlatform) {
				UI.showAlert("当前内容没有可下载的音频", "warning");
				return;
			}
			const ext = Utils.inferExtension(this.shortVideoInfo.music.url, "mp3");
			const filename = `${Utils.getShortVideoFilename(this.shortVideoInfo.title || this.shortVideoInfo.desc || "audio", this.shortVideoInfo.author?.name)}_music.${ext}`;
			UI.showAlert("正在下载音频...", "info");
			UI.showProgress(true);
			UI.updateCircleProgress(0);
			this.downloadBlobCandidates([this.shortVideoInfo.music.url], filename, this.currentPlatform, "下载音频").then(() => {
				UI.showAlert("音频下载完成", "success");
				setTimeout(() => UI.showProgress(false), 1200);
			}).catch((error) => UI.showAlert("下载音频失败: " + error.message, "error"));
		},
		downloadDanmaku() {
			const page = this.videoInfo.currentPage || Utils.getCurrentPage();
			const pageInfo = this.videoInfo.pages[page - 1];
			UI.showAlert("正在下载弹幕...", "info");
			BiliAPI.getDanmaku(pageInfo.cid).then((xmlData) => {
				let filename = Utils.sanitizeFilename(this.videoInfo.title);
				if (this.videoInfo.pages.length > 1 && pageInfo.part) filename += " - " + pageInfo.part;
				this.saveFile(new Blob([xmlData], { type: "text/xml;charset=utf-8" }), filename + ".xml");
				UI.showAlert("弹幕下载完成", "success");
			}).catch((error) => UI.showAlert("下载弹幕失败: " + error.message, "error"));
		},
		convertJsonToSrt(jsonData) {
			let srt = "";
			if (jsonData.body && Array.isArray(jsonData.body)) jsonData.body.forEach((item, index) => {
				srt += index + 1 + "\n" + this.formatSrtTime(item.from) + " --> " + this.formatSrtTime(item.to) + "\n" + item.content + "\n\n";
			});
			return srt;
		},
		formatSrtTime(seconds) {
			const h = Math.floor(seconds / 3600);
			const m = Math.floor(seconds % 3600 / 60);
			const s = Math.floor(seconds % 60);
			const ms = Math.floor(seconds % 1 * 1e3);
			return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0") + "," + String(ms).padStart(3, "0");
		},
		saveSeparate(videoBuffer, audioBuffer, filename) {
			this.saveFile(videoBuffer, filename + "_video.mp4");
			setTimeout(() => this.saveFile(audioBuffer, filename + "_audio.m4a"), 500);
		},
		saveFile(buffer, filename) {
			const blob = buffer instanceof Blob ? buffer : new Blob([buffer], { type: "video/mp4" });
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = filename;
			anchor.style.display = "none";
			document.body.appendChild(anchor);
			anchor.click();
			setTimeout(() => {
				document.body.removeChild(anchor);
				URL.revokeObjectURL(url);
			}, 1e3);
		}
	};
	//#endregion
	//#region src/main.ts
	var initialized = false;
	var initTimer = null;
	var ffmpegLoadPromise = null;
	function getFFmpegGlobal() {
		if (typeof FFmpeg !== "undefined") return FFmpeg;
		if (typeof unsafeWindow !== "undefined" && unsafeWindow.FFmpeg) {
			globalThis.FFmpeg = unsafeWindow.FFmpeg;
			return unsafeWindow.FFmpeg;
		}
		return null;
	}
	function bindUIEvents() {
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
		el.btn.addEventListener("click", (event) => {
			event.stopPropagation();
			if (UI.consumeEntryClickSuppression()) return;
			if (UI.togglePopup() && !Downloader.isDownloading) Downloader.refreshInfo();
		});
		el.close.addEventListener("click", () => UI.hidePopup());
		document.addEventListener("click", (e) => {
			const path = e.composedPath();
			if (!path.includes(el.panel) && !path.includes(el.entry)) UI.hidePopup();
		});
		el.methods.addEventListener("click", (e) => {
			const item = e.target.closest(".bdl-method-item");
			if (item) {
				const method = item.dataset.method;
				UI.queryAll(".bdl-method-item").forEach((i) => i.classList.remove("active"));
				item.classList.add("active");
				MergeManager.setMethod(method);
				UI.hideTips();
				el.mergeRow.style.display = method === "separate" ? "none" : "block";
			}
		});
		el.download.addEventListener("click", () => Downloader.start());
		el.footer.addEventListener("click", () => {
			if (UI.handleFooterSecretClick()) UI.positionPopup();
		});
		el.selectAll.addEventListener("click", () => {
			el.pagesList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = true);
			Downloader.updateSelectedPages();
		});
		el.selectNone.addEventListener("click", () => {
			el.pagesList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = false);
			Downloader.updateSelectedPages();
		});
		el.selectReverse.addEventListener("click", () => {
			el.pagesList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = !cb.checked);
			Downloader.updateSelectedPages();
		});
		el.ugcSelectAll.addEventListener("click", () => {
			el.ugcList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = true);
			Downloader.updateSelectedUGC();
		});
		el.ugcSelectNone.addEventListener("click", () => {
			el.ugcList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = false);
			Downloader.updateSelectedUGC();
		});
		el.ugcSelectReverse.addEventListener("click", () => {
			el.ugcList.querySelectorAll(".bdl-page-checkbox").forEach((cb) => cb.checked = !cb.checked);
			Downloader.updateSelectedUGC();
		});
		el.videoCodec.addEventListener("change", function() {
			Downloader.selectedVideoCodec = this.value;
		});
		el.audioCodec.addEventListener("change", function() {
			Downloader.selectedAudioCodec = parseInt(this.value);
		});
		window.addEventListener("resize", () => {
			UI.positionEntry();
			UI.positionPopup();
		});
		document.addEventListener("scroll", () => {
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
		}).observe(document.body, {
			childList: true,
			subtree: true
		});
	}
	function loadFFmpeg() {
		if (getFFmpegGlobal()) return Promise.resolve();
		if (ffmpegLoadPromise) return ffmpegLoadPromise;
		ffmpegLoadPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.src = "https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js";
			script.async = true;
			script.onload = () => {
				if (getFFmpegGlobal()) resolve();
				else reject(/* @__PURE__ */ new Error("FFmpeg 加载后不可用"));
			};
			script.onerror = () => reject(/* @__PURE__ */ new Error("FFmpeg 加载失败"));
			(document.head || document.documentElement).appendChild(script);
		});
		return ffmpegLoadPromise;
	}
	function checkFFmpegAvailability() {
		const updateStatus = (ready) => {
			const el = UI.query("[data-method=\"ffmpeg-merge\"] .bdl-method-status");
			if (!el) return;
			el.textContent = ready ? "就绪" : "不可用";
			el.className = ready ? "bdl-method-status ready" : "bdl-method-status";
			el.style.background = ready ? "" : "#f8d7da";
			el.style.color = ready ? "" : "#721c24";
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
	function init() {
		if (initialized) return;
		if (!document.body) {
			scheduleInit(50);
			return;
		}
		const siteContext = Utils.getSiteContext();
		if (siteContext.kind === "unsupported") return;
		initialized = true;
		ThreadManager.init();
		UI.init();
		if (siteContext.kind === "short-video") UI.setShortVideoMode(siteContext.platform);
		bindUIEvents();
		if (siteContext.kind === "bilibili") checkFFmpegAvailability();
		setTimeout(() => Downloader.refreshInfo({ silent: siteContext.kind === "short-video" }), siteContext.kind === "short-video" ? 900 : 500);
		console.log("[视频下载助手] 初始化完成");
		console.log("[视频下载助手] CPU逻辑核心数:", Utils.getCPUCores());
		console.log("[视频下载助手] 最大下载线程数:", ThreadManager.maxThreads);
		console.log("[视频下载助手] 版本: 0.2.0");
	}
	function scheduleInit(delay) {
		if (initialized || initTimer !== null) return;
		initTimer = window.setTimeout(() => {
			initTimer = null;
			init();
		}, delay);
	}
	init();
	scheduleInit(100);
	document.addEventListener("DOMContentLoaded", init, { once: true });
	window.addEventListener("load", init, { once: true });
	//#endregion
})();
