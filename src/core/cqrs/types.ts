/**
 * CQRS Core Types
 *
 * Defines the foundational types for the command/event sourcing system.
 * Commands represent intent, events represent facts that happened.
 */

import type { LayoutId } from '@/core/types';
import type { Result, LayoutError, ValidationError } from '@/core/result';
export type CommandId = string & { readonly __brand: 'CommandId' };
export type EventId = string & { readonly __brand: 'EventId' };
export type CorrelationId = string & { readonly __brand: 'CorrelationId' };

export const commandId = (id: string): CommandId => id as CommandId;
export const eventId = (id: string): EventId => id as EventId;
export const correlationId = (id: string): CorrelationId => id as CorrelationId;
/** Source of a command — who/what initiated it */
export type CommandSource = 'user' | 'system' | 'replay' | 'collab' | 'cascade';

export interface CommandMeta {
  readonly id: CommandId;
  readonly timestamp: number;
  readonly correlationId: CorrelationId;
  readonly source: CommandSource;
}
export interface EventMeta {
  readonly id: EventId;
  readonly timestamp: number;
  readonly correlationId: CorrelationId;
  readonly commandId: CommandId;
  readonly aggregateId: LayoutId;
  /** Monotonically increasing version per aggregate for ordering */
  readonly version: number;
  /** Schema version for forward-compatible event migration */
  readonly schemaVersion: number;
}
export interface BaseCommand<TType extends string, TPayload> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly meta: CommandMeta;
}

export interface BaseDomainEvent<TType extends string, TPayload> {
  readonly type: TType;
  readonly payload: TPayload;
  readonly meta: EventMeta;
}

// Note: Command and DomainEvent union types are defined in commands/index.ts and events/index.ts
// and re-exported from the cqrs barrel. Types here use generics to avoid circular deps.

/**
 * Result of executing a command handler.
 * Contains the return value and domain events produced.
 */
export interface CommandSuccess<T = void, TEvent = unknown> {
  readonly value: T;
  readonly events: ReadonlyArray<TEvent>;
}

export type CommandResult<T = void, TEvent = unknown> = Result<
  CommandSuccess<T, TEvent>,
  LayoutError | ValidationError
>;

/**
 * A command handler maps a command to store mutations and produces events.
 */
export type CommandHandler<TCommand, TEvent = unknown> = (
  command: TCommand
) => CommandResult<unknown, TEvent>;
export type NextFn<TCommand = unknown, TEvent = unknown> = (
  command: TCommand
) => CommandResult<unknown, TEvent>;

/**
 * Middleware intercepts commands before/after handler execution.
 * Call `next(command)` to continue the pipeline.
 */
export type Middleware<TCommand = unknown, TEvent = unknown> = (
  command: TCommand,
  next: NextFn<TCommand, TEvent>
) => CommandResult<unknown, TEvent>;
export type EventHandler<T = unknown> = (event: T) => void;
export type UnsubscribeFn = () => void;
