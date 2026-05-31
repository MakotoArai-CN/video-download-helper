import { defineConfig } from 'vite';
import { resolve } from 'path';

const userscriptHeader = `// ==UserScript==
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
