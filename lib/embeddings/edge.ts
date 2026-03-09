/**
 * Edge Runtime Embedding Generation
 * 
 * Uses @xenova/transformers with WASM backend
 * Compatible with Vercel Edge Runtime
 */

// Model configurations
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
    console.log('[Edge Embeddings] Initializing e5-small model (384-dim)...');
    
    // Dynamic import for Edge Runtime
    const { pipeline, env } = await import('@xenova/transformers');
    
    // Configure for Edge Runtime (WASM only)
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    
    smallPipeline = await pipeline('feature-extraction', SMALL_MODEL, {
      quantized: true,
    });
    
    console.log('[Edge Embeddings] ✅ e5-small model ready');
    return smallPipeline;
  } catch (error) {
    console.error('[Edge Embeddings] Failed to initialize e5-small:', error);
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
    console.log('[Edge Embeddings] Initializing e5-large model (1024-dim)...');
    
    // Dynamic import for Edge Runtime
    const { pipeline, env } = await import('@xenova/transformers');
    
    // Configure for Edge Runtime (WASM only)
    env.allowLocalModels = false;
    env.useBrowserCache = false;
    
    largePipeline = await pipeline('feature-extraction', LARGE_MODEL, {
      quantized: true,
    });
    
    console.log('[Edge Embeddings] ✅ e5-large model ready');
    return largePipeline;
  } catch (error) {
    console.error('[Edge Embeddings] Failed to initialize e5-large:', error);
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
    console.log('[Edge Embeddings] Generating dual embeddings...');
    
    // For documents, use "passage: " prefix
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
    
    console.log('[Edge Embeddings] ✅ Dual embeddings generated');
    console.log(`[Edge Embeddings] Small: ${small.length}-dim, Large: ${large.length}-dim`);
    
    return { small, large };
  } catch (error) {
    console.error('[Edge Embeddings] Error generating dual embeddings:', error);
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
    console.log(`[Edge Embeddings] Generating batch dual embeddings for ${texts.length} texts...`);
    
    const results = await Promise.all(
      texts.map(text => generateDualEmbeddings(text))
    );
    
    console.log(`[Edge Embeddings] ✅ Batch dual embeddings completed: ${results.length} items`);
    return results;
  } catch (error) {
    console.error('[Edge Embeddings] Error generating batch dual embeddings:', error);
    throw new Error(`Failed to generate batch dual embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
