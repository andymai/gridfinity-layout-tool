/**
 * Figma-style compact number input.
 *
 * Features: label on left, editable value on right, arrow key increment,
 * shift+arrow for 10x step, enter to commit, escape to revert.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface CompactNumberInputProps {
  readonly label: string;
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly unit?: string;
  readonly disabled?: boolean;
}

export function CompactNumberInput({
  label,
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 0.5,
  unit,
  disabled = false,
}: CompactNumberInputProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = useCallback((v: number) => Math.max(min, Math.min(max, v)), [min, max]);

  const formatValue = useCallback((v: number) => {
    const rounded = Math.round(v * 100) / 100;
    return rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toString();
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    setEditValue(formatValue(value));
    setEditing(true);
  }, [disabled, value, formatValue]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = useCallback(
    (raw: string) => {
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        onChange(clamp(parsed));
      }
      setEditing(false);
    },
    [onChange, clamp]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        commit(editValue);
      } else if (e.key === 'Escape') {
        setEditing(false);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const increment = e.shiftKey ? step * 10 : step;
        const newVal = clamp(value + increment);
        onChange(newVal);
        setEditValue(formatValue(newVal));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const decrement = e.shiftKey ? step * 10 : step;
        const newVal = clamp(value - decrement);
        onChange(newVal);
        setEditValue(formatValue(newVal));
      }
    },
    [editValue, commit, value, step, clamp, onChange, formatValue]
  );

  return (
    <button
      type="button"
      className={`flex items-center rounded border border-stroke-subtle bg-surface-elevated h-7 text-left ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'
      }`}
      onClick={handleClick}
      disabled={disabled}
    >
      <span className="px-1.5 text-[10px] text-content-tertiary select-none leading-none min-w-[1.5rem]">
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commit(editValue)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 bg-transparent text-right text-xs text-content pr-1 outline-none"
          disabled={disabled}
        />
      ) : (
        <span className="flex-1 text-right text-xs text-content pr-1 tabular-nums select-none">
          {formatValue(value)}
        </span>
      )}
      {unit && <span className="pr-1.5 text-[10px] text-content-disabled select-none">{unit}</span>}
    </button>
  );
}
