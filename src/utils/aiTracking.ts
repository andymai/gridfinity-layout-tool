/**
 * AI/LLM Analytics utilities for tracking AI feature usage via PostHog.
 *
 * This module provides a foundation for tracking AI-powered features like:
 * - Bin suggestions based on labels/context
 * - Layout generation from descriptions
 * - Smart search across layouts
 *
 * Uses PostHog's LLM analytics format ($ai_generation, $ai_trace, $ai_span)
 * for full observability of AI operations including:
 * - Cost tracking per model
 * - Latency monitoring
 * - Input/output logging for debugging
 * - User feedback on AI suggestions
 *
 * @see https://posthog.com/docs/llm-analytics
 */

import { getPostHogInstance, getLayoutContext, getDeviceType } from './analytics';
import { generateUUID } from '@/shared/utils';

// ============================================
// TYPES
// ============================================

export type AIProvider = 'openai' | 'anthropic' | 'google' | 'local';

export interface AIGenerationParams {
  /** The AI model used (e.g., 'gpt-4o-mini', 'claude-3-haiku') */
  model: string;
  /** The LLM provider */
  provider: AIProvider;
  /** Input sent to the model (messages, prompt, etc.) */
  input: unknown;
  /** Output received from the model */
  output: unknown;
  /** Number of input tokens (if known) */
  inputTokens?: number;
  /** Number of output tokens (if known) */
  outputTokens?: number;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Cost in USD (if calculable) */
  costUsd?: number;
  /** Name for this generation step */
  spanName?: string;
  /** Whether this was an error response */
  isError?: boolean;
  /** Error details if isError is true */
  error?: string;
}

export interface AISpanParams {
  /** Name for this span (e.g., 'vector_search', 'data_prep') */
  name: string;
  /** Input state for this operation */
  input: unknown;
  /** Output state from this operation */
  output: unknown;
  /** Latency in milliseconds */
  latencyMs: number;
  /** Whether this span had an error */
  isError?: boolean;
  /** Error details if isError is true */
  error?: string;
}

export interface AIFeedback {
  /** Whether the user accepted the AI suggestion */
  accepted: boolean;
  /** What action did the user take */
  action: 'accepted' | 'rejected' | 'modified' | 'ignored';
  /** If modified, what did they change to */
  correction?: unknown;
  /** Optional reason for rejection/modification */
  reason?: string;
}

// ============================================
// AI TRACKER CLASS
// ============================================

/**
 * Tracks AI operations for a single user interaction.
 *
 * Usage:
 * ```ts
 * const tracker = new AITracker();
 *
 * // Start a trace for a bin suggestion request
 * tracker.startTrace('bin_suggestion', { labels: ['screws', 'nails'] });
 *
 * // Track a vector search step
 * tracker.trackSpan({
 *   name: 'similar_layouts_search',
 *   input: { labels: ['screws', 'nails'] },
 *   output: { matches: 5 },
 *   latencyMs: 150,
 * });
 *
 * // Track the LLM call
 * tracker.trackGeneration({
 *   model: 'gpt-4o-mini',
 *   provider: 'openai',
 *   input: prompt,
 *   output: response,
 *   inputTokens: 500,
 *   outputTokens: 100,
 *   latencyMs: 800,
 *   costUsd: 0.002,
 *   spanName: 'generate_suggestions',
 * });
 *
 * // End the trace
 * tracker.endTrace(suggestions, 1200);
 *
 * // Later, track user feedback
 * tracker.trackFeedback({
 *   accepted: true,
 *   action: 'modified',
 *   correction: { size: '3x3' },
 * });
 * ```
 */
export class AITracker {
  private traceId: string | null = null;
  private traceStartTime: number | null = null;
  private spanCount = 0;

  /**
   * Generate a unique ID for traces/spans.
   * Uses generateUUID which has a fallback for environments without crypto.randomUUID.
   */
  private generateId(): string {
    return generateUUID();
  }

  /**
   * Start a new AI trace (e.g., user asks for bin suggestions).
   * A trace groups multiple AI operations together.
   */
  startTrace(name: string, input: unknown): string {
    const posthog = getPostHogInstance();
    this.traceId = this.generateId();
    this.traceStartTime = Date.now();
    this.spanCount = 0;

    if (posthog) {
      posthog.capture('$ai_trace', {
        $ai_trace_id: this.traceId,
        $ai_span_name: name,
        $ai_input_state: input,
        // Output state will be set in endTrace
        ...getLayoutContext(),
        device_type: getDeviceType(),
      });
    }

    return this.traceId;
  }

  /**
   * Get the current trace ID (for linking related operations).
   */
  getTraceId(): string | null {
    return this.traceId;
  }

