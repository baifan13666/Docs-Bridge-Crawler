/**
 * HTML Crawler
 * 
 * Crawls HTML pages and extracts clean, readable content
 */

import * as cheerio from 'cheerio';

export interface CrawledHTMLContent {
  title: string;
  content: string;
  excerpt: string;
  author?: string;
  publishedDate?: string;
  url: string;
  siteName?: string;
  language?: string;
  wordCount: number;
  metadata: {
    description?: string;
    keywords?: string[];
    ogImage?: string;
  };
}

/**
 * Crawl and extract content from HTML URL
 */
export async function crawlHTML(url: string): Promise<CrawledHTMLContent> {
  try {
    console.log(`[HTML Crawler] Fetching: ${url}`);
    
    // Fetch HTML content with realistic browser headers
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
      },
      // Add timeout and redirect handling
      signal: AbortSignal.timeout(30000), // 30 second timeout
      redirect: 'follow'
    });

    if (!response.ok) {
      const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`[HTML Crawler] ${errorMsg}`);
      
      // Provide more context for common errors
      if (response.status === 403) {
        throw new Error(`${errorMsg} - Website may be blocking automated access`);
      } else if (response.status === 404) {
        throw new Error(`${errorMsg} - Page not found`);
      } else if (response.status >= 500) {
        throw new Error(`${errorMsg} - Server error`);
      }
      
      throw new Error(errorMsg);
    }

    const html = await response.text();
    console.log(`[HTML Crawler] Fetched ${html.length} characters`);

    // Parse with Cheerio
    const $ = cheerio.load(html);
    
    // Extract metadata
    const metadata = {
      description: $('meta[name="description"]').attr('content') || 
                   $('meta[property="og:description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim()),
      ogImage: $('meta[property="og:image"]').attr('content')
    };

    // Extract main content (simple approach without Readability)
    // Remove script, style, nav, footer, header
    $('script, style, nav, footer, header, aside, .advertisement, .ads').remove();
    
    // Get main content
    const mainContent = $('main, article, .content, .main-content, body').first();
    const textContent = mainContent.text() || $('body').text();
    
    // Clean the content
    const cleanContent = cleanHTMLContent(textContent);
    
    const title = extractTitleFromHTML($);
    
    console.log(`[HTML Crawler] Extracted: ${title}`);
    console.log(`[HTML Crawler] Content length: ${cleanContent.length} characters`);

    return {
      title,
      content: cleanContent,
      excerpt: cleanContent.substring(0, 200) + '...',
      author: $('meta[name="author"]').attr('content'),
      publishedDate: extractPublishedDate($),
      url,
      siteName: extractSiteName($),
      language: extractLanguage($),
      wordCount: cleanContent.split(/\s+/).length,
      metadata
    };

  } catch (error) {
    console.error('[HTML Crawler] Error:', error);
    throw new Error(`Failed to crawl HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Clean HTML content
 */
function cleanHTMLContent(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

/**
 * Extract title from HTML
 */
function extractTitleFromHTML($: cheerio.CheerioAPI): string {
  return $('title').text() ||
         $('meta[property="og:title"]').attr('content') ||
         $('h1').first().text() ||
         'Untitled Document';
}

/**
 * Extract published date from HTML
 */
function extractPublishedDate($: cheerio.CheerioAPI): string | undefined {
  const dateSelectors = [
    'meta[property="article:published_time"]',
    'meta[name="publish-date"]',
    'meta[name="date"]',
    'time[datetime]'
  ];

  for (const selector of dateSelectors) {
    const date = $(selector).attr('content') || $(selector).attr('datetime');
    if (date) return date;
  }

  return undefined;
}

/**
 * Extract site name from HTML
 */
function extractSiteName($: cheerio.CheerioAPI): string | undefined {
  return $('meta[property="og:site_name"]').attr('content') ||
         $('meta[name="application-name"]').attr('content');
}

/**
 * Extract language from HTML
 */
function extractLanguage($: cheerio.CheerioAPI): string | undefined {
  return $('html').attr('lang') ||
         $('meta[http-equiv="content-language"]').attr('content');
}

/**
 * Validate URL before crawling
 */
export function isValidCrawlURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
