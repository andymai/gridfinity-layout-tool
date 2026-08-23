/** Transform + parameter editor for the selected Workshop part. */
import { SegmentedControl, Button, Stepper, Switch, TrashIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { clamp } from '@/shared/utils/math';
import { PanelSection } from '../../panel/PanelSection';
import { CutterProfileSection } from './CutterProfileSection';
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
  const setAssemblyPartArray = useDesignerStore((s) => s.setAssemblyPartArray);
  const setAssemblyPartMirror = useDesignerStore((s) => s.setAssemblyPartMirror);
  const alignAssemblySiblings = useDesignerStore((s) => s.alignAssemblySiblings);
  const distributeAssemblySiblings = useDesignerStore((s) => s.distributeAssemblySiblings);

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
      {node.type === 'cutter' && <CutterProfileSection node={node} />}
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

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-content-tertiary">{t('workshop.repeat.title')}</span>
        <Switch
          checked={node.array !== undefined}
          onChange={(on) => setAssemblyPartArray(node.id, on ? { count: 3, dx: 16, dy: 0 } : null)}
          aria-label={t('workshop.repeat.title')}
        />
      </div>
      {node.array && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <NumberField
            label={t('workshop.repeat.count')}
            value={node.array.count}
            min={2}
            max={64}
            step={1}
            onChange={(count) => {
              if (node.array) {
                setAssemblyPartArray(node.id, { ...node.array, count: Math.round(count) });
              }
            }}
          />
          <NumberField
            label={t('workshop.repeat.dx')}
            value={node.array.dx}
            min={-500}
            max={500}
            step={0.5}
            onChange={(dx) => {
              if (node.array) setAssemblyPartArray(node.id, { ...node.array, dx });
            }}
          />
          <NumberField
            label={t('workshop.repeat.dy')}
            value={node.array.dy}
            min={-500}
            max={500}
            step={0.5}
            onChange={(dy) => {
              if (node.array) setAssemblyPartArray(node.id, { ...node.array, dy });
            }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-content-tertiary">{t('workshop.mirror.part')}</span>
        <Switch
          checked={node.mirror === true}
          onChange={(on) => setAssemblyPartMirror(node.id, on)}
          aria-label={t('workshop.mirror.part')}
        />
      </div>

      <div className="mt-3">
        <span className="mb-1 block text-xs text-content-tertiary">
          {t('workshop.arrange.title')}
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => alignAssemblySiblings(node.id, 'y')}>
            {t('workshop.arrange.alignRow')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => alignAssemblySiblings(node.id, 'x')}>
            {t('workshop.arrange.alignColumn')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => distributeAssemblySiblings(node.id, 'x')}
          >
            {t('workshop.arrange.distributeX')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => distributeAssemblySiblings(node.id, 'y')}
          >
            {t('workshop.arrange.distributeY')}
          </Button>
        </div>
      </div>
    </PanelSection>
  );
}
