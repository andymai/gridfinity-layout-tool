import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsertsSection } from '../../components/parameters/InsertsSection';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import type { Insert } from '../../types';

function makeInsert(overrides: Partial<Insert> = {}): Insert {
  return {
    id: 'test-1',
    templateId: null,
    shape: 'rectangle',
    x: 5,
    y: 5,
    width: 20,
    depth: 30,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    ...overrides,
  };
}

describe('InsertsSection', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, inserts: [] },
    });
  });

  it('renders template browser when no inserts placed', () => {
    render(<InsertsSection />);

    expect(screen.getByText('Templates')).toBeInTheDocument();
    // Should not show the "Placed" header
    expect(screen.queryByText(/Placed/)).not.toBeInTheDocument();
  });

  it('renders placed inserts list when inserts exist', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          makeInsert({ id: '1', label: 'My Drill Bit' }),
          makeInsert({ id: '2', label: 'My Pencil' }),
        ],
      },
    });

    render(<InsertsSection />);

    expect(screen.getByText('Placed (2)')).toBeInTheDocument();
    expect(screen.getByText('My Drill Bit')).toBeInTheDocument();
    expect(screen.getByText('My Pencil')).toBeInTheDocument();
  });

  it('shows shape and dimensions when insert has no label', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ id: '1', label: '', shape: 'circle', width: 15, depth: 15 })],
      },
    });

    render(<InsertsSection />);

    expect(screen.getByText('Circle 15×15')).toBeInTheDocument();
  });

  it('remove button calls removeInsert', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ id: 'remove-me', label: 'Test Insert' })],
      },
    });

    render(<InsertsSection />);

    const removeBtn = screen.getByLabelText('Remove Test Insert');
    fireEvent.click(removeBtn);

    expect(useDesignerStore.getState().params.inserts).toHaveLength(0);
  });

  it('clear all button removes all inserts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          makeInsert({ id: '1' }),
          makeInsert({ id: '2' }),
          makeInsert({ id: '3' }),
        ],
      },
    });

    render(<InsertsSection />);

    const clearBtn = screen.getByLabelText('Remove all inserts');
    fireEvent.click(clearBtn);

    expect(useDesignerStore.getState().params.inserts).toHaveLength(0);
  });

  it('clear all button is not rendered when no inserts', () => {
    render(<InsertsSection />);

    expect(screen.queryByLabelText('Remove all inserts')).not.toBeInTheDocument();
  });

  it('shows dimension info for each insert', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ id: '1', width: 14, depth: 50, label: 'AA Battery' })],
      },
    });

    render(<InsertsSection />);

    expect(screen.getByText('14×50mm')).toBeInTheDocument();
  });
});
