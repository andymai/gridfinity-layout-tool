# PostHog API Guide for AI Agents

This guide helps AI agents interact with PostHog for analytics queries, dashboard management, and insight creation.

## Authentication

### Required Environment Variables

```bash
# Personal API Key (NOT the project API key)
# Get from: PostHog → Settings → Personal API Keys → Create personal API key
POSTHOG_PERSONAL_API_KEY=phx_xxx

# Project ID (numeric ID, not the token)
# Find in: PostHog → Project Settings → Project API Key section (look for the ID in URLs)
POSTHOG_PROJECT_ID=284234
```

### API Base URL

```
https://us.posthog.com/api/projects/{PROJECT_ID}
```

### Headers

```typescript
headers: {
  'Authorization': `Bearer ${POSTHOG_PERSONAL_API_KEY}`,
  'Content-Type': 'application/json',
}
```

## Quick Reference: Common API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Get project info |
| `/dashboards/` | GET | List all dashboards |
| `/dashboards/` | POST | Create dashboard |
| `/dashboards/{id}/` | GET | Get dashboard details |
| `/dashboards/{id}/` | PATCH | Update dashboard |
| `/dashboards/{id}/` | DELETE | Delete dashboard |
| `/insights/` | GET | List all insights |
| `/insights/` | POST | Create insight |
| `/insights/{id}/` | GET | Get insight with results |
| `/insights/{id}/` | PATCH | Update insight |
| `/insights/{id}/` | DELETE | Delete insight |
| `/events/` | GET | Query raw events |
| `/persons/` | GET | List persons |
| `/query/` | POST | Run HogQL queries |

## Running Queries

### Method 1: Using the Query Script

```bash
# Set environment variables
export POSTHOG_PERSONAL_API_KEY=phx_xxx
export POSTHOG_PROJECT_ID=284234

# Run a query
npx tsx scripts/posthog-query.ts "SELECT count() FROM events WHERE event = 'layout_snapshot'"
```

### Method 2: Direct API Call with curl

```bash
# Query events
curl -X POST "https://us.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/query/" \
  -H "Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": {
      "kind": "HogQLQuery",
      "query": "SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 10"
    }
  }'
```

### Method 3: Using the Script API Helper

```typescript
// In scripts/posthog-query.ts
import { query, queryEvents, queryPersons } from './posthog-query';

// HogQL query
const result = await query("SELECT * FROM events WHERE event = '$exception' LIMIT 5");

// Events API
const events = await queryEvents({ event: 'layout_snapshot', limit: 10 });

// Persons API
const persons = await queryPersons({ search: 'email@example.com' });
```

## HogQL Query Examples

### Event Counts by Type

```sql
SELECT
  event,
  count() as count,
  uniq(distinct_id) as unique_users
FROM events
WHERE timestamp > now() - INTERVAL 7 DAY
GROUP BY event
ORDER BY count DESC
LIMIT 20
```

### Feature Adoption Rates

```sql
SELECT
  properties.uses_multi_layer as uses_multi_layer,
  count() as user_count
FROM persons
GROUP BY uses_multi_layer
```

### Error Analysis

```sql
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
```

### Layout Metrics Over Time

```sql
SELECT
  toStartOfDay(timestamp) as day,
  avg(properties.bins_on_grid) as avg_bins,
  avg(properties.drawer_width) as avg_width,
  avg(properties.drawer_depth) as avg_depth
FROM events
WHERE event = 'layout_snapshot'
  AND timestamp > now() - INTERVAL 30 DAY
GROUP BY day
ORDER BY day
```

### Session Analysis

```sql
SELECT
  properties.$session_id as session_id,
  min(timestamp) as session_start,
  max(timestamp) as session_end,
  count() as events_count,
  countIf(event = 'layout_snapshot') as exports
FROM events
WHERE timestamp > now() - INTERVAL 1 DAY
GROUP BY session_id
HAVING events_count > 5
ORDER BY session_start DESC
LIMIT 20
```

### User Journey (Events in Order)

```sql
SELECT
  distinct_id,
  groupArray(event) as event_sequence,
  count() as event_count
FROM events
WHERE timestamp > now() - INTERVAL 1 DAY
GROUP BY distinct_id
HAVING event_count > 3
ORDER BY event_count DESC
LIMIT 10
```

## Creating Insights Programmatically

### Insight Query Structure

```typescript
interface InsightQuery {
  kind: 'InsightVizNode';
  source: TrendsQuery | FunnelsQuery | RetentionQuery;
}

interface TrendsQuery {
  kind: 'TrendsQuery';
  series: EventsNode[];
  interval: 'hour' | 'day' | 'week' | 'month';
  dateRange: { date_from: string; date_to?: string };
  trendsFilter?: { display: string; formula?: string };
  breakdownFilter?: { breakdown: string; breakdown_type: 'event' | 'person' };
}

interface EventsNode {
  kind: 'EventsNode';
  event: string;                    // Event name (e.g., 'layout_snapshot')
  name?: string;                    // Display name
  math?: 'total' | 'dau' | 'weekly_active' | 'unique_session' | 'avg' | 'sum' | 'min' | 'max';
  math_property?: string;           // Property for avg/sum/min/max
  properties?: PropertyFilter[];    // Event property filters
}
```

### Example: Create a Trends Insight

