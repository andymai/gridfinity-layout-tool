import { useCallback, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import type {
  BinParams,
  TextAnchor,
  TextMode,
  TextQuarterTurn,
} from '@/features/bin-designer/types';
import { floorTextHostBlock, resolveFloorTextStyle } from '@/features/bin-designer/types';

function unavailableKey(params: BinParams): string | undefined {
  switch (floorTextHostBlock(params)) {
    case 'polygon':
      return 'binDesigner.walls.text.disabledPolygon';
    case 'host':
      return 'binDesigner.floor.text.disabled';
    case null:
      return undefined;
  }
}

export function useFloorTextSection() {
  const t = useTranslation();
  const { params, currentDesignId, setFloorText, setFloorTextStyle, setFloorTextRotation } =
    useDesignerStore(
      useShallow((s) => ({
        params: s.params,
        currentDesignId: s.currentDesignId,
        setFloorText: s.setFloorText,
        setFloorTextStyle: s.setFloorTextStyle,
        setFloorTextRotation: s.setFloorTextRotation,
      }))
    );

  const text = params.surfaceText?.floorText ?? '';
  const hasText = text.trim() !== '';
  const style = resolveFloorTextStyle(params.textDefaults, params.surfaceText);
  const reasonKey = unavailableKey(params);

  const [open, setOpen] = useState(false);
  // Same design-switch reset as the lid caption toggle.
  const [openDesignId, setOpenDesignId] = useState(currentDesignId);
  if (openDesignId !== currentDesignId) {
    setOpenDesignId(currentDesignId);
    setOpen(false);
  }
  const isOpen = open || hasText;

  const toggle = useCallback(() => {
    if (isOpen) {
      setFloorText('');
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isOpen, setFloorText]);

  const commitText = useCallback(
    (_id: number, value: string) => setFloorText(value),
    [setFloorText]
  );

  const floorStyle = params.surfaceText?.floorStyle;
  const setMode = useCallback(
    (mode: TextMode) => {
      if (mode !== style.mode) setFloorTextStyle({ ...floorStyle, mode });
    },
    [floorStyle, style.mode, setFloorTextStyle]
  );
  const setAnchor = useCallback(
    (anchor: TextAnchor) => {
      if (anchor !== style.anchor) setFloorTextStyle({ ...floorStyle, anchor });
    },
    [floorStyle, style.anchor, setFloorTextStyle]
  );

  return {
    t,
    state: {
      text,
      hasText,
      isOpen,
      mode: style.mode,
      anchor: style.anchor,
      rotation: params.surfaceText?.floorTextRotation ?? 0,
      disabledReason: reasonKey !== undefined ? t(reasonKey) : undefined,
    },
    handlers: {
      toggle,
      commitText,
      setMode,
      setAnchor,
      setRotation: (rotation: TextQuarterTurn) => setFloorTextRotation(rotation),
    },
  };
}
