import type { BrandColors, SkinVars } from './types.ts';

/**
 * 入口按钮的站点皮肤与品牌色注入。
 *
 * 皮肤决定入口按钮的尺寸与文字色，取自所在站点原生操作栏；
 * 品牌色决定弹层内部的强调色，取自站点品牌色。
 *
 * 具体色值与尺寸定义在 platforms.ts；本文件只负责取样与写入 CSS 自定义属性。
 * 已实测的站点使用固定皮肤，未实测的站点在运行时从相邻原生按钮取样，
 * 取样失败时回退到 NEUTRAL_SKIN。
 */

/**
 * 从站点的一个原生按钮取样，得到贴近其当前视觉的皮肤。
 *
 * 用于站点改版或未实测过该站点的场景。各字段带取值区间校验，
 * 超出区间时沿用 base，避免取样落到非按钮元素上得到异常尺寸。
 *
 * @param sample 取样元素，为 null 时直接返回 base
 * @param base 取样失败或字段越界时的兜底皮肤
 */
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

/**
 * 把皮肤写成 CSS 自定义属性注入 shadow host。
 *
 * 使用变量而非直接改写规则，使同一套 CSS 能适配所有站点。
 */
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

/**
 * 把品牌色写成 CSS 自定义属性注入 shadow host。
 *
 * 与 applySkin 分开调用：皮肤随挂载点变化（同一站点浮动与内联两种形态取值不同），
 * 品牌色只随站点变化，写一次即可。
 */
export function applyBrand(host: HTMLElement | null, brand: BrandColors): void {
  if (!host) return;
  const map: Record<string, string> = {
    '--bdl-brand': brand.brand,
    '--bdl-brand-deep': brand.brandDeep,
    '--bdl-brand-accent': brand.brandAccent,
    '--bdl-brand-contrast': brand.brandContrast,
    '--bdl-brand-spark': brand.brandSpark ?? brand.brand
  };
  for (const [k, v] of Object.entries(map)) host.style.setProperty(k, v);
}

/** 判定为深色站点的相对亮度上限。 */
const DARK_LUMINANCE_MAX = 0.4;

/**
 * 解析 getComputedStyle 返回的颜色，得到 0 ~ 1 的相对亮度。
 *
 * 系数取 ITU-R BT.709（0.2126 / 0.7152 / 0.0722），不做 gamma 线性化：
 * 此处只用于深浅二分，精度足够。
 *
 * @param color `rgb()` 或 `rgba()` 形式的颜色字符串
 * @returns 相对亮度；完全透明或无法解析时返回 null
 */
function parseLuminance(color: string): number | null {
  const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i.exec(color);
  if (!m) return null;
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
  const r = parseFloat(m[1]) / 255;
  const g = parseFloat(m[2]) / 255;
  const b = parseFloat(m[3]) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 按站点背景色亮度判定当前页面是否为深色。
 *
 * 依次取 body 与 html 的背景色，用第一个非透明值判定，两者都透明时视为浅色。
 * 用于平台未显式声明 surface 时的自动判定，使 X 这类跟随用户主题的站点
 * 能与其当前配色保持一致。
 */
export function isDarkSite(): boolean {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const lum = parseLuminance(getComputedStyle(el).backgroundColor);
    if (lum !== null) return lum < DARK_LUMINANCE_MAX;
  }
  return false;
}

/**
 * 切换 shadow host 上的深色标记类，由 styles.ts 中的 `:host(.bdl-dark)` 接管配色。
 *
 * 只作用于承载弹层的主 host：入口按钮所在的 inlineHost 在挂载切换时会重置
 * className，标记类会随之丢失。
 */
export function applySurface(host: HTMLElement | null, dark: boolean): void {
  host?.classList.toggle('bdl-dark', dark);
}
