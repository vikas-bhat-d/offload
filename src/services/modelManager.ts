/**
 * Offload — Model Manager Service
 *
 * Owns all model download/status logic. Every other service calls
 * modelManager.isReady('nomic') before attempting inference.
 *
 * Models are NEVER auto-downloaded. The user must explicitly
 * tap a download button to start.
 */

const RNFS = require('@dr.pogodin/react-native-fs');

// ─── Types ───────────────────────────────────────────

export type ModelId = 'nomic-embed-text' | 'qwen-0.5b';

export type ModelState =
  | 'not_downloaded'
  | 'downloading'
  | 'verifying'
  | 'ready'
  | 'error';

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  percent: number;
  speedMBps?: number;
}

export interface ModelInfo {
  id: ModelId;
  name: string;
  description: string;
  sizeLabel: string;
  url: string;
  filename: string;
  required: boolean;
}

export interface ModelStatus {
  state: ModelState;
  progress?: DownloadProgress;
  error?: string;
  fileSizeBytes?: number;
}

// ─── Model Registry ──────────────────────────────────

const MODEL_REGISTRY: Record<ModelId, ModelInfo> = {
  'nomic-embed-text': {
    id: 'nomic-embed-text',
    name: 'Embedding Model',
    description: 'Converts text into semantic vectors for intelligent search and grouping.',
    sizeLabel: '~135 MB',
    url: 'https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/resolve/main/onnx/model_quantized.onnx',
    filename: 'nomic-text-quantized.onnx',
    required: true,
  },
  'qwen-0.5b': {
    id: 'qwen-0.5b',
    name: 'Language Model',
    description: 'Powers AI-generated cluster names and answers to your questions.',
    sizeLabel: '~400 MB',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    filename: 'qwen2.5-0.5b-instruct-q4_k_m.gguf',
    required: false,
  },
};

// ─── Internal State ──────────────────────────────────

type Listener = (id: ModelId, status: ModelStatus) => void;

const statusMap: Record<ModelId, ModelStatus> = {
  'nomic-embed-text': { state: 'not_downloaded' },
  'qwen-0.5b': { state: 'not_downloaded' },
};

const listeners: Set<Listener> = new Set();

// Track active downloads so we can cancel them
const activeDownloads: Map<ModelId, { jobId: number }> = new Map();

// For speed calculation
const downloadStartTimes: Map<ModelId, number> = new Map();

// ─── Helpers ─────────────────────────────────────────

function getModelPath(id: ModelId): string {
  const info = MODEL_REGISTRY[id];
  return `${RNFS.DocumentDirectoryPath}/${info.filename}`;
}

function notifyListeners(id: ModelId) {
  const status = statusMap[id];
  listeners.forEach(fn => fn(id, { ...status }));
}

function updateStatus(id: ModelId, partial: Partial<ModelStatus>) {
  statusMap[id] = { ...statusMap[id], ...partial };
  notifyListeners(id);
}

// ─── Public API ──────────────────────────────────────

