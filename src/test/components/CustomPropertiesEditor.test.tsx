import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { CustomPropertiesEditor } from '@/features/bin-inspector';
import { CONSTRAINTS } from '@/core/constants';

describe('CustomPropertiesEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders empty state when no properties', () => {
      const { getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      expect(getByText('No custom properties')).toBeInTheDocument();
    });

    it('renders existing properties', () => {
      const { getByText, getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123', Quantity: '5' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      expect(getByText('SKU')).toBeInTheDocument();
      expect(getByText('Quantity')).toBeInTheDocument();
      expect(getByLabelText('Value for SKU')).toHaveValue('ABC123');
      expect(getByLabelText('Value for Quantity')).toHaveValue('5');
    });

    it('shows property count', () => {
      const { getByText } = render(
        <CustomPropertiesEditor
          customProperties={{ key1: 'value1', key2: 'value2' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      expect(getByText('(2)')).toBeInTheDocument();
    });

    it('renders Add button when not at max', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      expect(getByLabelText('Add custom property')).toBeInTheDocument();
    });

    it('disables Add button when at max properties', () => {
      const props: Record<string, string> = {};
      for (let i = 0; i < CONSTRAINTS.CUSTOM_PROPERTY_MAX_COUNT; i++) {
        props[`key${i}`] = `value${i}`;
      }
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={props}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      expect(getByLabelText('Add custom property')).toBeDisabled();
    });
  });

  describe('adding properties', () => {
    it('shows add form when Add button clicked', () => {
      const { getByLabelText, getByPlaceholderText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      expect(getByPlaceholderText(/Property name/)).toBeInTheDocument();
      expect(getByPlaceholderText('Value')).toBeInTheDocument();
    });

    it('adds property with valid key and value', () => {
      const { getByLabelText, getByPlaceholderText, getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'SKU' } });
      fireEvent.change(getByPlaceholderText('Value'), { target: { value: 'ABC123' } });
      fireEvent.click(getByText('Add'));

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: 'ABC123' });
    });

    it('trims key and value when adding', () => {
      const { getByLabelText, getByPlaceholderText, getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: '  SKU  ' } });
      fireEvent.change(getByPlaceholderText('Value'), { target: { value: '  ABC123  ' } });
      fireEvent.click(getByText('Add'));

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: 'ABC123' });
    });

    it('disables Add button when key is empty', () => {
      const { getByLabelText, getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      // Add button should be disabled when key is empty
      const addButton = getByText('Add');
      expect(addButton).toBeDisabled();
    });

    it('disables Add button when value is empty', () => {
      const { getByLabelText, getByPlaceholderText, getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'key' } });
      // Add button should be disabled when value is empty
      const addButton = getByText('Add');
      expect(addButton).toBeDisabled();
    });

    it('shows error for reserved key', () => {
      const { getByLabelText, getByPlaceholderText, getByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'id' } });
      fireEvent.change(getByPlaceholderText('Value'), { target: { value: 'value' } });
      fireEvent.click(getByText('Add'));

      expect(getByText('"id" is a reserved field name')).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('shows error for duplicate key', () => {
      const { getByLabelText, getByText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'existing' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByLabelText('New property name'), { target: { value: 'SKU' } });
      fireEvent.change(getByLabelText('New property value'), { target: { value: 'new value' } });
      fireEvent.click(getByText('Add'));

      expect(getByText('Property name already exists')).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('cancels add form', () => {
      const { getByLabelText, getByPlaceholderText, getByText, queryByPlaceholderText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      expect(getByPlaceholderText(/Property name/)).toBeInTheDocument();

      fireEvent.click(getByText('Cancel'));
      expect(queryByPlaceholderText(/Property name/)).not.toBeInTheDocument();
    });

    it('clears error when typing in key field', () => {
      const { getByLabelText, getByPlaceholderText, getByText, queryByText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      // Enter reserved key and value, then click Add to trigger error
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'id' } });
      fireEvent.change(getByLabelText('New property value'), { target: { value: 'value' } });
      fireEvent.click(getByText('Add'));
      expect(getByText('"id" is a reserved field name')).toBeInTheDocument();

      // Typing in key field should clear the error
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'validKey' } });
      expect(queryByText('"id" is a reserved field name')).not.toBeInTheDocument();
    });
  });

  describe('editing properties', () => {
    it('updates property value', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.change(getByLabelText('Value for SKU'), { target: { value: 'XYZ789' } });

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: 'XYZ789' });
    });

    it('trims value when editing', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.change(getByLabelText('Value for SKU'), { target: { value: '  trimmed  ' } });

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: 'trimmed' });
    });

    it('allows empty value when editing (to clear a field)', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.change(getByLabelText('Value for SKU'), { target: { value: '' } });

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: '' });
    });
  });

  describe('deleting properties', () => {
    it('deletes property when delete button clicked', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123', Quantity: '5' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.click(getByLabelText('Delete SKU'));

      expect(mockOnChange).toHaveBeenCalledWith({ Quantity: '5' });
    });

    it('deletes last property', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'ABC123' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      fireEvent.click(getByLabelText('Delete SKU'));

      expect(mockOnChange).toHaveBeenCalledWith({});
    });
  });

  describe('keyboard interactions', () => {
    it('adds property on Enter key', () => {
      const { getByLabelText, getByPlaceholderText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: 'SKU' } });
      fireEvent.change(getByPlaceholderText('Value'), { target: { value: 'ABC123' } });
      fireEvent.keyDown(getByPlaceholderText('Value'), { key: 'Enter' });

      expect(mockOnChange).toHaveBeenCalledWith({ SKU: 'ABC123' });
    });

    it('cancels on Escape key', () => {
      const { getByLabelText, getByPlaceholderText, queryByPlaceholderText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      fireEvent.keyDown(getByPlaceholderText(/Property name/), { key: 'Escape' });

      expect(queryByPlaceholderText(/Property name/)).not.toBeInTheDocument();
    });
  });

  describe('input length limits', () => {
    it('limits key length', () => {
      const { getByLabelText, getByPlaceholderText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="desktop" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      const longKey = 'a'.repeat(100);
      fireEvent.change(getByPlaceholderText(/Property name/), { target: { value: longKey } });

      expect(
        (getByPlaceholderText(/Property name/) as HTMLInputElement).value.length
      ).toBeLessThanOrEqual(CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH);
    });

    it('limits value length on edit', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor
          customProperties={{ SKU: 'short' }}
          onChange={mockOnChange}
          variant="desktop"
        />
      );
      const longValue = 'a'.repeat(500);
      fireEvent.change(getByLabelText('Value for SKU'), { target: { value: longValue } });

      // The input should truncate the value
      expect(
        (getByLabelText('Value for SKU') as HTMLInputElement).value.length
      ).toBeLessThanOrEqual(CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH);
    });
  });

  describe('mobile variant', () => {
    it('renders with mobile styling', () => {
      const { getByLabelText } = render(
        <CustomPropertiesEditor onChange={mockOnChange} variant="mobile" />
      );
      fireEvent.click(getByLabelText('Add custom property'));
      // Mobile variant should apply different classes but functionality should be same
      expect(getByLabelText('New property name')).toBeInTheDocument();
    });
  });
});
