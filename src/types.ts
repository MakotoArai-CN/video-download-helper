export interface QualityItem {
  qn: number;
  desc: string;
  available: boolean;
}

export interface VideoCodecItem {
  type: string;
  name: string;
  videos: DashStream[];
}

export interface AudioCodecItem {
  id: number;
  name: string;
  data: DashStream;
}

export interface DashStream {
  id: number;
  codecs: string;
  bandwidth: number;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
}

export interface DashData {
  video?: DashStream[];
  audio?: DashStream[];
  dolby?: { audio?: DashStream[] };
  flac?: { audio?: DashStream };
}

export interface PlayData {
  dash?: DashData;
  accept_quality?: number[];
  accept_description?: string[];
  quality?: number;
}

export interface PageInfo {
  cid: number;
  page: number;
  part: string;
  duration: number;
  ep_id?: number;
  bvid?: string;
}

export interface UGCEpisode {
  title: string;
  bvid: string;
  cid: number;
  arc: { duration: number };
}

export interface VideoInfo {
  title: string;
  owner: { name: string };
  duration: number;
  desc: string;
  pages: PageInfo[];
  pic?: string;
  cover?: string;
  currentPage?: number;
  type?: string;
  ugc_season?: {
    title: string;
    cover: string;
    sections: Array<{ episodes: UGCEpisode[] }>;
  };
  ugcEpisodes?: UGCEpisode[];
}

export interface UGCInfo {
  hasUGC: boolean;
  title?: string;
  episodes?: UGCEpisode[];
  cover?: string;
}

export interface VideoId {
  type: 'video' | 'bangumi';
  id: string;
}

export type ShortVideoPlatform =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'weibo'
  | 'toutiao'
  | 'x';

export type SiteContext =
  | { kind: 'bilibili'; platform: 'bilibili'; sourceType: 'video' | 'bangumi' }
  | { kind: 'short-video'; platform: ShortVideoPlatform }
  | { kind: 'unsupported'; platform: null };

/** 皮肤键，含 B 站的两种页面类型。 */
export type SkinKey = ShortVideoPlatform | 'bilibili' | 'bangumi';

/**
 * 入口按钮的尺寸与配色变量，由 applySkin 写成 `--bdl-skin-*` 自定义属性。
 *
 * 描述的是「贴合站点原生按钮」的形态，与品牌色（BrandColors）分属两套：
 * 皮肤决定按钮在原生操作栏里的大小和文字色，品牌色决定弹层内部的强调色。
 */
export interface SkinVars {
  height: string;
  padding: string;
  radius: string;
  gap: string;
  fontSize: string;
  fontWeight: string;
  color: string;
  colorHover: string;
  iconSize: string;
  bg: string;
  bgHover: string;
}

/**
 * 平台品牌色，由 applyBrand 写成 `--bdl-brand-*` 自定义属性。
 *
 * 用于弹层内部的主按钮、进度条、激活态等站点无关的自有 UI，
 * 使其与所在站点的观感一致，而非所有平台共用一套粉色。
 */
export interface BrandColors {
  /** 主色：主按钮背景、进度条、激活边框。 */
  brand: string;
  /** 主色的深一档：hover 与按下态。 */
  brandDeep: string;
  /** 搭配色：链接与次级强调。 */
  brandAccent: string;
  /** 压在主色之上的前景色（文字与图标）。 */
  brandContrast: string;
  /**
   * 点缀色：完成动画的粒子与星芒。
   *
   * 省略时取主色。主色为黑白的站点在此给出一个有彩度的值，
   * 否则整段动画只剩灰阶。
   */
  brandSpark?: string;
}

/**
 * 同一 URL 内切换视频时的重新解析策略。
 *
 * 沉浸式信息流（抖音推荐页、微博视频流）不改变 URL，需额外监听
 * 播放器状态才能感知切换。未配置该字段的平台只依赖 URL 变化。
 */
export interface WatchConfig {
  /** URL 变化后重新解析的延迟，毫秒。默认 1500。 */
  urlChangeDelayMs?: number;
  /** 切换视频后重新解析的防抖窗口，毫秒。默认 300。 */
  debounceMs?: number;
  /** 监听所有 `<video>` 的 play 事件作为切换信号。 */
  videoPlay?: boolean;
  /**
   * 监听匹配元素的 class 变化作为切换信号。
   *
   * 播放器容器的 class 中带视频 id（抖音为 `video_<19 位数字>`），
   * 比 play 事件更可靠：xgplayer 的 MSE 模式下 playing 不触发，
   * 且同一视频重复播放不会误报。
   */
  classIdSelector?: string;
  /** 从 class 中捕获视频 id 的正则，需含一个捕获组。与 classIdSelector 配对使用。 */
  classIdPattern?: RegExp;
}

