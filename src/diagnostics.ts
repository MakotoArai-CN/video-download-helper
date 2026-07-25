// 智能诊断模块：收集运行时日志、错误、环境信息，方便用户反馈问题给开发者
// 所有诊断信息只保留在内存中，用户主动导出 / 复制 / 提交时才产生输出

declare const GM_setValue: ((key: string, value: any) => void) | undefined;
declare const GM_getValue: (<T = any>(key: string, def?: T) => T) | undefined;
declare const GM_info: { script: { version: string; name?: string } } | undefined;

export type DiagnosticLevel = 'info' | 'warn' | 'error' | 'debug';

export type DiagnosticEntry = {
  time: number;
  level: DiagnosticLevel;
  scope: string;
  message: string;
  detail?: string;
};

type Listener = (entries: DiagnosticEntry[]) => void;

const MAX_ENTRIES = 300;
const REPO_ISSUE_URL = 'https://github.com/MakotoArai-CN/video-download-helper/issues/new';
const SCRIPT_VERSION = typeof GM_info !== 'undefined' && GM_info?.script?.version ? GM_info.script.version : '0.2.3';

function safeStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return value;
  if (value instanceof Error) {
    return `${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ''}`;
  }
  try {
    return JSON.stringify(value, (_key, val) => {
      if (val instanceof Error) return { name: val.name, message: val.message, stack: val.stack };
      return val;
    }, 2);
  } catch (err) {
    return `[unstringifiable: ${(err as Error).message}]`;
  }
}

function redact(text: string): string {
  if (!text) return text;
  // 遮蔽常见敏感字段
  return text
    .replace(/\b(SESSDATA|bili_jct|DedeUserID|access_key|token|cookie)\s*[=:]\s*[^;\s"']+/gi, '$1=***REDACTED***')
    .replace(/([?&](?:SESSDATA|bili_jct|access_key|token))=([^&\s]+)/gi, '$1=***REDACTED***');
}

export const Diagnostics = {
  entries: [] as DiagnosticEntry[],
  listeners: [] as Listener[],
  errorHooksInstalled: false,

  init(): void {
    this.installGlobalHooks();
    this.log('info', 'diagnostics', `诊断模块已启用 v${SCRIPT_VERSION}`);
    this.log('info', 'env', this.getEnvSummary());
  },

  installGlobalHooks(): void {
    if (this.errorHooksInstalled) return;
    this.errorHooksInstalled = true;

    try {
      window.addEventListener('error', event => {
        const err = event.error || event.message;
        this.log('error', 'window.error', safeStringify(err), event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined);
      });
      window.addEventListener('unhandledrejection', event => {
        this.log('error', 'unhandledrejection', safeStringify(event.reason));
      });
    } catch {
      // ignore（部分环境不支持 addEventListener）
    }
  },

  log(level: DiagnosticLevel, scope: string, message: unknown, detail?: unknown): void {
    const entry: DiagnosticEntry = {
      time: Date.now(),
      level,
      scope,
      message: redact(safeStringify(message)),
      detail: detail === undefined ? undefined : redact(safeStringify(detail))
    };

    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }

    this.emit();
  },

  info(scope: string, message: unknown, detail?: unknown): void { this.log('info', scope, message, detail); },
  warn(scope: string, message: unknown, detail?: unknown): void { this.log('warn', scope, message, detail); },
  error(scope: string, message: unknown, detail?: unknown): void { this.log('error', scope, message, detail); },
  debug(scope: string, message: unknown, detail?: unknown): void { this.log('debug', scope, message, detail); },

  clear(): void {
    this.entries = [];
    this.emit();
  },

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    listener(this.entries.slice());
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  },

  emit(): void {
    const snapshot = this.entries.slice();
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch { /* ignore listener error */ }
    }
  },

  getEnvSummary(): string {
    const nav = navigator as any;
    const hasSAB = typeof SharedArrayBuffer !== 'undefined';
    const isolated = typeof (globalThis as any).crossOriginIsolated === 'boolean'
      ? (globalThis as any).crossOriginIsolated
      : 'unknown';
    return [
      `URL: ${redact(location.href)}`,
      `UA: ${navigator.userAgent}`,
      `Platform: ${nav.userAgentData?.platform || nav.platform || 'unknown'}`,
      `Language: ${navigator.language}`,
      `Viewport: ${window.innerWidth}x${window.innerHeight}`,
      `DPR: ${window.devicePixelRatio}`,
      `Cores: ${navigator.hardwareConcurrency || 'unknown'}`,
      `Memory: ${(nav.deviceMemory || 'unknown')}GB`,
      `SharedArrayBuffer: ${hasSAB ? 'available' : 'unavailable'}`,
      `crossOriginIsolated: ${isolated}`,
      `Time: ${new Date().toISOString()}`,
      `Script: video-download-helper v${SCRIPT_VERSION}`
    ].join('\n');
  },

  buildReport(userNote?: string): string {
    const lines: string[] = [];
    lines.push('# 视频下载助手 - 诊断报告');
    lines.push('');
    lines.push('## 环境信息');
    lines.push('```');
    lines.push(this.getEnvSummary());
    lines.push('```');
    lines.push('');

    if (userNote && userNote.trim().length > 0) {
      lines.push('## 用户描述');
      lines.push(userNote.trim());
      lines.push('');
    }

    lines.push('## 运行日志');
    lines.push('```');
    if (this.entries.length === 0) {
      lines.push('(暂无日志)');
    } else {
      for (const entry of this.entries) {
        const timestamp = new Date(entry.time).toISOString();
        lines.push(`[${timestamp}] [${entry.level.toUpperCase()}] [${entry.scope}] ${entry.message}`);
        if (entry.detail) {
          lines.push(`  detail: ${entry.detail.replace(/\n/g, '\n  ')}`);
        }
      }
    }
    lines.push('```');
    lines.push('');
    lines.push('_日志已自动屏蔽 SESSDATA / bili_jct / token 等敏感字段，仍请在提交前确认无隐私信息。_');
    return lines.join('\n');
  },

  buildIssueUrl(userNote?: string): string {
    const report = this.buildReport(userNote);
    // GitHub issue URL 长度有限（约 8KB），截断日志尾部
    const maxBodyLen = 6500;
    const body = report.length > maxBodyLen
      ? report.slice(0, maxBodyLen) + '\n\n... (日志过长，已截断，请附上完整报告文件)'
      : report;
    const title = '[Bug] 使用中遇到的问题';
    return `${REPO_ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&labels=bug`;
  },

  downloadReport(userNote?: string): void {
    const report = this.buildReport(userNote);
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `vdh-diagnostic-${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  },

  async copyReport(userNote?: string): Promise<boolean> {
    const report = this.buildReport(userNote);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(report);
        return true;
      }
    } catch {
      // fallthrough to legacy path
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = report;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
};
