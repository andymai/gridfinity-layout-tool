import { Button } from '@/design-system';
import type { TFunction } from '@/i18n';
import {
  DEPARTMENT_NOTE_KEYS,
  DEPARTMENT_TITLE_KEYS,
  KOFI_DEFAULT_NAME,
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
  /** The finale fades the roll: still read aloud, but out of the tab order. */
  hidden: boolean;
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
      data-bin-id={bin.id}
      tabIndex={ctx.hidden ? -1 : undefined}
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

function Heading({ title, note, accent }: { title: string; note?: string; accent: string }) {
  return (
    <div className="px-3 pb-5 pt-16 text-center">
      <h3
        className="text-[11px] uppercase leading-[1.7] tracking-[0.06em] sm:text-xs"
        style={{ fontFamily: PIXEL_FONT, color: accent }}
      >
        {title}
      </h3>
      {note && <p className="mt-2 text-xs italic opacity-60">{note}</p>}
    </div>
  );
}

export function CreditItemView({ item, ctx }: { item: CreditItem; ctx: ItemContext }) {
  const { t } = ctx;
  switch (item.kind) {
    case 'department': {
      const note = DEPARTMENT_NOTE_KEYS[item.department];
      return (
        <Heading
          title={t(DEPARTMENT_TITLE_KEYS[item.department])}
          note={note && t(note)}
          accent={ctx.accent}
        />
      );
    }
    case 'section':
      return <Heading title={t(item.titleKey)} note={t(item.noteKey)} accent={ctx.accent} />;
    case 'names':
      // Fixed-width cells keep the columns aligned row to row; a short last
      // row centres under them.
      return (
        <ul className="flex flex-wrap justify-center gap-y-0.5 px-2 pb-4 pt-1.5">
          {item.binIds.map((id) => {
            const bin = ctx.binsById.get(id);
            return bin ? (
              <li
                key={id}
                className={`flex min-w-0 justify-center ${ctx.stacked ? 'basis-1/2' : 'basis-1/3'}`}
              >
                <CreditName bin={bin} ctx={ctx} />
              </li>
            ) : null;
          })}
        </ul>
      );
    case 'crowd':
      return (
        <p className="flex items-baseline justify-center gap-2.5 px-4 pb-4 pt-1.5">
          <span aria-hidden="true" className="text-[15px] font-medium">
            {KOFI_DEFAULT_NAME}
          </span>
          <span
            aria-hidden="true"
            className="text-[11px]"
            style={{ fontFamily: PIXEL_FONT, color: ctx.accent }}
          >
            ×{item.binIds.length}
          </span>
          <span className="sr-only">
            {t('supporters.credits.somebody.crowdLabel', {
              count: item.binIds.length,
              name: KOFI_DEFAULT_NAME,
            })}
          </span>
        </p>
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
