/**
 * Government Document Sources
 * 
 * Curated list of government websites and documents for crawling
 * 
 * PRIORITY: Sources that answer common citizen questions
 * - Social assistance / benefits
 * - Healthcare programs
 * - Housing / immigration
 * - Pension / retirement
 * - FAQ pages (gold for RAG)
 */

export interface GovernmentSource {
  id: string;
  name: string;
  country: 'malaysia' | 'philippines' | 'singapore';
  url: string;
  type: 'html' | 'pdf';
  trust_level: number; // 1-5, where 5 is highest trust
  category: 'healthcare' | 'finance' | 'education' | 'housing' | 'social-services' | 'general' | 'immigration';
  language: string;
  description: string;
  crawl_frequency?: 'daily' | 'weekly' | 'monthly';
  priority?: 'high' | 'medium' | 'low'; // High = most useful for RAG
  content_type?: 'faq' | 'guide' | 'policy' | 'homepage'; // FAQ is gold for RAG
  requires_js?: boolean; // Requires JavaScript rendering (SPA)
  disabled?: boolean; // Temporarily disabled
  disabled_reason?: string; // Why it's disabled
}

export const GOVERNMENT_SOURCES: GovernmentSource[] = [
  // ========================================
  // 🇲🇾 MALAYSIA - High Priority Sources
  // ========================================
  
  // Government Portal (Best entry point)
  {
    id: 'malaysia-gov-portal',
    name: 'MyGovernment Portal',
    country: 'malaysia',
    url: 'https://www.malaysia.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Government services portal: birth registration, passport, business, aid programs',
    crawl_frequency: 'weekly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Social Assistance (Most asked questions)
  {
    id: 'bantuan-rakyat',
    name: 'Bantuan Rakyat 1Malaysia',
    country: 'malaysia',
    url: 'https://www.hasil.gov.my/en/bantuan-sara-hidup/',
    type: 'html',
    trust_level: 5,
    category: 'social-services',
    language: 'en',
    description: 'Cash assistance program: eligibility, benefits, how to apply',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // EPF (Pension - very common questions)
  {
    id: 'kwsp-epf',
    name: 'KWSP/EPF Information',
    country: 'malaysia',
    url: 'https://www.kwsp.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Employees Provident Fund: withdrawal rules, contribution rates, retirement',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Healthcare
  {
    id: 'mysalam-info',
    name: 'MySalam Health Insurance',
    country: 'malaysia',
    url: 'https://www.mysalam.com.my/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'National health insurance: coverage, eligibility, claims',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Housing (Very common questions)
  {
    id: 'kpkt-housing',
    name: 'Ministry of Housing Malaysia',
    country: 'malaysia',
    url: 'https://www.kpkt.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'housing',
    language: 'en',
    description: 'Housing programs, rental assistance, first home grants',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Immigration (Common questions)
  {
    id: 'imi-immigration',
    name: 'Immigration Department Malaysia',
    country: 'malaysia',
    url: 'https://www.imi.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'immigration',
    language: 'en',
    description: 'Passport, visa, citizenship applications',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Tax (Common but lower priority)
  {
    id: 'hasil-tax-guide',
    name: 'LHDN Tax Guide',
    country: 'malaysia',
    url: 'https://www.hasil.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Tax filing, deductions, refunds',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'guide'
  },
  
  // ========================================
  // 🇵🇭 PHILIPPINES - High Priority Sources
  // ========================================
  
  // Social Welfare (MOST IMPORTANT)
  {
    id: 'dswd-4ps',
    name: 'DSWD 4Ps Program',
    country: 'philippines',
    url: 'https://fo1.dswd.gov.ph/programs/poverty-reduction-programs/pantawid-pamilyang-pilipino-program/',
    type: 'html',
    trust_level: 5,
    category: 'social-services',
    language: 'en',
    description: 'Cash assistance for poor families: eligibility, benefits, application',
    crawl_frequency: 'weekly',
    priority: 'high',
    content_type: 'guide'
  },
  
  {
    id: 'dswd-programs',
    name: 'DSWD Social Programs',
    country: 'philippines',
    url: 'https://www.dswd.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'social-services',
    language: 'en',
    description: 'Disaster relief, senior citizen benefits, social assistance',
    crawl_frequency: 'weekly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // GSIS (Government pension - very common)
  {
    id: 'gsis',
    name: 'Government Service Insurance System',
    country: 'philippines',
    url: 'https://www.gsis.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Government employee pension, loans, insurance benefits',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // SSS (Private sector pension)
  {
    id: 'sss-philippines',
    name: 'Social Security System Philippines',
    country: 'philippines',
    url: 'https://www.sss.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Private sector pension, unemployment benefits, maternity leave',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Healthcare
  {
    id: 'philhealth',
    name: 'PhilHealth Information',
    country: 'philippines',
    url: 'https://www.philhealth.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'National health insurance: coverage, claims, enrollment',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  {
    id: 'doh-philippines',
    name: 'Department of Health Philippines',
    country: 'philippines',
    url: 'https://doh.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'Health programs, vaccination, medical assistance',
    crawl_frequency: 'weekly',
    priority: 'medium',
    content_type: 'guide',
    disabled: true,
    disabled_reason: 'Returns 403 Forbidden - anti-bot protection'
  },
  
  // ========================================
  // 🇸🇬 SINGAPORE - High Priority Sources
  // ========================================
  
  // SupportGoWhere (GOLD for RAG - FAQ format)
  {
    id: 'supportgowhere',
    name: 'SupportGoWhere',
    country: 'singapore',
    url: 'https://supportgowhere.life.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'social-services',
    language: 'en',
    description: 'Government assistance finder: what help can I get? Perfect for RAG',
    crawl_frequency: 'weekly',
    priority: 'high',
    content_type: 'faq',
    requires_js: true,
    disabled: true,
    disabled_reason: 'Requires JavaScript rendering (SPA) - needs Puppeteer/Playwright'
  },
  
  // Government Portal
  {
    id: 'gov-sg-services',
    name: 'Gov.sg Services',
    country: 'singapore',
    url: 'https://www.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Government services and information portal',
    crawl_frequency: 'weekly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // HDB (Housing - very common questions)
  {
    id: 'hdb-housing',
    name: 'Housing and Development Board',
    country: 'singapore',
    url: 'https://www.hdb.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'housing',
    language: 'en',
    description: 'Public housing: BTO, resale, rental, grants',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // CPF (Pension - very common)
  {
    id: 'cpf-singapore',
    name: 'CPF Board Singapore',
    country: 'singapore',
    url: 'https://www.cpf.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Central Provident Fund: retirement, housing, healthcare savings',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Immigration
  {
    id: 'ica-immigration',
    name: 'Immigration and Checkpoints Authority',
    country: 'singapore',
    url: 'https://www.ica.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'immigration',
    language: 'en',
    description: 'Passport, visa, citizenship, PR applications',
    crawl_frequency: 'monthly',
    priority: 'high',
    content_type: 'guide'
  },
  
  // Healthcare
  {
    id: 'moh-singapore',
    name: 'Ministry of Health Singapore',
    country: 'singapore',
    url: 'https://www.moh.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'healthcare',
    language: 'en',
    description: 'Healthcare subsidies, MediShield, medical schemes',
    crawl_frequency: 'weekly',
    priority: 'medium',
    content_type: 'guide'
  },
  
  // ========================================
  // 📊 OPEN DATA & STATISTICS SOURCES
  // ========================================
  // Note: These are data portals, not policy documents
  // Best for: "What is the GDP?" not "How do I apply?"
  
  // Malaysia Open Data
  {
    id: 'dosm-open-data',
    name: 'Department of Statistics Malaysia',
    country: 'malaysia',
    url: 'https://open.dosm.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Official statistics: GDP, employment, population, industry data',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'policy'
  },
  
  {
    id: 'malaysia-open-data',
    name: 'Malaysia Open Data Portal',
    country: 'malaysia',
    url: 'https://data.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Government open data: business, transport, education, city data',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'policy'
  },
  
  {
    id: 'bnm-statistics',
    name: 'Bank Negara Malaysia Statistics',
    country: 'malaysia',
    url: 'https://www.bnm.gov.my/statistics',
    type: 'html',
    trust_level: 5,
    category: 'finance',
    language: 'en',
    description: 'Financial and macroeconomic data: interest rates, banking, capital flows',
    crawl_frequency: 'monthly',
    priority: 'low',
    content_type: 'policy'
  },
  
  {
    id: 'napic-property',
    name: 'National Property Information Centre',
    country: 'malaysia',
    url: 'https://napic.jpph.gov.my/',
    type: 'html',
    trust_level: 5,
    category: 'housing',
    language: 'en',
    description: 'Real estate market data: property prices, transactions, regional data',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'policy'
  },
  
  // Singapore Statistics
  {
    id: 'singstat',
    name: 'Singapore Department of Statistics',
    country: 'singapore',
    url: 'https://www.singstat.gov.sg/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Official statistics: economy, population, trade, social indicators',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'policy'
  },
  
  // Philippines Statistics
  {
    id: 'psa-philippines',
    name: 'Philippine Statistics Authority',
    country: 'philippines',
    url: 'https://psa.gov.ph/',
    type: 'html',
    trust_level: 5,
    category: 'general',
    language: 'en',
    description: 'Official statistics: census, labor, prices, national accounts',
    crawl_frequency: 'monthly',
    priority: 'medium',
    content_type: 'policy'
  }
];

/**
 * Get source by ID
 */
export function getSourceById(id: string): GovernmentSource | undefined {
  return GOVERNMENT_SOURCES.find(source => source.id === id);
}

/**
 * Get sources by country
 */
export function getSourcesByCountry(country: 'malaysia' | 'philippines' | 'singapore'): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.country === country);
}

/**
 * Get sources by category
 */
export function getSourcesByCategory(category: string): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.category === category);
}

/**
 * Get high-priority sources (trust level >= 4)
 */
export function getHighPrioritySources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.trust_level >= 4);
}

/**
 * Get sources by priority (for RAG optimization)
 */
export function getSourcesByPriority(priority: 'high' | 'medium' | 'low'): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.priority === priority);
}

/**
 * Get FAQ sources (best for RAG)
 */
export function getFAQSources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.content_type === 'faq');
}

/**
 * Get enabled sources (not disabled)
 */
export function getEnabledSources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => !source.disabled);
}

/**
 * Get disabled sources
 */
export function getDisabledSources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.disabled);
}

/**
 * Get sources that require JavaScript rendering
 */
export function getJSRequiredSources(): GovernmentSource[] {
  return GOVERNMENT_SOURCES.filter(source => source.requires_js);
}
