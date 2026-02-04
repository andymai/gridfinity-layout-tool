/**
 * Tests for the InsertsSection component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsertsSection } from './InsertsSection';

// Test library items (passed as props)
const mockLibraryItems = [
  {
    id: 'template-1',
    name: 'Screwdriver',
    thumbnail: 'data:image/png;base64,test',
    contour: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    boundingBox: { width: 50, height: 100 },
  },
];

// Mock the designer store
const mockAddInsert = vi.fn();
const mockRemoveInsert = vi.fn();
const mockUpdateInsert = vi.fn();
const mockClearInserts = vi.fn();
let mockInserts: unknown[] = [];

vi.mock('@/features/bin-designer/store', () => ({
  useDesignerStore: vi.fn((selector) =>
    selector({
      params: {
        inserts: mockInserts,
        width: 2,
        depth: 2,
        wallThickness: 1.2,
      },
      addInsert: mockAddInsert,
      removeInsert: mockRemoveInsert,
      updateInsert: mockUpdateInsert,
      clearInserts: mockClearInserts,
    })
  ),
}));

// Mock i18n
vi.mock('@/i18n', () => ({
  useTranslation: () => (key: string, params?: Record<string, unknown>) => {
    const translations: Record<string, string> = {
      'binDesigner.floorInserts': 'Floor inserts',
      'binDesigner.addFromLibrary': 'Add from cutout library',
      'binDesigner.selectCutout': 'Select a cutout',
      'binDesigner.noCustomCutouts': 'No cutouts in library',
      'binDesigner.noInserts': 'No inserts added',
      'binDesigner.clearAllInserts': 'Remove all',
      'binDesigner.customShape': 'Custom shape',
      'binDesigner.insertShape.rectangle': 'Rectangle',
      'binDesigner.insertShape.circle': 'Circle',
      'binDesigner.insertShape.rounded-rect': 'Rounded',
      'binDesigner.insertShape.slot': 'Slot',
      'binDesigner.insertX': 'X (mm)',
      'binDesigner.insertY': 'Y (mm)',
      'binDesigner.insertWidth': 'Width',
      'binDesigner.insertDepth': 'Depth',
      'binDesigner.cutDepth': 'Cut depth',
      'binDesigner.rotation': 'Rotation',
      'binDesigner.rotationDegrees': `${params?.degrees}°`,
      'binDesigner.insertsCount': `${params?.count} insert(s)`,
      'common.loading': 'Loading...',
      'common.delete': 'Delete',
    };
    return translations[key] ?? key;
  },
}));

describe('InsertsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInserts = [];
  });

  it('renders the section title', () => {
    render(<InsertsSection />);
    expect(screen.getByText('Floor inserts')).toBeInTheDocument();
  });

  it('shows empty state when no inserts', () => {
    render(<InsertsSection />);
    expect(screen.getByText('No inserts added')).toBeInTheDocument();
  });

  it('shows add from library button', () => {
    render(<InsertsSection />);
    expect(screen.getByText('Add from cutout library')).toBeInTheDocument();
  });

  it('shows primitive shape buttons', () => {
    render(<InsertsSection />);
    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Circle')).toBeInTheDocument();
    expect(screen.getByTitle('Rounded')).toBeInTheDocument();
    expect(screen.getByTitle('Slot')).toBeInTheDocument();
  });

  it('opens library picker when clicking add from library', () => {
    render(<InsertsSection libraryItems={mockLibraryItems} />);

    fireEvent.click(screen.getByText('Add from cutout library'));

    expect(screen.getByText('Select a cutout')).toBeInTheDocument();
    expect(screen.getByText('Screwdriver')).toBeInTheDocument();
  });

  it('adds primitive shape when clicking shape button', () => {
    render(<InsertsSection />);

    fireEvent.click(screen.getByTitle('Rectangle'));

    expect(mockAddInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        shape: 'rectangle',
        width: 15,
        depth: 15,
        cutDepth: 3,
        rotation: 0,
      })
    );
  });

  it('adds insert from library template', async () => {
    render(<InsertsSection libraryItems={mockLibraryItems} />);

    // Open library picker
    fireEvent.click(screen.getByText('Add from cutout library'));

    // Click on template
    fireEvent.click(screen.getByText('Screwdriver'));

    await waitFor(() => {
      expect(mockAddInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          shape: 'custom',
          templateId: 'template-1',
          label: 'Screwdriver',
          contour: mockLibraryItems[0].contour,
        })
      );
    });
  });

  describe('with existing inserts', () => {
    beforeEach(() => {
      mockInserts = [
        {
          id: 'insert-1',
          templateId: null,
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 15,
          depth: 15,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
      ];
    });

    it('displays existing inserts', () => {
      render(<InsertsSection />);
      expect(screen.getByText('Rectangle')).toBeInTheDocument();
    });

    it('selects insert when clicked', () => {
      render(<InsertsSection />);

      fireEvent.click(screen.getByText('Rectangle'));

      // Should show expanded controls
      expect(screen.getByText('X (mm)')).toBeInTheDocument();
      expect(screen.getByText('Y (mm)')).toBeInTheDocument();
    });

    it('deletes insert when clicking delete button', async () => {
      render(<InsertsSection />);

      // First select the insert to show the delete button
      fireEvent.click(screen.getByText('Rectangle'));

      // Find and click delete button
      const deleteButton = screen.getByLabelText('Delete');
      fireEvent.click(deleteButton);

      expect(mockRemoveInsert).toHaveBeenCalledWith('insert-1');
    });
  });

  describe('with multiple inserts', () => {
    beforeEach(() => {
      mockInserts = [
        {
          id: 'insert-1',
          templateId: null,
          shape: 'rectangle',
          x: 10,
          y: 10,
          width: 15,
          depth: 15,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
        {
          id: 'insert-2',
          templateId: null,
          shape: 'circle',
          x: 30,
          y: 30,
          width: 10,
          depth: 10,
          cutDepth: 3,
          rotation: 0,
          cornerRadius: 0,
          label: '',
        },
      ];
    });

    it('shows clear all button when multiple inserts exist', () => {
      render(<InsertsSection />);
      expect(screen.getByText('Remove all')).toBeInTheDocument();
    });

    it('clears all inserts when clicking clear all', () => {
      render(<InsertsSection />);

      fireEvent.click(screen.getByText('Remove all'));

      expect(mockClearInserts).toHaveBeenCalled();
    });
  });
});
