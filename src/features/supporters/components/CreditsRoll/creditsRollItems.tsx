import { Button } from '@/design-system';
import type { TFunction } from '@/i18n';
import {
  DEPARTMENT_NOTE_KEYS,
  DEPARTMENT_TITLE_KEYS,
  type CreditItem,
} from '../../utils/creditsPlan';
import type { SupporterBin } from '../../utils/supportersData';

export const PIXEL_FONT = '"Press Start 2P", var(--font-sans)';

export interface ItemContext {
  binsById: Map<string, SupporterBin>;
  t: TFunction;
  accent: string;
  stacked: boolean;
  focusedId: string | null;
  onCredit: (binId: string) => void;
}

/** Bar length for a redacted name, stable per supporter so a replay looks the same. */
function redactionWidth(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return 3.4 + (Math.abs(hash) % 34) / 10;
}

function Leader() {
  return (
    <span
      aria-hidden="true"
      className="mx-2 min-w-6 flex-1 -translate-y-[0.28em] border-b-2 border-dotted opacity-30"
    />
  );
}

function CreditName({ bin, ctx }: { bin: SupporterBin; ctx: ItemContext }) {
  const focused = ctx.focusedId === bin.id;
  return (
    <Button
      variant="ghost"
      onClick={() => ctx.onCredit(bin.id)}
      aria-pressed={focused}
      aria-label={bin.name ?? ctx.t('supporters.anonymous')}
      className="h-auto min-h-0 max-w-full gap-1.5 px-1.5 py-0.5 text-[15px] font-medium hover:bg-white/10"
      style={{ color: 'inherit', boxShadow: focused ? `inset 0 -2px 0 ${ctx.accent}` : undefined }}
    >
      {bin.name ? (
        <span className="truncate">{bin.name}</span>
      ) : (
        <span
          aria-hidden="true"
          className="inline-block h-[0.95em] rounded-[2px] bg-current opacity-85"
          style={{ width: `${redactionWidth(bin.id)}em` }}
        />
      )}
      {bin.isNewest && (
        <span
          className="rounded-sm px-1 py-px text-micro font-bold uppercase tracking-wider"
          style={{ background: ctx.accent, color: '#fff' }}
        >
          {ctx.t('supporters.justJoined')}
        </span>
      )}
    </Button>
  );
}

function PairedLine({
  left,
  right,
  stacked,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  stacked: boolean;
}) {
  if (stacked) {
    return (
      <div className="flex flex-col items-center gap-1 px-2 py-3 text-center">
        {left}
        <div className="max-w-[34ch]">{right}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-baseline px-2 py-3">
      <div className="flex min-w-0 items-baseline">
        {left}
        <Leader />
      </div>
      <div className="min-w-0">{right}</div>
    </div>
  );
}

export function CreditItemView({ item, ctx }: { item: CreditItem; ctx: ItemContext }) {
  const { t } = ctx;
  switch (item.kind) {
    case 'department': {
      const note = DEPARTMENT_NOTE_KEYS[item.department];
      return (
        <div className="px-3 pb-5 pt-16 text-center">
          <h3
            className="text-[11px] uppercase leading-[1.7] tracking-[0.06em] sm:text-xs"
            style={{ fontFamily: PIXEL_FONT, color: ctx.accent }}
          >
            {t(DEPARTMENT_TITLE_KEYS[item.department])}
          </h3>
          {note && <p className="mt-2 text-xs italic opacity-60">{t(note)}</p>}
        </div>
      );
    }
    case 'names':
      return (
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-0.5 px-4 py-1.5">
          {item.binIds.map((id) => {
            const bin = ctx.binsById.get(id);
            return bin ? (
              <li key={id} className="max-w-full">
                <CreditName bin={bin} ctx={ctx} />
              </li>
            ) : null;
          })}
        </ul>
      );
    case 'message': {
      const bin = ctx.binsById.get(item.binId);
      if (!bin?.message) return null;
      return (
        <PairedLine
          stacked={ctx.stacked}
          left={<CreditName bin={bin} ctx={ctx} />}
          right={<q className="text-[15px] italic leading-snug opacity-80">{bin.message}</q>}
        />
      );
    }
    case 'gag':
      return (
        <div className="pt-8">
          <PairedLine
            stacked={ctx.stacked}
            left={
              <span className="px-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
                {t(item.roleKey)}
              </span>
            }
            right={<span className="text-[15px] font-medium">{t(item.valueKey)}</span>}
          />
        </div>
      );
    case 'note':
      return (
        <p className="px-4 pb-10 pt-16 text-center text-sm italic opacity-70">{t(item.textKey)}</p>
      );
  }
}
