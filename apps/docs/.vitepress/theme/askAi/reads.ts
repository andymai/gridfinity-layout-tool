import {
  READER_TOOL_NAMES,
  formatMyLayouts,
  formatMySettings,
  formatReadMyLayout,
} from '@/agent/contract';
import type {
  MyLayoutsData,
  MySettingsData,
  ReadMyLayoutData,
  ReaderToolName,
} from '@/agent/contract';
import { runReaderTool } from '@/agent/reader/readers';
import type { ReaderSource } from '@/agent/reader/readers';
import { readLayout, readLibraryIndex, readPrinterSettings } from '@/core/storage/readOnly';

/** One read that the reader can allow, with exactly what Allow would send. */
export interface ReaderCall {
  readonly id: string;
  readonly title: string;
  /** The text that the model would read, shown in the panel before the reader allows it. */
  readonly preview: string | null;
  readonly data: unknown;
  readonly unavailable: boolean;
}

const source: ReaderSource = {
  library: readLibraryIndex,
  layout: readLayout,
  settings: () => Promise.resolve(readPrinterSettings()),
};

const isReaderTool = (name: string): name is ReaderToolName =>
  (READER_TOOL_NAMES as readonly string[]).includes(name);

function shown(name: ReaderToolName, data: unknown): { title: string; preview: string } {
  if (name === 'list_my_layouts') {
    const list = data as MyLayoutsData;
    return { title: `Your saved layouts (${list.total})`, preview: formatMyLayouts(list) };
  }
  if (name === 'read_my_layout') {
    const read = data as ReadMyLayoutData;
    return {
      title: read.layout ? `Your layout “${read.layout.name}”` : 'A layout you do not have',
      preview: formatReadMyLayout(read),
    };
  }
  return { title: 'Your printer settings', preview: formatMySettings(data as MySettingsData) };
}

/** Runs a read in this browser, before the reader decides, so the panel can show what it shares. */
export async function prepareRead(call: {
  readonly id: string;
  readonly name: string;
  readonly input: unknown;
}): Promise<ReaderCall> {
  const unavailable = {
    id: call.id,
    title: 'Your data',
    preview: null,
    data: null,
    unavailable: true,
  };
  if (!isReaderTool(call.name)) return unavailable;
  try {
    const run = await runReaderTool(source, call.name, call.input);
    if (!run.ok) return unavailable;
    return { id: call.id, ...shown(call.name, run.data), data: run.data, unavailable: false };
  } catch {
    return unavailable;
  }
}
