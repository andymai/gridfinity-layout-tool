import {
  PROPOSE_CHANGES,
  READER_TOOL_NAMES,
  formatMyLayouts,
  formatMySettings,
  formatReadMyLayout,
} from '@/agent/contract';
import type {
  MyLayoutsData,
  MySettingsData,
  ProposeChangesData,
  ReadMyLayoutData,
  ReaderToolName,
} from '@/agent/contract';
import type { BrowserCall, PreparedCall } from '@/agent/client/session';
import { appliedChanges, prepareChanges } from '@/agent/reader/changes';
import type { OpenLayout } from '@/agent/reader/changes';
import { runReaderTool } from '@/agent/reader/readers';
import type { ReaderSource } from '@/agent/reader/readers';
import { getUserMessage, isOk, ok } from '@/core/result';
import { readLayout, readPrinterSettings } from '@/core/storage';
import { useLayoutStore, useLibraryStore } from '@/core/store';
import type { Mutations } from '@/shared/contexts';
import type { TFunction } from '@/i18n';

/** The layout that the editor shows, which a change set must name. */
export function openLayout(): OpenLayout | null {
  const { activeLayoutId, layout } = useLayoutStore.getState();
  return activeLayoutId === null ? null : { id: activeLayoutId, layout };
}

// The app's own stores, so a read sees an edit that autosave has not stored yet.
const source: ReaderSource = {
  library: () => Promise.resolve(ok(useLibraryStore.getState().library)),
  layout: (id) => {
    const open = openLayout();
    return open && open.id === id ? Promise.resolve(ok(open.layout)) : readLayout(id);
  },
  settings: () => Promise.resolve(readPrinterSettings()),
};

const isReaderTool = (name: string): name is ReaderToolName =>
  (READER_TOOL_NAMES as readonly string[]).includes(name);

function readTitle(name: ReaderToolName, data: unknown, t: TFunction): string {
  if (name === 'list_my_layouts') {
    return t('askAi.read.layouts', { count: (data as MyLayoutsData).total });
  }
  if (name === 'read_my_layout') {
    const layout = (data as ReadMyLayoutData).layout;
    return layout ? t('askAi.read.layout', { name: layout.name }) : t('askAi.read.noLayout');
  }
  return t('askAi.read.settings');
}

// The panel shows exactly the text that the model would read.
function readPreview(name: ReaderToolName, data: unknown): string {
  if (name === 'list_my_layouts') return formatMyLayouts(data as MyLayoutsData);
  if (name === 'read_my_layout') return formatReadMyLayout(data as ReadMyLayoutData);
  return formatMySettings(data as MySettingsData);
}

/** What a change call carries from the server to the card: the model's own input. */
export interface ChangeCallData {
  readonly input: unknown;
}

const summaryOf = (input: unknown): string => {
  const summary = (input as { summary?: unknown } | null)?.summary;
  return typeof summary === 'string' ? summary : '';
};

async function prepareCall(call: BrowserCall, t: TFunction): Promise<PreparedCall> {
  const unavailable: PreparedCall = {
    id: call.id,
    title: t('askAi.read.unknown'),
    preview: null,
    data: null,
    unavailable: true,
  };
  if (call.name === PROPOSE_CHANGES) {
    const data: ChangeCallData = { input: call.input };
    const change = { ...unavailable, kind: 'change' as const, title: summaryOf(call.input), data };
    const prepared = prepareChanges(openLayout(), call.input);
    if (prepared.kind === 'unavailable') return change;
    // The app refused the set, so the reader has nothing to decide: it goes back at once.
    if (prepared.kind === 'refused')
      return { ...change, unavailable: false, settled: prepared.data };
    return { ...change, unavailable: false };
  }
  if (!isReaderTool(call.name)) return unavailable;
  try {
    const run = await runReaderTool(source, call.name, call.input);
    if (!isOk(run)) return unavailable;
    return {
      id: call.id,
      title: readTitle(call.name, run.value, t),
      preview: readPreview(call.name, run.value),
      data: run.value,
      unavailable: false,
    };
  } catch {
    return unavailable;
  }
}

export function prepareCalls(calls: readonly BrowserCall[], t: TFunction): Promise<PreparedCall[]> {
  return Promise.all(calls.map((call) => prepareCall(call, t)));
}

/**
 * Applies a change that the reader approved, on the layout as it is now: the
 * set runs again first, so an edit since the preview cannot slip past it.
 */
export function applyChange(call: PreparedCall, mutations: Mutations): Promise<ProposeChangesData> {
  const prepared = prepareChanges(openLayout(), (call.data as ChangeCallData | null)?.input);
  if (prepared.kind === 'unavailable') {
    return Promise.reject(new Error('No layout of the reader is open.'));
  }
  if (prepared.kind === 'refused') return Promise.resolve(prepared.data);
  const result = mutations.applyChangeSet(prepared.changeSet);
  if (isOk(result)) return Promise.resolve(appliedChanges(result.value.refs));
  return Promise.resolve({
    outcome: 'refused',
    change: null,
    reason: getUserMessage(result.error).slice(0, 400),
  });
}
