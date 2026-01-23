import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InsertFloorPlan } from '../../components/parameters/InsertFloorPlan';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import type { Insert } from '../../types';

function makeInsert(overrides: Partial<Insert> = {}): Insert {
  return {
    id: 'fp-1',
    templateId: null,
    shape: 'rectangle',
    x: 10,
    y: 10,
    width: 20,
    depth: 20,
    cutDepth: 10,
    rotation: 0,
    cornerRadius: 0,
    label: 'Test',
    ...overrides,
  };
}

describe('InsertFloorPlan', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, inserts: [] },
    });
  });

  it('shows empty state when no inserts exist', () => {
    render(<InsertFloorPlan />);
    expect(screen.getByText(/add a template below/i)).toBeInTheDocument();
    // Should not render the interactive floor plan SVG
    expect(screen.queryByRole('img', { name: /floor plan/i })).not.toBeInTheDocument();
  });

  it('renders SVG floor plan when inserts exist', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert()],
      },
    });

    render(<InsertFloorPlan />);
    expect(screen.getByLabelText('Insert floor plan')).toBeInTheDocument();
  });

  it('renders rectangle insert as rect element', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ shape: 'rectangle', label: 'My Rect' })],
      },
    });

    render(<InsertFloorPlan />);
    const shape = screen.getByLabelText('My Rect insert');
    expect(shape.tagName.toLowerCase()).toBe('rect');
  });

  it('renders circle insert as ellipse element', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ shape: 'circle', label: 'My Circle' })],
      },
    });

    render(<InsertFloorPlan />);
    const shape = screen.getByLabelText('My Circle insert');
    expect(shape.tagName.toLowerCase()).toBe('ellipse');
  });

  it('renders hexagon insert as polygon element', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ shape: 'hexagon', label: 'My Hex' })],
      },
    });

    render(<InsertFloorPlan />);
    const shape = screen.getByLabelText('My Hex insert');
    expect(shape.tagName.toLowerCase()).toBe('polygon');
  });

  it('renders rounded-rect insert with rx attribute', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ shape: 'rounded-rect', cornerRadius: 3, label: 'Rounded' })],
      },
    });

    render(<InsertFloorPlan />);
    const shape = screen.getByLabelText('Rounded insert');
    expect(shape.tagName.toLowerCase()).toBe('rect');
    // rx should be > 0 (corner radius scaled)
    const rx = parseFloat(shape.getAttribute('rx') ?? '0');
    expect(rx).toBeGreaterThan(0);
  });

  it('shows help text when an insert is selected', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ label: 'Selectable' })],
      },
    });

    render(<InsertFloorPlan />);

    // Click the insert to select it
    const shape = screen.getByLabelText('Selectable insert');
    fireEvent.mouseDown(shape);
    fireEvent.mouseUp(screen.getByLabelText('Insert floor plan'));

    expect(screen.getByText(/Drag to move/)).toBeInTheDocument();
  });

  it('deselects when clicking background', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ label: 'Clickable' })],
      },
    });

    render(<InsertFloorPlan />);

    // Select the insert
    const shape = screen.getByLabelText('Clickable insert');
    fireEvent.mouseDown(shape);
    fireEvent.mouseUp(screen.getByLabelText('Insert floor plan'));

    expect(screen.getByText(/Drag to move/)).toBeInTheDocument();

    // MouseDown on background to start box selection (clears selection)
    const svg = screen.getByLabelText('Insert floor plan');
    fireEvent.mouseDown(svg, { target: svg });
    fireEvent.mouseUp(svg);
    expect(screen.queryByText(/Drag to move/)).not.toBeInTheDocument();
  });

  it('updates insert position on drag', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ id: 'drag-me', x: 10, y: 10, label: 'Draggable' })],
      },
    });

    render(<InsertFloorPlan />);

    const shape = screen.getByLabelText('Draggable insert');
    const svg = screen.getByLabelText('Insert floor plan');

    // Simulate drag: mouse down, move, up
    fireEvent.mouseDown(shape, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(svg, { clientX: 120, clientY: 80 });
    fireEvent.mouseUp(svg);

    // Position should have changed
    const insert = useDesignerStore.getState().params.inserts[0];
    // The exact values depend on scale, but they should differ from original
    expect(insert.x !== 10 || insert.y !== 10).toBe(true);
  });

  it('renders multiple inserts', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [
          makeInsert({ id: '1', label: 'First' }),
          makeInsert({ id: '2', label: 'Second', shape: 'circle' }),
        ],
      },
    });

    render(<InsertFloorPlan />);

    expect(screen.getByLabelText('First insert')).toBeInTheDocument();
    expect(screen.getByLabelText('Second insert')).toBeInTheDocument();
  });

  it('uses shape name as label fallback', () => {
    useDesignerStore.setState({
      params: {
        ...DEFAULT_BIN_PARAMS,
        inserts: [makeInsert({ label: '', shape: 'hexagon' })],
      },
    });

    render(<InsertFloorPlan />);

    expect(screen.getByLabelText('hexagon insert')).toBeInTheDocument();
  });
});
