import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { DOWNLOAD_ROUTES, checkRouteSite, getRouteContext, preferredRoute, rememberRoute, routeUrl, routesForPlatform } from '../src/download-routes.ts';
import { matchPlatform, PLATFORMS } from '../src/platforms.ts';
import { renderRouteSection } from '../src/route-ui.ts';
import { watchNavigation } from '../src/navigation.ts';
import type { ShortVideoPlatform } from '../src/types.ts';

const valid: Array<[ShortVideoPlatform, string]> = [
  ['youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc'],
  ['youtube', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['youtube', 'https://music.youtube.com/watch?v=dQw4w9WgXcQ'],
  ['youtube', 'https://youtu.be/dQw4w9WgXcQ?si=track'],
  ['youtube', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'],
  ['youtube', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
  ['youtube', 'https://www.youtube.com/live/dQw4w9WgXcQ'],
  ['tiktok', 'https://www.tiktok.com/@user/video/123456789'],
  ['tiktok', 'https://www.tiktok.com/@user/photo/123456789'],
  ['tiktok', 'https://www.tiktok.com/t/Zexample/'],
  ['tiktok', 'https://vm.tiktok.com/Zexample/'],
  ['tiktok', 'https://vt.tiktok.com/Zexample/'],
  ['instagram', 'https://www.instagram.com/p/ABC_123/'],
  ['instagram', 'https://www.instagram.com/reel/ABC_123/'],
  ['instagram', 'https://www.instagram.com/user/reel/ABC_123/'],
  ['instagram', 'https://www.instagram.com/tv/ABC_123/'],
  ['instagram', 'https://www.instagram.com/stories/user/1234567/'],
  ['x', 'https://x.com/user/status/12345678/video/1'],
  ['x', 'https://twitter.com/i/web/status/12345678'],
  ['facebook', 'https://www.facebook.com/watch/?v=12345678'],
  ['facebook', 'https://www.facebook.com/reel/12345678/'],
  ['facebook', 'https://www.facebook.com/user/videos/12345678/'],
  ['facebook', 'https://www.facebook.com/share/v/ABCD/'],
  ['facebook', 'https://fb.watch/ABCD/'],
  ['threads', 'https://www.threads.net/@user/post/ABC_123'],
  ['threads', 'https://www.threads.com/@user/post/ABC_123'],
  ['threads', 'https://www.threads.com/t/ABC_123/'],
  ['douyin', 'https://www.douyin.com/video/7123456789012345678'],
  ['douyin', 'https://www.douyin.com/note/7123456789012345678'],
  ['douyin', 'https://www.douyin.com/?modal_id=7123456789012345678'],
  ['douyin', 'https://www.iesdouyin.com/share/video/7123456789012345678/'],
  ['douyin', 'https://v.douyin.com/ABCDEF/'],
  ['xiaohongshu', 'https://www.xiaohongshu.com/explore/6aa25f7a000000002902eea8?xsec_token=token&xsec_source=pc_feed'],
  ['xiaohongshu', 'https://www.xiaohongshu.com/discovery/item/6aa25f7a000000002902eea8'],
  ['xiaohongshu', 'https://www.xiaohongshu.com/user/profile/123/6aa25f7a000000002902eea8'],
  ['xiaohongshu', 'https://xhslink.com/a/ABC'],
  ['pinterest', 'https://www.pinterest.com/pin/12345678/'],
  ['pinterest', 'https://pin.it/ABCDEF'],
  ['snapchat', 'https://www.snapchat.com/spotlight/ABC_123'],
  ['ted', 'https://www.ted.com/talks/a_talk'],
  ['vimeo', 'https://vimeo.com/12345678'],
  ['vimeo', 'https://vimeo.com/12345678/privatehash'],
  ['vimeo', 'https://player.vimeo.com/video/12345678?h=privatehash'],
  ['vimeo', 'https://vimeo.com/channels/staffpicks/12345678'],
  ['vimeo', 'https://vimeo.com/groups/music/videos/12345678'],
  ['vimeo', 'https://vimeo.com/showcase/123/video/12345678'],
  ['twitch', 'https://www.twitch.tv/videos/12345678'],
  ['twitch', 'https://www.twitch.tv/user/clip/ABC_123'],
  ['twitch', 'https://clips.twitch.tv/ABC_123'],
  ['twitch', 'https://clips.twitch.tv/embed?clip=ABC_123'],
  ['soundcloud', 'https://soundcloud.com/user/track'],
  ['soundcloud', 'https://on.soundcloud.com/ABCDEF'],
  ['reddit', 'https://www.reddit.com/r/videos/comments/abc123/title/'],
  ['reddit', 'https://www.reddit.com/gallery/abc123'],
  ['reddit', 'https://redd.it/abc123'],
  ['dailymotion', 'https://www.dailymotion.com/video/x123abc'],
  ['dailymotion', 'https://www.dailymotion.com/embed/video/x123abc'],
  ['dailymotion', 'https://dai.ly/x123abc']
];

test.each(valid)('%s 内容链接及该平台所有线路：%s', (platform, url) => {
  expect(matchPlatform(new URL(url).hostname)).toBe(platform);
  const context = getRouteContext(url, platform);
  expect(context).not.toBeNull();
  const routes = routesForPlatform(platform);
  expect(routes.length).toBeGreaterThan(0);
  for (const route of routes) {
    const target = new URL(routeUrl(route.id, context!)!);
    expect(target.origin).toBe(route.origin);
    expect(target.searchParams.get('url') || target.searchParams.get('videoId') || target.searchParams.get('v'))
      .toBe(target.searchParams.has('url') ? context!.pageUrl : context!.videoId!);
    expect(target.href).not.toContain('undefined');
  }
});

test.each([
  ['youtube', 'https://www.youtube.com/'], ['youtube', 'https://www.youtube.com/watch?v=bad'],
  ['youtube', 'https://www.youtube.com/shorts/dQw4w9WgXcQ-extra'], ['youtube', 'https://www.youtube.com/playlist?list=123'],
  ['tiktok', 'https://www.tiktok.com/@user'], ['instagram', 'https://www.instagram.com/stories/user/'],
  ['facebook', 'https://www.facebook.com/watch/'], ['threads', 'https://www.threads.com/@user'],
  ['pinterest', 'https://www.pinterest.com/'], ['twitch', 'https://www.twitch.tv/user'],
  ['twitch', 'https://clips.twitch.tv/embed'], ['soundcloud', 'https://soundcloud.com/discover/sets'],
  ['soundcloud', 'https://soundcloud.com/user/sets'], ['soundcloud', 'https://soundcloud.com/user/tracks'],
  ['reddit', 'https://www.reddit.com/r/videos/'], ['youtube', 'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'],
  ['youtube', 'javascript:alert(1)'], ['youtube', 'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ'],
  ['douyin', 'https://www.douyin.com/?modal_id=bad']
] as Array<[ShortVideoPlatform, string]>)('%s 非内容页不生成下载链接：%s', (platform, url) => {
  expect(getRouteContext(url, platform)).toBeNull();
});

test('所有新增平台均有线路，当前原生平台保留解析模式', () => {
  const external = Object.entries(PLATFORMS).filter(([, def]) => def.externalOnly);
  expect(external).toHaveLength(12);
  for (const [platform] of external) expect(routesForPlatform(platform as ShortVideoPlatform).length).toBeGreaterThan(0);
  expect(PLATFORMS.douyin.externalOnly).toBeUndefined();
  expect(PLATFORMS.reddit.externalOnly).toBeUndefined();
  expect(DOWNLOAD_ROUTES).toHaveLength(7);
});

test('签名参数保留，跟踪参数清理，查询值只编码一次', () => {
  const context = getRouteContext('https://www.xiaohongshu.com/explore/6aa25f7a000000002902eea8?xsec_token=a%2Bb%3D&xsec_source=pc&utM_source=tracking#hash', 'xiaohongshu')!;
  const target = new URL(routeUrl('tool77', context)!);
  const source = new URL(target.searchParams.get('url')!);
  expect(source.searchParams.get('xsec_token')).toBe('a+b=');
  expect(source.searchParams.get('xsec_source')).toBe('pc');
  expect(source.searchParams.has('utM_source')).toBe(false);
  expect(source.hash).toBe('');
  expect(routeUrl('saveany', context)).toBeNull();
});

describe('偏好、响应检查与面板', () => {
  let win: Window;
  const store = new Map<string, unknown>();
  beforeEach(() => {
    win = new Window({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    Object.assign(globalThis, { window: win, document: win.document, location: win.location });
    store.clear();
    (globalThis as any).GM_getValue = (key: string, fallback: unknown) => store.get(key) ?? fallback;
    (globalThis as any).GM_setValue = (key: string, value: unknown) => store.set(key, value);
  });
  afterEach(() => {
    for (const key of ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest']) delete (globalThis as any)[key];
    win.happyDOM.abort();
  });

  test('偏好按平台隔离，失效配置回退，错误的跨平台线路不能保存', () => {
    rememberRoute('youtube', 'yout');
    expect(preferredRoute('youtube')).toBe('yout');
    expect(preferredRoute('tiktok')).toBe('tool77');
    rememberRoute('tiktok', 'saveany');
    expect(preferredRoute('tiktok')).toBe('tool77');
    store.set('bdl:route:youtube', 'removed');
    expect(preferredRoute('youtube')).toBe('saveany');
  });

  test('响应检查不发送作品参数、不改变偏好、不声称下载可用', async () => {
    rememberRoute('youtube', 'yout');
    let requested = '';
    (globalThis as any).GM_xmlhttpRequest = (req: any) => { requested = req.url; req.onload({ status: 200 }); };
    expect(await checkRouteSite('saveany')).toBe('网站已响应，下载能力需实际尝试');
    expect(requested).toBe('https://saveanyyoutube.com/');
    expect(preferredRoute('youtube')).toBe('yout');
    (globalThis as any).GM_xmlhttpRequest = (req: any) => req.onload({ status: 403 });
    expect(await checkRouteSite('saveany')).toContain('HTTP 403');
    (globalThis as any).GM_xmlhttpRequest = (req: any) => req.ontimeout();
    expect(await checkRouteSite('saveany')).toContain('超时');
  });

  test('线路选择更新真实新标签页链接，首页不提供无效下载入口', () => {
    const container = document.createElement('section');
    document.body.append(container);
    renderRouteSection(container, 'youtube', location.href, true);
    expect(container.querySelectorAll('option')).toHaveLength(7);
    const select = container.querySelector('select')!;
    select.value = 'grabshorts';
    select.dispatchEvent(new win.Event('change') as unknown as Event);
    const anchor = container.querySelector('a')!;
    expect(new URL(anchor.href).pathname).toBe('/zh-CN/yt');
    expect(anchor.target).toBe('_blank');
    expect(anchor.rel).toBe('noopener noreferrer');
    expect(preferredRoute('youtube')).toBe('grabshorts');
    renderRouteSection(container, 'youtube', 'https://www.youtube.com/', true);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toContain('请先打开');
  });

  test('页面刚切换时阻止打开旧链接并刷新目的地', () => {
    const container = document.createElement('section');
    document.body.append(container);
    renderRouteSection(container, 'youtube', location.href, true);
    const old = container.querySelector('a')!;
    win.history.pushState({}, '', '/watch?v=abcdefghijk');
    const click = new win.MouseEvent('click', { cancelable: true });
    old.dispatchEvent(click as unknown as Event);
    expect(click.defaultPrevented).toBe(true);
    expect(container.querySelector('a')!.href).toContain('abcdefghijk');
  });

  test('旧检查结果不能覆盖新选择的网站状态', async () => {
    let finish: (result: any) => void = () => {};
    (globalThis as any).GM_xmlhttpRequest = (req: any) => { finish = req.onload; };
    const container = document.createElement('section');
    document.body.append(container);
    renderRouteSection(container, 'youtube', location.href, true);
    container.querySelector('button')!.click();
    const select = container.querySelector('select')!;
    select.value = 'yout';
    select.dispatchEvent(new win.Event('change') as unknown as Event);
    finish({ status: 403 });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(container.querySelector('[role=status]')!.textContent).toBe('');
    expect(container.querySelector('button')!.disabled).toBe(false);
  });

  test('没有 DOM 变化的 SPA 导航也触发更新，事件与轮询不重复通知', async () => {
    let count = 0;
    const dispose = watchNavigation(() => count++);
    try {
      win.history.pushState({}, '', '/watch?v=abcdefghijk');
      await new Promise(resolve => setTimeout(resolve, 900));
      expect(count).toBe(1);
      document.dispatchEvent(new win.Event('yt-navigate-finish') as unknown as Event);
      expect(count).toBe(1);
      win.history.pushState({}, '', '/shorts/dQw4w9WgXcQ');
      document.dispatchEvent(new win.Event('yt-navigate-finish') as unknown as Event);
      expect(count).toBe(2);
    } finally { dispose(); }
  });
});
