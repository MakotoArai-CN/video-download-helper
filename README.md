# 视频下载助手

一个面向 Userscript 管理器的浏览器下载辅助脚本。哔哩哔哩及已接入原生解析的平台使用页面数据、站点接口和浏览器本地下载逻辑；其他平台提供外部下载网站入口。

## 功能概览

| 模块 | 能力 | 说明 |
| --- | --- | --- |
| 哔哩哔哩 | 普通视频、分 P、番剧/剧集、合集 | 默认只下载当前视频；隐藏入口解锁后支持多选 |
| B 站附加资源 | 封面、字幕、弹幕 | 按页面接口返回结果展示 |
| B 站合并 | JS 原生合并、分离下载、FFmpeg 合并 | 默认推荐 JS 原生合并 |
| 短视频解析 | 抖音、快手、小红书、微博、今日头条、X (Twitter)、Reddit | 依赖页面数据与站点接口 |
| 快手推荐流 | `new-reco` 当前播放内容 | 优先读取页面当前媒体源，成功率取决于页面暴露信息 |
| 外部下载网站 | YouTube、TikTok、Instagram、Facebook、Threads、Pinterest、Snapchat、TED、Vimeo、Twitch、SoundCloud、Dailymotion | 转交当前内容链接到所选网站，不在脚本内解析或下载 |
| 备用线路 | 抖音、小红书、X、Reddit | 保留原生下载，同时提供适用的外部网站入口 |

## 免责声明

- 本工具仅用于个人学习研究用途，禁止用于商业用途。
- 请尊重内容创作者，并优先通过正规渠道观看与下载。
- 脚本由 AI 辅助生成，不保证准确性、完整性、及时性或可靠性。
- 哔哩哔哩下载走浏览器本地请求与本地合并逻辑。

## 支持环境

| 项目 | 要求 |
| --- | --- |
| 浏览器 | Chrome、Edge、Firefox 等现代桌面浏览器 |
| 脚本管理器 | Tampermonkey、Violentmonkey、Greasemonkey、Scriptcat |
| 关键权限 | `GM_xmlhttpRequest` 跨域请求 |

## 安装

1. 安装任意 Userscript 管理器。
2. 打开最新发布脚本：`https://github.com/MakotoArai-CN/video-download-helper/releases/latest/download/video-download-helper.user.js`。
3. 在脚本管理器弹出的安装页中确认安装。
4. 如果脚本管理器提示跨域权限，请允许访问 B 站接口、视频域名以及媒体资源域名。

## 哔哩哔哩使用

适用页面：

- `https://www.bilibili.com/video/*`
- `https://www.bilibili.com/bangumi/play/*`

基础流程：

1. 打开 B 站视频、番剧或剧集页面。
2. 点击页面上的下载入口打开面板。
3. 选择清晰度、视频编码、音频编码和合并方式。
4. 点击“开始下载”。

默认行为：

- 即使当前视频有多个分 P，默认也只下载当前正在观看的分 P。
- 未触发隐藏入口时，使用体验与单视频一致。
- 默认勾选当前 P，不主动展示多 P 多选列表。

隐藏多选入口：

- 连续点击面板底部免责声明区域 5 次后，展开分 P / 合集多选列表。
- 解锁后再次点击底部区域，可展开或收起多选列表。
- 多选列表支持全选、取消、反选。

## 短视频使用

适用平台：

| 平台 | 说明 |
| --- | --- |
| 抖音 | 支持视频、笔记图集、实况图和 `modal_id`；按作品 ID 匹配缓存，保留图集顺序与背景音乐 |
| 快手 | 支持作品页；推荐流页会尝试读取当前播放源 |
| 小红书 | 支持笔记详情页图集、实况图和视频，按当前笔记 ID 读取页面状态 |
| 微博 | 支持视频内容页解析 |
| 今日头条 | 支持视频内容页（`/video/`）解析 |
| X (Twitter) | 支持推文视频与图集解析，GIF 可转码为 GIF 文件 |
| Reddit | 支持帖子详情页、图集页及 redd.it 短链接；图片、图集、原生视频和转帖，独立音轨自动合并 |

Reddit 请先打开具体帖子再点击下载入口。纯文字和外站视频链接不提供媒体下载；请求被限制或帖子需要登录时会显示错误提示。独立音轨无法读取或合并时会报错，避免将无声视频误当作完整视频保存。

基础流程：

1. 打开受支持平台的具体内容页。
2. 点击浮动下载入口。
3. 等待脚本解析当前内容。
4. 点击下载按钮保存视频、图集、实况图、封面或音频。

