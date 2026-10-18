import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlantTooLargeNotice } from './SlantTooLargeNotice';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('SlantTooLargeNotice', () => {
  it('names the bed inline and keeps the remedy behind the info dot', () => {
    render(<SlantTooLargeNotice width={256} depth={256} />);
    expect(screen.getByText(/binDesigner\.printFit\.slantTooLarge/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'binDesigner.infoButton' })).toBeInTheDocument();
  });
});
