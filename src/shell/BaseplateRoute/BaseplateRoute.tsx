import { BaseplatePage } from '@/features/baseplate';
import { DrawerShapeEditButton } from '@/features/drawer-shape';

/** One feature cannot import another, so the shell hands the baseplate page its shape editor. */
export function BaseplateRoute() {
  return <BaseplatePage shapeEditor={DrawerShapeEditButton} />;
}