```typescript
const insight = {
  name: 'Daily Exports',
  description: 'Number of exports per day',
  query: {
    kind: 'InsightVizNode',
    source: {
      kind: 'TrendsQuery',
      series: [{
        kind: 'EventsNode',
        event: 'layout_snapshot',
        name: 'Exports',
        math: 'total',
      }],
      interval: 'day',
      dateRange: { date_from: '-30d' },
      trendsFilter: { display: 'ActionsLineGraph' },
    },
  },
  saved: true,
};

// POST to /insights/
```

### Example: Create a Funnel

```typescript
const funnel = {
  name: 'Activation Funnel',
  query: {
    kind: 'InsightVizNode',
    source: {
      kind: 'FunnelsQuery',
      series: [
        { kind: 'EventsNode', event: 'app_loaded', name: 'App Loaded' },
        { kind: 'EventsNode', event: 'layout_action', name: 'Layout Modified' },
        { kind: 'EventsNode', event: 'layout_snapshot', name: 'Exported' },
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
};
```

### Example: Create a Retention Chart

```typescript
const retention = {
  name: 'Weekly Retention',
  query: {
    kind: 'InsightVizNode',
    source: {
      kind: 'RetentionQuery',
      retentionFilter: {
        retentionType: 'retention_first_time',
        totalIntervals: 8,
        period: 'Week',
        targetEntity: { id: 'app_loaded', type: 'events', name: 'App Loaded' },
        returningEntity: { id: 'app_loaded', type: 'events', name: 'Returned' },
      },
      dateRange: { date_from: '-8w' },
    },
  },
};
```

## Managing Dashboards

### List Dashboards

```bash
curl "https://us.posthog.com/api/projects/${POSTHOG_PROJECT_ID}/dashboards/" \
  -H "Authorization: Bearer ${POSTHOG_PERSONAL_API_KEY}"
```

### Create Dashboard

```typescript
const dashboard = {
  name: 'My Dashboard',
  description: 'Description here',
  tags: ['tag1', 'tag2'],
};

// POST to /dashboards/
```

### Add Insight to Dashboard

When creating an insight, include `dashboards: [dashboardId]`:

```typescript
const insight = {
  name: 'My Insight',
  query: { /* ... */ },
  dashboards: [123],  // Dashboard IDs
  saved: true,
};
```

## Existing Scripts

### `scripts/setup-posthog-dashboards.ts`

Creates the standard Gridfinity dashboards with ~20 insights. Run once per project:

```bash
POSTHOG_PERSONAL_API_KEY=phx_xxx POSTHOG_PROJECT_ID=284234 \
  npx tsx scripts/setup-posthog-dashboards.ts
```

### `scripts/posthog-query.ts`

Interactive query tool for exploring data:

```bash
# Run HogQL query
npx tsx scripts/posthog-query.ts "SELECT event, count() FROM events GROUP BY event"

# List dashboards
npx tsx scripts/posthog-query.ts --dashboards

# Get insight results
npx tsx scripts/posthog-query.ts --insight 12345

# Export events to JSON
npx tsx scripts/posthog-query.ts --events layout_snapshot --limit 100 --output events.json
```

## Events Reference

### Core Events (PostHog)

| Event | When Fired | Key Properties |
|-------|------------|----------------|
| `layout_snapshot` | Export, session end | `trigger`, `bins_on_grid`, `drawer_*`, `feature_*` |
| `layout_action` | Layout CRUD | `action`, `source` |
| `3d_preview` | 3D preview interaction | `action`, `preset` |
| `fill_operation` | Fill layer/gaps | `type`, `bin_count` |
| `paint_mode` | Enter/exit paint | `action`, `bins_created` |
| `labs_feature_toggle` | Toggle feature flag | `feature_id`, `enabled` |
| `$exception` | Errors | `$exception_type`, `$exception_message` |

### Person Properties

| Property | Type | Description |
|----------|------|-------------|
| `uses_multi_layer` | boolean | Has used multiple layers |
| `uses_half_bins` | boolean | Has enabled half-bin mode |
| `uses_3d_preview` | boolean | Has opened 3D preview |
| `uses_cloud_share` | boolean | Has shared a layout |
| `uses_labels` | boolean | Has labeled bins |
| `uses_fill_operations` | boolean | Has used fill features |
| `layout_count` | number | Estimated layout count |
| `engagement_tier` | string | 'new', 'active', 'power' |
| `primary_device` | string | Most used device type |

## Rate Limits

PostHog API has rate limits:
- 240 requests per minute for most endpoints
- Batch operations when possible
- Add delays between bulk operations (100-500ms)

## Troubleshooting

### "401 Unauthorized"
- Check `POSTHOG_PERSONAL_API_KEY` is correct
- Ensure using Personal API Key, not Project API Key
- Verify key has access to the project

### "404 Not Found"
- Check `POSTHOG_PROJECT_ID` is correct (numeric ID)
- Verify endpoint URL is correct

### "Query timeout"
- Reduce date range
- Add more specific filters
- Use sampling for large datasets

### Empty results
- Check event names (case-sensitive)
- Verify date range includes data
- Check property filters match actual data

## Further Reading

- [PostHog API Docs](https://posthog.com/docs/api)
- [HogQL Documentation](https://posthog.com/docs/hogql)
- [Insight Query Schema](https://posthog.com/docs/api/insights)
