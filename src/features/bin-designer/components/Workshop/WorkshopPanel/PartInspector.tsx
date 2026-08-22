/** Transform + parameter editor for the selected Workshop part. */
import { SegmentedControl, Button, Stepper, TrashIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { clamp } from '@/shared/utils/math';
import { PanelSection } from '../../panel/PanelSection';
import { PART_LABEL_KEYS, PART_NUMBER_FIELDS } from './partFieldConfig';

interface NumberFieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, step, onChange }: NumberFieldProps) {
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

interface PartInspectorProps {
  readonly node: AssemblyPartNode;
}

export function PartInspector({ node }: PartInspectorProps) {
  const t = useTranslation();
  const moveAssemblyPart = useDesignerStore((s) => s.moveAssemblyPart);
  const updateAssemblyPartParams = useDesignerStore((s) => s.updateAssemblyPartParams);
  const removeAssemblyPart = useDesignerStore((s) => s.removeAssemblyPart);

  const params = node.params as unknown as Record<string, number>;

  return (
    <PanelSection>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{t(PART_LABEL_KEYS[node.type])}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeAssemblyPart(node.id)}
          aria-label={t('workshop.inspector.delete')}
        >
          <TrashIcon size="sm" />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={t('workshop.inspector.x')}
          value={node.transform.x}
          min={-1000}
          max={1000}
          step={0.5}
          onChange={(x) => moveAssemblyPart(node.id, { x })}
        />
        <NumberField
          label={t('workshop.inspector.y')}
          value={node.transform.y}
          min={-1000}
          max={1000}
          step={0.5}
          onChange={(y) => moveAssemblyPart(node.id, { y })}
        />
        <NumberField
          label={t('workshop.inspector.seatZ')}
          value={node.transform.seatZ}
          min={-200}
          max={200}
          step={0.5}
          onChange={(seatZ) => moveAssemblyPart(node.id, { seatZ })}
        />
        <NumberField
          label={t('workshop.inspector.rotation')}
          value={node.transform.rotZDeg}
          min={-360}
          max={360}
          step={15}
          onChange={(rotZDeg) => moveAssemblyPart(node.id, { rotZDeg })}
        />
      </div>
      {node.type === 'cradle' && (
        <div className="mt-2">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('workshop.field.grooveStyle')}
          </span>
          <SegmentedControl
            aria-label={t('workshop.field.grooveStyle')}
            value={node.params.grooveStyle}
            onChange={(grooveStyle) => updateAssemblyPartParams(node.id, { grooveStyle })}
            options={[
              { value: 'round', label: t('workshop.groove.round') },
              { value: 'vee', label: t('workshop.groove.vee') },
            ]}
            size="sm"
          />
        </div>
      )}
      {node.type === 'arch' && (
        <div className="mt-2">
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('workshop.field.archStyle')}
          </span>
          <SegmentedControl
            aria-label={t('workshop.field.archStyle')}
            value={node.params.style}
            onChange={(style) => updateAssemblyPartParams(node.id, { style })}
            options={[
              { value: 'rod', label: t('workshop.archStyle.rod') },
              { value: 'bridge', label: t('workshop.archStyle.bridge') },
            ]}
            size="sm"
          />
        </div>
      )}
      <div className="mt-2 grid grid-cols-2 gap-2">
        {PART_NUMBER_FIELDS[node.type].map((field) => (
          <NumberField
            key={field.key}
            label={t(field.labelKey)}
            value={params[field.key] ?? 0}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(value) =>
              updateAssemblyPartParams(node.id, {
                [field.key]: value,
              })
            }
          />
        ))}
      </div>
    </PanelSection>
  );
}
