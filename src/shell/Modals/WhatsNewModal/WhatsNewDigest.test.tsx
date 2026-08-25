import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DigestList } from './WhatsNewDigest';
import type { WhatsNewEntry } from '@/features/whats-new';

vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string) => key,
  useCurrentLocale: () => 'en' as const,
}));

function entry(id: string, overrides: Partial<WhatsNewEntry> = {}): WhatsNewEntry {
  return { id, date: '2026-08-24', title: { en: id }, body: { en: `${id} body` }, ...overrides };
}

function renderList(props: Partial<Parameters<typeof DigestList>[0]> = {}) {
  const onSeeAll = vi.fn();
  const activate = vi.fn();
  render(
    <DigestList
      headline={null}
      rest={[]}
      overflow={0}
      activate={activate}
      onSeeAll={onSeeAll}
      {...props}
    />
  );
  return { activate, onSeeAll };
}

describe('DigestList', () => {
  it('says you are up to date when there is nothing to lead with or list', () => {
    renderList();
    expect(screen.getByText('whatsNew.empty')).toBeInTheDocument();
  });

  it('makes a row with a destination activatable as a whole', async () => {
    const user = userEvent.setup();
    const target = entry('goes-somewhere', { action: { kind: 'openTool', tool: 'designer' } });
    const { activate } = renderList({ rest: [target] });

    // The chevron alone would not name the destination, so the row carries it.
    const row = screen.getByRole('button', { name: /whatsNew.action.openTool.designer/ });
    await user.click(row);
    expect(activate).toHaveBeenCalledWith(target);
  });

  it('leaves a row with nowhere to go inert', () => {
    renderList({ rest: [entry('static')] });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('heads the new section differently once an entry is promoted', () => {
    renderList({ headline: entry('lead', { featured: true }), rest: [entry('other')] });
    expect(screen.getByRole('heading', { name: 'whatsNew.sectionAlsoNew' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'whatsNew.kind.new' })).not.toBeInTheDocument();
  });

  it('names the new section plainly when nothing is promoted', () => {
    renderList({ rest: [entry('other')] });
    expect(screen.getByRole('heading', { name: 'whatsNew.kind.new' })).toBeInTheDocument();
  });
});
