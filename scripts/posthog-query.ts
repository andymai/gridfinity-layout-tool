#!/usr/bin/env -S pnpm exec tsx
/**
 * PostHog Query Script
 *
 * Interactive tool for querying PostHog data, listing dashboards/insights,
 * and exporting analytics data.
 *
 * Prerequisites:
 *   POSTHOG_PERSONAL_API_KEY - Your personal API key (from Settings → Personal API Keys)
 *   POSTHOG_PROJECT_ID - Your project ID (numeric, from Project Settings)
 *
 * Usage:
 *   # Run a HogQL query
 *   pnpm exec tsx scripts/posthog-query.ts "SELECT event, count() FROM events GROUP BY event"
 *
 *   # List dashboards
 *   pnpm exec tsx scripts/posthog-query.ts --dashboards
 *
 *   # List insights
 *   pnpm exec tsx scripts/posthog-query.ts --insights
 *
 *   # Get insight results
 *   pnpm exec tsx scripts/posthog-query.ts --insight 12345
 *
 *   # Query events
 *   pnpm exec tsx scripts/posthog-query.ts --events layout_snapshot --limit 10
 *
 *   # Get person properties
 *   pnpm exec tsx scripts/posthog-query.ts --persons --limit 10
 *
 *   # Export to file
 *   pnpm exec tsx scripts/posthog-query.ts --events layout_snapshot --output data.json
 *
 * @see https://posthog.com/docs/api
 * @see https://posthog.com/docs/hogql
 */

// ============================================
// CONFIGURATION
// ============================================

// Check for help flag early (before env validation)
const needsHelp = process.argv.includes('--help') || process.argv.includes('-h');

const POSTHOG_HOST = 'https://us.posthog.com';
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

if (!needsHelp && (!API_KEY || !PROJECT_ID)) {
  console.error('❌ Missing environment variables');
  console.error('');
  console.error('Required:');
  console.error('  POSTHOG_PERSONAL_API_KEY - Get from PostHog → Settings → Personal API Keys');
  console.error('  POSTHOG_PROJECT_ID - Find in PostHog → Project Settings');
  console.error('');
  console.error('Usage:');
  console.error(
    '  POSTHOG_PERSONAL_API_KEY=phx_xxx POSTHOG_PROJECT_ID=123 pnpm exec tsx scripts/posthog-query.ts "YOUR QUERY"'
  );
  console.error('');
  console.error('Run with --help for more options');
  process.exit(1);
}

const API_BASE = `${POSTHOG_HOST}/api/projects/${PROJECT_ID}`;

