import type { ShortVideoPlatform } from './types.ts';

// 「无缝集成」：让入口按钮看起来就是站点自带的一个功能，而不是外挂。
//
// 下面的数值全部来自真机实测（Playwright + getComputedStyle），不是估计值：
//   B 站视频页 .toolbar-left-item-wrap
//     外层 margin-right: 8px；内层 flex / height 28px / font 13px-500
//     / color rgb(97,102,109) / svg 28px / border-radius 0 / padding 0
//   微博 .woo-like-main
//     color rgb(128,128,128) / svg 15px / font 16px / 透明底 / 无圆角
//
// 抖音、快手、小红书、X 在无痕环境下是验证码页或登录墙，无法实测，
// 因此不硬编码它们的尺寸，改用「运行时从相邻原生按钮取样」(sampleNativeStyle)，
// 取不到样就退回一套克制的中性样式。

export type SkinVars = {
  // 按钮整体
  height: string;
  padding: string;
  radius: string;
  gap: string;
  // 文字
  fontSize: string;
  fontWeight: string;
  color: string;
  colorHover: string;
  // 图标
  iconSize: string;
  // 背景（多数站点的操作栏按钮都是透明底）
  bg: string;
  bgHover: string;
};

// 中性兜底：低调、透明底、跟随继承字体，尽量不与任何站点冲突
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

// 实测得到的站点皮肤
export const SITE_SKINS: Partial<Record<ShortVideoPlatform | 'bilibili' | 'bangumi', SkinVars>> = {
  bilibili: {
    height: '28px',
    padding: '0',
    radius: '0',
    gap: '4px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgb(97, 102, 109)',
    colorHover: 'var(--brand_blue, #00aeec)',
    iconSize: '28px',
    bg: 'transparent',
    bgHover: 'transparent'
  },
  bangumi: {
    height: '28px',
    padding: '0',
    radius: '0',
    gap: '4px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgb(97, 102, 109)',
    colorHover: 'var(--brand_blue, #00aeec)',
    iconSize: '24px',
    bg: 'transparent',
    bgHover: 'transparent'
  },
  weibo: {
    height: '16px',
    padding: '0',
    radius: '0',
    gap: '4px',
    fontSize: '13px',
    fontWeight: '400',
    color: 'rgb(128, 128, 128)',
    colorHover: '#eb7350',
    iconSize: '15px',
    bg: 'transparent',
    bgHover: 'transparent'
  }
};

// 从站点自己的一个原生按钮上取样，套到我们的按钮上。
// 这样即便站点改版、或我们没实测过该站点，也能自动贴近它当前的视觉。
export function sampleNativeStyle(sample: Element | null, base: SkinVars): SkinVars {
  if (!sample) return base;
  try {
    const cs = getComputedStyle(sample);
    const rect = sample.getBoundingClientRect();
    const svg = sample.querySelector('svg');
    const svgSize = svg ? Math.round(svg.getBoundingClientRect().width) : 0;

    const height = rect.height > 8 && rect.height < 80 ? `${Math.round(rect.height)}px` : base.height;
    const fontSize = parseFloat(cs.fontSize) >= 10 && parseFloat(cs.fontSize) <= 20 ? cs.fontSize : base.fontSize;
    const color = cs.color && cs.color !== 'rgba(0, 0, 0, 0)' ? cs.color : base.color;

    return {
      ...base,
      height,
      fontSize,
      fontWeight: cs.fontWeight || base.fontWeight,
      color,
      colorHover: color,
      iconSize: svgSize >= 12 && svgSize <= 40 ? `${svgSize}px` : base.iconSize,
      radius: cs.borderRadius && cs.borderRadius !== '0px' ? cs.borderRadius : base.radius
    };
  } catch {
    return base;
  }
}

// 把皮肤写成 CSS 自定义属性，注入 shadow host。
// 用变量而不是直接改规则，是为了让同一套 CSS 适配所有站点。
export function applySkin(host: HTMLElement | null, skin: SkinVars): void {
  if (!host) return;
  const map: Record<string, string> = {
    '--bdl-skin-height': skin.height,
    '--bdl-skin-padding': skin.padding,
    '--bdl-skin-radius': skin.radius,
    '--bdl-skin-gap': skin.gap,
    '--bdl-skin-font-size': skin.fontSize,
    '--bdl-skin-font-weight': skin.fontWeight,
    '--bdl-skin-color': skin.color,
    '--bdl-skin-color-hover': skin.colorHover,
    '--bdl-skin-icon-size': skin.iconSize,
    '--bdl-skin-bg': skin.bg,
    '--bdl-skin-bg-hover': skin.bgHover
  };
  for (const [k, v] of Object.entries(map)) host.style.setProperty(k, v);
}
