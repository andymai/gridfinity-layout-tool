/**
 * UI Analytics Commands
 *
 * Fire-and-forget commands for tracking UI interactions through the CQRS
 * analytics middleware. These skip validation and undo capture — their
 * sole purpose is flowing through the analytics pipeline.
 *
 * Handlers return empty events: no domain events, no IndexedDB persistence.
 */

import type { BaseCommand } from '../types';

export type UiPageViewCommand = BaseCommand<'ui.pageView', { readonly page: string }>;
export type UiModalOpenCommand = BaseCommand<'ui.modalOpen', { readonly modal: string }>;
export type UiModalCloseCommand = BaseCommand<'ui.modalClose', { readonly modal: string }>;
export type UiFeatureUsedCommand = BaseCommand<'ui.featureUsed', { readonly feature: string }>;
export type UiShareAttemptCommand = BaseCommand<'ui.shareAttempt', { readonly layoutId: string }>;
export type UiShareCompleteCommand = BaseCommand<
  'ui.shareComplete',
  { readonly layoutId: string; readonly shareId: string }
>;
export type UiShareFailedCommand = BaseCommand<
  'ui.shareFailed',
  { readonly layoutId: string; readonly error: string }
>;
export type UiOnboardingStepCommand = BaseCommand<'ui.onboardingStep', { readonly step: string }>;
export type UiTemplateAppliedCommand = BaseCommand<
  'ui.templateApplied',
  { readonly templateId: string }
>;
export type UiLayoutExportedCommand = BaseCommand<'ui.layoutExported', { readonly format: string }>;

export type UiCommand =
  | UiPageViewCommand
  | UiModalOpenCommand
  | UiModalCloseCommand
  | UiFeatureUsedCommand
  | UiShareAttemptCommand
  | UiShareCompleteCommand
  | UiShareFailedCommand
  | UiOnboardingStepCommand
  | UiTemplateAppliedCommand
  | UiLayoutExportedCommand;
