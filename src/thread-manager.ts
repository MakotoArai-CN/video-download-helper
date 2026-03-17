import { Utils } from './utils.ts';
import { Network } from './network.ts';
import type { DownloadBuffers } from './types.ts';

export const ThreadManager = {
  maxThreads: 1,
  activeThreads: 0,
  queue: [] as Array<() => Promise<any>>,

  init(): void {
    const cores = Utils.getCPUCores();
    if (cores <= 4) {
      this.maxThreads = 1;
    } else {
      this.maxThreads = Math.floor(cores * 0.6);
      if (this.maxThreads % 2 !== 0) this.maxThreads -= 1;
    }
    console.log('线程管理器初始化，最大线程数:', this.maxThreads);
  },

  canRunTask(): boolean {
    return this.activeThreads < this.maxThreads;
  },

  runTask<T>(task: () => Promise<T>): Promise<T> {
    if (this.canRunTask()) {
      this.activeThreads++;
      return task().finally(() => {
        this.activeThreads--;
        this.processQueue();
      }) as Promise<T>;
    } else {
      return new Promise<T>((resolve, reject) => {
        this.queue.push(() => task().then(resolve as any).catch(reject));
      });
    }
  },

  processQueue(): void {
    if (this.queue.length > 0 && this.canRunTask()) {
      const nextTask = this.queue.shift()!;
      this.activeThreads++;
      nextTask().finally(() => {
        this.activeThreads--;
        this.processQueue();
      });
    }
  },

  downloadWithThread(
    videoUrl: string,
    audioUrl: string | null,
    onVideoProgress?: (loaded: number, total: number) => void,
    onAudioProgress?: (loaded: number, total: number) => void
  ): Promise<DownloadBuffers> {
    let videoPromise: Promise<ArrayBuffer>;
    let audioPromise: Promise<ArrayBuffer | null>;

    if (this.maxThreads > 1) {
      videoPromise = this.runTask(() => Network.downloadBuffer(videoUrl, onVideoProgress));
      audioPromise = audioUrl
        ? this.runTask(() => Network.downloadBuffer(audioUrl, onAudioProgress))
        : Promise.resolve(null);
    } else {
      videoPromise = Network.downloadBuffer(videoUrl, onVideoProgress);
      audioPromise = audioUrl
        ? videoPromise.then(() => Network.downloadBuffer(audioUrl, onAudioProgress))
        : Promise.resolve(null);
    }

    return Promise.all([videoPromise, audioPromise]).then(([videoBuffer, audioBuffer]) => ({
      videoBuffer,
      audioBuffer
    }));
  }
};
