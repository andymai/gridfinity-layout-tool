import { useState } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { CONSTRAINTS, generateId } from '@/core/constants';
import type { BinItem } from '@/core/types';
import { Button, IconButton, Input, PlusIcon, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';

interface BinItemsEditorProps {
  items?: readonly BinItem[];
  /** Offered as the first item while the bin has none. */
  label: string;
  onChange: (items: BinItem[]) => void;
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
}

function cleanName(name: string): string {
  return name.trim().slice(0, CONSTRAINTS.ITEM_NAME_MAX_LENGTH);
}

/** Blank or unreadable clears the quantity; anything above the cap is held to it. */
function parseQuantity(raw: string): number | undefined {
  const qty = Number.parseInt(raw, 10);
  return Number.isInteger(qty) && qty >= 0 ? Math.min(qty, CONSTRAINTS.ITEM_QTY_MAX) : undefined;
}

/** A field's unsaved text, reset whenever the saved value changes under it (undo, sync). */
function useDraft(saved: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setDraft(saved);
  }
  return [draft, setDraft];
}

function onEnter(commit: () => void) {
  return (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    commit();
  };
}

interface ItemRowProps {
  item: BinItem;
  inputHeight: string;
  isMobile: boolean;
  onRename: (name: string) => void;
  onQuantity: (qty: number | undefined) => void;
  onRemove: () => void;
}

/**
 * Both fields commit on blur or Enter, not per keystroke, so an edit is one
 * undo step. A blank name is refused by the bin update schema, and clearing a
 * name is how a row goes away.
 */
function ItemRow({ item, inputHeight, isMobile, onRename, onQuantity, onRemove }: ItemRowProps) {
  const t = useTranslation();
  const savedQty = item.qty === undefined ? '' : String(item.qty);
  const [name, setName] = useDraft(item.name);
  const [qty, setQty] = useDraft(savedQty);

  const commitName = () => {
    if (cleanName(name) !== item.name) onRename(name);
    else setName(item.name);
  };
  const commitQuantity = () => {
    const next = parseQuantity(qty);
    if (next !== item.qty) onQuantity(next);
    else setQty(savedQty);
  };

  return (
    <li className="flex items-center gap-1.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={onEnter(commitName)}
        maxLength={CONSTRAINTS.ITEM_NAME_MAX_LENGTH}
        aria-label={item.name}
        className={inputHeight}
        wrapperClassName="flex-1 min-w-0"
      />
      <Input
        type="number"
        min={0}
        max={CONSTRAINTS.ITEM_QTY_MAX}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        onBlur={commitQuantity}
        onKeyDown={onEnter(commitQuantity)}
        placeholder={t('inspector.contents.qtyPlaceholder')}
        aria-label={t('inspector.contents.quantity', { name: item.name })}
        className={inputHeight}
        wrapperClassName="w-16 shrink-0"
      />
      <IconButton
        variant="dangerGhost"
        size="sm"
        touchTarget={isMobile}
        type="button"
        onClick={onRemove}
        className="text-content-tertiary"
        aria-label={t('inspector.contents.remove', { name: item.name })}
      >
        <XIcon className="w-3.5 h-3.5" />
      </IconButton>
    </li>
  );
}

/** What a bin holds, for Find: one row per item, plus a line that adds one or a pasted list. */
export function BinItemsEditor({ items = [], label, onChange, variant }: BinItemsEditorProps) {
  const t = useTranslation();
  const [draft, setDraft] = useState('');

  const isMobile = variant === 'mobile';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';
  const room = CONSTRAINTS.ITEMS_PER_BIN_MAX - items.length;
  const offeredLabel = items.length === 0 ? label.trim() : '';

  const add = (names: readonly string[]) => {
    const fresh = names
      .map(cleanName)
      .filter((name) => name !== '')
      .slice(0, room)
      .map((name): BinItem => ({ id: generateId(), name }));
    if (fresh.length > 0) onChange([...items, ...fresh]);
  };

  const rename = (id: string, name: string) => {
    const clean = cleanName(name);
    onChange(
      clean === ''
        ? items.filter((item) => item.id !== id)
        : items.map((item) => (item.id === id ? { ...item, name: clean } : item))
    );
  };

  const setQuantity = (id: string, qty: number | undefined) => {
    onChange(
      items.map((item) => {
        if (item.id !== id) return item;
        const { qty: _previous, ...rest } = item;
        return qty === undefined ? rest : { ...rest, qty };
      })
    );
  };

  const onDraftKeyDown = onEnter(() => {
    add([draft]);
    setDraft('');
  });

  const onDraftPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/\r?\n/.test(text)) return;
    e.preventDefault();
    add(text.split(/\r?\n/));
  };

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={`block ${labelSize} text-content-tertiary`}>
          {t('inspector.contents.title')}
        </span>
        {items.length > 0 && (
          <span className="text-micro text-content-disabled tabular-nums">
            {items.length}/{CONSTRAINTS.ITEMS_PER_BIN_MAX}
          </span>
        )}
      </div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              inputHeight={inputHeight}
              isMobile={isMobile}
              onRename={(name) => rename(item.id, name)}
              onQuantity={(qty) => setQuantity(item.id, qty)}
              onRemove={() => onChange(items.filter((other) => other.id !== item.id))}
            />
          ))}
        </ul>
      )}
      {offeredLabel !== '' && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="mb-1.5"
          leftIcon={<PlusIcon size="sm" />}
          onClick={() => add([offeredLabel])}
        >
          {t('inspector.contents.useLabel', { label: offeredLabel })}
        </Button>
      )}
      {room > 0 ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onDraftKeyDown}
          onPaste={onDraftPaste}
          maxLength={CONSTRAINTS.ITEM_NAME_MAX_LENGTH}
          placeholder={t('inspector.contents.addPlaceholder')}
          aria-label={t('inspector.contents.add')}
          className={inputHeight}
          fullWidth
        />
      ) : (
        <p className="text-micro text-content-tertiary">
          {t('inspector.contents.full', { max: CONSTRAINTS.ITEMS_PER_BIN_MAX })}
        </p>
      )}
    </div>
  );
}
