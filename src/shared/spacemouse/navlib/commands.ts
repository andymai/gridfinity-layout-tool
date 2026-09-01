import type { NavlibActionNode, NavlibConstructor } from './tdxTypes';
import { NAVLIB_COMMANDS } from './types';

/** The action-set id; "Default" tells the driver not to show a set label. */
const ACTIVE_SET = 'Default';

/**
 * Build the command tree exposed to 3DxWare so a puck's buttons can be bound to
 * our view commands in the standard 3Dconnexion control panel. Takes the loaded
 * library constructor (its command classes are statics) rather than importing it,
 * so this stays free of the lib's eager global side effects.
 */
export function buildCommandTree(ctor: NavlibConstructor): {
  activeSet: string;
  tree: NavlibActionNode;
} {
  const tree = new ctor.ActionTree();
  const set = tree.push(new ctor.ActionSet(ACTIVE_SET, 'Gridfinity Layout Tool'));
  const category = set.push(new ctor.Category('GFLT_CAT_VIEW', 'View'));
  for (const c of NAVLIB_COMMANDS) {
    category.push(new ctor.Action(c.id, c.label, c.description));
  }
  return { activeSet: ACTIVE_SET, tree };
}
