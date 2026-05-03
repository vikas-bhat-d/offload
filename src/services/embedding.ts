/**
 * Offload - On-device Embedding Test
 *
 * Tests ONNX Runtime React Native integration by:
 * 1. Downloading a small ONNX model (all-MiniLM-L6-v2, ~23MB)
 * 2. Creating an InferenceSession
 * 3. Running a dummy embedding inference
 *
 * This validates the entire ONNX pipeline works on Android before
 * we bring in the larger nomic-embed-vision model.
 */

import * as ort from 'onnxruntime-react-native';

// Model config — using all-MiniLM-L6-v2 quantized as a lightweight test
// This is ~23MB vs nomic-embed-vision's ~300MB
const MODEL_URL =
  'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx';

export interface EmbeddingResult {
  success: boolean;
  embeddingDim: number;
  sampleValues: number[];
  inferenceTimeMs: number;
  error?: string;
}

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  percent: number;
}

/**
 * Downloads the ONNX model to the app's document directory.
 * Uses a simple fetch + write approach.
 */
export async function downloadModel(
  destPath: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<boolean> {
  try {
    const RNFS = require('@dr.pogodin/react-native-fs');

    // Check if model already exists
    const exists = await RNFS.exists(destPath);
    if (exists) {
      console.log('[Embedding] Model already exists at:', destPath);
      return true;
    }

    console.log('[Embedding] Starting model download from:', MODEL_URL);
    console.log('[Embedding] Destination:', destPath);

    const downloadResult = await RNFS.downloadFile({
      fromUrl: MODEL_URL,
      toFile: destPath,
      progress: (res: {bytesWritten: number; contentLength: number}) => {
        const percent =
          res.contentLength > 0
            ? Math.round((res.bytesWritten / res.contentLength) * 100)
            : 0;
        onProgress?.({
          bytesWritten: res.bytesWritten,
          contentLength: res.contentLength,
          percent,
        });
      },
      progressDivider: 5, // Report every 5%
    }).promise;

    if (downloadResult.statusCode === 200) {
      console.log('[Embedding] Download complete. Bytes:', downloadResult.bytesWritten);
      return true;
    } else {
      console.error('[Embedding] Download failed with status:', downloadResult.statusCode);
      return false;
    }
  } catch (error) {
    console.error('[Embedding] Download error:', error);
    return false;
  }
}

/**
 * Creates a dummy tokenized input for testing.
 * all-MiniLM-L6-v2 expects:
 *   - input_ids: int64 tensor [1, sequence_length]
 *   - attention_mask: int64 tensor [1, sequence_length]
 *   - token_type_ids: int64 tensor [1, sequence_length]
 *
 * For a simple test, we use a short sequence of token IDs.
 * In production, you'd use a proper tokenizer.
 */
function createDummyInputs() {
  const seqLength = 8;

  // Dummy token IDs: [CLS]=101, "hello"=7592, "world"=2088, [SEP]=102, rest=0
  const inputIds = new BigInt64Array(seqLength);
  inputIds[0] = BigInt(101); // [CLS]
  inputIds[1] = BigInt(7592); // hello
  inputIds[2] = BigInt(2088); // world
  inputIds[3] = BigInt(102); // [SEP]
  // rest are 0 (padding)

  const attentionMask = new BigInt64Array(seqLength);
  attentionMask[0] = BigInt(1);
  attentionMask[1] = BigInt(1);
  attentionMask[2] = BigInt(1);
  attentionMask[3] = BigInt(1);
  // rest are 0

  const tokenTypeIds = new BigInt64Array(seqLength);
  // all zeros for single sentence

  return {
    input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
    attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
    token_type_ids: new ort.Tensor('int64', tokenTypeIds, [1, seqLength]),
  };
}

/**
 * Runs a test embedding inference with the downloaded ONNX model.
 */
export async function runEmbeddingTest(
  modelPath: string,
): Promise<EmbeddingResult> {
  try {
    console.log('[Embedding] Creating InferenceSession...');
    const startLoad = Date.now();

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'], // Start with CPU; can try 'nnapi' for Android acceleration
    });

    const loadTime = Date.now() - startLoad;
    console.log(`[Embedding] Session created in ${loadTime}ms`);
    console.log('[Embedding] Input names:', session.inputNames);
    console.log('[Embedding] Output names:', session.outputNames);

    // Create dummy inputs
    const feeds = createDummyInputs();
    console.log('[Embedding] Running inference...');

    const startInference = Date.now();
    const results = await session.run(feeds);
    const inferenceTime = Date.now() - startInference;

    console.log(`[Embedding] Inference done in ${inferenceTime}ms`);

    // Get the output — usually "last_hidden_state" or "sentence_embedding"
    const outputKey = session.outputNames[0];
    const output = results[outputKey];
    const data = output.data as Float32Array;

    console.log(`[Embedding] Output shape: [${output.dims}]`);
    console.log(`[Embedding] Output size: ${data.length} values`);

    // For all-MiniLM-L6-v2, output is [1, seq_len, 384]
    // We take the [CLS] token's embedding (first token)
    const embeddingDim = output.dims[output.dims.length - 1];
    const sampleValues = Array.from(data.slice(0, 5));

    // Cleanup
    session.release();

    return {
      success: true,
      embeddingDim,
      sampleValues,
      inferenceTimeMs: inferenceTime,
    };
  } catch (error: any) {
    console.error('[Embedding] Inference error:', error);
    return {
      success: false,
      embeddingDim: 0,
      sampleValues: [],
      inferenceTimeMs: 0,
      error: error?.message || String(error),
    };
  }
}
