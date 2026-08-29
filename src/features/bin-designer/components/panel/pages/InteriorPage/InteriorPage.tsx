import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { isPartialMask } from '@/shared/utils/cellMask';
import { useDesignerStore } from '@/features/bin-designer/store';
import { jumpToDesignerControl } from '@/features/bin-designer/settingsManifest';
import { PanelSection } from '../../PanelSection';
import { FeatureGate } from '../../FeatureGate';
import { DependencyHint } from '../../shared';
import { InteriorSection } from '../../InteriorSection';
import { LabelTabsSection } from '../../LabelTabsSection';
import { ScoopSection } from '../../ScoopSection';
import { KnifeRestSection } from '../../KnifeRestSection';

/** Interior layout: compartment modes, label tabs, scoop, knife rest. */
export function InteriorPage() {
  const t = useTranslation();
  const { showLabelTabs, isCustomShape } = useDesignerStore(
    useShallow((s) => ({
      showLabelTabs: s.params.style === 'standard',
      isCustomShape: isPartialMask(s.params.cellMask),
    }))
  );
  const customShapeReason = t('binDesigner.shape.custom.hint');
  const footprintFix = isCustomShape ? (
    <DependencyHint
      reason={customShapeReason}
      actionLabel={t('binDesigner.dependency.editFootprint')}
      onAction={() => jumpToDesignerControl('bd-shape')}
    />
  ) : null;

  return (
    <div className="divide-y divide-stroke-subtle/50">
      <PanelSection helpTarget="bd-interior">
        {/* Per-mode gating lives inside InteriorSection: Solid (cutouts) stays
            interactive on custom shapes; Standard/Slotted remain gated. */}
        <InteriorSection />
      </PanelSection>
      {showLabelTabs && (
        <PanelSection helpTarget="bd-label-tabs">
          {footprintFix}
          <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
            <LabelTabsSection />
          </FeatureGate>
        </PanelSection>
      )}
      <PanelSection helpTarget="bd-scoop">
        {footprintFix}
        <FeatureGate disabled={isCustomShape} reason={customShapeReason}>
          <ScoopSection />
        </FeatureGate>
      </PanelSection>
      <PanelSection helpTarget="bd-knife-rest">
        <KnifeRestSection />
      </PanelSection>
    </div>
  );
}
