import { afterEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { parseYouTube, parseYouTubeFallback } from '../src/youtube-api.ts';

const win = new Window();
Object.assign(globalThis, { window: win, document: win.document, location: win.location });
afterEach(() => { delete (globalThis as any).GM_xmlhttpRequest; delete (win as any).ytInitialPlayerResponse; });
const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const details = { videoId: 'jNQXAC9IVRw', title: 'Me at the zoo' };

test('YouTube 网页仅有 SABR 时调用原站移动播放器并返回完整格式', async () => {
  (win as any).ytInitialPlayerResponse = { videoDetails: details, playabilityStatus: { status: 'OK' }, streamingData: { serverAbrStreamingUrl: 'https://cdn.test/sabr', adaptiveFormats: [{ mimeType: 'video/mp4', itag: 134 }] } };
  (globalThis as any).GM_xmlhttpRequest = (options: any) => {
    expect(options.url).toStartWith('https://www.youtube.com/youtubei/v1/player');
    expect(JSON.parse(options.data).videoId).toBe(details.videoId);
    options.onload({ status: 200, responseText: JSON.stringify({ videoDetails: details, streamingData: { formats: [{ itag: 18, url: 'https://cdn.test/complete.mp4' }] } }) });
  };
  expect((await parseYouTube(url))?.url).toBe('https://cdn.test/complete.mp4');
});

test('YouTube 移动响应仍无完整流时继续尝试另一客户端', async () => {
  let calls = 0;
  (globalThis as any).GM_xmlhttpRequest = (options: any) => {
    calls++;
    options.onload({ status: 200, responseText: JSON.stringify({ videoDetails: details, streamingData: calls === 1 ? {} : { adaptiveFormats: [
      { mimeType: 'video/mp4', url: 'https://cdn.test/v.mp4' }, { mimeType: 'audio/mp4', url: 'https://cdn.test/a.m4a' }
    ] } }) });
  };
  const result = await parseYouTubeFallback(url, async format => format.url);
  expect(calls).toBe(2);
  expect(result?.audio_url).toBe('https://cdn.test/a.m4a');
});

test('YouTube 原页面权限限制不能被客户端兜底覆盖', async () => {
  (win as any).ytInitialPlayerResponse = { videoDetails: details, playabilityStatus: { status: 'LOGIN_REQUIRED', reason: '需要登录' } };
  (globalThis as any).GM_xmlhttpRequest = () => { throw new Error('不应请求'); };
  await expect(parseYouTube(url)).rejects.toThrow('需要登录');
});
