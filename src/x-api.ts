import { Diagnostics } from './diagnostics.ts';
import type { ShortVideoData } from './types.ts';

declare const unsafeWindow: any;

// 公开可用的 Web guest bearer。X 在 web 前端硬编码这个值，可以直接复用。
const WEB_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// TweetResultByRestId GraphQL 端点。X 的 queryId 会不定期变更，
// 故保留一组已知的 fallback，并尝试从页面 script 中动态发现最新的。
const TWEET_QUERY_IDS = [
  'zJvfJs3gSbrVhC0MKjt_OQ',
  'OoJd6A50cv8GsifjoOHGfg',
  'nBS-WpgA6ZG0CyNHD517JQ'
];

interface XVideoVariant {
  bitrate?: number;
  content_type: string;
  url: string;
}

interface XMediaVideoInfo {
  aspect_ratio?: number[];
  duration_millis?: number;
  variants: XVideoVariant[];
}

interface XExtendedMedia {
  type: 'video' | 'animated_gif' | 'photo' | string;
  media_url_https?: string;
  video_info?: XMediaVideoInfo;
  ext_alt_text?: string;
}

interface XLegacyTweet {
  full_text?: string;
  entities?: any;
  extended_entities?: { media?: XExtendedMedia[] };
  user_id_str?: string;
  created_at?: string;
}

interface XTweetResult {
  __typename?: string;
  legacy?: XLegacyTweet;
  core?: { user_results?: { result?: { legacy?: { name?: string; screen_name?: string; profile_image_url_https?: string } } } };
  note_tweet?: { note_tweet_results?: { result?: { text?: string } } };
  tweet?: XTweetResult;
}

function extractTweetId(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/status(?:es)?\/(\d{5,25})/);
    if (m?.[1]) return m[1];
  } catch {}
  return null;
}

function getCookie(name: string): string {
  const list = document.cookie.split(';');
  for (const raw of list) {
    const [k, ...rest] = raw.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

async function fetchGuestToken(): Promise<string> {
  const ct0 = getCookie('ct0');
  return new Promise<string>((resolve, reject) => {
    (globalThis as any).GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://api.x.com/1.1/guest/activate.json',
      headers: {
        Authorization: `Bearer ${WEB_BEARER}`,
        'Content-Type': 'application/json',
        ...(ct0 ? { 'x-csrf-token': ct0 } : {})
      },
      data: '',
      responseType: 'json',
      onload(res: any) {
        try {
          let data = res.response;
          if (typeof data === 'string') data = JSON.parse(data);
          if (data?.guest_token) resolve(String(data.guest_token));
          else reject(new Error('未能获取 guest_token'));
        } catch (e: any) {
          reject(new Error('guest_token 解析失败: ' + e.message));
        }
      },
      onerror: () => reject(new Error('guest_token 网络错误')),
      ontimeout: () => reject(new Error('guest_token 超时'))
    });
  });
}

function collectQueryIdsFromPage(): string[] {
  const ids = new Set<string>();
  TWEET_QUERY_IDS.forEach(id => ids.add(id));
  try {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script'));
    for (const s of scripts) {
      const src = s.getAttribute('src') || '';
      if (!/TweetResult|graphql/i.test(src + (s.textContent || ''))) continue;
      const text = s.textContent || '';
      const m = text.match(/queryId:"([A-Za-z0-9_-]{16,})"[^}]{0,120}operationName:"TweetResultByRestId"/g) || [];
      m.forEach(fragment => {
        const idMatch = fragment.match(/queryId:"([A-Za-z0-9_-]+)"/);
        if (idMatch?.[1]) ids.add(idMatch[1]);
      });
    }
  } catch {}
  return Array.from(ids);
}