export const modelManager = {
  /**
   * Get static info about a model (name, description, size, etc.)
   */
  getInfo(id: ModelId): ModelInfo {
    return MODEL_REGISTRY[id];
  },

  /**
   * Get all model IDs in the registry.
   */
  getAllModelIds(): ModelId[] {
    return Object.keys(MODEL_REGISTRY) as ModelId[];
  },

  /**
   * Get current status of a model.
   */
  getStatus(id: ModelId): ModelStatus {
    return { ...statusMap[id] };
  },

  /**
   * Returns true if the model file exists and is ready for inference.
   */
  isReady(id: ModelId): boolean {
    return statusMap[id].state === 'ready';
  },

  /**
   * Get the local file path for a model.
   */
  getModelPath(id: ModelId): string {
    return getModelPath(id);
  },

  /**
   * Check if model files already exist on disk and update state accordingly.
   * Should be called once at app startup.
   */
  async initialize(): Promise<void> {
    for (const id of Object.keys(MODEL_REGISTRY) as ModelId[]) {
      const path = getModelPath(id);
      try {
        const exists = await RNFS.exists(path);
        if (exists) {
          const stat = await RNFS.stat(path);
          updateStatus(id, {
            state: 'ready',
            fileSizeBytes: Number(stat.size),
            error: undefined,
            progress: undefined,
          });
        } else {
          updateStatus(id, { state: 'not_downloaded' });
        }
      } catch {
        updateStatus(id, { state: 'not_downloaded' });
      }
    }
  },

  /**
   * Start downloading a model. Must be explicitly triggered by user action.
   */
  async startDownload(id: ModelId): Promise<boolean> {
    const info = MODEL_REGISTRY[id];
    const destPath = getModelPath(id);

    // Already downloading?
    if (statusMap[id].state === 'downloading') {
      console.warn(`[ModelManager] ${id} is already downloading.`);
      return false;
    }

    // Already ready?
    const exists = await RNFS.exists(destPath);
    if (exists) {
      const stat = await RNFS.stat(destPath);
      updateStatus(id, {
        state: 'ready',
        fileSizeBytes: Number(stat.size),
      });
      return true;
    }

    // Start download
    updateStatus(id, {
      state: 'downloading',
      progress: { bytesWritten: 0, contentLength: 0, percent: 0 },
      error: undefined,
    });

    downloadStartTimes.set(id, Date.now());

    try {
      const downloadResult = RNFS.downloadFile({
        fromUrl: info.url,
        toFile: destPath,
        progress: (res: { bytesWritten: number; contentLength: number }) => {
          const percent =
            res.contentLength > 0
              ? Math.round((res.bytesWritten / res.contentLength) * 100)
              : 0;

          // Calculate speed
          const elapsed = (Date.now() - (downloadStartTimes.get(id) || Date.now())) / 1000;
          const speedMBps = elapsed > 0 ? res.bytesWritten / (1024 * 1024) / elapsed : 0;

          updateStatus(id, {
            progress: {
              bytesWritten: res.bytesWritten,
              contentLength: res.contentLength,
              percent,
              speedMBps: Math.round(speedMBps * 10) / 10,
            },
          });
        },
        progressDivider: 2,  // Report frequently for smooth progress
      });

      // Track so we can cancel
      activeDownloads.set(id, { jobId: downloadResult.jobId });

      const result = await downloadResult.promise;
      activeDownloads.delete(id);
      downloadStartTimes.delete(id);

      if (result.statusCode === 200) {
        const stat = await RNFS.stat(destPath);
        updateStatus(id, {
          state: 'ready',
          progress: undefined,
          fileSizeBytes: Number(stat.size),
        });
        console.log(`[ModelManager] ${id} download complete.`);
        return true;
      } else {
        // Clean up partial file
        await RNFS.unlink(destPath).catch(() => {});
        updateStatus(id, {
          state: 'error',
          error: `Download failed (HTTP ${result.statusCode})`,
          progress: undefined,
        });
        return false;
      }
    } catch (err: any) {
      activeDownloads.delete(id);
      downloadStartTimes.delete(id);

      // Clean up partial file
      await RNFS.unlink(destPath).catch(() => {});

      // Don't show error for user-initiated cancellations
      if (err?.message?.includes('cancelled') || err?.message?.includes('abort')) {
        updateStatus(id, {
          state: 'not_downloaded',
          progress: undefined,
          error: undefined,
        });
      } else {
        updateStatus(id, {
          state: 'error',
          error: err?.message || 'Download failed',
          progress: undefined,
        });
      }
      return false;
    }
  },

  /**
   * Cancel an in-progress download.
   */
  cancelDownload(id: ModelId): void {
    const download = activeDownloads.get(id);
    if (download) {
      RNFS.stopDownload(download.jobId);
      activeDownloads.delete(id);
      downloadStartTimes.delete(id);
      updateStatus(id, {
        state: 'not_downloaded',
        progress: undefined,
        error: undefined,
      });
    }
  },

  /**
   * Delete a downloaded model file.
   */
  async deleteModel(id: ModelId): Promise<void> {
    const path = getModelPath(id);
    try {
      const exists = await RNFS.exists(path);
      if (exists) {
        await RNFS.unlink(path);
      }
      updateStatus(id, {
        state: 'not_downloaded',
        progress: undefined,
        fileSizeBytes: undefined,
        error: undefined,
      });
      console.log(`[ModelManager] ${id} deleted.`);
    } catch (err: any) {
      console.error(`[ModelManager] Error deleting ${id}:`, err);
    }
  },

  // ─── Listener API ──────────────────────────────────

  /**
   * Subscribe to status changes. Returns an unsubscribe function.
   */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
