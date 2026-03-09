/**
 * Event Bus — Synchronous pub/sub for domain events.
 *
 * Features subscribe to domain events to react to changes without coupling
 * to the command that caused them. Subscribers are invoked synchronously
 * after command execution. Side effects that need async should queue work internally.
 */

import type { DomainEvent, DomainEventType } from '../events';
import type { UnsubscribeFn } from '../types';

type TypedHandler<T extends DomainEventType> = (event: Extract<DomainEvent, { type: T }>) => void;

type WildcardHandler = (event: DomainEvent) => void;

export interface EventBus {
  /** Publish a single domain event to all subscribers */
  publish(event: DomainEvent): void;

  /** Publish multiple domain events in order */
  publishAll(events: ReadonlyArray<DomainEvent>): void;

  /** Subscribe to a specific event type. Returns unsubscribe function. */
  subscribe<T extends DomainEventType>(type: T, handler: TypedHandler<T>): UnsubscribeFn;

  /** Subscribe to all events. Returns unsubscribe function. */
  subscribeAll(handler: WildcardHandler): UnsubscribeFn;

  /** Remove all subscribers (for testing/cleanup) */
  clear(): void;
}

export function createEventBus(): EventBus {
  const typedHandlers = new Map<string, Set<WildcardHandler>>();
  const wildcardHandlers = new Set<WildcardHandler>();

  return {
    publish(event) {
      // Type-specific subscribers first
      const handlers = typedHandlers.get(event.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(event);
        }
      }

      // Wildcard subscribers
      for (const handler of wildcardHandlers) {
        handler(event);
      }
    },

    publishAll(events) {
      for (const event of events) {
        this.publish(event);
      }
    },

    subscribe<T extends DomainEventType>(type: T, handler: TypedHandler<T>): UnsubscribeFn {
      let handlers = typedHandlers.get(type);
      if (!handlers) {
        handlers = new Set();
        typedHandlers.set(type, handlers);
      }
      const wildcardRef = handler as WildcardHandler;
      handlers.add(wildcardRef);

      return () => {
        handlers.delete(wildcardRef);
        if (handlers.size === 0) {
          typedHandlers.delete(type);
        }
      };
    },

    subscribeAll(handler) {
      wildcardHandlers.add(handler);
      return () => {
        wildcardHandlers.delete(handler);
      };
    },

    clear() {
      typedHandlers.clear();
      wildcardHandlers.clear();
    },
  };
}

/** Singleton event bus for the application */
export const eventBus = createEventBus();
