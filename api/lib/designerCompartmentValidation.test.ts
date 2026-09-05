import { describe, it, expect } from 'vitest';
import {
  validateDividers,
  validateCellMask,
  validateCompartments,
} from './designerCompartmentValidation.js';
import { CONSTRAINTS, VALID_LABEL_PLATE_ICONS } from './designerValidationConstants.js';

const DIVIDER_HEIGHT_ERROR = `compartments.dividerHeight must be 'auto' or a number 0-${CONSTRAINTS.MAX_LABEL_TAB_HEIGHT}`;

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('validateDividers', () => {
  it('accepts a valid dividers object', () => {
    expect(validateDividers({ x: 2, y: 3, thickness: 1.2 })).toBeNull();
  });

  it('accepts minimum boundary values', () => {
    expect(
      validateDividers({ x: 0, y: 0, thickness: CONSTRAINTS.MIN_DIVIDER_THICKNESS })
    ).toBeNull();
  });

  it('accepts maximum boundary values', () => {
    expect(
      validateDividers({
        x: CONSTRAINTS.MAX_DIVIDERS,
        y: CONSTRAINTS.MAX_DIVIDERS,
        thickness: CONSTRAINTS.MAX_DIVIDER_THICKNESS,
      })
    ).toBeNull();
  });

  it('rejects null', () => {
    expect(validateDividers(null)).toBe('dividers must be an object');
  });

  it('rejects an array', () => {
    expect(validateDividers([])).toBe('dividers must be an object');
  });

  it('rejects a string', () => {
    expect(validateDividers('dividers')).toBe('dividers must be an object');
  });

  it('rejects x below 0', () => {
    expect(validateDividers({ x: -1, y: 0, thickness: 1.2 })).toBe(
      `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects x above MAX_DIVIDERS', () => {
    expect(validateDividers({ x: CONSTRAINTS.MAX_DIVIDERS + 1, y: 0, thickness: 1.2 })).toBe(
      `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects non-numeric x', () => {
    expect(validateDividers({ x: '5', y: 0, thickness: 1.2 })).toBe(
      `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects NaN x', () => {
    expect(validateDividers({ x: NaN, y: 0, thickness: 1.2 })).toBe(
      `dividers.x must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects y below 0', () => {
    expect(validateDividers({ x: 0, y: -1, thickness: 1.2 })).toBe(
      `dividers.y must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects y above MAX_DIVIDERS', () => {
    expect(validateDividers({ x: 0, y: CONSTRAINTS.MAX_DIVIDERS + 1, thickness: 1.2 })).toBe(
      `dividers.y must be 0-${CONSTRAINTS.MAX_DIVIDERS}`
    );
  });

  it('rejects thickness below MIN_DIVIDER_THICKNESS', () => {
    expect(validateDividers({ x: 0, y: 0, thickness: 0.5 })).toBe(
      `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`
    );
  });

  it('rejects thickness above MAX_DIVIDER_THICKNESS', () => {
    expect(validateDividers({ x: 0, y: 0, thickness: 3.0 })).toBe(
      `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`
    );
  });

  it('rejects non-numeric thickness', () => {
    expect(validateDividers({ x: 0, y: 0, thickness: 'medium' })).toBe(
      `dividers.thickness must be ${CONSTRAINTS.MIN_DIVIDER_THICKNESS}-${CONSTRAINTS.MAX_DIVIDER_THICKNESS}`
    );
  });
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

describe('validateCellMask', () => {
  it('accepts a structurally valid mask', () => {
    expect(validateCellMask({ cols: 4, rows: 4, cells: new Array(16).fill(1) })).toBeNull();
  });

  it('accepts minimum-dimension mask (1×1)', () => {
    expect(validateCellMask({ cols: 1, rows: 1, cells: [0] })).toBeNull();
  });

  it('accepts maximum-dimension mask', () => {
    expect(
      validateCellMask({
        cols: CONSTRAINTS.MAX_MASK_DIMENSION,
        rows: CONSTRAINTS.MAX_MASK_DIMENSION,
        cells: new Array(CONSTRAINTS.MAX_MASK_DIMENSION ** 2).fill(1),
      })
    ).toBeNull();
  });

  it('accepts mixed 0 and 1 cell values', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: [1, 0, 0, 1] })).toBeNull();
  });

  it('rejects null', () => {
    expect(validateCellMask(null)).toBe('cellMask must be an object');
  });

  it('rejects an array', () => {
    expect(validateCellMask([])).toBe('cellMask must be an object');
  });

  it('rejects cols = 0 (below minimum)', () => {
    expect(validateCellMask({ cols: 0, rows: 2, cells: [] })).toBe(
      `cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects cols above MAX_MASK_DIMENSION', () => {
    expect(
      validateCellMask({
        cols: CONSTRAINTS.MAX_MASK_DIMENSION + 1,
        rows: 2,
        cells: new Array((CONSTRAINTS.MAX_MASK_DIMENSION + 1) * 2).fill(1),
      })
    ).toBe(`cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`);
  });

  it('rejects non-integer cols', () => {
    expect(validateCellMask({ cols: 2.5, rows: 2, cells: new Array(5).fill(1) })).toBe(
      `cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects non-numeric cols', () => {
    expect(validateCellMask({ cols: '4', rows: 2, cells: [] })).toBe(
      `cellMask.cols must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects rows = 0', () => {
    expect(validateCellMask({ cols: 2, rows: 0, cells: [] })).toBe(
      `cellMask.rows must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects rows above MAX_MASK_DIMENSION', () => {
    expect(validateCellMask({ cols: 2, rows: CONSTRAINTS.MAX_MASK_DIMENSION + 1, cells: [] })).toBe(
      `cellMask.rows must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects non-integer rows', () => {
    expect(validateCellMask({ cols: 2, rows: 1.5, cells: [1, 1, 1] })).toBe(
      `cellMask.rows must be integer 1-${CONSTRAINTS.MAX_MASK_DIMENSION}`
    );
  });

  it('rejects cells that is not an array', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: 'data' })).toBe(
      'cellMask.cells must be an array'
    );
  });

  it('rejects cells with wrong length (too short)', () => {
    expect(validateCellMask({ cols: 4, rows: 4, cells: [1, 1, 1] })).toBe(
      'cellMask.cells length must be cols × rows (16)'
    );
  });

  it('rejects cells with wrong length (too long)', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: [1, 0, 1, 0, 1] })).toBe(
      'cellMask.cells length must be cols × rows (4)'
    );
  });

  it('rejects cell value of 2', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: [1, 1, 1, 2] })).toBe(
      'cellMask.cells[3] must be 0 or 1'
    );
  });

  it('rejects negative cell value', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: [-1, 1, 1, 1] })).toBe(
      'cellMask.cells[0] must be 0 or 1'
    );
  });

  it('rejects null cell value', () => {
    expect(validateCellMask({ cols: 2, rows: 2, cells: [1, null, 1, 1] })).toBe(
      'cellMask.cells[1] must be 0 or 1'
    );
  });
});

