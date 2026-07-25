export interface QualityItem {
  qn: number;
  desc: string;
  available: boolean;
}

export interface VideoCodecItem {
  type: string;
  name: string;
  videos: DashStream[];
}

export interface AudioCodecItem {
  id: number;
  name: string;
  data: DashStream;
}

export interface DashStream {
  id: number;
  codecs: string;
  bandwidth: number;
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string[];
  backup_url?: string[];
}

export interface DashData {
  video?: DashStream[];
  audio?: DashStream[];
  dolby?: { audio?: DashStream[] };
  flac?: { audio?: DashStream };
}

export interface PlayData {
  dash?: DashData;
  accept_quality?: number[];
  accept_description?: string[];
  quality?: number;
}

export interface PageInfo {
  cid: number;
  page: number;
  part: string;
  duration: number;
  ep_id?: number;
  bvid?: string;
}

export interface UGCEpisode {
  title: string;
  bvid: string;
  cid: number;
  arc: { duration: number };
}

export interface VideoInfo {
  title: string;
  owner: { name: string };
  duration: number;
  desc: string;
  pages: PageInfo[];
  pic?: string;
  cover?: string;
  currentPage?: number;
  type?: string;
  ugc_season?: {
    title: string;
    cover: string;
    sections: Array<{ episodes: UGCEpisode[] }>;
  };
  ugcEpisodes?: UGCEpisode[];
}

export interface UGCInfo {
  hasUGC: boolean;
  title?: string;
  episodes?: UGCEpisode[];
  cover?: string;
}

export interface VideoId {
  type: 'video' | 'bangumi';
  id: string;
}

export type ShortVideoPlatform =
  | 'douyin'
  | 'kuaishou'
  | 'xiaohongshu'
  | 'weibo'
  | 'toutiao'
  | 'pipigx';

export type SiteContext =
  | { kind: 'bilibili'; platform: 'bilibili'; sourceType: 'video' | 'bangumi' }
  | { kind: 'short-video'; platform: ShortVideoPlatform }
  | { kind: 'unsupported'; platform: null };

export interface ShortVideoAuthor {
  name?: string;
  id?: string;
  avatar?: string;
}

export interface ShortVideoMusic {
  title?: string;
  author?: string;
  url?: string;
  cover?: string;
}

export interface ShortVideoLivePhoto {
  image?: string;
  video?: string;
}

export interface ShortVideoData {
  type?: 'video' | 'image' | 'live' | 'unknown';
  title?: string;
  desc?: string;
  author?: ShortVideoAuthor;
  cover?: string;
  url?: string;
  duration?: number | null;
  video_backup?: string[];
  video_id?: string;
  images?: string[];
  live_photo?: ShortVideoLivePhoto[];
  music?: ShortVideoMusic;
  platform?: ShortVideoPlatform;
  sourceUrl?: string;
  itemLabel?: string;
  items?: ShortVideoData[];
}

export interface ShortVideoApiResponse {
  code: number;
  msg: string;
  data?: ShortVideoData | ShortVideoData[] | null;
}

export interface Streams {
  video: DashStream | null;
  audio: DashStream | null;
}

export interface DownloadBuffers {
  videoBuffer: ArrayBuffer;
  audioBuffer: ArrayBuffer | null;
}

export interface MergeResult {
  separate: boolean;
  data?: ArrayBuffer;
  video?: ArrayBuffer;
  audio?: ArrayBuffer | null;
}

export interface Metadata {
  title: string;
  author: string;
  description: string;
  duration: number;
}

export interface SubtitleItem {
  subtitle_url: string;
  lan: string;
  lan_doc?: string;
}

export type MergeMethod = 'js-merge' | 'ffmpeg-merge' | 'separate';