async function fetchTweetGraphQL(tweetId: string, queryId: string, guestToken: string): Promise<any> {
  const variables = {
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false
  };
  const features = {
    creator_subscriptions_tweet_preview_api_enabled: true,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_awards_web_tipping_enabled: false,
    creator_subscriptions_quote_tweet_preview_enabled: false,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    rweb_video_timestamps_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    profile_label_improvements_pcf_label_in_post_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    responsive_web_graphql_exclude_directive_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_enhance_cards_enabled: false
  };
  const fieldToggles = { withArticleRichContentState: true, withArticlePlainText: false, withGrokAnalyze: false, withDisallowedReplyControls: false };

  const params = new URLSearchParams({
    variables: JSON.stringify(variables),
    features: JSON.stringify(features),
    fieldToggles: JSON.stringify(fieldToggles)
  });

  const url = `https://api.x.com/graphql/${queryId}/TweetResultByRestId?${params.toString()}`;
  const ct0 = getCookie('ct0');

  return new Promise<any>((resolve, reject) => {
    (globalThis as any).GM_xmlhttpRequest({
      method: 'GET',
      url,
      headers: {
        Authorization: `Bearer ${WEB_BEARER}`,
        'x-guest-token': guestToken,
        'Content-Type': 'application/json',
        Referer: 'https://x.com/',
        Origin: 'https://x.com',
        ...(ct0 ? { 'x-csrf-token': ct0 } : {})
      },
      responseType: 'json',
      onload(res: any) {
        try {
          let data = res.response;
          if (typeof data === 'string') data = JSON.parse(data);
          if (res.status >= 200 && res.status < 300) resolve(data);
          else reject(new Error(`TweetResultByRestId HTTP ${res.status}`));
        } catch (e: any) {
          reject(new Error('TweetResult 解析失败: ' + e.message));
        }
      },
      onerror: () => reject(new Error('TweetResult 网络错误')),
      ontimeout: () => reject(new Error('TweetResult 超时'))
    });
  });
}

function unwrapTweetResult(response: any): XTweetResult | null {
  const root = response?.data?.tweetResult?.result;
  if (!root) return null;
  if (root.__typename === 'TweetWithVisibilityResults') return root.tweet || null;
  return root;
}

function pickBestVariant(variants: XVideoVariant[]): XVideoVariant | null {
  const mp4 = variants.filter(v => v.content_type === 'video/mp4');
  if (mp4.length === 0) return variants[0] || null;
  return mp4.slice().sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
}

