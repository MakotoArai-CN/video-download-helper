import { CONFIG } from './config.ts';
import { Network } from './network.ts';
import type { VideoInfo, UGCInfo, PlayData, QualityItem, VideoCodecItem, AudioCodecItem, Streams } from './types.ts';

export const BiliAPI = {
  userVipType: 0,

  getUserInfo(): Promise<number> {
    return Network.fetchJSON('https://api.bilibili.com/x/web-interface/nav').then(res => {
      if (res.code === 0 && res.data) {
        if (res.data.vipStatus === 1 && res.data.vipType === 2) this.userVipType = 2;
        else if (res.data.isLogin) this.userVipType = 1;
        else this.userVipType = 0;
      }
      return this.userVipType;
    }).catch(() => { this.userVipType = 0; return 0; });
  },

  getVideoInfo(bvid: string): Promise<VideoInfo> {
    return Network.fetchJSON('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid).then(res => {
      if (res.code !== 0) throw new Error(res.message || '获取视频信息失败');
      return res.data;
    });
  },

  getUGCSeasonInfo(bvid: string): Promise<UGCInfo> {
    return Network.fetchJSON('https://api.bilibili.com/x/web-interface/view?bvid=' + bvid).then(res => {
      if (res.code !== 0) throw new Error(res.message || '获取合集信息失败');
      const data = res.data;
      if (data.ugc_season) {
        return {
          hasUGC: true,
          title: data.ugc_season.title,
          episodes: data.ugc_season.sections[0].episodes,
          cover: data.ugc_season.cover
        };
      }
      return { hasUGC: false };
    });
  },

  getBangumiInfo(videoId: string): Promise<VideoInfo> {
    const isEp = videoId.indexOf('ep') === 0;
    const id = videoId.replace(/^(ep|ss)/, '');
    let url = 'https://api.bilibili.com/pgc/view/web/season?';
    url += isEp ? 'ep_id=' + id : 'season_id=' + id;

    return Network.fetchJSON(url).then(res => {
      if (res.code !== 0) throw new Error(res.message || '获取番剧信息失败');
      const result = res.result;
      const episodes = result.episodes || [];
      const pages: any[] = [];
      let currentEpId: number | null = null;

      if (isEp) {
        currentEpId = parseInt(id);
      } else {
        const urlMatch = window.location.pathname.match(/ep(\d+)/);
        if (urlMatch) currentEpId = parseInt(urlMatch[1]);
      }

      for (let i = 0; i < episodes.length; i++) {
        const ep = episodes[i];
        pages.push({ cid: ep.cid, page: i + 1, part: ep.long_title || ep.title || ('第' + (i + 1) + '集'), duration: ep.duration / 1000, ep_id: ep.id, bvid: ep.bvid });
      }

      let currentIndex = 0;
      if (currentEpId) {
        for (let j = 0; j < pages.length; j++) {
          if (pages[j].ep_id === currentEpId) { currentIndex = j; break; }
        }
      }

      const totalDuration = episodes.reduce((acc: number, ep: any) => acc + ep.duration / 1000, 0);

      return {
        title: result.season_title || result.title,
        pages,
        owner: { name: result.up_info ? result.up_info.uname : '番剧' },
        duration: totalDuration,
        desc: result.evaluate || '',
        currentPage: currentIndex + 1,
        type: 'bangumi',
        cover: result.cover
      };
    });
  },

  getPlayUrl(params: { type: string; cid: number; qn: number; ep_id?: number; bvid?: string }): Promise<PlayData> {
    let url: string;
    if (params.type === 'bangumi') {
      url = 'https://api.bilibili.com/pgc/player/web/playurl?ep_id=' + params.ep_id + '&cid=' + params.cid + '&qn=' + params.qn + '&fnval=4048&fnver=0&fourk=1';
    } else {
      url = 'https://api.bilibili.com/x/player/playurl?bvid=' + params.bvid + '&cid=' + params.cid + '&qn=' + params.qn + '&fnval=4048&fnver=0&fourk=1';
    }
    return Network.fetchJSON(url).then(res => {
      if (res.code !== 0) throw new Error(res.message || '获取播放地址失败');
      return res.result || res.data;
    });
  },

  getSubtitles(bvid: string, cid: number): Promise<any[]> {
    return Network.fetchJSON('https://api.bilibili.com/x/player/v2?bvid=' + bvid + '&cid=' + cid).then(res => {
      if (res.code === 0 && res.data?.subtitle?.subtitles) return res.data.subtitle.subtitles;
      return [];
    }).catch(() => []);
  },

  getDanmaku(cid: number): Promise<string> {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url: 'https://api.bilibili.com/x/v1/dm/list.so?oid=' + cid,
        onload(res: any) {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText);
          else reject(new Error('获取弹幕失败'));
        },
        onerror() { reject(new Error('获取弹幕网络错误')); }
      });
    });
  },

  getAvailableQualities(playData: PlayData): QualityItem[] {
    const list: QualityItem[] = [];
    const userLimit = CONFIG.QUALITY_LIMIT[this.userVipType] || 32;
    if (playData.accept_quality && playData.accept_description) {
      for (let i = 0; i < playData.accept_quality.length; i++) {
        const qn = playData.accept_quality[i];
        list.push({ qn, desc: playData.accept_description[i] || CONFIG.QUALITY_MAP[qn] || qn + 'P', available: qn <= userLimit });
      }
    }
    return list;
  },

  getVideoCodecs(playData: PlayData): VideoCodecItem[] {
    const dash = playData.dash;
    if (!dash?.video) return [];
    const codecsMap: Record<string, VideoCodecItem> = {};
    for (const video of dash.video) {
      const codecType = video.codecs.split('.')[0];
      if (!codecsMap[codecType]) codecsMap[codecType] = { type: codecType, name: CONFIG.VIDEO_CODEC_MAP[codecType] || codecType, videos: [] };
      codecsMap[codecType].videos.push(video);
    }
    return Object.values(codecsMap).sort((a, b) => {
      const order: Record<string, number> = { 'avc1': 0, 'hev1': 1, 'hvc1': 1, 'av01': 2 };
      return (order[a.type] || 99) - (order[b.type] || 99);
    });
  },

  getAudioCodecs(playData: PlayData): AudioCodecItem[] {
    const dash = playData.dash;
    if (!dash) return [];
    const codecs: AudioCodecItem[] = [];
    if (dash.audio) {
      for (const a of dash.audio) codecs.push({ id: a.id, name: CONFIG.AUDIO_CODEC_MAP[a.id] || 'AAC', data: a });
    }
    if (dash.dolby?.audio?.[0]) codecs.push({ id: 30250, name: 'Dolby Atmos', data: dash.dolby.audio[0] });
    if (dash.flac?.audio) codecs.push({ id: 30251, name: 'FLAC', data: dash.flac.audio });
    return codecs.sort((a, b) => b.data.bandwidth - a.data.bandwidth);
  },

  getStreams(playData: PlayData, targetQn: number, videoCodec: string | null, audioCodec: number | null): Streams {
    const dash = playData.dash;
    if (!dash) throw new Error('该视频不支持DASH格式');
    let video = null;
    let audio = null;
    if (dash.video && dash.video.length > 0) {
      const sorted = dash.video.slice().sort((a, b) => b.id !== a.id ? b.id - a.id : b.bandwidth - a.bandwidth);
      if (videoCodec) video = sorted.find(v => v.id === targetQn && v.codecs.split('.')[0] === videoCodec) || null;
      if (!video) video = sorted.find(v => v.id === targetQn && v.codecs?.startsWith('avc1')) || null;
      if (!video) video = sorted.find(v => v.id === targetQn) || null;
      if (!video) video = sorted.find(v => v.id <= targetQn && v.codecs?.startsWith('avc1')) || null;
      if (!video) video = sorted.find(v => v.id <= targetQn) || null;
      if (!video) video = sorted[sorted.length - 1];
    }
    if (audioCodec) {
      if (audioCodec === 30250 && dash.dolby?.audio?.[0]) audio = dash.dolby.audio[0];
      else if (audioCodec === 30251 && dash.flac?.audio) audio = dash.flac.audio;
      else if (dash.audio) audio = dash.audio.find(a => a.id === audioCodec) || null;
    }
    if (!audio) {
      if (dash.audio?.length) audio = dash.audio.slice().sort((a, b) => b.bandwidth - a.bandwidth)[0];
      if (dash.dolby?.audio?.[0] && (!audio || dash.dolby.audio[0].bandwidth > audio.bandwidth)) audio = dash.dolby.audio[0];
      if (dash.flac?.audio && (!audio || dash.flac.audio.bandwidth > audio.bandwidth)) audio = dash.flac.audio;
    }
    return { video, audio };
  }
};

declare function GM_xmlhttpRequest(details: any): void;
