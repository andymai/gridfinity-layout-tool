import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TopRuler, LeftRuler, RulerCorner } from './Rulers';

describe('Rulers', () => {
  describe('TopRuler', () => {
    it('renders an SVG element', () => {
      const { container } = render(
        <TopRuler extent={40} scale={5} zoom={1} panOffset={0} length={200} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders tick marks', () => {
      const { container } = render(
        <TopRuler extent={40} scale={5} zoom={1} panOffset={0} length={200} />
      );

      const lines = container.querySelectorAll('line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('LeftRuler', () => {
    it('renders an SVG element', () => {
      const { container } = render(
        <LeftRuler extent={40} scale={5} zoom={1} panOffset={0} length={200} />
      );

      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders tick marks', () => {
      const { container } = render(
        <LeftRuler extent={40} scale={5} zoom={1} panOffset={0} length={200} />
      );

      const lines = container.querySelectorAll('line');
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('RulerCorner', () => {
    it('renders a div element', () => {
      const { container } = render(<RulerCorner />);

      const div = container.firstChild as HTMLElement;
      expect(div).toBeInTheDocument();
      expect(div.tagName).toBe('DIV');
    });

    it('has cursor-pointer class', () => {
      const { container } = render(<RulerCorner />);

      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('cursor-pointer');
    });
  });
});
