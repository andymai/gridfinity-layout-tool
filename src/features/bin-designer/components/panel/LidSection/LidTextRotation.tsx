import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { SegmentedControl } from '@/design-system';
import { useDesignerStore } from '@/features/bin-designer/store';
import { TEXT_QUARTER_TURNS, isTextQuarterTurn } from '@/features/bin-designer/types';

export function LidTextRotation() {
  const t = useTranslation();
  const { rotation, setLidTextRotation } = useDesignerStore(
    useShallow((s) => ({
      rotation: s.params.surfaceText?.lidTextRotation ?? 0,
      setLidTextRotation: s.setLidTextRotation,
    }))
  );
  const label = t('binDesigner.lid.text.rotation');
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-content-secondary">{label}</span>
      <SegmentedControl
        aria-label={label}
        activeStyle="accent"
        fullWidth
        size="sm"
        value={String(rotation)}
        onChange={(value) => {
          const turn = Number(value);
          if (isTextQuarterTurn(turn)) setLidTextRotation(turn);
        }}
        options={TEXT_QUARTER_TURNS.map((turn) => ({
          value: String(turn),
          label: t('binDesigner.lid.text.rotationOption', { angle: turn }),
        }))}
      />
    </div>
  );
}
