import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

  it('sets title attribute when tooltip provided', () => {
    render(
      <SettingsRow label="Grid" tooltip="Size of grid">
        <input />
      </SettingsRow>
    );
    expect(screen.getByText('Grid')).toHaveAttribute('title', 'Size of grid');
  });
});
