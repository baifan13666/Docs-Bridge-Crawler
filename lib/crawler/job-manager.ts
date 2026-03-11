/**
 * Crawler Job Manager
 * 
 * Manages batch crawling jobs and tracks progress
 */

import { createServiceClient } from '@/lib/supabase/server';
import { getEnabledSources, type GovernmentSource } from './sources';

export interface CrawlJob {
  id: string;
  source_url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  documents_crawled: number;
  chunks_created: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export class CrawlerJobManager {
  private supabase = createServiceClient();

  /**
   * Create a batch crawl job for all enabled sources
   */
  async createBatchJob(): Promise<string> {
    const sources = getEnabledSources();
    
    const { data: job, error } = await this.supabase
      .from('crawler_jobs')
      .insert({
        source_url: 'batch_crawl_all',
        status: 'pending',
        documents_crawled: 0,
        chunks_created: 0
      })
      .select()
      .single();

    if (error || !job) {
      throw new Error(`Failed to create batch job: ${error?.message}`);
    }

    return job.id;
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    jobId: string, 
    documentsCount: number, 
    chunksCount: number
  ): Promise<void> {
    await this.supabase
      .from('crawler_jobs')
      .update({
        documents_crawled: documentsCount,
        chunks_created: chunksCount
      })
      .eq('id', jobId);
  }

  /**
   * Mark job as completed
   */
  async completeJob(jobId: string): Promise<void> {
    await this.supabase
      .from('crawler_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }

  /**
   * Mark job as failed
   */
  async failJob(jobId: string, error: string): Promise<void> {
    await this.supabase
      .from('crawler_jobs')
      .update({
        status: 'failed',
        error_message: error,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<CrawlJob | null> {
    const { data } = await this.supabase
      .from('crawler_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    return data;
  }
}