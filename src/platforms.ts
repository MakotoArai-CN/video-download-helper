import type {
  BrandColors,
  PlatformDef,
  ShortVideoPlatform,
  SkinKey,
  SkinVars
} from './types.ts';

/**
 * 受支持站点的唯一注册表。
 *
 * PLATFORMS 的一条记录描述一个站点的全部信息：域名识别、媒体请求头、
 * 品牌色、挂载点、皮肤与信息流监听。新增平台只需新增一条记录，
 * 构建配置的 @match 列表也由本表推导。
 *
 * 品牌色取自各站点自身的 CSS 自定义属性。未暴露 hover 档的站点，
 * 其 brandDeep 由主色压暗推得，已在各条目注明。
 */

/** X 的动作按钮色。三套主题（亮 / 暗淡 / 暗）下文字色不同，蓝色一致。 */
const X_TEXT_LIGHT = '#0F1419';
const X_BLUE = '#1D9BF0';

/**
 * B 站两种页面类型共用的品牌色。
 *
 * 粉色取当前 token `--brand_pink: #FF6699`，而非旧版 #FB7299。
 */
const BILIBILI_BRAND: BrandColors = {
  brand: '#FF6699',
  brandDeep: '#E84B85',
  brandAccent: '#00AEEC',
  brandContrast: '#FFFFFF'
};

/** B 站视频页与番剧页的入口皮肤，取自 .toolbar-left-item-wrap 的实测值。 */
const BILIBILI_SKIN: SkinVars = {
  height: '28px',
  padding: '0',
  radius: '0',
  gap: '4px',
  fontSize: '13px',
  fontWeight: '500',
  color: 'rgb(97, 102, 109)',
  colorHover: 'var(--brand_blue, #00AEEC)',
  iconSize: '28px',
  bg: 'transparent',
  bgHover: 'transparent'
};

/**
 * 沉浸式播放页操作栏的入口皮肤，抖音与快手共用。
 *
 * 两站的操作栏都是压在视频上方的白色图标，画面亮度不可控，故配半透明底
 * 保证文字可读。原生控件为图标在上、计数在下的纵向结构，取其尺寸会得到
 * 约 70px 的按钮，因此这两个平台的挂载点都声明 fixedSkin 走本皮肤。
 */
const IMMERSIVE_BAR_SKIN: SkinVars = {
  height: '36px',
  padding: '0 10px',
  radius: '8px',
  gap: '6px',
  fontSize: '13px',
  fontWeight: '500',
  color: '#FFFFFF',
  colorHover: '#FFFFFF',
  iconSize: '22px',
  bg: 'rgba(255, 255, 255, 0.12)',
  bgHover: 'rgba(255, 255, 255, 0.24)'
};

