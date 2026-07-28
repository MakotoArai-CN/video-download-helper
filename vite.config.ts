import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

const isDev = process.env.VDH_DEV === '1';

const matchRules = [
  '*://www.bilibili.com/video/*',
  '*://www.bilibili.com/bangumi/play/*',
  '*://douyin.com/*',
  '*://*.douyin.com/*',
  '*://iesdouyin.com/*',
  '*://*.iesdouyin.com/*',
  '*://kuaishou.com/*',
  '*://*.kuaishou.com/*',
  '*://xiaohongshu.com/*',
  '*://*.xiaohongshu.com/*',
  '*://xhslink.com/*',
  '*://*.xhslink.com/*',
  '*://xhs.cn/*',
  '*://*.xhs.cn/*',
  '*://weibo.com/*',
  '*://*.weibo.com/*',
  '*://weibo.cn/*',
  '*://*.weibo.cn/*',
  '*://toutiao.com/*',
  '*://*.toutiao.com/*',
  '*://ippzone.com/*',
  '*://*.ippzone.com/*',
  '*://pipigx.com/*',
  '*://*.pipigx.com/*',
  '*://x.com/*',
  '*://*.x.com/*',
  '*://twitter.com/*',
  '*://*.twitter.com/*',
];

const matchLines = matchRules.map(m => `// @match        ${m}`).join('\n');

const commonMeta = `// @namespace    https://github.com/MakotoArai-CN/video-download-helper
// @version      0.2.4
// @description  支持哔哩哔哩原生下载，以及抖音、快手、小红书、微博、今日头条、皮皮搞笑等站点的内容解析下载，新增智能诊断日志反馈功能，脚本仅供学习研究使用。
// @author       Makoto
${matchLines}
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
// @connect      x.com
// @connect      twitter.com
// @connect      twimg.com
// @connect      video.twimg.com
// @connect      *
// @run-at       document-start
// @license      MIT`;

const prodHeader = `// ==UserScript==
// @name         视频下载助手 - 多平台
${commonMeta}
// @downloadURL  https://github.com/MakotoArai-CN/video-download-helper/releases/latest/download/video-download-helper.user.js
// @updateURL    https://github.com/MakotoArai-CN/video-download-helper/releases/latest/download/video-download-helper.user.js
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
        banner: isDev ? '' : prodHeader,
        intro: "'use strict';",
      },
    },
    outDir: isDev ? 'dist/dev' : 'dist',
    minify: false,
    cssCodeSplit: false,
  },
  plugins: [
    {
      name: 'dev-stub',
      closeBundle() {
        if (!isDev) return;
        const devFile = path.resolve(__dirname, 'dist/dev/video-download-helper.user.js');
        const stubFile = path.resolve(__dirname, 'dist/video-download-helper.dev.user.js');
        const stub = `// ==UserScript==
// @name         视频下载助手 - 多平台 [DEV]
${commonMeta}
// @require      file://${devFile.replace(/\\/g, '/')}
// ==/UserScript==
`;
        fs.mkdirSync(path.dirname(stubFile), { recursive: true });
        fs.writeFileSync(stubFile, stub, 'utf-8');
        console.log('[dev-stub] stub written:', stubFile);
      },
    },
  ],
});
