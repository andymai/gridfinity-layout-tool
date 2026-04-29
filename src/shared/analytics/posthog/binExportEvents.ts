/**
 * Telemetry helpers for bin designer exports.
 *
 * Split out of `events.ts` to keep that module under the 500-line cap and
 * give the bin-export pipeline its own colocated event surface.
 */

import { trackEvent } from './trackEvent';

/**
 * Properties shared by bin export success and failure events.
 *
 * Captured both for successful exports (so we can tell whether retries paid
 * off) and failures (so PostHog dashboards can slice by feature combinations
 * that correlate with engine wedges, e.g. wall pattern + handles + tall bins).
 */
export interface BinExportProperties {
  format: 'stl' | '3mf' | 'step';
  duration_ms: number;
  retry_count: number;
  restart_count: number;
  bin_width: number;
  bin_depth: number;
  bin_height: number;
  bin_style: string;
  has_dividers: boolean;
  has_lid: boolean;
  needs_split: boolean;
}

/**
 * Track a successful bin export. Capture this even when retries or worker
 * restarts were needed — non-zero `retry_count` / `restart_count` are signal,
 * not noise.
 */
export function trackBinExportSucceeded(props: BinExportProperties): void {
  try {
    trackEvent('bin_export_succeeded', {
      format: props.format,
      duration_ms: Math.round(props.duration_ms),
      retry_count: props.retry_count,
      restart_count: props.restart_count,
      bin_width: props.bin_width,
      bin_depth: props.bin_depth,
      bin_height: props.bin_height,
      bin_style: props.bin_style,
      has_dividers: props.has_dividers,
      has_lid: props.has_lid,
      needs_split: props.needs_split,
    });
  } catch {
    // Analytics should never break the app
  }
}

/**
 * Track a failed bin export after the resilience wrapper exhausted retries
 * and the worker restart. The `error_*` fields are required so PostHog can
 * group failures by class — message text alone produces noisy buckets.
 */
export function trackBinExportFailure(
  props: BinExportProperties & {
    error_code: string;
    error_message: string;
    error_stack: string;
  }
): void {
  try {
    trackEvent('bin_export_failure', {
      format: props.format,
      duration_ms: Math.round(props.duration_ms),
      retry_count: props.retry_count,
      restart_count: props.restart_count,
      bin_width: props.bin_width,
      bin_depth: props.bin_depth,
      bin_height: props.bin_height,
      bin_style: props.bin_style,
      has_dividers: props.has_dividers,
      has_lid: props.has_lid,
      needs_split: props.needs_split,
      error_code: props.error_code,
      error_message: props.error_message,
      error_stack: props.error_stack,
    });
  } catch {
    // Analytics should never break the app
  }
}
