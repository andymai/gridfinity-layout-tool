/**
 * Replaces the separate identity step. Choosing a public name was a whole
 * phase that every repeat publisher walked through once and could then never
 * revisit; it is now a line on the form that expands only when there is
 * something to decide.
 */

import { useState } from 'react';
import { Button, Field, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { DISPLAY_NAME_MAX_LENGTH } from '../../utils/displayName';

export interface PublisherIdentityProps {
  value: string;
  /** No name was ever saved, so the field opens expanded and required. */
  firstTime: boolean;
  error?: string;
  onChange: (name: string) => void;
}

export function PublisherIdentity({ value, firstTime, error, onChange }: PublisherIdentityProps) {
  const t = useTranslation();
  const [editing, setEditing] = useState(firstTime);

  if (!editing && error === undefined) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-content-secondary">
          {t('community.publish.identity.publishingAs')}
        </span>
        <span className="font-medium text-content">{value}</span>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 md:min-h-0"
          onClick={() => setEditing(true)}
        >
          {t('community.publish.identity.change')}
        </Button>
      </div>
    );
  }

  return (
    <Field
      label={t('community.publish.identity.label')}
      htmlFor="community-public-name"
      hint={t('community.publish.identity.hint')}
      error={error}
    >
      <div className="flex items-center gap-2">
        <Input
          id="community-public-name"
          value={value}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          placeholder={t('community.publish.identity.placeholder')}
          aria-invalid={error !== undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <span aria-hidden className="shrink-0 text-xs tabular-nums text-content-tertiary">
          {value.length}/{DISPLAY_NAME_MAX_LENGTH}
        </span>
        {!firstTime && (
          <Button
            variant="secondary"
            className="min-h-11 shrink-0 md:min-h-0"
            disabled={value.trim() === ''}
            onClick={() => setEditing(false)}
          >
            {t('common.done')}
          </Button>
        )}
      </div>
    </Field>
  );
}
