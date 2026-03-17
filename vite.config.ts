import { defineConfig } from 'vite';
import { resolve } from 'path';

const userscriptHeader = `// ==UserScript==
// @name         视频下载助手 - 哔哩哔哩
// @namespace    https://github.com/MakotoArai-CN/video-download-helper
// @version      0.1.3
// @description  纯本地的视频下载器，使用原生JavaScript对视频音频进行合并并输出，支持登录账号可以观看的最高分辨率视频下载（非破解，下载的清晰度等取决于账号权限），脚本仅供学习研究使用。
// @author       Makoto
// @match        *://www.bilibili.com/video/*
// @match        *://www.bilibili.com/bangumi/play/*
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
// @connect      *
// @require      https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.11.6/ffmpeg.min.js
// @run-at       document-idle
// @license      MIT
// ==/UserScript==
`;

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'VideoDownloadHelper',
      fileName: () => 'video-download-helper.user.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        banner: userscriptHeader,
        // Wrap in strict IIFE
        intro: "'use strict';",
      },
    },
    outDir: 'dist',
    minify: false,
    cssCodeSplit: false,
  },
});
