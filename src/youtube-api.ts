import { getMediaContext } from './media-context.ts';
import { assignedJSON, httpUrl, mediaJSON, mediaRequest } from './media-http.ts';
import type { ShortVideoData } from './types.ts';

declare const unsafeWindow: any;
type Decipher = (format: any) => Promise<string>;

/** 只有同时有音视频的格式，或者完整的音视频配对，才作为成功结果。 */
export async function parseYouTubePlayer(response: any, url: string, decipher: Decipher): Promise<ShortVideoData | null> {
  const context = getMediaContext(url, 'youtube');
  if (!context || response?.videoDetails?.videoId !== context.videoId) return null;
  if (response.playabilityStatus?.status && response.playabilityStatus.status !== 'OK') {
    throw new Error(response.playabilityStatus.reason || 'YouTube 当前账号无法播放此视频');
  }
  const streams = response.streamingData;
  if (!streams) return null;
  const base: ShortVideoData = {
    type: 'video', platform: 'youtube', sourceUrl: url, video_id: context.videoId,
    title: response.videoDetails.title, author: { name: response.videoDetails.author },
    duration: Number(response.videoDetails.lengthSeconds) || null,
    cover: response.videoDetails.thumbnail?.thumbnails?.at(-1)?.url
  };
  const sorted = (formats: any[]) => formats.slice().sort((a, b) => (b.height || b.bitrate || 0) - (a.height || a.bitrate || 0));
  const resolve = async (formats: any[]) => {
    for (const format of sorted(formats)) {
      if (format.drmFamilies?.length || format.drmTrackType) continue;
      try { const media = httpUrl(await decipher(format)); if (media) return { format, url: media }; } catch { /* 尝试其他实际格式。 */ }
    }
    return null;
  };
  const progressive = await resolve((streams.formats || []).filter((f: any) => f.audioQuality || f.audioChannels || [18, 22, 37, 38, 59, 78].includes(f.itag)));
  if (progressive) return { ...base, url: progressive.url, output_ext: /webm/.test(progressive.format.mimeType) ? 'webm' : 'mp4' };
  const formats = streams.adaptiveFormats || [];
  const video = await resolve(formats.filter((f: any) => /^video\//.test(f.mimeType)));
  const audio = await resolve(formats.filter((f: any) => /^audio\//.test(f.mimeType)));
  if (video && audio) return {
    ...base, url: video.url, audio_url: audio.url, processing: { kind: 'remux' }, output_ext: 'mp4'
  };
  const hls = httpUrl(streams.hlsManifestUrl);
  if (hls) return { ...base, url: hls, processing: { kind: 'hls' }, output_ext: 'mp4' };
  const dash = httpUrl(streams.dashManifestUrl);
  if (dash) return { ...base, url: dash, processing: { kind: 'dash' }, output_ext: 'mp4' };
  return null;
}

let playerPromise: Promise<any> | null = null;
let loadedPlayerId = '';

/** 网页仅返回 SABR 时，请求原站移动播放器提供的普通媒体格式。 */
export async function parseYouTubeFallback(url: string, decipher: Decipher): Promise<ShortVideoData | null> {
  const context = getMediaContext(url, 'youtube');
  if (!context) return null;
  const clients = [
    { clientName: 'ANDROID', clientVersion: '21.02.35', androidSdkVersion: 30 },
    { clientName: 'IOS', clientVersion: '21.02.3', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2' }
  ];
  let lastError: unknown;
  for (const client of clients) {
    try {
      const response = await mediaJSON('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { ...client, hl: 'en' } }, videoId: context.videoId })
      });
      const result = await parseYouTubePlayer(response, url, decipher);
      if (result) return result;
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
  return null;
}

export async function parseYouTube(url: string): Promise<ShortVideoData | null> {
  const context = getMediaContext(url, 'youtube');
  if (!context) throw new Error('请打开 YouTube 视频、Shorts 或已结束的直播页面');
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  let response: any;
  try { response = (document.getElementById('movie_player') as any)?.getPlayerResponse?.(); } catch {}
  if (response?.videoDetails?.videoId !== context.videoId) response = win.ytInitialPlayerResponse;
  if (response?.videoDetails?.videoId !== context.videoId) {
    const html = (await mediaRequest(context.pageUrl)).data;
    response = assignedJSON(html, 'ytInitialPlayerResponse =') || assignedJSON(html, 'ytInitialPlayerResponse=');
  }
  const decipher: Decipher = async format => {
    const cipher = new URLSearchParams(format.signatureCipher || format.cipher || '');
    const direct = httpUrl(format.url || cipher.get('url'));
    if (!direct) throw new Error('YouTube 未提供媒体地址');
    if (!cipher.has('s') && !new URL(direct).searchParams.has('n')) {
      const parsed = new URL(direct);
      if (cipher.get('sig')) parsed.searchParams.set(cipher.get('sp') || 'signature', cipher.get('sig')!);
      return parsed.href;
    }
    const { Player, Platform } = await import('youtubei.js/web');
    const { evaluatePlayerScript } = await import('./player-sandbox.ts');
    Platform.shim.eval = data => evaluatePlayerScript(data.output);
    const source = Array.from(document.scripts).map(script => script.src).find(src => /\/s\/player\/[^/]+\/.*base\.js/.test(src));
    const playerId = source?.match(/\/s\/player\/([^/]+)\//)?.[1] || '';
    if (!playerPromise || loadedPlayerId !== playerId) {
      loadedPlayerId = playerId;
      const playerFetch = (async (input: RequestInfo | URL) => {
        const address = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!/^https:\/\/(?:www\.)?youtube\.com\//.test(address)) throw new Error('播放器请求不是 YouTube 原站');
        const result = await mediaRequest(address);
        return new Response(result.data, { status: result.status });
      }) as typeof fetch;
      playerPromise = Player.create(undefined, playerFetch, undefined, playerId || undefined).catch(error => { playerPromise = null; throw error; });
    }
    return (await playerPromise).decipher(format.url, format.signatureCipher, format.cipher);
  };
  // 原页面的登录/权限错误由 parseYouTubePlayer 直接抛出，不用其他客户端覆盖。
  const result = await parseYouTubePlayer(response, url, decipher) || await parseYouTubeFallback(url, decipher);
  if (!result) throw new Error('YouTube 未提供可用的完整音视频源；播放器签名、登录要求或 SABR 格式可能暂不受支持');
  return result;
}
