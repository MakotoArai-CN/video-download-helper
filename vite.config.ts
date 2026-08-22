import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import { PLATFORMS } from './src/platforms.ts';

/**
 * @match 列表由平台注册表推导，避免与 src/platforms.ts 中的域名各自维护。
 *
 * B 站单列：它是唯一按路径限定的站点，只在视频页与番剧页注入。
 */
const matchRules = [
  '*://www.bilibili.com/video/*',
  '*://www.bilibili.com/bangumi/play/*',
  ...Object.values(PLATFORMS).flatMap(def =>
    def.hosts.flatMap(host => [`*://${host}/*`, `*://*.${host}/*`])
  ),
];

/** 发布产物地址，同时用于 @downloadURL 与 @updateURL。 */
const releaseURL =
  'https://github.com/MakotoArai-CN/video-download-helper/releases/latest/download/video-download-helper.user.js';

export default defineConfig({
  resolve: {
    extensions: ['.ts', '.js'],
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        // 删除 console
        drop_console: true,
        // 删除 debugger
        drop_debugger: true,
        // 删除无用的代码
        dead_code: true,
        // 优化 if 语句
        conditionals: true,
        // 优化布尔运算
        booleans: true,
        // 移除未使用的变量
        unused: true,
        // 优化 if return 语句
        if_return: true,
        // 合并连续的声明
        join_vars: true,
        // 按变量的赋值情况改写引用
        reduce_vars: true,
        // 内联函数
        inline: 2,
        // 优化循环
        loops: true,
        // 移除顶层未引用的函数与变量
        toplevel: true,
        // 计算常量表达式
        evaluate: true,
        // 压缩轮数
        passes: 3,
        // 不保留未使用的形参
        keep_fargs: false,
        // 不保留函数名
        keep_fnames: false,
        // 不保留类名
        keep_classnames: false,
      },
      mangle: {
        // 混淆顶层作用域的名字
        toplevel: true,
      },
      format: {
        // 删除所有注释
        comments: false,
        // 按需选择引号
        quote_style: 0,
      },
    },
  },
  plugins: [
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: '视频下载助手 - 多平台',
        namespace: 'https://github.com/MakotoArai-CN/video-download-helper',
        version: '0.2.5',
        description:
          '支持哔哩哔哩原生下载，以及抖音、快手、小红书、微博、今日头条、X 等站点的内容解析下载，新增智能诊断日志反馈功能，脚本仅供学习研究使用。',
        author: 'Makoto',
        license: 'MIT',
        icon: 'https://www.bilibili.com/favicon.ico',
        match: matchRules,
        grant: ['GM_xmlhttpRequest', 'GM_addStyle', 'GM_getValue', 'GM_setValue', 'unsafeWindow'],
        connect: [
          'api.bilibili.com',
          'bilivideo.com',
          'bilivideo.cn',
          'bilivideo.net',
          'akamaized.net',
          'x.com',
          'twitter.com',
          'twimg.com',
          'video.twimg.com',
          '*',
        ],
        'run-at': 'document-start',
        downloadURL: releaseURL,
        updateURL: releaseURL,
      },
      build: {
        fileName: 'video-download-helper.user.js',
        metaFileName: true,
      },
    }),
  ],
});
