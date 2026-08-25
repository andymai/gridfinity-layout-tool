import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantLock } from './VariantLock';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));

describe('VariantLock', () => {
  it('renders children untouched when nothing is locked', () => {
    const { container } = render(
      <VariantLock locked={false} parentName="Router Bit Holder">
        <button type="button">edit me</button>
      </VariantLock>
    );

    expect(screen.getByText('edit me')).toBeInTheDocument();
    // No wrapper at all, so an unlocked surface keeps its own layout.
    expect(container.querySelector('[inert]')).toBeNull();
  });

  it('says where the values come from when locked', () => {
    render(
      <VariantLock locked parentName="Router Bit Holder">
        <button type="button">edit me</button>
      </VariantLock>
    );

    expect(screen.getByText('binDesigner.variants.lockedHere')).toBeInTheDocument();
  });

  // `inert` alone leaves the controls looking completely ordinary, so the
  // surface reads as broken rather than deliberate.
  it('marks the locked content inert and visibly dimmed', () => {
    const { container } = render(
      <VariantLock locked parentName="Router Bit Holder">
        <button type="button">edit me</button>
      </VariantLock>
    );

    const guarded = container.querySelector('[inert]');
    expect(guarded).not.toBeNull();
    expect(guarded?.className).toContain('opacity-55');
    expect(guarded?.contains(screen.getByText('edit me'))).toBe(true);
  });

  // The note is outside the inert subtree, so the way out stays reachable.
  it('keeps the escape hatch operable', () => {
    const onOpenParent = vi.fn();
    render(
      <VariantLock locked parentName="Router Bit Holder" onOpenParent={onOpenParent}>
        <button type="button">edit me</button>
      </VariantLock>
    );

    const openParent = screen.getByText('binDesigner.variants.openParent');
    expect(openParent.closest('[inert]')).toBeNull();
    fireEvent.click(openParent);
    expect(onOpenParent).toHaveBeenCalledTimes(1);
  });

  it('omits the escape hatch when there is nowhere to go', () => {
    render(
      <VariantLock locked parentName="Router Bit Holder">
        <button type="button">edit me</button>
      </VariantLock>
    );

    expect(screen.queryByText('binDesigner.variants.openParent')).toBeNull();
  });
});