export const PLATFORMS: Record<ShortVideoPlatform, PlatformDef> = {
  /**
   * 抖音。
   *
   * 主色 `--color-primary: #FE2C55`，hover / active 档由站点自身暴露。
   * logo 中的青色 #25F4EE 不出现在 UI token 中，此处仅用作点缀色。
   */
  douyin: {
    label: '抖音',
    hosts: ['douyin.com', 'iesdouyin.com'],
    mediaReferer: 'https://www.douyin.com/',
    mediaOrigin: 'https://www.douyin.com',
    brand: {
      brand: '#FE2C55',
      brandDeep: '#D21B46',
      brandAccent: '#25F4EE',
      brandContrast: '#FFFFFF'
    },
    /**
     * 沉浸式播放页右侧操作栏。
     *
     * 交互区在推荐流中每个视频各一份，上一个/当前/下一个同时存在于 DOM 且都能
     * 解析成功，故用 matchVisible 取视口内的那一份：固定下标在滑动后会指向
     * 已移出视口的交互区，按钮随之看不见。
     *
     * 操作栏内的 AI 入口、关注按钮并非每个视频都渲染，固定下标会错位，
     * 故以点赞控件所在的那一层兄弟节点为锚点，插到其前面。
     *
     * 操作栏控件为图标在上、计数在下的纵向结构，取其尺寸会得到约 70px 的按钮，
     * 故用 fixedSkin 改走固定皮肤。
     */
    mount: {
      selector: '.immersive-player-switch-on-hide-interaction-area',
      matchVisible: true,
      anchorSelector: ':scope > *:has([data-e2e="video-player-digg"])',
      fixedSkin: true
    },
    /**
     * 操作栏为视频上方的白色图标，配半透明底以保证文字在浅色画面上可读。
     * 与快手共用，见 IMMERSIVE_BAR_SKIN。
     */
    skin: IMMERSIVE_BAR_SKIN,
    /** 站点 UI 恒为深色。 */
    surface: 'dark',
    /** 推荐页切换视频不改变 URL，故 urlChangeDelayMs 取 0，改由 class 变化驱动。 */
    watch: {
      urlChangeDelayMs: 0,
      debounceMs: 300,
      videoPlay: true,
      classIdSelector: '[class*="sliderVideo"]',
      classIdPattern: /\bvideo_(\d{15,20})\b/
    }
  },

  /**
   * 快手。
   *
   * 主色为粉红 `--brand-primary: #FE3566`，不是橙色；橙色 #FFA832 是其警告色。
   * 该值取自 live.kuaishou.com——www.kuaishou.com 返回无内容的壳页面，SPA 未挂载。
   * 站点未暴露 hover 档，brandDeep 由主色压暗推得。
   */
  kuaishou: {
    label: '快手',
    hosts: ['kuaishou.com'],
    mediaReferer: 'https://www.kuaishou.com/',
    mediaOrigin: 'https://www.kuaishou.com',
    brand: {
      brand: '#FE3566',
      brandDeep: '#DE1F4E',
      brandAccent: '#FFA832',
      brandContrast: '#FFFFFF'
    },
    /**
     * 播放页右侧竖排操作栏。
     *
     * 以「更多」控件为锚点插到其前面：操作栏末尾还有绝对定位的分享面板
     * （.share-panel），追加到末尾会排到面板之后。
     *
     * 推荐流会同时渲染多个 .photo-btns，故用 matchVisible 取视口内的那一份，
     * 固定下标在滑动后会指向已移出视口的操作栏。
     *
     * 控件为图标在上、计数在下的纵向结构，取其尺寸会得到超高的按钮，
     * 故用 fixedSkin 改走固定皮肤。
     */
    mount: {
      selector: '.photo-btns',
      matchVisible: true,
      anchorSelector: ':scope > .more',
      fixedSkin: true
    },
    /** 操作栏同为视频上方的白色图标，与抖音共用皮肤。 */
    skin: IMMERSIVE_BAR_SKIN,
    /** 播放页恒为深色。 */
    surface: 'dark',
    /**
     * 推荐流内滑动切换视频时，操作栏的可见性变化不伴随 DOM 变动，
     * 全局 MutationObserver 收不到信号，matchVisible 会停在上一条内容的操作栏。
     * 故监听 video 的 play 事件补一次重挂。
     */
    watch: {
      videoPlay: true,
      debounceMs: 300
    }
  },

  /** 小红书。主色 `--color-red: #FF2442`；站点未暴露 hover 档，brandDeep 为推得值。 */
  xiaohongshu: {
    label: '小红书',
    hosts: ['xiaohongshu.com', 'xhslink.com', 'xhs.cn'],
    mediaReferer: 'https://www.xiaohongshu.com/',
    mediaOrigin: 'https://www.xiaohongshu.com',
    brand: {
      brand: '#FF2442',
      brandDeep: '#E00E2B',
      brandAccent: '#FF6B81',
      brandContrast: '#FFFFFF'
    },
    /**
     * 笔记底部互动栏的左侧一组。
     *
     * 容器内是点赞 / 收藏 / 评论等同构的 span，按钮追加到末位并以最后一个
     * span 为样板取样，得到同一档图标尺寸与文字色。
     *
     * 属性选择器要求 class 恰为 `left`，比 `.left` 更严：后者会连带命中
     * class 中含有 left 的其他节点。
     */
    mount: {
      selector: '.engage-bar .interact-container div[class="left"]',
      insertAt: 'end'
    }
  },

  /**
   * 微博。
   *
   * 主色取按钮色 `--w-brand: #FF8200`（hover `#FF5900`），
   * 而非链接色 `--w-alink: #EB7350`——两者角色不同，入口是按钮，用前者。
   */
  weibo: {
    label: '微博',
    hosts: ['weibo.com', 'weibo.cn'],
    mediaReferer: 'https://weibo.com/',
    mediaOrigin: 'https://weibo.com',
    brand: {
      brand: '#FF8200',
      brandDeep: '#FF5900',
      brandAccent: '#EB7350',
      brandContrast: '#FFFFFF'
    },
    /** 取自 .woo-like-main 的实测值。 */
    skin: {
      height: '16px',
      padding: '0',
      radius: '0',
      gap: '4px',
      fontSize: '13px',
      fontWeight: '400',
      color: 'rgb(128, 128, 128)',
      colorHover: '#FF8200',
      iconSize: '15px',
      bg: 'transparent',
      bgHover: 'transparent'
    },
    /** 视频流内切换视频不改变 URL，监听 play 事件。 */
    watch: {
      debounceMs: 500,
      videoPlay: true
    }
  },

  /**
   * 今日头条。
   *
   * 站点未提供 CSS 变量，色值由首页渲染后的控件计算样式取样得到，
   * 可能只代表信息流而非全站 token。brandDeep 为推得值。
   */
  toutiao: {
    label: '今日头条',
    hosts: ['toutiao.com'],
    mediaReferer: 'https://www.toutiao.com/',
    mediaOrigin: 'https://www.toutiao.com',
    brand: {
      brand: '#FF403A',
      brandDeep: '#E02722',
      brandAccent: '#F04142',
      brandContrast: '#FFFFFF'
    },
    /**
     * 视频页的操作栏。
     *
     * 只在 `/video/` 页型生效：文章页与首页没有这条操作栏，urlPattern 不匹配时
     * 回退为浮动按钮。
     *
     * 末位是「下载今日头条 APP」入口，按钮插到其后并用 hideSample 隐藏它，
     * 视觉上等同于替换。取样另指向 .video-action-button：被隐藏的元素取不到
     * 尺寸，而点赞 / 评论 / 收藏才是这条栏里的按钮形态。
     */
    mount: {
      selector: '.actions-list',
      urlPattern: /^https?:\/\/[^/?#]+\/video\//i,
      insertAt: 'end',
      hideSample: true,
      skinSampleSelector: '.video-action-button'
    }
  },

  /**
   * X (Twitter)。
   *
   * 改版后主操作色为黑白而非蓝色：亮色主题下按钮为黑底白字，
   * 蓝色 #1D9BF0 降级为链接与焦点环，故 accent 取蓝、brand 取黑。
   * 主色为黑，完成动画的点缀色另取蓝色，否则整段动画只剩灰阶。
   */
  x: {
    label: 'X (Twitter)',
    hosts: ['x.com', 'twitter.com'],
    mediaReferer: 'https://x.com/',
    mediaOrigin: 'https://x.com',
    brand: {
      brand: X_TEXT_LIGHT,
      brandDeep: '#272C30',
      brandAccent: X_BLUE,
      brandContrast: '#FFFFFF',
      brandSpark: X_BLUE
    },
    /**
     * 沉浸式播放层。
     *
     * `#layers > div` 下并列多个绝对定位的兄弟层，各自以行内 style 声明
     * position / bottom / transform。以该父节点为容器在首位插入同构的新层：
     * 复制样板层的行内 style 继承其定位方案，再将纵向偏移覆盖为 -134px。
     *
     * 视觉取样与定位取样分离：样板层为整层高度，直接取样会得到超尺寸按钮，
     * 故用 skinSampleSelector 在层内定位真正的图标按钮。X 的动作控件既有
     * `<button role="button">` 也有 `<div role="button" tabindex="0">`，
     * 用 [role="button"] 同时覆盖；`:has(svg)` 排除纯文字按钮（关注 / 登录）。
     *
     * 按钮包在 layer > wrapper > 定位盒 > button 的多层结构中，仅复制最外层行内
     * style 得不到内层定位盒，故用 cloneSampleSkeleton 克隆整体结构后嫁接宿主。
     */
    mount: {
      selector: '#layers > div',
      insertAt: 'start',
      sampleIndex: 0,
      cloneSampleStyle: true,
      styleOverride: { transform: 'translateY(-134px)' },
      skinSampleSelector: '[role="button"][aria-label]:has(svg)',
      cloneSampleSkeleton: '[role="button"]'
    },
    /**
     * 层内原生动作按钮为圆形图标钮：约 34px 触达区、约 22px 图标、无文字、透明底。
     *
     * color 取 inherit 而非固定值：X 有亮 / 暗淡 / 暗三套主题，文字色在
     * #0F1419 与 #E7E9EA 之间变化，固定任一值都会在其他主题下失效。
     * 尺寸类字段与主题无关，可固定。
     */
    skin: {
      height: '34px',
      padding: '0 6px',
      radius: '9999px',
      gap: '4px',
      fontSize: '13px',
      fontWeight: '400',
      color: 'inherit',
      colorHover: X_BLUE,
      iconSize: '22px',
      bg: 'transparent',
      bgHover: 'rgba(239, 243, 244, 0.1)'
    },
    /** video.twimg.com 拒绝脚本沙箱发出的请求，须借页面自身的 fetch。 */
    pageContextMedia: /(?:^|\.)video\.twimg\.com$/i
  }
};

/** 中性兜底皮肤：透明底、继承字体，尽量不与任何站点冲突。 */
export const NEUTRAL_SKIN: SkinVars = {
  height: '32px',
  padding: '0 10px',
  radius: '6px',
  gap: '6px',
  fontSize: '13px',
  fontWeight: '500',
  color: 'inherit',
  colorHover: 'inherit',
  iconSize: '20px',
  bg: 'transparent',
  bgHover: 'rgba(127, 127, 127, 0.12)'
};

/** 品牌色兜底：沿用 B 站配色，仅在站点识别失败时出现。 */
export const NEUTRAL_BRAND: BrandColors = BILIBILI_BRAND;

/** B 站两种页面类型的皮肤。番剧页操作栏更紧凑，图标小一档。 */
const BILIBILI_SKINS: Record<'bilibili' | 'bangumi', SkinVars> = {
  bilibili: BILIBILI_SKIN,
  bangumi: { ...BILIBILI_SKIN, iconSize: '24px' }
};

/** 取指定站点的固定皮肤，未配置时返回 null 表示应改用运行时取样。 */
export function getSkin(key: SkinKey): SkinVars | null {
  if (key === 'bilibili' || key === 'bangumi') return BILIBILI_SKINS[key];
  return PLATFORMS[key].skin ?? null;
}

/** 取指定站点的品牌色。 */
export function getBrand(key: SkinKey): BrandColors {
  if (key === 'bilibili' || key === 'bangumi') return BILIBILI_BRAND;
  return PLATFORMS[key].brand;
}

/** 按域名后缀匹配平台，未命中返回 null。 */
export function matchPlatform(host: string): ShortVideoPlatform | null {
  const lower = host.toLowerCase();
  for (const [platform, def] of Object.entries(PLATFORMS)) {
    if (def.hosts.some(h => lower === h || lower.endsWith('.' + h))) {
      return platform as ShortVideoPlatform;
    }
  }
  return null;
}
