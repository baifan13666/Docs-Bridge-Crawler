/**
 * Local Embeddings with bge-small-en
 * 
 * Uses @huggingface/transformers with WASM backend
 * Only generates 384-dim embeddings locally
 * 1024-dim embeddings are generated asynchronously via external API
 */

import { pipeline, env } from '@huggingface/transformers';

// CRITICAL: Configure BEFORE any pipeline creation
// Use local WASM files instead of CDN to avoid ESM URL scheme error
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/wasm/';
  env.backends.onnx.wasm.proxy = false;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.simd = true;
}

env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = false;
env.cacheDir = '/tmp/.transformers-cache';

// Model: bge-small-en for 384-dim embeddings
const MODEL = 'Xenova/bge-small-en-v1.5'; // 384-dim

// Singleton instance
let pipeline_instance: any = null;
let isInitializing = false;

/**
 * Initialize bge-small-en model (384-dim)
 */
async function initModel() {
  if (pipeline_instance) return pipeline_instance;
  
  while (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  if (pipeline_instance) return pipeline_instance;

  try {
    isInitializing = true;
    console.log('[Embeddings] Initializing bge-small-en model (384-dim) with WASM backend...');
    
    pipeline_instance = await pipeline('feature-extraction', MODEL, {
      dtype: 'q8',
    });
    
    console.log('[Embeddings] ✅ bge-small-en model ready (WASM)');
    return pipeline_instance;
  } catch (error) {
    console.error('[Embeddings] Failed to initialize bge-small-en:', error);
    pipeline_instance = null;
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Generate 384-dim embedding with bge-small-en
 * Returns null for large embedding (will be generated asynchronously)
 */
export async function generateDualEmbeddings(text: string): Promise<{
  small: number[];
  large: number[] | null;
}> {
  try {
    const model = await initModel();
    const output = await model(text, {
      pooling: 'mean',
      normalize: true,
    });
    const embedding = Array.from(output.data) as number[];
    
    return { 
      small: embedding,  // 384-dim from bge-small-en
      large: null        // Will be generated asynchronously via API
    };
  } catch (error) {
    console.error('[Embeddings] Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate batch 384-dim embeddings
 */
export async function generateBatchDualEmbeddings(texts: string[]): Promise<Array<{
  small: number[];
  large: number[] | null;
}>> {
  try {
    console.log(`[Embeddings] Generating batch embeddings for ${texts.length} texts...`);
    console.log('[Embeddings] Using bge-small-en (384-dim) locally...');
    console.log('[Embeddings] 1024-dim embeddings will be generated asynchronously via API');
    
    const results: Array<{ small: number[]; large: number[] | null }> = [];
    
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