// ============================================
// API HELPERS
// ============================================

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { ok: false, error: `${response.status}: ${errorText}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Run a HogQL query
 */
export async function query(hogql: string): Promise<unknown> {
  const result = await apiRequest<{ results: unknown[]; columns: string[] }>('POST', '/query/', {
    query: {
      kind: 'HogQLQuery',
      query: hogql,
    },
  });

  if (!result.ok) {
    throw new Error(`Query failed: ${result.error}`);
  }

  return result.data;
}

/**
 * Query events with filters
 */
export async function queryEvents(options: {
  event?: string;
  limit?: number;
  after?: string;
  before?: string;
  personId?: string;
  properties?: Record<string, unknown>;
}): Promise<unknown> {
  const params = new URLSearchParams();

  if (options.event) params.append('event', options.event);
  if (options.limit) params.append('limit', String(options.limit));
  if (options.after) params.append('after', options.after);
  if (options.before) params.append('before', options.before);
  if (options.personId) params.append('person_id', options.personId);
  if (options.properties) {
    params.append('properties', JSON.stringify(options.properties));
  }

  const result = await apiRequest<{ results: unknown[] }>('GET', `/events/?${params}`);

  if (!result.ok) {
    throw new Error(`Events query failed: ${result.error}`);
  }

  return result.data;
}

/**
 * Query persons
 */
export async function queryPersons(options: {
  search?: string;
  limit?: number;
  properties?: Record<string, unknown>;
}): Promise<unknown> {
  const params = new URLSearchParams();

  if (options.search) params.append('search', options.search);
  if (options.limit) params.append('limit', String(options.limit));
  if (options.properties) {
    params.append('properties', JSON.stringify(options.properties));
  }

  const result = await apiRequest<{ results: unknown[] }>('GET', `/persons/?${params}`);

  if (!result.ok) {
    throw new Error(`Persons query failed: ${result.error}`);
  }

  return result.data;
}

/**
 * List all dashboards
 */
export async function listDashboards(): Promise<unknown> {
  const result = await apiRequest<{ results: unknown[] }>('GET', '/dashboards/');

  if (!result.ok) {
    throw new Error(`Failed to list dashboards: ${result.error}`);
  }

  return result.data;
}

/**
 * List all insights
 */
export async function listInsights(options?: {
  limit?: number;
  saved?: boolean;
}): Promise<unknown> {
  const params = new URLSearchParams();

  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.saved !== undefined) params.append('saved', String(options.saved));

  const result = await apiRequest<{ results: unknown[] }>('GET', `/insights/?${params}`);

  if (!result.ok) {
    throw new Error(`Failed to list insights: ${result.error}`);
  }

  return result.data;
}

/**
 * Get insight with results
 */
export async function getInsight(insightId: number | string): Promise<unknown> {
  const result = await apiRequest<unknown>('GET', `/insights/${insightId}/`);

  if (!result.ok) {
    throw new Error(`Failed to get insight: ${result.error}`);
  }

  return result.data;
}

/**
 * Get dashboard with insights
 */
export async function getDashboard(dashboardId: number | string): Promise<unknown> {
  const result = await apiRequest<unknown>('GET', `/dashboards/${dashboardId}/`);

  if (!result.ok) {
    throw new Error(`Failed to get dashboard: ${result.error}`);
  }

  return result.data;
}

// ============================================
// PRESET QUERIES
// ============================================

const PRESET_QUERIES: Record<string, string> = {
  'event-counts': `
    SELECT
      event,
      count() as count,
      uniq(distinct_id) as unique_users
    FROM events
    WHERE timestamp > now() - INTERVAL 7 DAY
    GROUP BY event
    ORDER BY count DESC
    LIMIT 20
  `,

  errors: `
    SELECT
      properties.$exception_type as error_type,
      properties.$exception_message as message,
      count() as occurrences,
      max(timestamp) as last_seen
    FROM events
    WHERE event = '$exception'
      AND timestamp > now() - INTERVAL 7 DAY
    GROUP BY error_type, message
    ORDER BY occurrences DESC
    LIMIT 20
  `,

  'feature-adoption': `
    SELECT
      countIf(properties.uses_multi_layer = true) as uses_multi_layer,
      countIf(properties.uses_half_bins = true) as uses_half_bins,
      countIf(properties.uses_3d_preview = true) as uses_3d_preview,
      countIf(properties.uses_cloud_share = true) as uses_cloud_share,
      countIf(properties.uses_labels = true) as uses_labels,
      countIf(properties.uses_fill_operations = true) as uses_fill,
      count() as total_users
    FROM persons
  `,

  'layout-metrics': `
    SELECT
      toStartOfDay(timestamp) as day,
      count() as exports,
      avg(properties.bins_on_grid) as avg_bins,
      avg(properties.drawer_width) as avg_width,
      avg(properties.drawer_depth) as avg_depth
    FROM events
    WHERE event = 'layout_snapshot'
      AND timestamp > now() - INTERVAL 30 DAY
    GROUP BY day
    ORDER BY day
  `,

  sessions: `
    SELECT
      properties.$session_id as session_id,
      min(timestamp) as session_start,
      max(timestamp) as session_end,
      dateDiff('minute', min(timestamp), max(timestamp)) as duration_minutes,
      count() as events_count,
      countIf(event = 'layout_snapshot') as exports
    FROM events
    WHERE timestamp > now() - INTERVAL 1 DAY
    GROUP BY session_id
    HAVING events_count > 3
    ORDER BY session_start DESC
    LIMIT 20
  `,

  'engagement-tiers': `
    SELECT
      properties.engagement_tier as tier,
      count() as user_count
    FROM persons
    WHERE properties.engagement_tier IS NOT NULL
    GROUP BY tier
    ORDER BY user_count DESC
  `,

  'device-breakdown': `
    SELECT
      properties.primary_device as device,
      count() as user_count
    FROM persons
    WHERE properties.primary_device IS NOT NULL
    GROUP BY device
    ORDER BY user_count DESC
  `,
};

// ============================================
// CLI
// ============================================

function printHelp() {
  console.log(`
PostHog Query Tool
==================

Usage:
  pnpm exec tsx scripts/posthog-query.ts [OPTIONS] [QUERY]

Options:
  --help, -h              Show this help message
  --dashboards            List all dashboards
  --dashboard <id>        Get dashboard details
  --insights              List all saved insights
  --insight <id>          Get insight with results
  --events <name>         Query events by name
  --persons               Query persons
  --limit <n>             Limit results (default: 100)
  --output <file>         Write results to JSON file
  --preset <name>         Run a preset query

Preset Queries:
  event-counts            Event counts and unique users (7 days)
  errors                  Exception analysis (7 days)
  feature-adoption        Feature usage across all users
  layout-metrics          Layout metrics over time (30 days)
  sessions                Session analysis (1 day)
  engagement-tiers        User engagement tier distribution
  device-breakdown        Users by primary device

Examples:
  # Run a HogQL query
  pnpm exec tsx scripts/posthog-query.ts "SELECT event, count() FROM events GROUP BY event LIMIT 10"

  # Use a preset query
  pnpm exec tsx scripts/posthog-query.ts --preset errors

  # List dashboards
  pnpm exec tsx scripts/posthog-query.ts --dashboards

  # Get insight results
  pnpm exec tsx scripts/posthog-query.ts --insight 12345

  # Query specific events
  pnpm exec tsx scripts/posthog-query.ts --events layout_snapshot --limit 5

  # Export to file
  pnpm exec tsx scripts/posthog-query.ts --preset feature-adoption --output adoption.json
`);
}

function formatResults(data: unknown): string {
  if (!data) return 'No data';

  // Handle HogQL query results
  if (typeof data === 'object' && data !== null && 'results' in data && 'columns' in data) {
    const { results, columns } = data as { results: unknown[][]; columns: string[] };

    if (results.length === 0) {
      return 'No results';
    }

    // Calculate column widths
    const widths = columns.map((col, i) => {
      const maxDataWidth = Math.max(...results.map((row) => String(row[i] ?? '').length));
      return Math.max(col.length, maxDataWidth, 4);
    });

    // Build table
    const header = columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map((w) => '-'.repeat(w)).join('-+-');
    const rows = results.map((row) =>
      row.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join(' | ')
    );

    return [header, separator, ...rows].join('\n');
  }

  // Handle list results (dashboards, insights, etc.)
  if (typeof data === 'object' && data !== null && 'results' in data) {
    const { results } = data as {
      results: Array<{ id: number; name: string; [key: string]: unknown }>;
    };

    if (results.length === 0) {
      return 'No results';
    }

    return results
      .map((item) => {
        const id = item.id || 'N/A';
        const name = item.name || 'Unnamed';
        const extra = item.description ? ` - ${item.description}` : '';
        return `[${id}] ${name}${extra}`;
      })
      .join('\n');
  }

  // Default: pretty print JSON
  return JSON.stringify(data, null, 2);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || needsHelp) {
    printHelp();
    process.exit(0);
  }

  let outputFile: string | null = null;
  let limit = 100;

  // Parse options
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputFile = args[outputIndex + 1];
    args.splice(outputIndex, 2);
  }

  const limitIndex = args.indexOf('--limit');
  if (limitIndex !== -1 && args[limitIndex + 1]) {
    limit = parseInt(args[limitIndex + 1], 10);
    args.splice(limitIndex, 2);
  }

  try {
    let result: unknown;

    if (args.includes('--dashboards')) {
      console.log('📊 Listing dashboards...\n');
      result = await listDashboards();
    } else if (args.includes('--dashboard')) {
      const idIndex = args.indexOf('--dashboard') + 1;
      const id = args[idIndex];
      console.log(`📊 Getting dashboard ${id}...\n`);
      result = await getDashboard(id);
    } else if (args.includes('--insights')) {
      console.log('📈 Listing saved insights...\n');
      result = await listInsights({ limit, saved: true });
    } else if (args.includes('--insight')) {
      const idIndex = args.indexOf('--insight') + 1;
      const id = args[idIndex];
      console.log(`📈 Getting insight ${id}...\n`);
      result = await getInsight(id);
    } else if (args.includes('--events')) {
      const eventIndex = args.indexOf('--events') + 1;
      const event = args[eventIndex];
      console.log(`📋 Querying events: ${event}...\n`);
      result = await queryEvents({ event, limit });
    } else if (args.includes('--persons')) {
      console.log(`👥 Querying persons...\n`);
      result = await queryPersons({ limit });
    } else if (args.includes('--preset')) {
      const presetIndex = args.indexOf('--preset') + 1;
      const presetName = args[presetIndex];

      if (!PRESET_QUERIES[presetName]) {
        console.error(`❌ Unknown preset: ${presetName}`);
        console.error(`Available presets: ${Object.keys(PRESET_QUERIES).join(', ')}`);
        process.exit(1);
      }

      console.log(`🔍 Running preset query: ${presetName}...\n`);
      result = await query(PRESET_QUERIES[presetName]);
    } else {
      // Treat remaining args as a HogQL query
      const hogql = args.join(' ');
      console.log(`🔍 Running HogQL query...\n`);
      result = await query(hogql);
    }

    // Output results
    if (outputFile) {
      const fs = await import('fs');
      fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
      console.log(`✅ Results written to ${outputFile}`);
    } else {
      console.log(formatResults(result));
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
    process.exit(1);
  }
}

main();
