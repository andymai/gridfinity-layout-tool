#!/usr/bin/env -S npx tsx
/**
 * PostHog Dashboard Setup Script
 *
 * Creates dashboards and insights in PostHog using their API.
 * This automates the setup of analytics views so you don't have to
 * navigate the PostHog UI.
 *
 * Prerequisites:
 * 1. Set POSTHOG_PERSONAL_API_KEY environment variable
 * 2. Set POSTHOG_PROJECT_ID environment variable (find in PostHog project settings)
 *
 * Usage:
 *   POSTHOG_PERSONAL_API_KEY=phx_xxx POSTHOG_PROJECT_ID=12345 npx tsx scripts/setup-posthog-dashboards.ts
 *
 * Or add to .env.local:
 *   POSTHOG_PERSONAL_API_KEY=phx_xxx
 *   POSTHOG_PROJECT_ID=12345
 *
 * Then run:
 *   source .env.local && npx tsx scripts/setup-posthog-dashboards.ts
 *
 * @see https://posthog.com/docs/api/dashboards
 * @see https://posthog.com/docs/api/insights
 */

// ============================================
// CONFIGURATION
// ============================================

const POSTHOG_HOST = 'https://us.posthog.com';
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY;
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID;

if (!API_KEY) {
  console.error('❌ Missing POSTHOG_PERSONAL_API_KEY environment variable');
  console.error('   Get your personal API key from: PostHog → Settings → Personal API Keys');
  process.exit(1);
}

if (!PROJECT_ID) {
  console.error('❌ Missing POSTHOG_PROJECT_ID environment variable');
  console.error('   Find your project ID in: PostHog → Project Settings → Project API Key section');
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
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
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
// INSIGHT DEFINITIONS
// ============================================

interface InsightDefinition {
  name: string;
  description: string;
  query: unknown;
  tags?: string[];
}

/**
 * Core engagement trends
 */
const engagementInsights: InsightDefinition[] = [
  {
    name: '📊 Daily Active Users (DAU)',
    description: 'Unique users who loaded the app each day',
    tags: ['engagement', 'core'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'app_loaded',
            name: 'Daily Active Users',
            math: 'dau',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: '📊 Weekly Active Users (WAU)',
    description: 'Unique users who loaded the app each week',
    tags: ['engagement', 'core'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'app_loaded',
            name: 'Weekly Active Users',
            math: 'weekly_active',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-12w' },
        trendsFilter: { display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: '📈 Exports Per Day',
    description: 'Number of layout exports (JSON, URL, TSV) per day',
    tags: ['engagement', 'core'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'Exports',
            math: 'total',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: {
          breakdown: 'trigger',
          breakdown_type: 'event',
        },
      },
    },
  },
  {
    name: '📱 Device Type Distribution',
    description: 'Breakdown of users by device type',
    tags: ['engagement', 'device'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'app_loaded',
            name: 'Users by Device',
            math: 'dau',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-4w' },
        trendsFilter: { display: 'ActionsBarValue' },
        breakdownFilter: {
          breakdown: 'device_type',
          breakdown_type: 'event',
        },
      },
    },
  },
];

/**
 * Feature adoption insights
 */
const featureInsights: InsightDefinition[] = [
  {
    name: '🎨 3D Preview Usage',
    description: 'How often users open and interact with 3D preview',
    tags: ['features', 'adoption'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: '3d_preview',
            name: '3D Preview Actions',
            math: 'total',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: {
          breakdown: 'action',
          breakdown_type: 'event',
        },
      },
    },
  },
  {
    name: '🔲 Fill Operations',
    description: 'Usage of fill layer and fill gaps features',
    tags: ['features', 'adoption'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'fill_operation',
            name: 'Fill Operations',
            math: 'total',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: {
          breakdown: 'type',
          breakdown_type: 'event',
        },
      },
    },
  },
  {
    name: '🎨 Paint Mode Usage',
    description: 'How often users enter paint mode and how many bins they create',
    tags: ['features', 'adoption'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'paint_mode',
            name: 'Paint Mode Sessions',
            math: 'total',
            properties: [{ key: 'action', value: 'entered', operator: 'exact', type: 'event' }],
          },
          {
            kind: 'EventsNode',
            event: 'paint_mode',
            name: 'Bins Created in Paint Mode',
            math: 'sum',
            math_property: 'bins_created',
            properties: [{ key: 'action', value: 'exited', operator: 'exact', type: 'event' }],
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: '📁 Layout Actions',
    description: 'Layout management actions (create, switch, delete, etc.)',
    tags: ['features', 'adoption'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'layout_action',
            name: 'Layout Actions',
            math: 'total',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-30d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: {
          breakdown: 'action',
          breakdown_type: 'event',
        },
      },
    },
  },
];

