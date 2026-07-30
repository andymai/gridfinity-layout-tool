import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StepperField } from './StepperField';

describe('StepperField', () => {
  it('renders the label with an inline unit', () => {
    render(
      <StepperField
        label="Height"
        unit="mm"
        value={5}
        onStep={() => {}}
        min={0}
        max={10}
        aria-label="Height"
      />
    );
    expect(screen.getByText('Height')).toBeDefined();
    expect(screen.getByText('(mm)')).toBeDefined();
  });

  it('omits the unit suffix when no unit is given', () => {
    render(
      <StepperField label="Count" value={1} onStep={() => {}} min={1} max={5} aria-label="Count" />
    );
    expect(screen.getByText('Count')).toBeDefined();
    expect(screen.queryByText(/\(/)).toBeNull();
  });
});
