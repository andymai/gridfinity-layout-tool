import type { ReactNode } from 'react';
import { Card } from '@/design-system';
import { ImageIcon, SmartphoneIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';

interface ScanRouteChoiceProps {
  readonly onPhone: () => void;
  readonly onComputer: () => void;
}

export function ScanRouteChoice({ onPhone, onComputer }: ScanRouteChoiceProps) {
  const t = useTranslation();
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <RouteCard
        icon={<SmartphoneIcon size="lg" />}
        title={t('binDesigner.cutouts.scanImport.routePhone')}
        help={t('binDesigner.cutouts.scanImport.routePhoneHelp')}
        onClick={onPhone}
      />
      <RouteCard
        icon={<ImageIcon size="lg" />}
        title={t('binDesigner.cutouts.traceView.open')}
        help={t('binDesigner.cutouts.traceView.openHelp')}
        onClick={onComputer}
      />
    </div>
  );
}

function RouteCard({
  icon,
  title,
  help,
  onClick,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly help: string;
  readonly onClick: () => void;
}) {
  return (
    <Card
      as="button"
      interactive
      padding="lg"
      onClick={onClick}
      className="flex h-full flex-col items-center gap-2 text-center"
    >
      <span className="text-accent">{icon}</span>
      <span className="text-sm font-semibold text-content-primary">{title}</span>
      <span className="text-xs leading-relaxed text-content-tertiary">{help}</span>
    </Card>
  );
}
