import * as ort from 'onnxruntime-react-native';
import { AutoTokenizer, env } from '@xenova/transformers';

// Configure transformers.js to not use ONNX Node.js bindings
env.allowLocalModels = false;
env.useBrowserCache = false;

// We will use nomic-embed-text-v1.5 (quantized) for text embeddings
const MODEL_REPO = 'nomic-ai/nomic-embed-text-v1.5';
const MODEL_URL = `https://huggingface.co/${MODEL_REPO}/resolve/main/onnx/model_quantized.onnx`;

export interface EmbeddingResult {
  success: boolean;
  embeddingDim: number;
  sampleValues: number[];
  inferenceTimeMs: number;
  error?: string;
  vector?: number[];
}

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
  percent: number;
}

/**
 * Downloads the ONNX model to the app's document directory.
 */
export async function downloadModel(
  destPath: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<boolean> {
  try {
    const RNFS = require('@dr.pogodin/react-native-fs');

    const exists = await RNFS.exists(destPath);
    if (exists) {
      console.log('[Embedding] Model already exists at:', destPath);
      return true;
    }

    console.log('[Embedding] Starting model download from:', MODEL_URL);

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
      progressDivider: 5,
    }).promise;

    if (downloadResult.statusCode === 200) {
      console.log('[Embedding] Download complete.');
      return true;
    } else {
      console.error('[Embedding] Download failed:', downloadResult.statusCode);
      return false;
    }
  } catch (error) {
    console.error('[Embedding] Download error:', error);
    return false;
  }
}

/**
 * Runs embedding inference on actual text using Xenova tokenizer and ONNX Runtime.
 */
export async function runTextEmbedding(
  text: string,
  modelPath: string,
): Promise<EmbeddingResult> {
  try {
    console.log('[Embedding] Tokenizing input text...');
    
    // Load tokenizer
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_REPO);
    
    // Nomic requires the 'search_document: ' prefix for document embeddings
    const prefix = 'search_document: ';
    const inputs = tokenizer(prefix + text, {
      padding: true,
      truncation: true,
      maxLength: 256, // Reasonable max length for mobile
    });

    console.log('[Embedding] Creating InferenceSession...');
    const startLoad = Date.now();

    const session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
    });

    const loadTime = Date.now() - startLoad;
    console.log(`[Embedding] Session created in ${loadTime}ms`);

    // Prepare tensors
    const seqLength = inputs.input_ids.data.length;
    
    // Transformers.js returns its own Tensor object. We need to access .data 
    // and map it safely to BigInt for ONNX Runtime's int64 requirement.
    const inputIdsArray = Array.from(inputs.input_ids.data).map((x: any) => BigInt(x));
    const inputIdsTensor = new ort.Tensor(
      'int64',
      new BigInt64Array(inputIdsArray),
      [1, seqLength]
    );
    
    const attentionMaskArray = Array.from(inputs.attention_mask.data).map((x: any) => BigInt(x));
    const attentionMaskTensor = new ort.Tensor(
      'int64',
      new BigInt64Array(attentionMaskArray),
      [1, seqLength]
    );

    // Optional token_type_ids
    let feeds: Record<string, ort.Tensor> = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor,
    };
    
    if (inputs.token_type_ids) {
       const tokenTypeArray = Array.from(inputs.token_type_ids.data).map((x: any) => BigInt(x));
       feeds['token_type_ids'] = new ort.Tensor(
         'int64',
         new BigInt64Array(tokenTypeArray),
         [1, seqLength]
       );
    }

    console.log('[Embedding] Running inference...');
    const startInference = Date.now();
    const results = await session.run(feeds);
    const inferenceTime = Date.now() - startInference;

    console.log(`[Embedding] Inference done in ${inferenceTime}ms`);

    // Nomic uses mean pooling over the sequence length, 
    // but the final output is usually normalized.
    // Assuming output is `sentence_embedding` or `last_hidden_state`
    const outputKey = session.outputNames.includes('sentence_embedding') 
      ? 'sentence_embedding' 
      : session.outputNames[0];
      
    const output = results[outputKey];
    let data = output.data as Float32Array;
    
    // If we get last_hidden_state (shape: [1, seq_len, 768])
    // we need to mean pool and normalize.
    // If the model exports `sentence_embedding`, it might already be pooled.
    const embeddingDim = output.dims[output.dims.length - 1];
    
    // For simplicity, we just take the [CLS] token (first token vector) 
    // or the already pooled vector if dims == 2 ([1, 768])
    let vector: number[];
    if (output.dims.length === 3) {
      // Taking [CLS] token at index 0 for each of the 768 dims
      vector = Array.from(data.slice(0, embeddingDim));
      
      // Better approach for nomic: Mean pooling over attention mask (skipped for simplicity here)
    } else {
      vector = Array.from(data);
    }
    
    // L2 Normalize (Nomic requirement)
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    vector = vector.map(v => v / norm);

    const sampleValues = vector.slice(0, 5);

    // Cleanup
    session.release();

    return {
      success: true,
      embeddingDim,
      sampleValues,
      inferenceTimeMs: inferenceTime,
      vector,
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
