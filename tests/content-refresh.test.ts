import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test';
import { Window } from 'happy-dom';
import { Downloader } from '../src/downloader.ts';
import { ShortVideoAPI } from '../src/short-video-api.ts';
import { DouyinInterceptor, douyinContentId } from '../src/douyin-interceptor.ts';
import { UI } from '../src/ui.ts';
import { extractXhsNote } from '../src/xhs-api.ts';
import type { ShortVideoData } from '../src/types.ts';

let win: Window;
const mocks: Array<{ mockRestore(): void }> = [];
const id = '7123456789012345678';
beforeEach(() => {
  win = new Window({ url: `https://www.douyin.com/note/${id}` });
  Object.assign(globalThis, { window: win, document: win.document, location: win.location });
  Downloader.shortVideoInfo = null;
  Downloader.shortVideoItems = [];
});
afterEach(() => { mocks.splice(0).forEach(mock => mock.mockRestore()); win.happyDOM.abort(); });

test('抖音图集和混合实况图可进入下载流程，顺序及背景音乐保留', async () => {
  const detail = { aweme_id: id, desc: '图集', images: [
    { url_list: ['https://cdn.test/1.jpg'] },
    { url_list: ['https://cdn.test/2.jpg'], video: { play_addr: { url_list: ['https://cdn.test/2.mp4'] } } }
  ], music: { play_url: { url_list: ['https://cdn.test/music.mp3'] } } };
  mocks.push(spyOn(DouyinInterceptor, 'getByAwemeId').mockReturnValue(detail));
  const result = await ShortVideoAPI.parseDouyinLocal(location.href, 0);
  expect(result?.type).toBe('live');
  expect(result?.live_photo?.map(photo => photo.image)).toEqual(['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg']);
  expect(result?.music?.url).toBe('https://cdn.test/music.mp3');
  expect(Downloader.buildItemUnits(result!, '相册').map(unit => unit.candidates[0]))
    .toEqual(['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg', 'https://cdn.test/2.mp4']);
  expect(ShortVideoAPI.normalizeDouyinDetail({ ...detail, images: [{ url_list: ['https://cdn.test/1.jpg'] }] }, location.href).type).toBe('image');
});

test('抖音精确匹配视频、笔记和 modal_id，不将最新缓存当成目标作品', () => {
  for (const url of [`https://www.douyin.com/video/${id}`, location.href, `https://www.douyin.com/?modal_id=${id}`]) {
    expect(douyinContentId(url)).toBe(id);
  }
  const detail = { aweme_id: id, desc: '图集', images: [{ url_list: ['https://cdn.test/1.jpg'] }] };
  (win as any).__INITIAL_STATE__ = { detail };
  expect(DouyinInterceptor.getByUrl(location.href)?.aweme_id).toBe(id);
  expect(DouyinInterceptor.getByUrl('https://www.douyin.com/video/7000000000000000000')).toBeNull();
  expect(DouyinInterceptor.getByUrl('https://www.douyin.com/')).toBeNull();
});

test('抖音不同清晰度也携带作品 ID，推荐流能生成正确备用链接', () => {
  const result = ShortVideoAPI.normalizeDouyinDetail({ aweme_id: id, desc: '视频', video: { bit_rate: [
    { quality_type: 1, quality_desc: '1080P', bit_rate: 1000, play_addr: { url_list: ['https://cdn.test/1080.mp4'] } },
    { quality_type: 2, quality_desc: '720P', bit_rate: 500, play_addr: { url_list: ['https://cdn.test/720.mp4'] } }
  ] } }, 'https://www.douyin.com/');
  expect(result.items?.map(item => item.video_id)).toEqual([id, id]);
});

test('小红书实况图保留每张静图与对应视频，普通图不丢失', () => {
  const noteId = '6aa25f7a000000002902eea8';
  const result = extractXhsNote({ noteId, type: 'normal', imageList: [
    { urlDefault: 'https://cdn.test/1.jpg' },
    { urlDefault: 'https://cdn.test/2.jpg', stream: { h264: [{ masterUrl: 'https://cdn.test/2.mp4' }] } }
  ] }, noteId, 'https://www.xiaohongshu.com/explore/' + noteId);
  expect(result?.type).toBe('live');
  expect(Downloader.buildItemUnits(result!, '相册')).toHaveLength(3);
});

test('旧解析成功或失败都不能覆盖新页面数据', async () => {
  const requests: Array<{ resolve: (data: ShortVideoData) => void; reject: (error: Error) => void }> = [];
  mocks.push(spyOn(ShortVideoAPI, 'parseUrl').mockImplementation(() => new Promise((resolve, reject) => requests.push({ resolve, reject }))));
  const render = spyOn(Downloader, 'renderShortVideoInfo').mockImplementation(() => {});
  const alert = spyOn(UI, 'showAlert').mockImplementation(() => {});
  mocks.push(render, alert, spyOn(UI, 'hideAlert').mockImplementation(() => {}), spyOn(UI, 'positionPopup').mockImplementation(() => {}));
  const first = Downloader.refreshShortVideoInfo('douyin');
  const second = Downloader.refreshShortVideoInfo('douyin');
  requests[1].resolve({ title: '新作品', type: 'video', url: 'https://cdn.test/new.mp4' });
  expect(await second).toBe(true);
  requests[0].resolve({ title: '旧作品', type: 'video', url: 'https://cdn.test/old.mp4' });
  expect(await first).toBe(false);
  expect(Downloader.shortVideoInfo?.title).toBe('新作品');
  const third = Downloader.refreshShortVideoInfo('douyin');
  win.history.pushState({}, '', '/video/7000000000000000000');
  requests[2].reject(new Error('旧页面错误'));
  expect(await third).toBe(false);
  expect(Downloader.shortVideoInfo?.title).toBe('新作品');
  expect(alert).not.toHaveBeenCalled();
  expect(render).toHaveBeenCalledTimes(1);
});
