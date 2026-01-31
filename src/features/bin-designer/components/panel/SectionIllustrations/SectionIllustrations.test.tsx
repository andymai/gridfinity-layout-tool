import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  DimensionsIcon,
  BaseIcon,
  InteriorIcon,
  WallsIcon,
  LabelTabsIcon,
  InsertsIcon,
} from './SectionIllustrations';

describe('SectionIllustrations', () => {
  it('renders DimensionsIcon without crashing', () => {
    const { container } = render(<DimensionsIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders BaseIcon without crashing', () => {
    const { container } = render(<BaseIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders InteriorIcon without crashing', () => {
    const { container } = render(<InteriorIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders WallsIcon without crashing', () => {
    const { container } = render(<WallsIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders LabelTabsIcon without crashing', () => {
    const { container } = render(<LabelTabsIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders InsertsIcon without crashing', () => {
    const { container } = render(<InsertsIcon />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