function normalizeMediaItems(tweet: XTweetResult, pageUrl: string): ShortVideoData[] {
  const legacy = tweet.legacy;
  const media = legacy?.extended_entities?.media || [];
  if (media.length === 0) return [];

  const authorLegacy = tweet.core?.user_results?.result?.legacy;
  const author = {
    name: authorLegacy?.name || '',
    id: authorLegacy?.screen_name || '',
    avatar: authorLegacy?.profile_image_url_https || ''
  };
  const rawText = tweet.note_tweet?.note_tweet_results?.result?.text || legacy?.full_text || '';
  const text = rawText.replace(/https:\/\/t\.co\/\w+/g, '').trim();

  const results: ShortVideoData[] = [];

  media.forEach((m, index) => {
    const label = media.length > 1 ? ` #${index + 1}` : '';
    if (m.type === 'video' || m.type === 'animated_gif') {
      const variants = m.video_info?.variants || [];
      const best = pickBestVariant(variants);
      if (!best?.url) return;
      // 类型字段缺失时按地址判定：GIF 的文件走 /tweet_video/，普通视频走 /ext_tw_video/ 等
      const animated = m.type === 'animated_gif' || /\/tweet_video\//.test(best.url);
      const backups = variants
        .filter(v => v.content_type === 'video/mp4' && v.url !== best.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        .map(v => v.url);
      results.push({
        type: 'video',
        title: text || `X ${animated ? 'GIF' : '视频'}${label}`,
        desc: text,
        author,
        cover: m.media_url_https || '',
        url: best.url,
        video_backup: backups,
        duration: m.video_info?.duration_millis ? m.video_info.duration_millis / 1000 : null,
        platform: 'x',
        sourceUrl: pageUrl,
        animated,
        itemLabel: `${animated ? 'GIF' : '视频'}${label} ${best.bitrate ? Math.round((best.bitrate || 0) / 1000) + 'kbps' : ''}`.trim()
      });
    } else if (m.type === 'photo' && m.media_url_https) {
      results.push({
        type: 'image',
        title: text || `X 图片${label}`,
        desc: text,
        author,
        cover: m.media_url_https,
        url: '',
        images: [`${m.media_url_https}?name=orig`],
        platform: 'x',
        sourceUrl: pageUrl,
        itemLabel: `图片${label}`
      });
    }
  });

  return results;
}

function mergeIntoSingle(items: ShortVideoData[], pageUrl: string): ShortVideoData {
  const images = items.filter(i => i.type === 'image').flatMap(i => i.images || []);
  const videos = items.filter(i => i.type === 'video');

  if (videos.length > 0) {
    const first = videos[0];
    return {
      ...first,
      sourceUrl: pageUrl,
      items: items.length > 1 ? items : undefined,
      images: images.length > 0 ? images : first.images
    };
  }

  const firstImage = items[0];
  return {
    ...firstImage,
    images,
    sourceUrl: pageUrl,
    items: items.length > 1 ? items : undefined
  };
}

async function parseFromDom(pageUrl: string): Promise<ShortVideoData | null> {
  const win: any = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const initial = win.__INITIAL_STATE__ || win.__META_DATA__ || null;
  if (!initial) return null;

  const walk = (value: any, depth: number, seen: WeakSet<object>): XTweetResult | null => {
    if (depth > 8 || !value || typeof value !== 'object') return null;
    if (seen.has(value)) return null;
    seen.add(value);
    if (value.legacy?.extended_entities?.media) return value as XTweetResult;
    for (const v of Object.values(value)) {
      const r = walk(v, depth + 1, seen);
      if (r) return r;
    }
    return null;
  };

  const found = walk(initial, 0, new WeakSet());
  if (!found) return null;
  const items = normalizeMediaItems(found, pageUrl);
  if (items.length === 0) return null;
  return mergeIntoSingle(items, pageUrl);
}

export const XAPI = {
  async parseUrl(pageUrl: string): Promise<ShortVideoData | null> {
    const tweetId = extractTweetId(pageUrl);
    if (!tweetId) {
      const dom = await parseFromDom(pageUrl);
      if (dom) return dom;
      throw new Error('未能识别推文 ID，请打开单条推文详情页');
    }

    let guestToken = '';
    try {
      guestToken = await fetchGuestToken();
    } catch (e: any) {
      Diagnostics.warn('x', 'guest_token 获取失败，尝试无 token 请求', e);
    }

    const queryIds = collectQueryIdsFromPage();
    let lastError: Error | null = null;

    for (const qid of queryIds) {
      try {
        const response = await fetchTweetGraphQL(tweetId, qid, guestToken);
        const tweet = unwrapTweetResult(response);
        if (!tweet) {
          const reason = response?.errors?.[0]?.message || '推文数据为空';
          lastError = new Error(reason);
          Diagnostics.debug('x', `queryId=${qid} 返回空: ${reason}`);
          continue;
        }
        const items = normalizeMediaItems(tweet, pageUrl);
        if (items.length === 0) throw new Error('该推文没有可下载的媒体');
        Diagnostics.info('x', `queryId=${qid} 解析成功，媒体数=${items.length}`);
        return mergeIntoSingle(items, pageUrl);
      } catch (e: any) {
        lastError = e;
        Diagnostics.warn('x', `queryId=${qid} 请求失败`, e);
      }
    }

    // GraphQL 全部失败时最后尝试 DOM
    const dom = await parseFromDom(pageUrl);
    if (dom) return dom;

    throw (lastError || new Error('无法获取 X 推文数据'));
  }
};