  /**
   * Track an LLM generation (API call to an AI model).
   */
  trackGeneration(params: AIGenerationParams): void {
    const posthog = getPostHogInstance();
    if (!posthog) return;

    // Auto-start a trace if not already started
    if (!this.traceId) {
      this.traceId = this.generateId();
      this.traceStartTime = Date.now();
    }

    this.spanCount++;

    posthog.capture('$ai_generation', {
      $ai_trace_id: this.traceId,
      $ai_span_id: this.generateId(),
      $ai_span_name: params.spanName || `generation_${this.spanCount}`,
      $ai_model: params.model,
      $ai_provider: params.provider,
      $ai_input: params.input,
      $ai_input_tokens: params.inputTokens,
      $ai_output_choices: params.output,
      $ai_output_tokens: params.outputTokens,
      $ai_latency: params.latencyMs / 1000, // PostHog expects seconds
      $ai_total_cost_usd: params.costUsd,
      $ai_is_error: params.isError ?? false,
      $ai_error: params.error,
      ...getLayoutContext(),
    });
  }

  /**
   * Track a non-LLM operation within the trace (e.g., vector search, data prep).
   */
  trackSpan(params: AISpanParams): void {
    const posthog = getPostHogInstance();
    if (!posthog) return;

    // Auto-start a trace if not already started
    if (!this.traceId) {
      this.traceId = this.generateId();
      this.traceStartTime = Date.now();
    }

    this.spanCount++;

    posthog.capture('$ai_span', {
      $ai_trace_id: this.traceId,
      $ai_span_id: this.generateId(),
      $ai_span_name: params.name,
      $ai_input_state: params.input,
      $ai_output_state: params.output,
      $ai_latency: params.latencyMs / 1000, // PostHog expects seconds
      $ai_is_error: params.isError ?? false,
      $ai_error: params.error,
    });
  }

  /**
   * End the trace with final output.
   */
  endTrace(output: unknown, totalLatencyMs?: number): void {
    const posthog = getPostHogInstance();
    if (!posthog || !this.traceId) return;

    const latency = totalLatencyMs ?? (this.traceStartTime ? Date.now() - this.traceStartTime : 0);

    posthog.capture('$ai_trace', {
      $ai_trace_id: this.traceId,
      $ai_output_state: output,
      $ai_latency: latency / 1000,
      span_count: this.spanCount,
    });

    // Keep trace ID for feedback tracking
  }

  /**
   * Track user feedback on AI output.
   * Call this after the user accepts, rejects, or modifies an AI suggestion.
   * Returns early if no trace is active (feedback must be linked to a trace).
   */
  trackFeedback(feedback: AIFeedback): void {
    const posthog = getPostHogInstance();
    if (!posthog || !this.traceId) return;

    posthog.capture('ai_feedback', {
      trace_id: this.traceId,
      accepted: feedback.accepted,
      action: feedback.action,
      correction: feedback.correction,
      reason: feedback.reason,
      ...getLayoutContext(),
    });
  }

  /**
   * Reset the tracker for a new interaction.
   */
  reset(): void {
    this.traceId = null;
    this.traceStartTime = null;
    this.spanCount = 0;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/**
 * Global AI tracker instance.
 * Use this for simple tracking, or create new AITracker instances
 * for parallel AI operations.
 */
export const aiTracker = new AITracker();

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Track a simple AI suggestion (single generation, no multi-step trace).
 * Use this for simple AI features that don't need full trace support.
 */
export function trackAISuggestion(params: {
  feature: 'bin_suggestion' | 'layout_generation' | 'smart_search' | 'label_autocomplete';
  model: string;
  provider: AIProvider;
  input: unknown;
  output: unknown;
  latencyMs: number;
  accepted?: boolean;
}): void {
  const tracker = new AITracker();
  tracker.startTrace(params.feature, params.input);
  tracker.trackGeneration({
    model: params.model,
    provider: params.provider,
    input: params.input,
    output: params.output,
    latencyMs: params.latencyMs,
    spanName: params.feature,
  });
  tracker.endTrace(params.output, params.latencyMs);

  if (params.accepted !== undefined) {
    tracker.trackFeedback({
      accepted: params.accepted,
      action: params.accepted ? 'accepted' : 'rejected',
    });
  }
}

/**
 * Track when a user accepts/rejects an AI suggestion.
 * Use this standalone when you have a trace ID from a previous tracking call.
 */
export function trackAIFeedback(
  traceId: string,
  feedback: AIFeedback
): void {
  const posthog = getPostHogInstance();
  if (!posthog) return;

  posthog.capture('ai_feedback', {
    trace_id: traceId,
    ...feedback,
    ...getLayoutContext(),
  });
}
