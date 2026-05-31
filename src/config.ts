import type { MergeMethod, ShortVideoPlatform } from './types.ts';

export const LEARNING_DISCLAIMER = '本视频通过学习工具下载，仅供个人学习研究使用，请勿用于商业用途，请支持正版内容创作者。';

export const CONFIG = {
  SHORT_VIDEO_API_BASE: 'https://api.bugpk.com/api',
  SHORT_VIDEO_PLATFORMS: {
    douyin: {
      label: '抖音',
      endpoint: 'douyin',
      mediaReferer: 'https://www.douyin.com/',
      mediaOrigin: 'https://www.douyin.com',
      proxyType: 'douyin'
    },
    kuaishou: {
      label: '快手',
      endpoint: 'kuaishou',
      fallbackEndpoints: ['ksjx'],
      mediaReferer: 'https://www.kuaishou.com/',
      mediaOrigin: 'https://www.kuaishou.com'
    },
    xiaohongshu: {
      label: '小红书',
      endpoint: 'xhsjx',
      mediaReferer: 'https://www.xiaohongshu.com/',
      mediaOrigin: 'https://www.xiaohongshu.com'
    },
    weibo: {
      label: '微博',
      endpoint: 'weibo',
      mediaReferer: 'https://weibo.com/',
      mediaOrigin: 'https://weibo.com',
      proxyType: 'weibo'
    },
    toutiao: {
      label: '今日头条',
      endpoint: 'toutiao',
      mediaReferer: 'https://www.toutiao.com/',
      mediaOrigin: 'https://www.toutiao.com'
    },
    pipixia: {
      label: '皮皮虾',
      endpoint: 'ppxia',
      mediaReferer: 'https://h5.pipix.com/',
      mediaOrigin: 'https://h5.pipix.com'
    },
    pipigx: {
      label: '皮皮搞笑',
      endpoint: 'pipigx',
      mediaReferer: 'https://h5.pipigx.com/',
      mediaOrigin: 'https://h5.pipigx.com'
    }
  } as Record<ShortVideoPlatform, {
    label: string;
    endpoint: string;
    mediaReferer: string;
    mediaOrigin: string;
    fallbackEndpoints?: string[];
    proxyType?: 'douyin' | 'weibo';
  }>,
  QUALITY_MAP: {
    127: '8K 超高清',
    126: '杜比视界',
    125: 'HDR 真彩色',
    120: '4K 超清',
    116: '1080P 60帧',
    112: '1080P 高码率',
    80: '1080P 高清',
    74: '720P 60帧',
    64: '720P 高清',
    32: '480P 清晰',
    16: '360P 流畅'
  } as Record<number, string>,
  QUALITY_LIMIT: {
    0: 32,
    1: 80,
    2: 127
  } as Record<number, number>,
  VIDEO_CODEC_MAP: {
    'avc1': 'H.264/AVC',
    'hev1': 'H.265/HEVC',
    'hvc1': 'H.265/HEVC',
    'av01': 'AV1'
  } as Record<string, string>,
  AUDIO_CODEC_MAP: {
    30280: 'AAC 64K',
    30232: 'AAC 132K',
    30216: 'AAC 192K',
    30250: 'AAC Dolby',
    30251: 'FLAC'
  } as Record<number, string>,
  MERGE_METHODS: {
    JSMERGE: 'js-merge' as MergeMethod,
    FFMPEG: 'ffmpeg-merge' as MergeMethod,
    SEPARATE: 'separate' as MergeMethod
  }
};
