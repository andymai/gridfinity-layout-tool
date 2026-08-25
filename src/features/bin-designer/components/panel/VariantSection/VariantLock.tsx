import type { ReactNode } from 'react';
import { Button } from '@/design-system';
import { useTranslation } from '@/i18n';

export interface VariantLockProps {
  readonly locked: boolean;
  readonly parentName: string;
  readonly onOpenParent?: () => void;
  readonly children: ReactNode;
}

/**
 * Makes an editing surface read-only while the open design is a variant.
 *
 * A variant's `params` is a materialized cache that the next propagation
 * rewrites, so an edit outside its override surface survives only until the
 * parent is next saved. Every surface that edits those params has to be covered
 * or the guard is decorative: the parameter panel AND the cutout and bento
 * workspaces, which live in a different subtree entirely.
 *
 * `inert` alone is not enough. It stops the interaction but leaves the controls
 * looking completely ordinary, so the surface reads as broken rather than
 * deliberate. The dimming and the note are what make it legible.
 */
export function VariantLock({ locked, parentName, onOpenParent, children }: VariantLockProps) {
  const t = useTranslation();

  if (!locked) return <>{children}</>;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-stroke-subtle bg-surface-elevated px-4 py-2">
        <p className="flex-1 text-xs text-content-secondary">
          {t('binDesigner.variants.lockedHere', { name: parentName })}
        </p>
        {onOpenParent && (
          <Button variant="secondary" size="sm" onClick={onOpenParent}>
            {t('binDesigner.variants.openParent')}
          </Button>
        )}
      </div>
      {/* `aria-hidden` is deliberately NOT set: the content stays readable to a
          screen reader, it just cannot be operated, which is the same thing a
          sighted user gets from the dimming. */}
      <div inert className="min-h-0 flex-1 overflow-hidden opacity-55 grayscale-[0.35]">
        {children}
      </div>
    </div>
  );
}