/**
 * Error tracking insights
 */
const errorInsights: InsightDefinition[] = [
  {
    name: '🔴 Exceptions by Type',
    description: 'Error types occurring in the application',
    tags: ['errors', 'monitoring'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: '$exception',
            name: 'Exceptions',
            math: 'total',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-14d' },
        trendsFilter: { display: 'ActionsLineGraph' },
        breakdownFilter: {
          breakdown: '$exception_type',
          breakdown_type: 'event',
        },
      },
    },
  },
  {
    name: '🔴 Error Rate',
    description: 'Exceptions as percentage of sessions',
    tags: ['errors', 'monitoring'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: '$exception',
            name: 'Sessions with Errors',
            math: 'unique_session',
          },
          {
            kind: 'EventsNode',
            event: 'app_loaded',
            name: 'Total Sessions',
            math: 'unique_session',
          },
        ],
        interval: 'day',
        dateRange: { date_from: '-14d' },
        trendsFilter: {
          display: 'ActionsLineGraph',
          formula: 'A / B * 100',
        },
      },
    },
  },
  {
    name: '🔴 Errors by Device',
    description: 'Which device types have the most errors',
    tags: ['errors', 'monitoring'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: '$exception',
            name: 'Exceptions by Device',
            math: 'total',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-4w' },
        trendsFilter: { display: 'ActionsBarValue' },
        breakdownFilter: {
          breakdown: 'device_type',
          breakdown_type: 'event',
        },
      },
    },
  },
];

/**
 * Layout metrics insights
 */
const layoutInsights: InsightDefinition[] = [
  {
    name: '📐 Average Bins per Layout',
    description: 'How many bins users typically have in exported layouts',
    tags: ['layouts', 'usage'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'Avg Bins',
            math: 'avg',
            math_property: 'bins_on_grid',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-8w' },
        trendsFilter: { display: 'ActionsLineGraph' },
      },
    },
  },
  {
    name: '📐 Multi-Layer Adoption',
    description: 'Percentage of layouts using multiple layers',
    tags: ['layouts', 'features'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'Multi-Layer Layouts',
            math: 'total',
            properties: [{ key: 'feature_multi_layer', value: true, operator: 'exact', type: 'event' }],
          },
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'All Layouts',
            math: 'total',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-8w' },
        trendsFilter: {
          display: 'ActionsLineGraph',
          formula: 'A / B * 100',
        },
      },
    },
  },
  {
    name: '📐 Drawer Sizes Distribution',
    description: 'Common drawer dimensions',
    tags: ['layouts', 'usage'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'TrendsQuery',
        series: [
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'Drawer Width',
            math: 'avg',
            math_property: 'drawer_width',
          },
          {
            kind: 'EventsNode',
            event: 'layout_snapshot',
            name: 'Drawer Depth',
            math: 'avg',
            math_property: 'drawer_depth',
          },
        ],
        interval: 'week',
        dateRange: { date_from: '-8w' },
        trendsFilter: { display: 'ActionsLineGraph' },
      },
    },
  },
];

/**
 * Funnel definitions
 */
const funnelInsights: InsightDefinition[] = [
  {
    name: '🔄 Activation Funnel',
    description: 'From app load to first export',
    tags: ['funnels', 'core'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        series: [
          { kind: 'EventsNode', event: 'app_loaded', name: 'App Loaded' },
          { kind: 'EventsNode', event: 'layout_action', name: 'Layout Created/Switched' },
          { kind: 'EventsNode', event: 'layout_snapshot', name: 'Layout Exported' },
        ],
        dateRange: { date_from: '-30d' },
        funnelsFilter: {
          funnelVizType: 'steps',
          funnelOrderType: 'ordered',
          funnelWindowInterval: 7,
          funnelWindowIntervalUnit: 'day',
        },
      },
    },
  },
  {
    name: '🔄 Feature Discovery Funnel',
    description: 'Do users discover advanced features?',
    tags: ['funnels', 'features'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'FunnelsQuery',
        series: [
          { kind: 'EventsNode', event: 'app_loaded', name: 'App Loaded' },
          { kind: 'EventsNode', event: '3d_preview', name: '3D Preview Opened' },
          { kind: 'EventsNode', event: 'fill_operation', name: 'Used Fill' },
          { kind: 'EventsNode', event: 'layout_snapshot', name: 'Exported' },
        ],
        dateRange: { date_from: '-30d' },
        funnelsFilter: {
          funnelVizType: 'steps',
          funnelOrderType: 'ordered',
          funnelWindowInterval: 14,
          funnelWindowIntervalUnit: 'day',
        },
      },
    },
  },
];

