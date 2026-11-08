import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LabelInfo } from './LabelInfo';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('LabelInfo', () => {
  it('keeps the explanation hidden until the dot is opened', async () => {
    render(<LabelInfo label="Hole diameter">Clearance for the shaft.</LabelInfo>);
    expect(screen.queryByText('Clearance for the shaft.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'common.aboutLabel' }));
    expect(screen.getByText('Clearance for the shaft.')).toBeInTheDocument();
  });
});
