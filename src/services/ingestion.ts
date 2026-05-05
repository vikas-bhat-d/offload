/**
 * Offload -- Ingestion Service
 *
 * Unified entry point for all content types.
 * Handles preprocessing, embedding, and persistence.
 *
 * Text  --> clean --> embed --> insertItem
 * Link  --> fetchLinkMetadata --> embed embedText --> insertLinkItem
 * Image --> store path only (no embedding yet) --> insertImageItem
 */

import { modelManager } from './modelManager';
import { runTextEmbedding } from './embedding';
import { fetchLinkMetadata, isUrl, type LinkMetadata } from './linkMeta';
import { insertItem, insertLinkItem, insertImageItem } from './storage';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getEmbeddingModelPath(): string {
  return modelManager.getModelPath('nomic-embed-text');
}

// ─── Text Ingestion ──────────────────────────────────

export interface TextIngestionResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function ingestText(rawText: string): Promise<TextIngestionResult> {
  const text = rawText.trim();
  if (!text) return { success: false, error: 'Empty input' };

  try {
    const modelPath = getEmbeddingModelPath();
    const result = await runTextEmbedding(text, modelPath);
    if (!result.success || !result.vector) {
      return { success: false, error: result.error || 'Embedding failed' };
    }
    const id = generateId();
    await insertItem(id, text, result.vector);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

// ─── Link Ingestion ──────────────────────────────────

export interface LinkIngestionResult {
  success: boolean;
  id?: string;
  metadata?: LinkMetadata;
  error?: string;
}

export async function ingestLink(url: string): Promise<LinkIngestionResult> {
  const trimmed = url.trim();
  if (!isUrl(trimmed)) return { success: false, error: 'Not a valid URL' };

  let metadata: LinkMetadata;
  try {
    metadata = await fetchLinkMetadata(trimmed);
  } catch (err: any) {
    return { success: false, error: `Metadata fetch failed: ${err?.message}` };
  }

  try {
    const modelPath = getEmbeddingModelPath();
    const result = await runTextEmbedding(metadata.embedText, modelPath);
    if (!result.success || !result.vector) {
      return { success: false, error: result.error || 'Embedding failed' };
    }
    const id = generateId();
    await insertLinkItem(id, trimmed, metadata, result.vector);
    return { success: true, id, metadata };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

// ─── Image Ingestion ─────────────────────────────────

export interface ImageIngestionResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Stores a shared image path without embedding.
 * The item is marked is_embedded = 0 and excluded from search until
 * image embedding is implemented in a later phase.
 */
export async function ingestImage(
  imagePath: string,
  mimeType: string = 'image/*'
): Promise<ImageIngestionResult> {
  if (!imagePath) return { success: false, error: 'No image path provided' };
  try {
    const id = generateId();
    await insertImageItem(id, imagePath, mimeType);
    return { success: true, id };
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Unknown error' };
  }
}

// ─── Auto-detect and dispatch ────────────────────────

export type IngestionResult =
  | TextIngestionResult
  | LinkIngestionResult
  | ImageIngestionResult;

/**
 * Auto-detects content type and routes to the appropriate ingestion function.
 * Use this from the share intent handler.
 */
export async function ingestAuto(
  data: string,
  mimeType?: string
): Promise<IngestionResult> {
  if (mimeType?.startsWith('image/')) {
    return ingestImage(data, mimeType);
  }
  if (isUrl(data)) {
    return ingestLink(data);
  }
  return ingestText(data);
}
