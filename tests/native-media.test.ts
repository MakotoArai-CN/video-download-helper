import { afterEach, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { findPlatformMedia, decodePlatformNode } from '../src/native-platforms.ts';
import { parseYouTubePlayer } from '../src/youtube-api.ts';
import { hlsVariant, localizeHls, parseDash } from '../src/stream-media.ts';
import { mediaRequest } from '../src/media-http.ts';

const win = new Window();
Object.assign(globalThis, { window: win, document: win.document, DOMParser: win.DOMParser, location: win.location });
afterEach(() => { delete (globalThis as any).GM_xmlhttpRequest; });

test('Facebook watch 查询参数不同的旧帖不能作为当前媒体', () => {
  const old = { url: 'https://www.facebook.com/watch/?v=111', playable_url: 'https://cdn.test/old.mp4' };
  expect(findPlatformMedia([old], 'facebook', 'https://www.facebook.com/watch/?v=222')).toBeNull();
  expect(findPlatformMedia([old], 'facebook', old.url)?.url).toBe(old.playable_url);
});

test('Instagram 混合轮播保留每个媒体及顺序', () => {
  const result = decodePlatformNode({ carousel_media: [
    { display_url: 'https://cdn.test/1.jpg' },
    { video_versions: [{ width: 720, url: 'https://cdn.test/2.mp4' }] }
  ] }, 'instagram', 'https://www.instagram.com/p/ABC/');
  expect(result?.items?.map(item => item.type)).toEqual(['image', 'video']);
  expect(result?.items?.[1].url).toBe('https://cdn.test/2.mp4');
});

const ytUrl = 'https://www.youtube.com/watch?v=dQw4w9wWgXc';
const response = (streamingData: any) => ({ videoDetails: { videoId: 'dQw4w9wWgXc', title: '视频' }, streamingData });
const decipher = async (format: any) => format.url;

test('YouTube 拒绝旧视频响应和只有视频的格式', async () => {
  expect(await parseYouTubePlayer({ videoDetails: { videoId: 'otherVideo1' } }, ytUrl, decipher)).toBeNull();
  expect(await parseYouTubePlayer(response({ adaptiveFormats: [{ mimeType: 'video/mp4', url: 'https://cdn.test/v.mp4' }] }), ytUrl, decipher)).toBeNull();
});

test('YouTube 独立音视频必须成对交给本地合并', async () => {
  const result = await parseYouTubePlayer(response({ adaptiveFormats: [
    { mimeType: 'video/mp4', height: 1080, url: 'https://cdn.test/v.mp4' },
    { mimeType: 'audio/mp4', bitrate: 128000, url: 'https://cdn.test/a.m4a' }
  ] }), ytUrl, decipher);
  expect(result?.audio_url).toBe('https://cdn.test/a.m4a');
  expect(result?.processing?.kind).toBe('remux');
});

test('YouTube 签名失败时继续尝试可用格式，跳过 DRM', async () => {
  const result = await parseYouTubePlayer(response({ formats: [
    { itag: 22, height: 1080, drmFamilies: ['widevine'], url: 'https://cdn.test/protected.mp4' },
    { itag: 22, height: 720, url: 'bad' },
    { itag: 18, height: 360, url: 'https://cdn.test/ok.mp4' }
  ] }), ytUrl, async format => { if (format.url === 'bad') throw new Error('签名失效'); return format.url; });
  expect(result?.url).toBe('https://cdn.test/ok.mp4');
});

test('HLS 主清单选择高码率及对应的默认音轨', () => {
  expect(hlsVariant(`#EXTM3U
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",DEFAULT=YES,URI="audio.m3u8"
#EXT-X-STREAM-INF:BANDWIDTH=100,AUDIO="a"
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=200,AUDIO="a"
high.m3u8`, 'https://cdn.test/master.m3u8')).toEqual({ video: 'https://cdn.test/high.m3u8', audio: 'https://cdn.test/audio.m3u8' });
});

test('HLS 分片、密钥、初始化段全部替换为本地文件', () => {
  const fragments: any[] = [];
  const text = localizeHls(`#EXTM3U
#EXT-X-KEY:METHOD=AES-128,URI="key"
#EXT-X-MAP:URI="init.mp4"
#EXTINF:1,
segment.ts
#EXT-X-ENDLIST`, 'https://cdn.test/list.m3u8', fragment => { fragments.push(fragment); return `local${fragments.length}`; });
  expect(fragments.map(item => item.url)).toEqual(['https://cdn.test/key', 'https://cdn.test/init.mp4', 'https://cdn.test/segment.ts']);
  expect(text).not.toContain('https:');
  expect(text).toContain('URI="local1"');
});

test('HLS 隐式字节偏移仅能继承紧邻的同一资源分片', () => {
  const fragments: any[] = [];
  localizeHls('#EXTM3U\n#EXT-X-BYTERANGE:4@0\na.ts\n#EXT-X-BYTERANGE:4\na.ts\n#EXT-X-ENDLIST', 'https://cdn.test/list', fragment => { fragments.push(fragment); return 'local'; });
  expect(fragments.map(item => item.range)).toEqual([[0, 3], [4, 7]]);
  expect(() => localizeHls('#EXTM3U\n#EXT-X-BYTERANGE:4@0\na.ts\nb.ts\n#EXT-X-BYTERANGE:4\na.ts\n#EXT-X-ENDLIST', 'https://cdn.test/list', () => 'local')).toThrow();
});

test('HLS 持续直播和不支持的加密不能当成完整下载', () => {
  expect(() => localizeHls('#EXTM3U\na.ts', 'https://cdn.test/list', () => 'local')).toThrow();
  expect(() => localizeHls('#EXTM3U\n#EXT-X-KEY:METHOD=SAMPLE-AES,URI="key"\na.ts\n#EXT-X-ENDLIST', 'https://cdn.test/list', () => 'local')).toThrow();
});

test('DASH 继承模板，按时间线生成有限分片及初始化段', () => {
  const tracks = parseDash(`<MPD mediaPresentationDuration="PT6S"><Period><AdaptationSet mimeType="video/mp4">
    <SegmentTemplate timescale="1" initialization="init-$RepresentationID$.mp4" media="$Time$.m4s"><SegmentTimeline><S t="0" d="2" r="-1"/></SegmentTimeline></SegmentTemplate>
    <Representation id="high" bandwidth="200"><BaseURL>media/</BaseURL></Representation>
  </AdaptationSet></Period></MPD>`, 'https://cdn.test/master.mpd');
  expect(tracks[0].fragments.map(item => item.url)).toEqual(['https://cdn.test/media/init-high.mp4', 'https://cdn.test/media/0.m4s', 'https://cdn.test/media/2.m4s', 'https://cdn.test/media/4.m4s']);
});

test('DASH DRM 和多 Period 明确拒绝', () => {
  expect(() => parseDash('<MPD><Period><ContentProtection/></Period></MPD>', 'https://cdn.test/list')).toThrow();
  expect(() => parseDash('<MPD><Period/><Period/></MPD>', 'https://cdn.test/list')).toThrow();
});

test('原站请求拒绝 HTTP 错误和超限数据', async () => {
  (globalThis as any).GM_xmlhttpRequest = (options: any) => options.onload({ status: 403, responseText: '{}' });
  await expect(mediaRequest('https://cdn.test/data')).rejects.toThrow('403');
  (globalThis as any).GM_xmlhttpRequest = (options: any) => options.onload({ status: 200, responseText: '12345' });
  await expect(mediaRequest('https://cdn.test/data', { maxBytes: 4 })).rejects.toThrow('大小限制');
});
