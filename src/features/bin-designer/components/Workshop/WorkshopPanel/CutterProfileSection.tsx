/**
 * Profile editor for a cutter part: switch between parametric profile
 * shapes (each switch installs that shape's fresh defaults — variants
 * cannot be spread-merged across), edit the active shape's dimensions, or
 * replace the profile with a phone-scanned tool outline.
 */
import { useState } from 'react';
import { Button, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { CutterProfile } from '@/shared/types/assembly';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { defaultCutterProfile } from '@/shared/items/assembly/descriptor';
import { clamp } from '@/shared/utils/math';
import { ShapePicker } from '../../panel/shared';
import { ScanWithPhoneDialog } from '../../panel/CutoutsSection/scanImport/ScanWithPhoneDialog';
import type { ParsedCutoutSpec } from '../../panel/CutoutsSection/svgImport/types';
import { specToCutterProfile } from '../cutterProfileImport';

type CutterNode = Extract<AssemblyPartNode, { type: 'cutter' }>;
type ParametricShape = 'circle' | 'rectangle' | 'polygon' | 'slot';

const PARAMETRIC_SHAPES: readonly ParametricShape[] = ['circle', 'rectangle', 'polygon', 'slot'];

interface ProfileFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function ProfileField({ label, value, min, max, step, onChange }: ProfileFieldProps) {
  return (
    <div>
      <span className="mb-1 block text-xs text-content-tertiary">{label}</span>
      <Stepper
        aria-label={label}
        value={value}
        onChange={(v) => onChange(clamp(v, min, max))}
        onStep={(delta) => onChange(clamp(value + delta * step, min, max))}
        min={min}
        max={max}
        step={step}
        size="md"
      />
    </div>
  );
}

interface CutterProfileSectionProps {
  readonly node: CutterNode;
}

export function CutterProfileSection({ node }: CutterProfileSectionProps) {
  const t = useTranslation();
  const updateAssemblyPartParams = useDesignerStore((s) => s.updateAssemblyPartParams);
  const [scanOpen, setScanOpen] = useState(false);
  const profile = node.params.profile;

  const setProfile = (next: CutterProfile): void => {
    updateAssemblyPartParams(node.id, { profile: next });
  };

  const importSpecs = (specs: readonly ParsedCutoutSpec[]): number => {
    for (const spec of specs) {
      const imported = specToCutterProfile(spec);
      if (imported) {
        setProfile(imported);
        return 1;
      }
    }
    return 0;
  };

  const isScanned = profile.shape === 'path' || profile.shape === 'outline';

  return (
    <div className="mt-2">
      <span className="mb-1 block text-xs text-content-tertiary">
        {t('workshop.profile.title')}
      </span>
      {isScanned ? (
        <p className="mb-2 text-xs text-content-secondary">
          {t('workshop.profile.scanned')} · {profile.points.length}
        </p>
      ) : (
        <ShapePicker
          options={PARAMETRIC_SHAPES.map((shape) => ({
            value: shape,
            label: t(`workshop.profileShape.${shape}`),
          }))}
          value={profile.shape}
          onChange={(shape) => setProfile(defaultCutterProfile(shape))}
          ariaLabel={t('workshop.profile.title')}
        />
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {profile.shape === 'circle' && (
          <ProfileField
            label={t('workshop.field.diameter')}
            value={profile.diameter}
            min={0.5}
            max={200}
            step={0.5}
            onChange={(diameter) => setProfile({ ...profile, diameter })}
          />
        )}
        {profile.shape === 'rectangle' && (
          <>
            <ProfileField
              label={t('workshop.field.width')}
              value={profile.width}
              min={0.5}
              max={400}
              step={0.5}
              onChange={(width) => setProfile({ ...profile, width })}
            />
            <ProfileField
              label={t('workshop.field.depth')}
              value={profile.depth}
              min={0.5}
              max={400}
              step={0.5}
              onChange={(depth) => setProfile({ ...profile, depth })}
            />
            <ProfileField
              label={t('workshop.field.cornerRadius')}
              value={profile.cornerRadius}
              min={0}
              max={50}
              step={0.5}
              onChange={(cornerRadius) => setProfile({ ...profile, cornerRadius })}
            />
          </>
        )}
        {profile.shape === 'polygon' && (
          <>
            <ProfileField
              label={t('workshop.field.diameter')}
              value={profile.diameter}
              min={0.5}
              max={200}
              step={0.5}
              onChange={(diameter) => setProfile({ ...profile, diameter })}
            />
            <ProfileField
              label={t('workshop.field.sides')}
              value={profile.sides}
              min={3}
              max={12}
              step={1}
              onChange={(sides) => setProfile({ ...profile, sides: Math.round(sides) })}
            />
          </>
        )}
        {profile.shape === 'slot' && (
          <>
            <ProfileField
              label={t('workshop.field.length')}
              value={profile.length}
              min={1}
              max={400}
              step={0.5}
              onChange={(length) => setProfile({ ...profile, length })}
            />
            <ProfileField
              label={t('workshop.field.width')}
              value={profile.width}
              min={0.5}
              max={200}
              step={0.5}
              onChange={(width) => setProfile({ ...profile, width })}
            />
          </>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => setScanOpen(true)}>
          {t('workshop.profile.scan')}
        </Button>
        {isScanned && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProfile(defaultCutterProfile('circle'))}
          >
            {t('workshop.profile.reset')}
          </Button>
        )}
      </div>
      <ScanWithPhoneDialog
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onImport={importSpecs}
      />
    </div>
  );
}
