import type { TFunction } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import type { YearType, YearTypeId } from '../../types';
import { formatArea, formatDuration, formatPercent, formatWeight } from '../../utils/yearFormat';

/** Literal keys, so the i18n checks can see every one. */
const TYPE_KEYS: Readonly<Record<YearTypeId, { readonly name: string; readonly line: string }>> = {
  compartmentalist: {
    name: 'your2026.type.compartmentalist.name',
    line: 'your2026.type.compartmentalist.line',
  },
  nightShift: { name: 'your2026.type.nightShift.name', line: 'your2026.type.nightShift.line' },
  spoolEater: { name: 'your2026.type.spoolEater.name', line: 'your2026.type.spoolEater.line' },
  gapFiller: { name: 'your2026.type.gapFiller.name', line: 'your2026.type.gapFiller.line' },
  customShop: { name: 'your2026.type.customShop.name', line: 'your2026.type.customShop.line' },
  architect: { name: 'your2026.type.architect.name', line: 'your2026.type.architect.line' },
  smallParts: { name: 'your2026.type.smallParts.name', line: 'your2026.type.smallParts.line' },
  labelMaker: { name: 'your2026.type.labelMaker.name', line: 'your2026.type.labelMaker.line' },
  minimalist: { name: 'your2026.type.minimalist.name', line: 'your2026.type.minimalist.line' },
  heavyDuty: { name: 'your2026.type.heavyDuty.name', line: 'your2026.type.heavyDuty.line' },
  remixer: { name: 'your2026.type.remixer.name', line: 'your2026.type.remixer.line' },
  measureTwice: {
    name: 'your2026.type.measureTwice.name',
    line: 'your2026.type.measureTwice.line',
  },
  standardIssue: {
    name: 'your2026.type.standardIssue.name',
    line: 'your2026.type.standardIssue.line',
  },
};

export function typeName(t: TFunction, id: YearTypeId): string {
  return t(TYPE_KEYS[id].name);
}

export function typeLine(t: TFunction, id: YearTypeId): string {
  return t(TYPE_KEYS[id].line);
}

function num(values: YearType['values'], key: string): number {
  const value = values[key];
  return typeof value === 'number' ? value : 0;
}

function str(values: YearType['values'], key: string): string {
  const value = values[key];
  return typeof value === 'string' ? value : '';
}

export function typeReason(
  t: TFunction,
  type: YearType,
  locale: string,
  unit: LengthUnit
): string | null {
  const { values } = type;
  const count = num(values, 'count');
  const name = str(values, 'name');
  switch (type.id) {
    case 'compartmentalist':
      return t('your2026.type.compartmentalist.reason', { count, name });
    case 'nightShift':
      return t('your2026.type.nightShift.reason', {
        name,
        time: formatDuration(locale, num(values, 'minutes')),
      });
    case 'spoolEater':
      return t('your2026.type.spoolEater.reason', {
        weight: formatWeight(locale, num(values, 'grams')),
      });
    case 'gapFiller':
      return t('your2026.type.gapFiller.reason', {
        percent: formatPercent(locale, num(values, 'percent') / 100),
      });
    case 'customShop':
      return t('your2026.type.customShop.reason', { count });
    case 'architect':
      return 'areaMm2' in values
        ? t('your2026.type.architect.areaReason', {
            area: formatArea(locale, num(values, 'areaMm2'), unit),
          })
        : t('your2026.type.architect.layersReason', { count });
    case 'smallParts':
      return t('your2026.type.smallParts.reason', { count });
    case 'labelMaker':
      return t('your2026.type.labelMaker.reason', { count });
    case 'minimalist':
      return t('your2026.type.minimalist.reason', { count });
    case 'heavyDuty':
      return t('your2026.type.heavyDuty.reason', { count });
    case 'remixer':
      return t('your2026.type.remixer.reason', { count });
    case 'measureTwice':
      return t('your2026.type.measureTwice.reason', { count, name });
    case 'standardIssue':
      return null;
  }
}
