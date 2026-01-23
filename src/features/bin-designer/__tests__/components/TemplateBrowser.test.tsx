import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateBrowser } from '../../components/parameters/TemplateBrowser';
import { useDesignerStore } from '../../store';
import { DEFAULT_BIN_PARAMS } from '../../constants';
import { ALL_TEMPLATES, AVAILABLE_CATEGORIES } from '../../templates';

describe('TemplateBrowser', () => {
  beforeEach(() => {
    useDesignerStore.setState({
      params: { ...DEFAULT_BIN_PARAMS, inserts: [] },
    });
  });

  it('shows "All" category tab active by default', () => {
    render(<TemplateBrowser />);

    const allTab = screen.getByRole('tab', { name: 'All' });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays all templates by default', () => {
    render(<TemplateBrowser />);

    // Should render a card for each template
    for (const template of ALL_TEMPLATES) {
      expect(screen.getByLabelText(`Add ${template.name}`)).toBeInTheDocument();
    }
  });

  it('filters templates by category', () => {
    render(<TemplateBrowser />);

    const electronicsTab = screen.getByRole('tab', { name: 'Electronics' });
    fireEvent.click(electronicsTab);

    expect(electronicsTab).toHaveAttribute('aria-selected', 'true');
    // All electronics templates should be visible
    const electronicsTemplates = ALL_TEMPLATES.filter((t) => t.category === 'electronics');
    for (const template of electronicsTemplates) {
      expect(screen.getByLabelText(`Add ${template.name}`)).toBeInTheDocument();
    }
  });

  it('clicking a template card adds an insert to the store', () => {
    render(<TemplateBrowser />);

    const aaButton = screen.getByLabelText('Add AA Battery');
    fireEvent.click(aaButton);

    const inserts = useDesignerStore.getState().params.inserts;
    expect(inserts).toHaveLength(1);
    expect(inserts[0].templateId).toBe('battery-aa');
    expect(inserts[0].label).toBe('AA'); // defaults.label, not template name
    expect(inserts[0].shape).toBe('circle');
  });

  it('sets correct dimensions from template defaults', () => {
    render(<TemplateBrowser />);

    const sdButton = screen.getByLabelText('Add SD Card');
    fireEvent.click(sdButton);

    const inserts = useDesignerStore.getState().params.inserts;
    // SD Card: 24 + 0.5 clearance = 24.5, 32 + 0.5 = 32.5, cutDepth = 4.7
    expect(inserts[0].width).toBe(24.5);
    expect(inserts[0].depth).toBe(32.5);
    expect(inserts[0].cutDepth).toBe(4.7);
  });

  it('auto-positions inserts to avoid overlap', () => {
    render(<TemplateBrowser />);

    // Add two templates
    const aaButton = screen.getByLabelText('Add AA Battery');
    fireEvent.click(aaButton);
    fireEvent.click(aaButton);

    const inserts = useDesignerStore.getState().params.inserts;
    expect(inserts).toHaveLength(2);

    // Second insert should have a different position
    expect(inserts[0].x).not.toBe(inserts[1].x) ;
  });

  it('generates unique IDs for each insert', () => {
    render(<TemplateBrowser />);

    const button = screen.getByLabelText('Add AA Battery');
    fireEvent.click(button);
    fireEvent.click(button);

    const inserts = useDesignerStore.getState().params.inserts;
    expect(inserts[0].id).not.toBe(inserts[1].id);
  });

  it('shows template dimensions in the card', () => {
    render(<TemplateBrowser />);

    // AA Battery: 15×15×51mm
    expect(screen.getByText('15×15×51mm')).toBeInTheDocument();
  });

  it('shows all three category tabs', () => {
    render(<TemplateBrowser />);

    expect(AVAILABLE_CATEGORIES).toContain('electronics');
    expect(AVAILABLE_CATEGORIES).toContain('hardware');
    expect(AVAILABLE_CATEGORIES).toContain('tools');

    expect(screen.getByRole('tab', { name: 'Electronics' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hardware' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tools' })).toBeInTheDocument();
  });

  it('filters to hardware templates', () => {
    render(<TemplateBrowser />);

    fireEvent.click(screen.getByRole('tab', { name: 'Hardware' }));

    // Should show hardware templates
    expect(screen.getByLabelText('Add Hex Key (2.5mm)')).toBeInTheDocument();
    expect(screen.getByLabelText('Add ¼" Driver Bit')).toBeInTheDocument();

    // Should NOT show electronics
    expect(screen.queryByLabelText('Add AA Battery')).not.toBeInTheDocument();
  });

  it('filters to tools templates', () => {
    render(<TemplateBrowser />);

    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));

    expect(screen.getByLabelText('Add Sharpie / Marker')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Utility Knife')).toBeInTheDocument();
    expect(screen.getByLabelText('Add Needle-Nose Pliers')).toBeInTheDocument();

    // Should NOT show hardware
    expect(screen.queryByLabelText('Add Hex Key (2.5mm)')).not.toBeInTheDocument();
  });

  describe('search', () => {
    it('renders search input', () => {
      render(<TemplateBrowser />);
      expect(screen.getByLabelText('Search templates')).toBeInTheDocument();
    });

    it('filters templates by search query', () => {
      render(<TemplateBrowser />);

      const searchInput = screen.getByLabelText('Search templates');
      fireEvent.change(searchInput, { target: { value: 'hex key' } });

      // Should show hex key templates
      expect(screen.getByLabelText('Add Hex Key (2.5mm)')).toBeInTheDocument();
      expect(screen.getByLabelText('Add Hex Key (4mm)')).toBeInTheDocument();

      // Should NOT show unrelated templates
      expect(screen.queryByLabelText('Add AA Battery')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Add Sharpie / Marker')).not.toBeInTheDocument();
    });

    it('search is case-insensitive', () => {
      render(<TemplateBrowser />);

      const searchInput = screen.getByLabelText('Search templates');
      fireEvent.change(searchInput, { target: { value: 'HEX' } });

      // Should find hex-related templates
      expect(screen.getByLabelText('Add Hex Key (2.5mm)')).toBeInTheDocument();
      expect(screen.getByLabelText('Add Hex Key (4mm)')).toBeInTheDocument();
    });

    it('combines search with category filter', () => {
      render(<TemplateBrowser />);

      // Filter to hardware first
      fireEvent.click(screen.getByRole('tab', { name: 'Hardware' }));

      // Then search for "driver"
      const searchInput = screen.getByLabelText('Search templates');
      fireEvent.change(searchInput, { target: { value: 'driver' } });

      // Should show hardware driver bits only
      expect(screen.getByLabelText('Add ¼" Driver Bit')).toBeInTheDocument();

      // Tools/electronics should be hidden even if they'd match
      expect(screen.queryByLabelText('Add AA Battery')).not.toBeInTheDocument();
    });

    it('shows "no results" message when search has no matches', () => {
      render(<TemplateBrowser />);

      const searchInput = screen.getByLabelText('Search templates');
      fireEvent.change(searchInput, { target: { value: 'nonexistent xyz' } });

      expect(screen.getByText(/No templates matching "nonexistent xyz"/)).toBeInTheDocument();
    });

    it('shows result count when filtering', () => {
      render(<TemplateBrowser />);

      fireEvent.click(screen.getByRole('tab', { name: 'Electronics' }));

      const countText = screen.getByText(/of \d+ templates/);
      expect(countText).toBeInTheDocument();
    });

    it('searches template descriptions', () => {
      render(<TemplateBrowser />);

      const searchInput = screen.getByLabelText('Search templates');
      // "standing upright" appears in AA Battery description
      fireEvent.change(searchInput, { target: { value: 'standing upright' } });

      expect(screen.getByLabelText('Add AA Battery')).toBeInTheDocument();
    });
  });

  it('adds hardware template with correct dimensions', () => {
    render(<TemplateBrowser />);

    fireEvent.click(screen.getByRole('tab', { name: 'Hardware' }));
    fireEvent.click(screen.getByLabelText('Add ¼" Driver Bit'));

    const inserts = useDesignerStore.getState().params.inserts;
    expect(inserts).toHaveLength(1);
    expect(inserts[0].shape).toBe('hexagon');
    expect(inserts[0].width).toBe(6.85); // 6.35 + 0.5 clearance
    expect(inserts[0].label).toBe('Bit');
  });

  it('adds tools template with correct dimensions', () => {
    render(<TemplateBrowser />);

    fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
    fireEvent.click(screen.getByLabelText('Add Sharpie / Marker'));

    const inserts = useDesignerStore.getState().params.inserts;
    expect(inserts).toHaveLength(1);
    expect(inserts[0].shape).toBe('circle');
    expect(inserts[0].width).toBe(13); // 12 + 1.0 tools clearance
    expect(inserts[0].label).toBe('Marker');
  });
});
