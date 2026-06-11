export function FractionalEdgeToggle({
  axis,
  label,
  value,
  onChange,
  startTitle,
  startLabel,
  endTitle,
  endLabel,
}: {
  axis: 'x' | 'y';
  label: string;
  value: 'start' | 'end';
  onChange: (axis: 'x' | 'y', position: 'start' | 'end') => void;
  startTitle: string;
  startLabel: string;
  endTitle: string;
  endLabel: string;
}) {
  const activeClass = 'bg-accent text-on-dark';
  const inactiveClass = 'bg-surface-elevated text-content-tertiary hover:bg-surface-hover';

  return (
    <div className="flex items-center justify-between">
      <span className="text-content-tertiary">{label}</span>
      <div className="flex rounded overflow-hidden border border-stroke-subtle">
        <button
          type="button"
          onClick={() => onChange(axis, 'start')}
          aria-pressed={value === 'start'}
          className={`px-2.5 py-1 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            value === 'start' ? activeClass : inactiveClass
          }`}
          title={startTitle}
        >
          {startLabel}
        </button>
        <button
          type="button"
          onClick={() => onChange(axis, 'end')}
          aria-pressed={value === 'end'}
          className={`px-2.5 py-1 text-[10px] border-l border-stroke-subtle transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
            value === 'end' ? activeClass : inactiveClass
          }`}
          title={endTitle}
        >
          {endLabel}
        </button>
      </div>
    </div>
  );
}
