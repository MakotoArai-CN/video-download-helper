import { afterEach, expect, spyOn, test } from 'bun:test';
import { Downloader } from '../src/downloader.ts';
import { UI } from '../src/ui.ts';
import { JSMerger } from '../src/merger.ts';

const mocks: Array<{ mockRestore(): void }> = [];
afterEach(() => { for (const mock of mocks.splice(0)) mock.mockRestore(); });

test('原生视频下载携带音轨，合并后才保存', async () => {
  const units = Downloader.buildItemUnits({ type: 'video', url: 'https://v.redd.it/id/video.mp4', audio_url: 'https://v.redd.it/id/audio.mp4' }, 'post');
  expect(units[0].audioCandidates).toEqual(['https://v.redd.it/id/audio.mp4']);
  const video = new Blob(['video']);
  // 最小 moov box，用于测试下载流程的结构检查；实际合并另用 FFmpeg 样本验证。
  const audio = new Blob([new Uint8Array([0, 0, 0, 8, 109, 111, 111, 118])]);
  const fetch = spyOn(Downloader, 'fetchBlobCandidates').mockImplementation(async urls => urls[0].endsWith('audio.mp4') ? audio : video);
  const save = spyOn(Downloader, 'saveFile').mockImplementation(() => {});
  const merge = spyOn(JSMerger, 'merge').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
  mocks.push(fetch, save, merge,
    spyOn(UI, 'updateProgress').mockImplementation(() => {}),
    spyOn(UI, 'updateCircleProgress').mockImplementation(() => {}),
    spyOn(Downloader, 'updateShortVideoDownloadProgress').mockImplementation(() => {}));
  await Downloader.downloadUnits(units, 'reddit', 'post');
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(merge).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledTimes(1);
  expect(await (save.mock.calls[0][0] as Blob).arrayBuffer()).toEqual(new Uint8Array([1, 2, 3]).buffer);
});

test('音轨下载失败时不保存无声视频', async () => {
  const fetch = spyOn(Downloader, 'fetchBlobCandidates').mockImplementation(async urls => {
    if (urls[0].endsWith('audio.mp4')) throw new Error('音轨失败');
    return new Blob(['video']);
  });
  const save = spyOn(Downloader, 'saveFile').mockImplementation(() => {});
  mocks.push(fetch, save,
    spyOn(UI, 'updateProgress').mockImplementation(() => {}),
    spyOn(UI, 'updateCircleProgress').mockImplementation(() => {}),
    spyOn(Downloader, 'updateShortVideoDownloadProgress').mockImplementation(() => {}));
  await expect(Downloader.downloadUnits([{ candidates: ['video.mp4'], audioCandidates: ['audio.mp4'], filename: 'post.mp4', label: '视频' }], 'reddit', 'post')).rejects.toThrow('音轨失败');
  expect(save).not.toHaveBeenCalled();
});
