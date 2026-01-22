# Bin Designer Documentation

This folder contains the planning documentation for the **Bin Designer** feature - a standalone parametric bin generator for Gridfinity.

## Vision

Create a dedicated Bin Designer at `/designer` that empowers users to create custom parametric Gridfinity bins, then seamlessly integrate them with the Layout Planner for complete drawer organization workflows.

---

## Documents

| Document | Description |
|----------|-------------|
| [BIN-DESIGNER-PRD.md](./BIN-DESIGNER-PRD.md) | **Product Requirements** - 10 epics, user stories, insert templates, success metrics |
| [BIN-DESIGNER-ARCHITECTURE.md](./BIN-DESIGNER-ARCHITECTURE.md) | **System Architecture** - replicad integration, Web Worker pipeline, storage design |
| [BIN-DESIGNER-DRD.md](./BIN-DESIGNER-DRD.md) | **Design Requirements** - UI layouts, component specs, accessibility |
| [BIN-DESIGNER-IMPLEMENTATION.md](./BIN-DESIGNER-IMPLEMENTATION.md) | **Implementation Details** - Gridfinity specs, bin styles, edge cases, testing |

---

## Key Capabilities

- **Full Parametric Control** - Dimensions, dividers, scoops, labels, magnets, base options
- **Insert Templates** - Pre-built cavities for batteries, SD cards, screws, hex keys
- **Multiple Formats** - STL, STEP, and 3MF with print settings
- **Layout Integration** - Auto-sync designs to Layout Planner's bin library
- **Batch Export** - Queue multiple designs for single ZIP download
- **Share Codes** - Share designs via 8-character codes

---

## Technology

- **CAD Engine:** [replicad](https://replicad.xyz) (OpenCascade WASM, ~3MB lazy-loaded)
- **Benefits:** BREP geometry, native STEP export, precise fillets, text embossing
- **Runs in:** Web Worker for non-blocking generation

---

## Status

**📝 Planning Complete** - All documents ready for implementation.

---

## Quick Links

- [User Stories](./BIN-DESIGNER-PRD.md#epics-and-user-stories)
- [Insert Templates](./BIN-DESIGNER-PRD.md#epic-3-insert-templates)
- [replicad Integration](./BIN-DESIGNER-ARCHITECTURE.md#technology-choice-replicad)
- [UI Layouts](./BIN-DESIGNER-DRD.md#layout-specifications)
- [Gridfinity Dimensions](./BIN-DESIGNER-IMPLEMENTATION.md#gridfinity-specification-reference)
- [Bin Style Specs](./BIN-DESIGNER-IMPLEMENTATION.md#bin-style-specifications)
- [Testing Strategy](./BIN-DESIGNER-IMPLEMENTATION.md#testing-strategy)

---

## For AI Agents

When implementing this feature:

1. **Read IMPLEMENTATION.md first** - Contains exact dimensions, edge cases, testing requirements
2. **Use replicad** - Not JSCAD (see architecture doc for reasoning)
3. **Use gridfinity-rebuilt params** - Match [Kennetek's gridfinity-rebuilt](https://github.com/kennetek/gridfinity-rebuilt-openscad)
4. **Follow existing patterns** - Match Layout Planner's Zustand stores, feature directory structure
5. **Prioritize electronics templates** - AA/AAA batteries, SD cards are most requested
6. **Test with real WASM** - Use actual replicad in Vitest, not mocks

### Key Integration Points

- `src/features/bin-designer/` - New feature module
- `src/features/generation/` - Shared CAD engine
- `src/core/storage/DesignerStorage.ts` - Separate IndexedDB
- `api/share.ts` - Extend for `type: 'designer'` payloads

### Key Decisions (see IMPLEMENTATION.md)

- **Bin styles:** Standard, Lite, Solid, Vase, Rugged (fully documented)
- **Fonts:** User choice of Inter, JetBrains Mono, Archivo Black
- **3MF:** Minimal metadata, let slicer handle settings
- **Errors:** Show error + last good mesh
- **Auto-save:** Always (like Google Docs)
- **Inserts on resize:** Scale proportionally
- **Wall cutouts:** Minimum 20% height
- **Integration:** Full bidirectional with Layout Planner
