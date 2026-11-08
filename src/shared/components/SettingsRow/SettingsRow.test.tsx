import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsRow } from './SettingsRow';

describe('SettingsRow', () => {
  it('renders label text', () => {
    render(
      <SettingsRow label="Grid Width">
        <input />
      </SettingsRow>
    );
    expect(screen.getByText('Grid Width')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <SettingsRow label="Test">
        <input data-testid="child" />
      </SettingsRow>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders unit suffix', () => {
    render(
      <SettingsRow label="Size" unit="mm">
        <input />
      </SettingsRow>
    );
    expect(screen.getByText('mm')).toBeInTheDocument();
  });

  it('renders label element when htmlFor provided', () => {
    render(
      <SettingsRow label="Width" htmlFor="width-input">
        <input id="width-input" />
      </SettingsRow>
    );
    const label = screen.getByText('Width');
    expect(label.tagName).toBe('LABEL');
    expect(label).toHaveAttribute('for', 'width-input');
  });

  it('renders span when htmlFor not provided', () => {
    render(
      <SettingsRow label="Width">
        <input />
      </SettingsRow>
    );
    const label = screen.getByText('Width');
    expect(label.tagName).toBe('SPAN');
  });

  it('keeps the explanation behind an info dot beside the label', () => {
    render(
      <SettingsRow label="Grid" info="Size of grid">
        <input />
      </SettingsRow>
    );
    expect(screen.getByText('Grid')).not.toHaveAttribute('title');
    expect(screen.queryByText('Size of grid')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Grid/ }));
    expect(screen.getByText('Size of grid')).toBeInTheDocument();
  });
});
