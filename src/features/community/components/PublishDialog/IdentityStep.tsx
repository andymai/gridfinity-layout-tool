import { useState } from 'react';
import { Button, Dialog, Field, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import { DISPLAY_NAME_MAX_LENGTH } from '../../utils/displayName';

export interface IdentityStepProps {
  initialName: string;
  onContinue: (name: string) => void;
}

export function IdentityStep({ initialName, onContinue }: IdentityStepProps) {
  const t = useTranslation();
  const [publicName, setPublicName] = useState(initialName);
  return (
    <>
      <Dialog.Body>
        <div className="space-y-4">
          <Field
            label={t('community.publish.identity.label')}
            htmlFor="community-public-name"
            hint={t('community.publish.identity.hint')}
          >
            <Input
              id="community-public-name"
              value={publicName}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              placeholder={t('community.publish.identity.placeholder')}
              onChange={(e) => setPublicName(e.target.value)}
            />
          </Field>
          <p className="text-xs text-content-tertiary">
            {t('community.publish.disclosure')}{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-content"
            >
              {t('community.publish.disclosureTerms')}
            </a>
          </p>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button
          variant="primary"
          className="min-h-11 md:min-h-0"
          disabled={publicName.trim() === ''}
          onClick={() => onContinue(publicName)}
        >
          {t('community.publish.identity.continue')}
        </Button>
      </Dialog.Footer>
    </>
  );
}
