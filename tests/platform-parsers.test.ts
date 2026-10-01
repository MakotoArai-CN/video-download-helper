import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { extractXhsNote, parseXhsLocal } from '../src/xhs-api.ts';
import { normalizeRedditPost, redditAudioUrl, redditPostId, RedditAPI } from '../src/reddit-api.ts';
import { matchPlatform } from '../src/platforms.ts';

const win = new Window();
Object.assign(globalThis, { window: win, document: win.document, DOMParser: win.DOMParser, location: win.location });
const id = '6aa25f7a000000002902eea8';
const url = `https://www.xiaohongshu.com/explore/${id}`;
const note = { noteId: id, type: 'normal', title: '图集', imageList: [
  { infoList: [{ imageScene: 'WB_PRV', url: 'https://cdn.test/preview.jpg' }, { imageScene: 'WB_DFT', url: 'https://cdn.test/1.jpg' }] },
  { urlDefault: 'https://cdn.test/2.jpg' }
] };

afterEach(() => { delete (globalThis as any).GM_xmlhttpRequest; delete (win as any).__INITIAL_STATE__; });

describe('小红书', () => {
  test('读取实际入口 __INITIAL_STATE__，跳过之前的笔记并保留图集顺序', async () => {
    win.location.href = url;
    (win as any).__INITIAL_STATE__ = { note: { noteDetailMap: {
      old: { note: { ...note, noteId: 'old', title: '旧笔记' } }, [id]: { note }
    } } };
    const result = await parseXhsLocal(url);
    expect(result?.title).toBe('图集');
    expect(result?.images).toEqual(['https://cdn.test/1.jpg', 'https://cdn.test/2.jpg']);
  });
  test('支持 ref 和只有映射键带 ID 的笔记', () => {
    const { noteId, ...withoutId } = note;
    expect(extractXhsNote({ value: { [id]: { note: withoutId } }, __v_isRef: true }, id, url)?.images).toHaveLength(2);
  });
  test('找不到当前笔记时不能返回推荐或旧笔记；循环引用安全', () => {
    const state: any = { note: { ...note, noteId: 'old' } };
    state.self = state;
    expect(extractXhsNote(state, id, url)).toBeNull();
  });
  test('保留视频和备用源，图文中的实况视频不覆盖图集', () => {
    const video = { media: { stream: { h264: [{ masterUrl: 'https://cdn.test/v.mp4', backupUrls: ['https://cdn.test/b.mp4'] }] } } };
    expect(extractXhsNote({ note: { ...note, video } }, id, url)?.type).toBe('image');
    expect(extractXhsNote({ note: { ...note, type: 'video', video } }, id, url)?.video_backup).toEqual(['https://cdn.test/b.mp4']);
  });
});

describe('Reddit', () => {
  test('域名识别与详情链接', () => {
    expect(matchPlatform('www.reddit.com')).toBe('reddit');
    expect(matchPlatform('reddit.com.evil.test')).toBeNull();
    for (const link of ['https://www.reddit.com/r/pics/comments/abc123/title/', 'https://www.reddit.com/gallery/abc123', 'https://redd.it/abc123']) {
      expect(redditPostId(link)).toBe('abc123');
    }
    expect(redditPostId('https://www.reddit.com/')).toBeNull();
  });
  test('图集按 gallery_data 排序并解码签名参数，跳过失效媒体', () => {
    const data = normalizeRedditPost({ gallery_data: { items: [{ media_id: 'b' }, { media_id: 'a' }, { media_id: 'c' }] }, media_metadata: {
      a: { status: 'valid', s: { u: 'https://i.redd.it/a.png' } },
      b: { status: 'valid', s: { u: 'https://preview.redd.it/b.jpg?x=1&amp;s=2' } }
    } }, 'post');
    expect(data?.images).toEqual(['https://preview.redd.it/b.jpg?x=1&s=2', 'https://i.redd.it/a.png']);
  });
  test('转帖使用源媒体和当前帖标题，纯文字不冒充图片', () => {
    expect(normalizeRedditPost({ title: '转帖', crosspost_parent_list: [{ url: 'https://i.redd.it/a.jpg' }] }, 'post')?.title).toBe('转帖');
    expect(normalizeRedditPost({ selftext: 'text' }, 'post')).toBeNull();
  });
  test('从 DASH 清单选择真实音轨地址，不猜测文件名', () => {
    const xml = '<MPD><Period><AdaptationSet contentType="audio"><Representation bandwidth="64000"><BaseURL>DASH_AUDIO_64.mp4</BaseURL></Representation><Representation bandwidth="128000"><BaseURL>DASH_AUDIO_128.mp4?x=1&amp;y=2</BaseURL></Representation></AdaptationSet></Period></MPD>';
    expect(redditAudioUrl(xml, 'https://v.redd.it/abc/DASHPlaylist.mpd')).toBe('https://v.redd.it/abc/DASH_AUDIO_128.mp4?x=1&y=2');
    expect(redditAudioUrl('<MPD><Period/></MPD>', 'https://v.redd.it/abc/DASHPlaylist.mpd')).toBe('');
  });
  test('接口到音轨解析端到端，正确匹配帖子 ID', async () => {
    (globalThis as any).GM_xmlhttpRequest = (req: any) => req.onload({ status: 200, response: req.responseType === 'json'
      ? [{ data: { children: [{ kind: 't3', data: { id: 'abc123', title: '视频', media: { reddit_video: { fallback_url: 'https://v.redd.it/abc/DASH_720.mp4', dash_url: 'https://v.redd.it/abc/DASHPlaylist.mpd' } } } }] } }]
      : '<MPD><Period><AdaptationSet mimeType="audio/mp4"><Representation><BaseURL>DASH_AUDIO_128.mp4</BaseURL></Representation></AdaptationSet></Period></MPD>' });
    expect((await RedditAPI.parseUrl('https://www.reddit.com/comments/abc123/'))?.audio_url).toBe('https://v.redd.it/abc/DASH_AUDIO_128.mp4');
  });
  test('HTTP 错误不能变成成功的无声视频', async () => {
    (globalThis as any).GM_xmlhttpRequest = (req: any) => req.onload({ status: 403 });
    await expect(RedditAPI.parseUrl('https://www.reddit.com/comments/abc123/')).rejects.toThrow('HTTP 403');
  });
});
