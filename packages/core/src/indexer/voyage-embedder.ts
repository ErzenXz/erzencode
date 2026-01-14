/**
 * Voyage AI Embedder.
 * Handles code embedding with batching and rate limiting.
 */

import type {
  VoyageCodeModel,
  ProgressCallback,
  VOYAGE_MODEL_DIMENSIONS,
} from "./types.js";

/**
 * Voyage API response structure.
 */
interface VoyageEmbeddingResponse {
  object: "list";
  data: Array<{
    object: "embedding";
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    total_tokens: number;
  };
}

/**
 * Error from Voyage API.
 */
export class VoyageError extends Error {
  constructor(
    public statusCode: number,
    public body: string
  ) {
    super(`Voyage API error (${statusCode}): ${body}`);
    this.name = "VoyageError";
  }
}

/**
 * Options for the Voyage embedder.
 */
export interface VoyageEmbedderOptions {
  /** Voyage API key */
  apiKey: string;
  /** Model to use */
  model?: VoyageCodeModel;
  /** Batch size (max 128, recommended 50-100) */
  batchSize?: number;
  /** Max retries on rate limit */
  maxRetries?: number;
  /** Progress callback */
  onProgress?: ProgressCallback;
}

/**
 * Default batch size for embedding requests.
 */
const DEFAULT_BATCH_SIZE = 50;

/**
 * Maximum batch size allowed by Voyage API.
 */
const MAX_BATCH_SIZE = 128;

/**
 * Default max retries.
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Voyage AI embedding client with batching support.
 */
export class VoyageEmbedder {
  private apiKey: string;
  private model: VoyageCodeModel;
  private batchSize: number;
  private maxRetries: number;
  private onProgress?: ProgressCallback;

  constructor(options: VoyageEmbedderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "voyage-code-3";
    this.batchSize = Math.min(options.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.onProgress = options.onProgress;
  }

  /**
   * Embeds a single text.
   */
  async embed(text: string, inputType: "document" | "query" = "document"): Promise<number[]> {
    const results = await this.embedBatch([text], inputType);
    return results[0];
  }

  /**
   * Embeds a batch of texts.
   */
  async embedBatch(
    texts: string[],
    inputType: "document" | "query" = "document"
  ): Promise<number[][]> {
    const response = await this.callApi(texts, inputType);
    
    // Sort by index to ensure correct order
    const sorted = response.data.sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }

  /**
   * Embeds multiple texts with automatic batching.
   * Returns embeddings in the same order as input texts.
   */
  async embedAll(
    texts: string[],
    inputType: "document" | "query" = "document"
  ): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const results: number[][] = new Array(texts.length);
    const batches = this.createBatches(texts);
    let processedCount = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      this.onProgress?.({
        phase: "embedding",
        current: processedCount,
        total: texts.length,
        message: `Embedding batch ${batchIndex + 1}/${batches.length}...`,
      });

      const batchResults = await this.embedBatch(
        batch.texts,
        inputType
      );

      // Place results in correct positions
      for (let i = 0; i < batchResults.length; i++) {
        results[batch.indices[i]] = batchResults[i];
      }

      processedCount += batch.texts.length;
    }

    this.onProgress?.({
      phase: "embedding",
      current: texts.length,
      total: texts.length,
      message: `Embedded ${texts.length} chunks`,
    });

    return results;
  }

  /**
   * Creates batches from texts.
   */
  private createBatches(texts: string[]): Array<{ texts: string[]; indices: number[] }> {
    const batches: Array<{ texts: string[]; indices: number[] }> = [];
    
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const end = Math.min(i + this.batchSize, texts.length);
      const batchTexts: string[] = [];
      const batchIndices: number[] = [];
      
      for (let j = i; j < end; j++) {
        batchTexts.push(texts[j]);
        batchIndices.push(j);
      }
      
      batches.push({ texts: batchTexts, indices: batchIndices });
    }
    
    return batches;
  }

  /**
   * Calls the Voyage API with retry logic.
   */
  private async callApi(
    texts: string[],
    inputType: "document" | "query"
  ): Promise<VoyageEmbeddingResponse> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch("https://api.voyageai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            input: texts,
            model: this.model,
            input_type: inputType,
          }),
        });

        if (response.ok) {
          return (await response.json()) as VoyageEmbeddingResponse;
        }

        const body = await response.text();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") ?? "1", 10);
          const delay = Math.min(retryAfter * 1000, 60000);
          
          if (attempt < this.maxRetries) {
            await this.sleep(delay);
            continue;
          }
        }

        throw new VoyageError(response.status, body);
      } catch (error) {
        if (error instanceof VoyageError) {
          throw error;
        }
        lastError = error as Error;
        
        if (attempt < this.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw lastError ?? new Error("Unknown error during embedding");
  }

  /**
   * Sleep for a specified duration.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gets the embedding dimension for the current model.
   */
  getEmbeddingDimension(): number {
    return this.model === "voyage-code-3" ? 1024 : 1536;
  }

  /**
   * Gets the model being used.
   */
  getModel(): VoyageCodeModel {
    return this.model;
  }
}

/**
 * Convenience function to create an embedder and embed texts.
 */
export async function embedTexts(
  texts: string[],
  apiKey: string,
  options: Partial<VoyageEmbedderOptions> = {}
): Promise<number[][]> {
  const embedder = new VoyageEmbedder({ apiKey, ...options });
  return embedder.embedAll(texts, "document");
}

/**
 * Embeds a query for search.
 */
export async function embedQuery(
  query: string,
  apiKey: string,
  model: VoyageCodeModel = "voyage-code-3"
): Promise<number[]> {
  const embedder = new VoyageEmbedder({ apiKey, model });
  return embedder.embed(query, "query");
}
