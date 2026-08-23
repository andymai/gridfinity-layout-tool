/** Transform + parameter editor for the selected Workshop part. */
import {
  Button,
  Collapsible,
  IconButton,
  SegmentedControl,
  Switch,
  TrashIcon,
} from '@/design-system';
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignHorizontalDistributeCenterIcon,
  AlignVerticalDistributeCenterIcon,
} from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput/CompactNumberInput';
import { clamp } from '@/shared/utils/math';
import { PanelSection } from '../../panel/PanelSection';
import { CutterProfileSection } from './CutterProfileSection';
import { PART_LABEL_KEYS, PART_NUMBER_FIELDS } from './partFieldConfig';

/** Degrees for angle-ish keys, counts unitless, millimetres otherwise. */
function unitFor(key: string): string | undefined {
  if (key.endsWith('Deg') || key === 'rotation') return '°';
  if (key === 'count' || key === 'sides') return undefined;
  return 'mm';
}

interface FieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit?: string;
  readonly onChange: (value: number) => void;
}

function Field({ label, value, min, max, step, unit, onChange }: FieldProps) {
  return (
    <CompactNumberInput
      label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      onChange={(v) => onChange(clamp(v, min, max))}
    />
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

  const arrangeButtons = [
    {
      key: 'alignRow',
      label: t('workshop.arrange.alignRow'),
      icon: <AlignCenterHorizontalIcon size="xs" />,
      onClick: () => alignAssemblySiblings(node.id, 'y'),
    },
    {
      key: 'alignColumn',
      label: t('workshop.arrange.alignColumn'),
      icon: <AlignCenterVerticalIcon size="xs" />,
      onClick: () => alignAssemblySiblings(node.id, 'x'),
    },
    {
      key: 'distributeX',
      label: t('workshop.arrange.distributeX'),
      icon: <AlignHorizontalDistributeCenterIcon size="xs" />,
      onClick: () => distributeAssemblySiblings(node.id, 'x'),
    },
    {
      key: 'distributeY',
      label: t('workshop.arrange.distributeY'),
      icon: <AlignVerticalDistributeCenterIcon size="xs" />,
      onClick: () => distributeAssemblySiblings(node.id, 'y'),
    },
  ];

  return (
    <PanelSection>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{t(PART_LABEL_KEYS[node.type])}</span>
        <div className="flex items-center gap-0.5">
          {arrangeButtons.map((button) => (
            <IconButton
              key={button.key}
              type="button"
              size="sm"
              variant="ghost"
              aria-label={button.label}
              title={button.label}
              onClick={button.onClick}
            >
              {button.icon}
            </IconButton>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeAssemblyPart(node.id)}
            aria-label={t('workshop.inspector.delete')}
          >
            <TrashIcon size="sm" />
          </Button>
        </div>
      </div>

      <Collapsible title={t('workshop.inspector.transform')} size="sm">
        <div className="grid grid-cols-2 gap-1">
          <Field
            label={t('workshop.inspector.x')}
            value={node.transform.x}
            min={-1000}
            max={1000}
            step={0.5}
            unit="mm"
            onChange={(x) => moveAssemblyPart(node.id, { x })}
          />
          <Field
            label={t('workshop.inspector.y')}
            value={node.transform.y}
            min={-1000}
            max={1000}
            step={0.5}
            unit="mm"
            onChange={(y) => moveAssemblyPart(node.id, { y })}
          />
          <Field
            label={t('workshop.inspector.seatZ')}
            value={node.transform.seatZ}
            min={-200}
            max={200}
            step={0.5}
            unit="mm"
            onChange={(seatZ) => moveAssemblyPart(node.id, { seatZ })}
          />
          <Field
            label={t('workshop.inspector.rotation')}
            value={node.transform.rotZDeg}
            min={-360}
            max={360}
            step={15}
            unit="°"
            onChange={(rotZDeg) => moveAssemblyPart(node.id, { rotZDeg })}
          />
        </div>
      </Collapsible>

      <Collapsible title={t('workshop.inspector.shape')} size="sm">
        {node.type === 'cradle' && (
          <div className="mb-2">
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
          <div className="mb-2">
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
        <div className="grid grid-cols-2 gap-1">
          {PART_NUMBER_FIELDS[node.type].map((field) => (
            <Field
              key={field.key}
              label={t(field.labelKey)}
              value={params[field.key] ?? 0}
              min={field.min}
              max={field.max}
              step={field.step}
              unit={unitFor(field.key)}
              onChange={(value) =>
                updateAssemblyPartParams(node.id, {
                  [field.key]: value,
                })
              }
            />
          ))}
        </div>
      </Collapsible>

      <Collapsible
        title={t('workshop.repeat.title')}
        size="sm"
        summary={node.array ? `${node.array.count}×` : undefined}
        defaultExpanded={node.array !== undefined}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-content-tertiary">{t('workshop.repeat.title')}</span>
          <Switch
            checked={node.array !== undefined}
            onChange={(on) =>
              setAssemblyPartArray(node.id, on ? { count: 3, dx: 16, dy: 0 } : null)
            }
            aria-label={t('workshop.repeat.title')}
          />
        </div>
        {node.array && (
          <div className="mt-2 grid grid-cols-3 gap-1">
            <Field
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
            <Field
              label={t('workshop.repeat.dx')}
              value={node.array.dx}
              min={-500}
              max={500}
              step={0.5}
              unit="mm"
              onChange={(dx) => {
                if (node.array) setAssemblyPartArray(node.id, { ...node.array, dx });
              }}
            />
            <Field
              label={t('workshop.repeat.dy')}
              value={node.array.dy}
              min={-500}
              max={500}
              step={0.5}
              unit="mm"
              onChange={(dy) => {
                if (node.array) setAssemblyPartArray(node.id, { ...node.array, dy });
              }}
            />
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-content-tertiary">{t('workshop.mirror.part')}</span>
          <Switch
            checked={node.mirror === true}
            onChange={(on) => setAssemblyPartMirror(node.id, on)}
            aria-label={t('workshop.mirror.part')}
          />
        </div>
      </Collapsible>
    </PanelSection>
  );
}
