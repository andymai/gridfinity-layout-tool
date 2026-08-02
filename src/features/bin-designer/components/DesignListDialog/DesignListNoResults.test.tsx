// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesignListNoResults } from './DesignListNoResults';

describe('DesignListNoResults', () => {
  it('interpolates the search query into the empty-results message', () => {
    render(<DesignListNoResults searchQuery="widget" />);
    expect(screen.getByText('No designs match "widget"')).toBeInTheDocument();
  });
});
