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

// Use /tmp for cache on Vercel (writable directory)
env.cacheDir = '/tmp/.transformers-cache';

// Model configurations - MUST use e5 models
const SMALL_MODEL = 'Xenova/e5-small-v2'; // 384-dim
const LARGE_MODEL = 'Xenova/e5-large-v2'; // 1024-dim

// Singleton instances
let smallPipeline: any = null;
let largePipeline: any = null;
let isInitializingSmall = false;
let isInitializingLarge = false;

/**
 * Initialize e5-small model (384-dim)
 */
async function initSmallModel() {
  if (smallPipeline) return smallPipeline;
  
  // Wait if already initializing
  while (isInitializingSmall) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (smallPipeline) return smallPipeline;

  try {
    isInitializingSmall = true;
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
  } finally {
    isInitializingSmall = false;
  }
}

/**
 * Initialize e5-large model (1024-dim)
 */
async function initLargeModel() {
  if (largePipeline) return largePipeline;
  
  // Wait if already initializing
  while (isInitializingLarge) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (largePipeline) return largePipeline;

  try {
    isInitializingLarge = true;
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
  } finally {
    isInitializingLarge = false;
  }
}

/**
 * Generate dual embeddings (both 384-dim and 1024-dim)
 * Sequential to save memory
 */
export async function generateDualEmbeddings(text: string): Promise<{
  small: number[];
  large: number[];
}> {
  try {
    // For documents, use "passage: " prefix (e5 models requirement)
    const prefixedText = text.startsWith('passage: ') ? text : `passage: ${text}`;
    
    // Generate sequentially to save memory (not parallel)
    const smallModel = await initSmallModel();
    const smallOutput = await smallModel(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    const small = Array.from(smallOutput.data) as number[];
    
    const largeModel = await initLargeModel();
    const largeOutput = await largeModel(prefixedText, {
      pooling: 'mean',
      normalize: true,
    });
    const large = Array.from(largeOutput.data) as number[];
    
    return { small, large };
  } catch (error) {
    console.error('[Embeddings] Error generating dual embeddings:', error);
    throw new Error(`Failed to generate dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch dual embeddings for multiple texts
 * Process sequentially to avoid memory issues
 */
export async function generateBatchDualEmbeddings(texts: string[]): Promise<Array<{
  small: number[];
  large: number[];
}>> {
  try {
    console.log(`[Embeddings] Generating batch dual embeddings for ${texts.length} texts...`);
    console.log('[Embeddings] Processing sequentially to conserve memory...');
    
    const results: Array<{ small: number[]; large: number[] }> = [];
    
    // Process one at a time to save memory
    for (let i = 0; i < texts.length; i++) {
      console.log(`[Embeddings] Processing ${i + 1}/${texts.length}...`);
      const embedding = await generateDualEmbeddings(texts[i]);
      results.push(embedding);
    }
    
    console.log(`[Embeddings] ✅ Batch dual embeddings completed: ${results.length} items`);
    return results;
  } catch (error) {
    console.error('[Embeddings] Error generating batch dual embeddings:', error);
    throw new Error(`Failed to generate batch dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
