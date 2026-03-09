/**
 * Node.js Runtime Embeddings with WASM Backend
 * 
 * Uses @xenova/transformers with WASM backend (not native ONNX)
 * Works on Vercel Node.js runtime
 */

import { pipeline, env } from '@xenova/transformers';

// CRITICAL: Configure BEFORE any pipeline creation
// Force WASM backend, disable native ONNX runtime
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;

// Model configurations - MUST use e5 models
const SMALL_MODEL = 'Xenova/e5-small-v2'; // 384-dim
const LARGE_MODEL = 'Xenova/e5-large-v2'; // 1024-dim

// Singleton instances
let smallPipeline: any = null;
let largePipeline: any = null;

/**
 * Initialize e5-small model (384-dim)
 */
async function initSmallModel() {
  if (smallPipeline) return smallPipeline;

  try {
    console.log('[Embeddings] Initializing e5-small model (384-dim) with WASM backend...');
    
    smallPipeline = await pipeline('feature-extraction', SMALL_MODEL, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-small model ready (WASM)');
    return smallPipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize e5-small:', error);
    smallPipeline = null;
    throw error;
  }
}

/**
 * Initialize e5-large model (1024-dim)
 */
async function initLargeModel() {
  if (largePipeline) return largePipeline;

  try {
    console.log('[Embeddings] Initializing e5-large model (1024-dim) with WASM backend...');
    
    largePipeline = await pipeline('feature-extraction', LARGE_MODEL, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-large model ready (WASM)');
    return largePipeline;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize e5-large:', error);
    largePipeline = null;
    throw error;
  }
}

/**
 * Generate dual embeddings (both 384-dim and 1024-dim)
 */
export async function generateDualEmbeddings(text: string): Promise<{
  small: number[];
  large: number[];
}> {
  try {
    console.log('[Embeddings] Generating dual embeddings...');
    
    // For documents, use "passage: " prefix (e5 models requirement)
    const prefixedText = text.startsWith('passage: ') ? text : `passage: ${text}`;
    
    // Generate both embeddings in parallel
    const [small, large] = await Promise.all([
      (async () => {
        const model = await initSmallModel();
        const output = await model(prefixedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data) as number[];
      })(),
      (async () => {
        const model = await initLargeModel();
        const output = await model(prefixedText, {
          pooling: 'mean',
          normalize: true,
        });
        return Array.from(output.data) as number[];
      })(),
    ]);
    
    console.log('[Embeddings] ✅ Dual embeddings generated');
    console.log(`[Embeddings] Small: ${small.length}-dim, Large: ${large.length}-dim`);
    
    return { small, large };
  } catch (error) {
    console.error('[Embeddings] Error generating dual embeddings:', error);
    throw new Error(`Failed to generate dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch dual embeddings for multiple texts
 */
export async function generateBatchDualEmbeddings(texts: string[]): Promise<Array<{
  small: number[];
  large: number[];
}>> {
  try {
    console.log(`[Embeddings] Generating batch dual embeddings for ${texts.length} texts...`);
    
    const results = await Promise.all(
      texts.map(text => generateDualEmbeddings(text))
    );
    
    console.log(`[Embeddings] ✅ Batch dual embeddings completed: ${results.length} items`);
    return results;
  } catch (error) {
    console.error('[Embeddings] Error generating batch dual embeddings:', error);
    throw new Error(`Failed to generate batch dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
