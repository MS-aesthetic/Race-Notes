import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export type ReportShareStatus = 'shared' | 'downloaded' | 'cancelled' | 'failed';

export interface ReportShareResult {
  status: ReportShareStatus;
  error?: string;
}

export interface ReportShareAdapter {
  isNative: boolean;
  nativeShare?: (file: File, title: string) => Promise<void>;
  webCanShare?: (file: File) => boolean;
  webShare?: (file: File, title: string) => Promise<void>;
  download: (file: File) => void;
}

function isCancelled(error: unknown): boolean {
  const value = error as { name?: string; message?: string } | null;
  const text = `${value?.name || ''} ${value?.message || ''}`.toLowerCase();
  return text.includes('abort') || text.includes('cancel');
}

async function fileBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function browserDownload(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function defaultAdapter(): ReportShareAdapter {
  return {
    isNative: Capacitor.isNativePlatform(),
    nativeShare: async (file, title) => {
      const supported = await Share.canShare();
      if (!supported.value) throw new Error('Native file sharing is unavailable.');
      const written = await Filesystem.writeFile({ path: file.name, data: await fileBase64(file), directory: Directory.Cache });
      await Share.share({ title, dialogTitle: title, files: [written.uri] });
    },
    webCanShare: file => typeof navigator !== 'undefined'
      && typeof navigator.share === 'function'
      && typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [file] }),
    webShare: (file, title) => navigator.share({ title, files: [file] }),
    download: browserDownload,
  };
}

/** Native file share first, Web Share second, reliable download last. */
export async function shareOrDownloadReport(file: File, title: string, adapter: ReportShareAdapter = defaultAdapter()): Promise<ReportShareResult> {
  let lastError: unknown;
  if (adapter.isNative && adapter.nativeShare) {
    try {
      await adapter.nativeShare(file, title);
      return { status: 'shared' };
    } catch (error) {
      if (isCancelled(error)) return { status: 'cancelled' };
      const message = error instanceof Error ? error.message : 'Native file sharing failed.';
      return { status: 'failed', error: message };
    }
  }
  if (adapter.webCanShare?.(file) && adapter.webShare) {
    try {
      await adapter.webShare(file, title);
      return { status: 'shared' };
    } catch (error) {
      if (isCancelled(error)) return { status: 'cancelled' };
      lastError = error;
    }
  }
  try {
    adapter.download(file);
    return { status: 'downloaded' };
  } catch (error) {
    lastError = error;
  }
  const message = lastError instanceof Error ? lastError.message : 'Report could not be shared or downloaded.';
  return { status: 'failed', error: message };
}