/**
 * 站点原生操作栏的挂载点配置。
 *
 * 平台未配置、或配置在当前页面解析失败时，回退为浮动按钮。
 */
export interface MountPointConfig {
  /** 操作栏容器的 CSS 选择器。 */
  selector: string;
  /**
   * 限定生效的地址，不匹配时不解析该挂载点。
   *
   * 用于同域下只有部分页型带操作栏的站点：今日头条的视频页为 `/video/<id>`，
   * 文章页与首页的 `.actions-list` 结构不同。不匹配时回退为浮动按钮。
   *
   * 匹配对象是完整的 `location.href`，故按路径判定页型时须自行锚定到主机名之后，
   * 否则查询串里出现同样的片段也会命中。
   */
  urlPattern?: RegExp;
  /** selector 命中多个时的下标，负数从后往前（-1 表示最后一个）。省略时按顺序取第一个可解析的匹配。 */
  matchIndex?: number;
  /**
   * 先按与视口的交叠面积过滤并排序 selector 的命中项，再解析挂载点。
   *
   * 用于沉浸式信息流：抖音推荐页同时渲染上一个/当前/下一个视频的操作栏，
   * 三份都能解析成功，固定下标在滑动后会指向已移出视口的那一份，按钮随之看不见。
   * 全部命中项都不可见时（首屏渲染中途）保留原列表，不作废挂载点。
   */
  matchVisible?: boolean;
  /** 自命中元素起按 children 下标逐层下钻，得到插入按钮的父元素。 */
  childPath?: number[];
  /**
   * 插入锚点的选择器，在下钻后的容器内查找。
   *
   * 命中时按钮插到该元素之前、与其同级，并以该元素为样板，
   * insertAt 与 sampleIndex 不再生效。用于操作栏子节点数量随页面变化的场景
   * （抖音的 AI 入口、关注按钮并非每个视频都存在，固定下标会错位），
   * 选择器应指向要插到其前面的那一层兄弟节点。未命中时整个挂载点作废。
   */
  anchorSelector?: string;
  /** 插入位置：'start' | 'end' | children 下标。默认 'start'。 */
  insertAt?: number | 'start' | 'end';
  /** 样板兄弟节点的 children 下标。默认取插入位置处的相邻兄弟。 */
  sampleIndex?: number;
  /** 是否复制样板兄弟的行内 style，用于继承站点的绝对定位方案。 */
  cloneSampleStyle?: boolean;
  /** 在 cloneSampleStyle 之后覆盖的行内样式，键为 CSS 属性名。 */
  styleOverride?: Record<string, string>;
  /**
   * 视觉取样元素的选择器，在容器内部查找。
   *
   * 用于定位样板与视觉样板不是同一元素的场景：X 的定位样板是整个绝对定位层，
   * 视觉需取层内的原生按钮。已配置但未命中时使用平台自身的固定皮肤。
   */
  skinSampleSelector?: string;
  /**
   * 跳过运行时视觉取样，直接使用平台自身的固定皮肤。
   *
   * 用于样板兄弟形态与按钮差异过大的场景：抖音操作栏是图标在上、计数在下的
   * 纵向控件，取其高度会得到约 70px 的按钮。
   */
  fixedSkin?: boolean;
  /**
   * 挂载期间隐藏样板兄弟，取消挂载时还原。
   *
   * 用于按钮取代站点原有入口而非与其并列的场景：今日头条操作栏末位是
   * 「下载今日头条 APP」，按钮插到其后并将它隐藏，视觉上等同于替换。
   */
  hideSample?: boolean;
  /**
   * 外壳克隆的叶子选择器。
   *
   * 深克隆样板兄弟，并把克隆体中匹配该选择器的节点替换为按钮宿主，
   * 用于站点将按钮包在多层 wrapper 中的场景（X 为 layer > wrapper > drawer > button，
   * 仅复制最外层行内 style 无法得到内层定位盒）。class 名随发版变化，故在运行时克隆。
   *
   * 未命中叶子时整个挂载点作废并回退为浮动按钮。
   */
  cloneSampleSkeleton?: string;
}

/** 弹层配色方案。'auto' 按站点背景色亮度判定。 */
export type SurfaceScheme = 'auto' | 'light' | 'dark';

/**
 * 一个受支持站点的完整定义。
 *
 * 新增平台只需在 PLATFORMS 中追加一条：域名、文案、媒体请求头与品牌色为必填，
 * 挂载点 / 皮肤 / 信息流监听 / 页面上下文下载为可选，缺省时各自走通用兜底逻辑。
 */
