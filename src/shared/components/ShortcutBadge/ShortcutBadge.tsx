import { Kbd, isMacPlatform } from '@/design-system';

interface ShortcutBadgeProps {
  keys: string | readonly string[];
  modifier?: boolean;
  shift?: boolean;
  className?: string;
}

const SEPARATOR = '+';

export function ShortcutBadge({ keys, modifier, shift, className = '' }: ShortcutBadgeProps) {
  const keyList = typeof keys === 'string' ? keys.split(' / ') : keys;
  const modifierKey = isMacPlatform() ? '⌘' : 'Ctrl';

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {modifier && (
        <>
          <Kbd variant="keycap">{modifierKey}</Kbd>
          <span className="text-content-tertiary text-micro">{SEPARATOR}</span>
        </>
      )}
      {shift && (
        <>
          <Kbd variant="keycap">Shift</Kbd>
          <span className="text-content-tertiary text-micro">{SEPARATOR}</span>
        </>
      )}
      {keyList.map((key, index) => (
        <span key={`${key}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span className="text-content-tertiary text-micro mx-0.5">/</span>}
          <Kbd variant="keycap">{key}</Kbd>
        </span>
      ))}
    </div>
  );
}
