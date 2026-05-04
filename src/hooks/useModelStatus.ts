/**
 * Offload — useModelStatus Hook
 *
 * React hook that subscribes to modelManager state changes
 * and re-renders the component when a model's status updates.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  modelManager,
  ModelId,
  ModelStatus,
  ModelInfo,
} from '../services/modelManager';

export interface UseModelStatusResult {
  info: ModelInfo;
  status: ModelStatus;
  isReady: boolean;
  isDownloading: boolean;
  startDownload: () => Promise<boolean>;
  cancelDownload: () => void;
  deleteModel: () => Promise<void>;
}

/**
 * Subscribe to a single model's status.
 */
export function useModelStatus(id: ModelId): UseModelStatusResult {
  const [status, setStatus] = useState<ModelStatus>(
    modelManager.getStatus(id),
  );

  useEffect(() => {
    // Get fresh status on mount
    setStatus(modelManager.getStatus(id));

    const unsubscribe = modelManager.subscribe((changedId, newStatus) => {
      if (changedId === id) {
        setStatus(newStatus);
      }
    });

    return unsubscribe;
  }, [id]);

  const startDownload = useCallback(() => {
    return modelManager.startDownload(id);
  }, [id]);

  const cancelDownload = useCallback(() => {
    modelManager.cancelDownload(id);
  }, [id]);

  const deleteModel = useCallback(() => {
    return modelManager.deleteModel(id);
  }, [id]);

  return {
    info: modelManager.getInfo(id),
    status,
    isReady: status.state === 'ready',
    isDownloading: status.state === 'downloading',
    startDownload,
    cancelDownload,
    deleteModel,
  };
}

/**
 * Subscribe to all models' statuses at once.
 */
export function useAllModelStatuses(): Record<ModelId, UseModelStatusResult> {
  const nomic = useModelStatus('nomic-embed-text');
  const qwen = useModelStatus('qwen-0.5b');

  return {
    'nomic-embed-text': nomic,
    'qwen-0.5b': qwen,
  };
}
