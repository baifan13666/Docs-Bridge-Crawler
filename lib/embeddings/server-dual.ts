/**
 * Node.js Runtime Embeddings with WASM Backend
 * 
 * Uses @xenova/transformers with WASM backend (not native ONNX)
 * Works on Vercel Node.js runtime
 * 
 * MEMORY OPTIMIZATION: Only uses e5-small to fit in 1GB limit
 */

import { pipeline, env } from '@xenova/transformers';

// CRITICAL: Configure BEFORE any pipeline creation
// Force WASM backend, disable native ONNX runtime
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.simd = true;
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;

// Use /tmp for cache on Vercel (writable directory)
env.cacheDir = '/tmp/.transformers-cache';

// Model configuration - ONLY use e5-small to save memory
const MODEL = 'Xenova/e5-small-v2'; // 384-dim

// Singleton instance
let pipeline_instance: any = null;
let isInitializing = false;

/**
 * Initialize e5-small model (384-dim)
 */
async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  
  // Wait if already initializing
  while (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (pipeline_instance) return pipeline_instance;

  try {
    isInitializing = true;
    console.log('[Embeddings] Initializing e5-small model (384-dim) with WASM backend...');
    
    pipeline_instance = await pipeline('feature-extraction', MODEL, {
      quantized: true,
    });
    
    console.log('[Embeddings] ✅ e5-small model ready (WASM)');
    return pipeline_instance;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize e5-small:', error);
    pipeline_instance = null;
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate single embedding (384-dim)
 * For dual embedding compatibility, returns same embedding for both small and large
 */
export async function generateDualEmbeddings(text: string): Promise<{
  small: number[];
  large: number[];
}> {
  try {
    // For documents, use "passage: " prefix (e5 models requirement)
    const prefixedText = text.startsWith('passage: ') ? text : `passage: ${text}`;
    
    const model = await initModel();
    const output = await model(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    const embedding = Array.from(output.data) as number[];
    
    // Return same embedding for both (memory optimization)
    // Database expects dual embeddings, so we provide the same one twice
    return { 
      small: embedding,  // 384-dim
      large: embedding   // 384-dim (same as small to save memory)
    };
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch embeddings for multiple texts
 * Process sequentially to avoid memory issues
 */
export async function generateBatchDualEmbeddings(texts: string[]): Promise<Array<{
  small: number[];
  large: number[];
}>> {
  try {
    console.log(`[Embeddings] Generating batch embeddings for ${texts.length} texts...`);
    console.log('[Embeddings] Using single model (e5-small 384-dim) to conserve memory...');
    
    const results: Array<{ small: number[]; large: number[] }> = [];
    
    // Process one at a time to save memory
    for (let i = 0; i < texts.length; i++) {
      console.log(`[Embeddings] Processing ${i + 1}/${texts.length}...`);
      const embedding = await generateDualEmbeddings(texts[i]);
      results.push(embedding);
    }
    
    console.log(`[Embeddings] ✅ Batch embeddings completed: ${results.length} items`);
    return results;
  } catch (error) {
    console.error('[Embeddings] Error generating batch embeddings:', error);
    throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