/**
 * Retention insight
 */
const retentionInsights: InsightDefinition[] = [
  {
    name: '📅 Weekly Retention',
    description: 'Do users come back week over week?',
    tags: ['retention', 'core'],
    query: {
      kind: 'InsightVizNode',
      source: {
        kind: 'RetentionQuery',
        retentionFilter: {
          retentionType: 'retention_first_time',
          totalIntervals: 8,
          period: 'Week',
          targetEntity: { id: 'app_loaded', type: 'events', name: 'app_loaded' },
          returningEntity: { id: 'app_loaded', type: 'events', name: 'app_loaded' },
        },
        dateRange: { date_from: '-8w' },
      },
    },
  },
];

// ============================================
// DASHBOARD DEFINITIONS
// ============================================

interface DashboardDefinition {
  name: string;
  description: string;
  insights: InsightDefinition[];
  tags?: string[];
}

const dashboards: DashboardDefinition[] = [
  {
    name: '🏠 Gridfinity Overview',
    description: 'High-level metrics for daily monitoring',
    tags: ['overview'],
    insights: [
      engagementInsights[0], // DAU
      engagementInsights[2], // Exports
      errorInsights[1],      // Error Rate
      funnelInsights[0],     // Activation Funnel
    ],
  },
  {
    name: '📊 Engagement & Retention',
    description: 'User engagement and retention metrics',
    tags: ['engagement'],
    insights: [
      ...engagementInsights,
      ...retentionInsights,
    ],
  },
  {
    name: '🚀 Feature Adoption',
    description: 'How users adopt and use features',
    tags: ['features'],
    insights: [
      ...featureInsights,
      funnelInsights[1], // Feature Discovery
    ],
  },
  {
    name: '📐 Layout Analytics',
    description: 'Understanding how users design layouts',
    tags: ['layouts'],
    insights: layoutInsights,
  },
  {
    name: '🔴 Error Monitoring',
    description: 'Track and debug application errors',
    tags: ['errors'],
    insights: errorInsights,
  },
];

// ============================================
// MAIN SCRIPT
// ============================================

async function createDashboard(dashboard: DashboardDefinition): Promise<void> {
  console.log(`\n📊 Creating dashboard: ${dashboard.name}`);

  // Create the dashboard first
  const dashResult = await apiRequest<{ id: number }>('POST', '/dashboards/', {
    name: dashboard.name,
    description: dashboard.description,
    tags: dashboard.tags || [],
  });

  if (!dashResult.ok || !dashResult.data) {
    console.error(`   ❌ Failed to create dashboard: ${dashResult.error}`);
    return;
  }

  const dashboardId = dashResult.data.id;
  console.log(`   ✅ Dashboard created (ID: ${dashboardId})`);

  // Create each insight and add to dashboard
  for (const insight of dashboard.insights) {
    const insightResult = await apiRequest<{ id: number }>('POST', '/insights/', {
      name: insight.name,
      description: insight.description,
      query: insight.query,
      tags: insight.tags || [],
      dashboards: [dashboardId],
      saved: true,
    });

    if (!insightResult.ok) {
      console.error(`   ❌ Failed to create insight "${insight.name}": ${insightResult.error}`);
    } else {
      console.log(`   ✅ Added insight: ${insight.name}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

async function main() {
  console.log('🦔 PostHog Dashboard Setup for Gridfinity Layout Tool');
  console.log('=====================================================\n');
  console.log(`API Host: ${POSTHOG_HOST}`);
  console.log(`Project ID: ${PROJECT_ID}`);

  // Verify API access
  console.log('\n🔐 Verifying API access...');
  const projectResult = await apiRequest<{ name: string }>('GET', '/');

  if (!projectResult.ok) {
    console.error(`❌ Failed to access PostHog API: ${projectResult.error}`);
    console.error('\nCheck that:');
    console.error('1. POSTHOG_PERSONAL_API_KEY is correct');
    console.error('2. POSTHOG_PROJECT_ID is correct');
    console.error('3. Your API key has access to this project');
    process.exit(1);
  }

  console.log(`✅ Connected to project: ${projectResult.data?.name || 'Unknown'}`);

  // Create dashboards
  console.log('\n📊 Creating dashboards and insights...');

  for (const dashboard of dashboards) {
    await createDashboard(dashboard);
    // Delay between dashboards
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n✅ Setup complete!');
  console.log(`\n🔗 View your dashboards at: ${POSTHOG_HOST}/project/${PROJECT_ID}/dashboard`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
