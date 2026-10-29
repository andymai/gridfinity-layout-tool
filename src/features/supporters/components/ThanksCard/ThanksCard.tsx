import { useTranslation } from '@/i18n';
import type { SupporterBin } from '../../utils/supportersData';
import type { SupportersPalette } from '../../scene/palette';

interface ThanksCardProps {
  bin: SupporterBin;
  department: string;
  palette: SupportersPalette;
  /** Left edge of the plate's part of the screen. */
  stageInset: string;
}

/** Styled like the printed label tape on the bins. */
export function ThanksCard({ bin, department, palette, stageInset }: ThanksCardProps) {
  const t = useTranslation();
  return (
    <div
      className="pointer-events-none absolute bottom-[20%] right-0 z-20 flex justify-center px-6"
      style={{ left: stageInset }}
    >
      <div
        className="max-w-sm rounded-md px-5 py-3 text-center text-sm shadow-lg motion-safe:animate-fade-in"
        style={{
          background: palette.tape,
          color: palette.tapeInk,
          border: `1px solid ${palette.accent}66`,
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        }}
      >
        <p className="font-semibold">
          {bin.name ? t('supporters.thanksNamed', { name: bin.name }) : t('supporters.thanksAnon')}
        </p>
        {bin.message && <q className="mt-1 block italic opacity-80">{bin.message}</q>}
        <p className="mt-1.5 text-micro uppercase tracking-wider opacity-60">{department}</p>
      </div>
    </div>
  );
}