export interface PlatformDef {
  /** 界面上展示的平台名。 */
  label: string;
  /**
   * 该平台的域名后缀列表，用于站点识别。
   *
   * 以后缀匹配，因此 `weibo.com` 同时覆盖 `www.weibo.com`；
   * 短链域名（`xhslink.com`）与旧域名（`twitter.com`）并列在此。
   */
  hosts: string[];
  /** 下载媒体资源时携带的 Referer，多数站点的 CDN 据此校验来源。 */
  mediaReferer: string;
  /** 下载媒体资源时携带的 Origin。 */
  mediaOrigin: string;
  /** 弹层内部自有 UI 的强调色。 */
  brand: BrandColors;
  /** 原生操作栏挂载点。缺省时入口按钮以浮动形式呈现。 */
  mount?: MountPointConfig;
  /** 弹层配色方案。缺省为 'auto'，即按站点背景色亮度判定深浅。 */
  surface?: SurfaceScheme;
  /** 入口按钮的固定皮肤。缺省时从相邻原生按钮取样，取样失败则用 NEUTRAL_SKIN。 */
  skin?: SkinVars;
  /** 信息流内切换视频的监听策略。缺省时只依赖 URL 变化。 */
  watch?: WatchConfig;
  /**
   * 命中该正则的媒体地址改由页面上下文下载。
   *
   * 部分 CDN（X 的 video.twimg.com）拒绝脚本沙箱发出的请求，
   * 需借页面自身的 fetch 才能取到数据。
   */
  pageContextMedia?: RegExp;
}

export interface ShortVideoAuthor {
  name?: string;
  id?: string;
  avatar?: string;
}

export interface ShortVideoMusic {
  title?: string;
  author?: string;
  url?: string;
  cover?: string;
}

export interface ShortVideoLivePhoto {
  image?: string;
  video?: string;
}

/**
 * 一个待保存的文件，是多选下载的最小单位。
 *
 * 图集的每张图、实况图的每个图与视频、视频本身各自是一个单位。
 */
export interface MediaUnit {
  /** 候选地址，按顺序尝试，首个成功的即为结果。 */
  candidates: string[];
  /** 保存时的文件名，含扩展名。 */
  filename: string;
  /** 进度提示上显示的名称。 */
  label: string;
  /** 下载完成后、保存之前要做的转码，缺省表示原样保存。 */
  convert?: GifMethod;
}

export interface ShortVideoData {
  type?: 'video' | 'image' | 'live' | 'unknown';
  title?: string;
  desc?: string;
  author?: ShortVideoAuthor;
  cover?: string;
  url?: string;
  duration?: number | null;
  video_backup?: string[];
  video_id?: string;
  images?: string[];
  live_photo?: ShortVideoLivePhoto[];
  music?: ShortVideoMusic;
  platform?: ShortVideoPlatform;
  sourceUrl?: string;
  itemLabel?: string;
  items?: ShortVideoData[];
  /**
   * items 为同一个媒体的备选地址（清晰度），而非彼此独立的媒体。
   *
   * 抖音一个视频会返回多路清晰度，默认全选会把同一个视频重复下载多次，
   * 故置位时只默认选中第一项；手动全选不受影响。
   */
  alternativeSources?: boolean;
  /**
   * 该媒体在站点上呈现为 GIF，实际文件是无声视频。
   *
   * X 的 GIF 走 tweet_video 的 mp4，面板据此提供转 GIF 的选项。
   */
  animated?: boolean;
}

export interface ShortVideoApiResponse {
  code: number;
  msg: string;
  data?: ShortVideoData | ShortVideoData[] | null;
}

export interface Streams {
  video: DashStream | null;
  audio: DashStream | null;
}

export interface DownloadBuffers {
  videoBuffer: ArrayBuffer;
  audioBuffer: ArrayBuffer | null;
}

export interface MergeResult {
  separate: boolean;
  data?: ArrayBuffer;
  video?: ArrayBuffer;
  audio?: ArrayBuffer | null;
}

export interface Metadata {
  title: string;
  author: string;
  description: string;
  duration: number;
}

export interface SubtitleItem {
  subtitle_url: string;
  lan: string;
  lan_doc?: string;
}

export type MergeMethod = 'js-merge' | 'ffmpeg-merge' | 'separate';

/** GIF 转码方式。 */
export type GifMethod = 'js-gif' | 'ffmpeg-gif';

/** GIF 区块的选项：保存原始视频，或按某种方式转码。 */
export type GifOutput = 'video' | GifMethod;
