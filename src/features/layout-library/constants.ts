export interface DrawerPreset {
  id: string;
  labelKey: string;
  drawer: { width: number; depth: number; height: number };
}

export const DRAWER_PRESETS: DrawerPreset[] = [
  {
    id: 'ikea-alex',
    labelKey: 'presets.ikeaAlex',
    drawer: { width: 7, depth: 12, height: 6 },
  },
  {
    id: 'ikea-helmer',
    labelKey: 'presets.ikeaHelmer',
    drawer: { width: 6, depth: 8, height: 4 },
  },
  {
    id: 'harbor-freight-44',
    labelKey: 'presets.harborFreight44',
    drawer: { width: 13, depth: 11, height: 8 },
  },
  {
    id: 'small',
    labelKey: 'presets.small',
    drawer: { width: 5, depth: 5, height: 4 },
  },
  {
    id: 'medium',
    labelKey: 'presets.medium',
    drawer: { width: 10, depth: 8, height: 6 },
  },
  {
    id: 'large',
    labelKey: 'presets.large',
    drawer: { width: 15, depth: 12, height: 10 },
  },
];