// ---------------------------------------------------------------------------
// validateCompartments
// ---------------------------------------------------------------------------

function validCompartments() {
  return { cols: 1, rows: 1, thickness: 1.2, cells: [0] };
}

describe('validateCompartments', () => {
  it('accepts a minimal valid compartments object', () => {
    expect(validateCompartments(validCompartments())).toBeNull();
  });

  it('accepts boundary values (max cols/rows, min thickness)', () => {
    expect(
      validateCompartments({
        cols: CONSTRAINTS.MAX_COMPARTMENT_GRID,
        rows: CONSTRAINTS.MAX_COMPARTMENT_GRID,
        thickness: CONSTRAINTS.MIN_COMPARTMENT_THICKNESS,
        cells: new Array(CONSTRAINTS.MAX_COMPARTMENT_GRID ** 2).fill(0),
      })
    ).toBeNull();
  });

  it('rejects null', () => {
    expect(validateCompartments(null)).toBe('compartments must be an object');
  });

  it('rejects an array', () => {
    expect(validateCompartments([])).toBe('compartments must be an object');
  });

  it('rejects cols = 0', () => {
    expect(validateCompartments({ cols: 0, rows: 1, thickness: 1.2, cells: [] })).toBe(
      `compartments.cols must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects cols above MAX_COMPARTMENT_GRID', () => {
    expect(
      validateCompartments({
        cols: CONSTRAINTS.MAX_COMPARTMENT_GRID + 1,
        rows: 1,
        thickness: 1.2,
        cells: [],
      })
    ).toBe(
      `compartments.cols must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects rows = 0', () => {
    expect(validateCompartments({ cols: 1, rows: 0, thickness: 1.2, cells: [] })).toBe(
      `compartments.rows must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects rows above MAX_COMPARTMENT_GRID', () => {
    expect(
      validateCompartments({
        cols: 1,
        rows: CONSTRAINTS.MAX_COMPARTMENT_GRID + 1,
        thickness: 1.2,
        cells: [],
      })
    ).toBe(
      `compartments.rows must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects a fractional cols', () => {
    expect(
      validateCompartments({ cols: 2.5, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3, 4] })
    ).toBe(
      `compartments.cols must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects a fractional rows', () => {
    expect(
      validateCompartments({ cols: 2, rows: 2.5, thickness: 1.2, cells: [0, 1, 2, 3, 4] })
    ).toBe(
      `compartments.rows must be integer ${CONSTRAINTS.MIN_COMPARTMENT_GRID}-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
    );
  });

  it('rejects thickness below MIN_COMPARTMENT_THICKNESS', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 0.3, cells: [0] })).toBe(
      `compartments.thickness must be ${CONSTRAINTS.MIN_COMPARTMENT_THICKNESS}-${CONSTRAINTS.MAX_COMPARTMENT_THICKNESS}`
    );
  });

  it('rejects thickness above MAX_COMPARTMENT_THICKNESS', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 3.0, cells: [0] })).toBe(
      `compartments.thickness must be ${CONSTRAINTS.MIN_COMPARTMENT_THICKNESS}-${CONSTRAINTS.MAX_COMPARTMENT_THICKNESS}`
    );
  });

  it('rejects cells that is not an array', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 1.2, cells: 'none' })).toBe(
      'compartments.cells must be an array'
    );
  });

  it('rejects cells with wrong length', () => {
    expect(validateCompartments({ cols: 2, rows: 2, thickness: 1.2, cells: [0, 1] })).toBe(
      'compartments.cells length must be cols × rows (4)'
    );
  });

  it('rejects fractional cell IDs', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 1.2, cells: [0.5] })).toBe(
      'compartments.cells[0] must be a non-negative integer'
    );
  });

  it('rejects negative cell IDs', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 1.2, cells: [-1] })).toBe(
      'compartments.cells[0] must be a non-negative integer'
    );
  });

  it('rejects string cell IDs', () => {
    expect(validateCompartments({ cols: 1, rows: 1, thickness: 1.2, cells: ['0'] })).toBe(
      'compartments.cells[0] must be a non-negative integer'
    );
  });

  describe('compartmentTexts', () => {
    it('accepts valid compartmentTexts', () => {
      expect(
        validateCompartments({ ...validCompartments(), compartmentTexts: ['SCREWS'] })
      ).toBeNull();
    });

    it('accepts compartmentTexts with exactly 50 chars (boundary)', () => {
      expect(
        validateCompartments({ ...validCompartments(), compartmentTexts: ['x'.repeat(50)] })
      ).toBeNull();
    });

    it('rejects compartmentTexts that is not an array', () => {
      expect(validateCompartments({ ...validCompartments(), compartmentTexts: 'oops' })).toBe(
        'compartments.compartmentTexts must be an array'
      );
    });

    it('rejects compartmentTexts longer than cols × rows', () => {
      // cols=1, rows=1 → max 1 entry
      expect(validateCompartments({ ...validCompartments(), compartmentTexts: ['A', 'B'] })).toBe(
        'compartments.compartmentTexts length must not exceed cols × rows (1)'
      );
    });

    it('rejects non-string compartmentTexts entry', () => {
      expect(validateCompartments({ ...validCompartments(), compartmentTexts: [123] })).toBe(
        'compartments.compartmentTexts[0] must be a string'
      );
    });

    it('rejects compartmentTexts entry exceeding 50 characters', () => {
      expect(
        validateCompartments({ ...validCompartments(), compartmentTexts: ['x'.repeat(51)] })
      ).toBe('compartments.compartmentTexts[0] must not exceed 50 characters');
    });

    it('accepts labelPlateWidths with standard widths and nulls (#2666)', () => {
      expect(validateCompartments({ ...validCompartments(), labelPlateWidths: [2] })).toBeNull();
      expect(validateCompartments({ ...validCompartments(), labelPlateWidths: [null] })).toBeNull();
    });

    it('rejects labelPlateWidths that is not an array', () => {
      expect(validateCompartments({ ...validCompartments(), labelPlateWidths: 2 })).toBe(
        'compartments.labelPlateWidths must be an array'
      );
    });

    it('rejects labelPlateWidths longer than cols × rows', () => {
      expect(validateCompartments({ ...validCompartments(), labelPlateWidths: [1, 2] })).toBe(
        'compartments.labelPlateWidths length must not exceed cols × rows (1)'
      );
    });

    it('rejects a non-standard labelPlateWidths entry', () => {
      for (const bad of [4, 0, 1.5, '2', {}]) {
        expect(validateCompartments({ ...validCompartments(), labelPlateWidths: [bad] })).toBe(
          'compartments.labelPlateWidths[0] must be null or one of: 1, 2, 3'
        );
      }
    });

    it('accepts labelIcons with allowlisted ids and nulls (#2666 follow-up)', () => {
      expect(validateCompartments({ ...validCompartments(), labelIcons: ['bolt'] })).toBeNull();
      expect(validateCompartments({ ...validCompartments(), labelIcons: [null] })).toBeNull();
    });

    it('rejects labelIcons that is not an array', () => {
      expect(validateCompartments({ ...validCompartments(), labelIcons: 'bolt' })).toBe(
        'compartments.labelIcons must be an array'
      );
    });

    it('rejects labelIcons longer than cols × rows', () => {
      expect(validateCompartments({ ...validCompartments(), labelIcons: ['bolt', 'nut'] })).toBe(
        'compartments.labelIcons length must not exceed cols × rows (1)'
      );
    });

    it('rejects an unknown labelIcons entry', () => {
      for (const bad of ['hammer', 2, {}, '']) {
        expect(validateCompartments({ ...validCompartments(), labelIcons: [bad] })).toBe(
          `compartments.labelIcons[0] must be null or one of: ${VALID_LABEL_PLATE_ICONS.join(', ')}`
        );
      }
    });

    // The allowlist is a mirror of the designer's catalogue, and a SUBSET of
    // it does not fail safe: an icon the picker offers but this omits makes
    // the whole design 400 on sync.
    it('accepts every icon the designer can set', () => {
      for (const icon of VALID_LABEL_PLATE_ICONS) {
        expect(
          validateCompartments({ ...validCompartments(), labelIcons: [icon] }),
          icon
        ).toBeNull();
      }
    });
  });

  describe('dividerHeight', () => {
    it('accepts the literal "auto"', () => {
      expect(validateCompartments({ ...validCompartments(), dividerHeight: 'auto' })).toBeNull();
    });

    it('accepts 0 (minimum numeric)', () => {
      expect(validateCompartments({ ...validCompartments(), dividerHeight: 0 })).toBeNull();
    });

    it('accepts the maximum numeric height', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          dividerHeight: CONSTRAINTS.MAX_LABEL_TAB_HEIGHT,
        })
      ).toBeNull();
    });

    it('rejects a negative dividerHeight', () => {
      expect(validateCompartments({ ...validCompartments(), dividerHeight: -1 })).toBe(
        DIVIDER_HEIGHT_ERROR
      );
    });

    it('rejects dividerHeight above the maximum', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          dividerHeight: CONSTRAINTS.MAX_LABEL_TAB_HEIGHT + 1,
        })
      ).toBe(DIVIDER_HEIGHT_ERROR);
    });

    it('rejects an arbitrary non-"auto" string', () => {
      expect(validateCompartments({ ...validCompartments(), dividerHeight: 'manual' })).toBe(
        DIVIDER_HEIGHT_ERROR
      );
    });
  });

  describe('dividerOverrides', () => {
    function adjacentCells() {
      // 1 col × 2 rows → cells [0, 1], IDs 0 and 1 are vertically adjacent
      return { cols: 1, rows: 2, thickness: 1.2, cells: [0, 1] };
    }

    it('accepts a well-formed dividerOverrides array', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: -8 }],
        })
      ).toBeNull();
    });

    it('rejects dividerOverrides that is not an array', () => {
      expect(validateCompartments({ ...adjacentCells(), dividerOverrides: 'bad' })).toBe(
        'compartments.dividerOverrides must be an array'
      );
    });

    it('rejects a non-object entry in dividerOverrides', () => {
      expect(validateCompartments({ ...adjacentCells(), dividerOverrides: ['nope'] })).toBe(
        'compartments.dividerOverrides[0] must be an object'
      );
    });

    it('rejects non-integer compartmentA', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0.5, compartmentB: 1, offsetStart: 0, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0].compartmentA must be a non-negative integer');
    });

    it('rejects negative compartmentB', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0, compartmentB: -1, offsetStart: 0, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0].compartmentB must be a non-negative integer');
    });

    it('rejects unordered pair (compartmentA >= compartmentB)', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 1, compartmentB: 0, offsetStart: 0, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0] must have compartmentA < compartmentB');
    });

    it('rejects override referencing an unknown compartment ID', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0, compartmentB: 99, offsetStart: 0, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0] references unknown compartment ID');
    });

    it('rejects non-adjacent compartment pair', () => {
      // 1 col × 3 rows → [0, 1, 2]; 0 and 2 are not adjacent
      expect(
        validateCompartments({
          cols: 1,
          rows: 3,
          thickness: 1.2,
          cells: [0, 1, 2],
          dividerOverrides: [{ compartmentA: 0, compartmentB: 2, offsetStart: 0, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0] compartments are not adjacent');
    });

    it('rejects offsetStart out of -200..200 range', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 9999, offsetEnd: 0 }],
        })
      ).toBe('compartments.dividerOverrides[0].offsetStart must be -200..200');
    });

    it('rejects offsetEnd out of range', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [{ compartmentA: 0, compartmentB: 1, offsetStart: 0, offsetEnd: -999 }],
        })
      ).toBe('compartments.dividerOverrides[0].offsetEnd must be -200..200');
    });

    it('rejects duplicate compartment pair in dividerOverrides', () => {
      expect(
        validateCompartments({
          ...adjacentCells(),
          dividerOverrides: [
            { compartmentA: 0, compartmentB: 1, offsetStart: 5, offsetEnd: 0 },
            { compartmentA: 0, compartmentB: 1, offsetStart: 10, offsetEnd: 0 },
          ],
        })
      ).toBe('compartments.dividerOverrides has duplicate pair 0|1');
    });

    it('rejects oversized dividerOverrides array', () => {
      // cols=1, rows=2, expectedLength=2 → max 4 entries (2*2)
      const overrides = Array.from({ length: 5 }, () => ({
        compartmentA: 0,
        compartmentB: 1,
        offsetStart: 0,
        offsetEnd: 0,
      }));
      expect(validateCompartments({ ...adjacentCells(), dividerOverrides: overrides })).toBe(
        'compartments.dividerOverrides length is unreasonably large'
      );
    });
  });

  describe('mergeBackground and backgroundIds', () => {
    function merged(extra: Record<string, unknown> = {}) {
      return {
        cols: 2,
        rows: 2,
        thickness: 1.2,
        cells: [0, 1, 1, 1],
        mergeBackground: true,
        backgroundIds: [1],
        ...extra,
      };
    }

    it('accepts markers on existing compartments in merged mode', () => {
      expect(validateCompartments(merged())).toBeNull();
    });

    it('rejects a non-boolean mode', () => {
      expect(validateCompartments(merged({ mergeBackground: 'yes' }))).toBe(
        'compartments.mergeBackground must be a boolean'
      );
    });

    it('rejects markers without the mode that gives them meaning', () => {
      expect(validateCompartments(merged({ mergeBackground: undefined }))).toBe(
        'compartments.backgroundIds requires compartments.mergeBackground'
      );
      expect(validateCompartments(merged({ mergeBackground: false }))).toBe(
        'compartments.backgroundIds requires compartments.mergeBackground'
      );
    });

    it('rejects a marker on an unknown compartment ID', () => {
      expect(validateCompartments(merged({ backgroundIds: [9] }))).toBe(
        'compartments.backgroundIds[0] must reference an existing compartment'
      );
    });

    it('rejects duplicates and malformed entries', () => {
      expect(validateCompartments(merged({ backgroundIds: [1, 1] }))).toBe(
        'compartments.backgroundIds has duplicate ID 1'
      );
      expect(validateCompartments(merged({ backgroundIds: [1.5] }))).toBe(
        'compartments.backgroundIds[0] must be a non-negative integer'
      );
      expect(validateCompartments(merged({ backgroundIds: 'all' }))).toBe(
        'compartments.backgroundIds must be an array'
      );
    });
  });

  describe('drawnUnitCells', () => {
    function fourCells() {
      return { cols: 2, rows: 2, thickness: 1.2, cells: [0, 1, 2, 3] };
    }

    it('accepts markers on 1×1 compartments', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [0, 3] })).toBeNull();
    });

    it('rejects a non-array', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: 'all' })).toBe(
        'compartments.drawnUnitCells must be an array'
      );
    });

    it('rejects an array longer than the cell count', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [0, 1, 2, 3, 0] })).toBe(
        'compartments.drawnUnitCells length must not exceed cols × rows (4)'
      );
    });

    it('rejects fractional, negative, and non-number entries', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [0.5] })).toBe(
        'compartments.drawnUnitCells[0] must be a non-negative integer'
      );
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [-1] })).toBe(
        'compartments.drawnUnitCells[0] must be a non-negative integer'
      );
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: ['0'] })).toBe(
        'compartments.drawnUnitCells[0] must be a non-negative integer'
      );
    });

    it('rejects a marker on an unknown compartment ID', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [9] })).toBe(
        'compartments.drawnUnitCells[0] must reference a 1×1 compartment'
      );
    });

    it('rejects a marker on a multi-cell compartment', () => {
      expect(
        validateCompartments({
          cols: 2,
          rows: 2,
          thickness: 1.2,
          cells: [0, 0, 1, 2],
          drawnUnitCells: [0],
        })
      ).toBe('compartments.drawnUnitCells[0] must reference a 1×1 compartment');
    });

    it('rejects duplicate markers', () => {
      expect(validateCompartments({ ...fourCells(), drawnUnitCells: [1, 1] })).toBe(
        'compartments.drawnUnitCells has duplicate ID 1'
      );
    });
  });

  describe('stash', () => {
    it('accepts a valid stash with and without labels', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [
            { w: 2, h: 1, label: 'screws' },
            { w: 1, h: 1 },
          ],
        })
      ).toBeNull();
    });

    it('accepts exactly MAX_STASH_ENTRIES entries (boundary)', () => {
      const stash = Array.from({ length: CONSTRAINTS.MAX_STASH_ENTRIES }, () => ({ w: 1, h: 1 }));
      expect(validateCompartments({ ...validCompartments(), stash })).toBeNull();
    });

    it('rejects a non-array', () => {
      expect(validateCompartments({ ...validCompartments(), stash: {} })).toBe(
        'compartments.stash must be an array'
      );
    });

    it('rejects more than MAX_STASH_ENTRIES entries', () => {
      const stash = Array.from({ length: CONSTRAINTS.MAX_STASH_ENTRIES + 1 }, () => ({
        w: 1,
        h: 1,
      }));
      expect(validateCompartments({ ...validCompartments(), stash })).toBe(
        `compartments.stash must not exceed ${CONSTRAINTS.MAX_STASH_ENTRIES} entries`
      );
    });

    it('rejects a non-object entry', () => {
      expect(validateCompartments({ ...validCompartments(), stash: [null] })).toBe(
        'compartments.stash[0] must be an object'
      );
    });

    it('rejects w/h outside 1..MAX_COMPARTMENT_GRID or fractional', () => {
      expect(validateCompartments({ ...validCompartments(), stash: [{ w: 0, h: 1 }] })).toBe(
        `compartments.stash[0].w must be integer 1-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
      );
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 1, h: CONSTRAINTS.MAX_COMPARTMENT_GRID + 1 }],
        })
      ).toBe(`compartments.stash[0].h must be integer 1-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`);
      expect(validateCompartments({ ...validCompartments(), stash: [{ w: 1.5, h: 1 }] })).toBe(
        `compartments.stash[0].w must be integer 1-${CONSTRAINTS.MAX_COMPARTMENT_GRID}`
      );
    });

    it('accepts a footprint mask for a merged shape', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 2, cells: [true, true, true, false], label: 'ell' }],
        })
      ).toBeNull();
    });

    it('rejects a non-array mask', () => {
      expect(
        validateCompartments({ ...validCompartments(), stash: [{ w: 2, h: 2, cells: {} }] })
      ).toBe('compartments.stash[0].cells must be an array');
    });

    it('rejects a mask whose length is not w × h', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 2, cells: [true, false, true] }],
        })
      ).toBe('compartments.stash[0].cells length must equal w × h (4)');
    });

    it('rejects a non-boolean mask entry', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 1, cells: [true, 0] }],
        })
      ).toBe('compartments.stash[0].cells[1] must be a boolean');
    });

    it('rejects an empty mask', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 1, cells: [false, false] }],
        })
      ).toBe('compartments.stash[0].cells must fill at least one cell');
    });

    it('rejects an all-filled mask, which must be encoded as an omitted field', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 1, cells: [true, true] }],
        })
      ).toBe('compartments.stash[0].cells must be omitted when every cell is filled');
    });

    it('rejects a mask split into two islands', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 2, cells: [true, false, false, true] }],
        })
      ).toBe('compartments.stash[0].cells must form one connected region');
    });

    it('accepts an L-shaped mask', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 2, h: 2, cells: [true, true, true, false] }],
        })
      ).toBeNull();
    });

    it('rejects a non-string label', () => {
      expect(
        validateCompartments({ ...validCompartments(), stash: [{ w: 1, h: 1, label: 7 }] })
      ).toBe('compartments.stash[0].label must be a string');
    });

    it('accepts a label of exactly 50 chars and rejects 51 (boundary)', () => {
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 1, h: 1, label: 'a'.repeat(50) }],
        })
      ).toBeNull();
      expect(
        validateCompartments({
          ...validCompartments(),
          stash: [{ w: 1, h: 1, label: 'a'.repeat(51) }],
        })
      ).toBe('compartments.stash[0].label must not exceed 50 characters');
    });
  });
});

describe('validateCompartments — shadow-box colours', () => {
  const base = () => ({ cols: 2, rows: 1, thickness: 1.2, cells: [0, 1] });

  it('accepts hex colours and known scopes', () => {
    expect(
      validateCompartments({
        ...base(),
        compartmentColors: ['#f00', null],
        compartmentColorScopes: ['floorAndWalls', null],
      })
    ).toBeNull();
  });

  it('rejects a non-hex colour', () => {
    expect(
      validateCompartments({ ...base(), compartmentColors: ['javascript:alert(1)', null] })
    ).toBe('compartments.compartmentColors[0] must be null or a hex color');
  });

  it('rejects an over-long colour array', () => {
    expect(
      validateCompartments({ ...base(), compartmentColors: ['#f00', '#0f0', '#00f'] })
    ).toContain('must not exceed cols × rows');
  });

  it('rejects an unknown paint scope', () => {
    expect(validateCompartments({ ...base(), compartmentColorScopes: ['everything'] })).toContain(
      'must be null or one of'
    );
  });

  it('rejects non-array values', () => {
    expect(validateCompartments({ ...base(), compartmentColors: '#f00' })).toBe(
      'compartments.compartmentColors must be an array'
    );
    expect(validateCompartments({ ...base(), compartmentColorScopes: 'floor' })).toBe(
      'compartments.compartmentColorScopes must be an array'
    );
  });
});
