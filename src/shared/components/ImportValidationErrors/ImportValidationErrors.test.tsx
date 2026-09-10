import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ImportValidationErrors } from './ImportValidationErrors';

vi.mock('@/i18n', async () => await import('@/test/mocks/i18nEcho'));
vi.mock('@/shared/components/SchemaDocsLink', () => ({
  SchemaDocsLink: () => <a href="#schema">schema</a>,
}));

describe('ImportValidationErrors', () => {
  it('renders nothing without errors', () => {
    const { container } = render(<ImportValidationErrors errors={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every error under the heading with the schema link', () => {
    render(<ImportValidationErrors errors={['too wide', 'no layers']} />);
    expect(screen.getByText('layouts.validationErrors')).toBeInTheDocument();
    expect(screen.getByText('• too wide')).toBeInTheDocument();
    expect(screen.getByText('• no layers')).toBeInTheDocument();
    expect(screen.getByText('schema')).toBeInTheDocument();
  });
});