队列行为：

- 短视频下载过程中，再次点击下载按钮会尝试解析当前页面并加入等待队列。
- 重复内容不会重复入队。

## 外部下载网站

打开具体内容页，点击下载入口，在“下载网站”中选择服务并点击“打开下载网站”。服务会在新标签页打开，并收到当前内容链接；选择会按平台记住。已有原生解析的平台，在面板中的“备用下载网站”提供同样的入口。

| 平台 | 识别的主要页面 | 可选网站 |
| --- | --- | --- |
| YouTube | watch、Shorts、embed、live、youtu.be；含移动版与 Music | SaveAnyYouTube、SSYouTube、Yout、Tenzaa、Tool77、GrabShorts、Y2Mate Stream |
| TikTok | 视频、图集、t/v 链接、vm/vt 短链接 | Yout、Tool77、GrabShorts |
| Instagram | 帖子、Reels、TV、带内容 ID 的 Stories | Yout、Tool77、GrabShorts |
| Facebook | watch 视频、Reels、videos、share/v、share/r、fb.watch | Yout、Tool77 |
| Threads | threads.net / threads.com 帖子及 t 链接 | Tool77、GrabShorts |
| Pinterest | Pin 详情、pin.it | Tool77 |
| Snapchat | Spotlight | Tool77 |
| TED | talks | Tool77 |
| Vimeo | 视频、播放器、频道/群组视频、showcase/album 视频 | Yout |
| Twitch | VOD、频道 Clip、clips.twitch.tv | Yout |
| SoundCloud | 单曲、on.soundcloud.com 短链接 | Yout |
| Dailymotion | 视频、嵌入页、dai.ly | Yout、Tool77 |
| 抖音 | video、note、modal_id/aweme_id、分享链接 | Tool77、GrabShorts |
| 小红书 | explore、discovery/item、个人页笔记、短链接 | Tool77 |
| X / Twitter | 推文及 photo/video 子页面 | Yout、Tool77、GrabShorts |
| Reddit | comments、gallery、redd.it | Yout |

“检查网站响应”只检查所选网站首页的 HTTP 响应，不发送当前内容链接，也不会自动切换线路。网站响应正常不代表能解析或下载当前内容；登录要求、清晰度与下载结果取决于第三方网站。以上为链接识别和转交范围，并非逐平台下载成功保证。

页面切换后会更新内容链接；首页、个人主页和缺少内容参数的页面不提供无效的外部下载链接。小红书 `xsec_token`、Vimeo `h` 等访问参数会保留。

## 合并与保存

| 方式 | 行为 |
| --- | --- |
| JS 原生合并 | 默认方式，在浏览器内合并 DASH 视频流和音频流，输出单个 `.mp4` |
| 分离下载 | 分别保存 `_video.mp4` 和 `_audio.m4a` |
| FFmpeg 合并 | 尝试动态加载 FFmpeg 前端库，加载失败不影响默认 JS 合并 |

合并失败时，脚本会自动回退为分离保存。

## 限制说明

- 清晰度取决于账号权限和平台接口返回结果。
- 脚本不会破解付费、DRM 或无权限内容。
- 大文件下载和浏览器内合并会占用较多内存。
- 原生解析依赖页面数据和站点接口，接口变更、平台风控或页面改版都可能导致解析失败；外部下载依赖所选第三方网站。
- 快手 `new-reco` 不是具体作品 URL，解析成功率取决于页面是否暴露当前播放视频源或作品 ID。

## 故障排查

| 问题 | 处理方式 |
| --- | --- |
| 解析失败 | 刷新页面，确认内容可正常播放，再重新打开下载面板 |
| 下载失败 | 检查 Userscript 管理器是否允许跨域请求和媒体域名访问 |
| 清晰度不可选 | 当前账号可能没有对应清晰度权限 |
| 合并失败 | 使用分离下载，或用本地 ffmpeg 手动合并 |

本地 ffmpeg 合并示例：

```powershell
ffmpeg -i "input_video.mp4" -i "input_audio.m4a" -c copy "output_merged.mp4"
```

## 开发

| 项目 | 路径/命令 |
| --- | --- |
| 源码入口 | `src/main.ts` |
| 配置文件 | `src/config.ts` |
| 平台与线路 | `src/platforms.ts`、`src/download-routes.ts` |
| 回归测试 / 类型检查 | `bun test` / `bun run type-check` |
| 构建命令 | `bun run build` |
| 生成脚本 | `dist/video-download-helper.user.js` |
