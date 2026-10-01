import type { ShortVideoData } from './types.ts';

function mediaUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const decoded = value.replace(/&amp;/g, '&');
  try {
    const url = new URL(decoded);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch { return ''; }
}

function request(url: string, json = true): Promise<any> {
  return new Promise((resolve, reject) => {
    (globalThis as any).GM_xmlhttpRequest({
      method: 'GET', url, timeout: 15000, responseType: json ? 'json' : 'text',
      headers: { Referer: 'https://www.reddit.com/' },
      onload(res: any) {
        if (res.status < 200 || res.status >= 300) {
          reject(new Error(`Reddit 请求失败（HTTP ${res.status}），请确认帖子可访问后重试`));
          return;
        }
        try { resolve(json && typeof res.response === 'string' ? JSON.parse(res.response) : res.response); }
        catch { reject(new Error('Reddit 返回了非 JSON 内容，请登录并打开帖子后重试')); }
      },
      onerror: () => reject(new Error('Reddit 网络请求失败')),
      ontimeout: () => reject(new Error('Reddit 请求超时'))
    });
  });
}

export function redditPostId(url: string): string | null {
  const parsed = new URL(url);
  if (parsed.hostname === 'redd.it') return parsed.pathname.match(/^\/([a-z0-9]+)\/?$/i)?.[1] ?? null;
  return parsed.pathname.match(/\/(?:comments|gallery)\/([a-z0-9]+)(?:\/|$)/i)?.[1] ?? null;
}

export function normalizeRedditPost(post: any, sourceUrl: string): ShortVideoData | null {
  const source = post.crosspost_parent_list?.[0] ?? post;
  const base: ShortVideoData = {
    title: post.title || source.title || 'Reddit', author: { name: post.author || source.author || '' },
    desc: post.selftext || '', platform: 'reddit', sourceUrl, video_id: post.id,
    cover: mediaUrl(source.preview?.images?.[0]?.source?.url)
  };
  const video = source.secure_media?.reddit_video ?? source.media?.reddit_video;
  if (mediaUrl(video?.fallback_url)) return {
    ...base, type: 'video', url: mediaUrl(video.fallback_url), duration: video.duration,
    animated: video.is_gif === true
  };
  const gallery = source.gallery_data?.items;
  if (Array.isArray(gallery)) {
    const items: ShortVideoData[] = gallery.flatMap((entry: any): ShortVideoData[] => {
      const media = source.media_metadata?.[entry.media_id];
      if (!media || media.status !== 'valid') return [];
      const image = mediaUrl(media.s?.gif) || mediaUrl(media.s?.u);
      if (image) return [{ ...base, type: 'image', images: [image], cover: image }];
      const mp4 = mediaUrl(media.s?.mp4);
      return mp4 ? [{ ...base, type: 'video', url: mp4, animated: true }] : [];
    });
    if (!items.length) return null;
    if (items.every(item => item.type === 'image')) {
      const images = items.flatMap(item => item.images!);
      return { ...base, type: 'image', images, cover: images[0] };
    }
    return { ...items[0], items };
  }
  const direct = mediaUrl(source.url_overridden_by_dest || source.url);
  if (/\.(?:jpe?g|png|webp|gif)(?:[?#]|$)/i.test(direct)) {
    return { ...base, type: 'image', images: [direct], cover: direct };
  }
  // Reddit 的动画预览是完整 MP4；普通外站链接的静态预览不能当作原帖媒体。
  const animation = source.preview?.reddit_video_preview;
  if (animation?.is_gif && mediaUrl(animation.fallback_url)) {
    return { ...base, type: 'video', url: mediaUrl(animation.fallback_url), animated: true };
  }
  return null;
}

export function redditAudioUrl(xml: string, manifestUrl: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('Reddit 音轨清单解析失败');
  const representations = Array.from(doc.querySelectorAll('Representation')).filter(rep =>
    /audio/i.test(`${rep.getAttribute('mimeType')} ${rep.getAttribute('codecs')} ${rep.parentElement?.getAttribute('mimeType')} ${rep.parentElement?.getAttribute('contentType')}`)
    || /^mp4a/i.test(rep.getAttribute('codecs') || ''));
  representations.sort((a, b) => Number(b.getAttribute('bandwidth')) - Number(a.getAttribute('bandwidth')));
  for (const rep of representations) {
    // 此下载路径要求完整文件，不能把分片清单保存为音频。
    if (rep.querySelector('SegmentTemplate, SegmentList') || rep.parentElement?.querySelector(':scope > SegmentTemplate, :scope > SegmentList')) continue;
    const ancestors: Element[] = [];
    for (let node: Element | null = rep; node; node = node.parentElement) ancestors.unshift(node);
    let resolved = manifestUrl;
    let found = false;
    for (const node of ancestors) {
      const base = Array.from(node.children).find(child => child.localName === 'BaseURL')?.textContent?.trim();
      if (base) { resolved = new URL(base, resolved).href; found = true; }
    }
    if (found) return mediaUrl(resolved);
  }
  if (representations.length) throw new Error('Reddit 音轨使用了暂不支持的分片格式');
  return '';
}

export const RedditAPI = {
  async parseUrl(url: string): Promise<ShortVideoData | null> {
    const id = redditPostId(url);
    if (!id) throw new Error('请打开 Reddit 帖子详情页后再试');
    const response = await request(`https://www.reddit.com/comments/${id}.json?raw_json=1&limit=1`);
    const post = response?.[0]?.data?.children?.find((item: any) => item.kind === 't3' && item.data?.id === id)?.data;
    if (!post) throw new Error('未找到 Reddit 帖子，可能已删除或需要登录');
    const data = normalizeRedditPost(post, url);
    if (!data) throw new Error('该 Reddit 帖子没有可下载的图片或原生视频，外站视频请打开原站下载');
    const source = post.crosspost_parent_list?.[0] ?? post;
    const video = source.secure_media?.reddit_video ?? source.media?.reddit_video;
    if (data.type === 'video' && video && !video.is_gif) {
      const manifest = mediaUrl(video.dash_url);
      if (!manifest) throw new Error('Reddit 未提供音轨清单，无法确认视频声音');
      data.audio_url = redditAudioUrl(await request(manifest, false), manifest);
    }
    return data;
  }
};
