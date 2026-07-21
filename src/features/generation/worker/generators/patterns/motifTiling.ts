/**
 * Pure tiling for motif patterns: place a unit cell across a wall panel.
 *
 * Emits cell-origin positions (centered on the panel), with an optional
 * odd-row horizontal stagger. The builder layer stamps the cell's outlines at
 * each origin. Pure-math module — no brepjs imports.
 */

import type { MotifCell } from './types';

/** Origin (center) of one tiled cell, in panel-centered coordinates (mm). */
export interface MotifTile {
  readonly x: number;
  readonly y: number;
}

/**
 * Tile a motif cell across a panel of size panelW × panelH, keeping every cell
 * fully within the panel bounds. Returns [] if a single cell doesn't fit.
 */
export function tileMotifCells(cell: MotifCell, panelW: number, panelH: number): MotifTile[] {
  const { cellW, cellH } = cell;
  const rowOffset = cell.rowOffset ?? 0;
  if (cellW <= 0 || cellH <= 0) return [];

  const maxX = panelW / 2 - cellW / 2;
  const maxY = panelH / 2 - cellH / 2;
  if (maxX < 0 || maxY < 0) return [];

  const tiles: MotifTile[] = [];
  const startRow = Math.ceil(-maxY / cellH);
  const endRow = Math.floor(maxY / cellH);
  for (let row = startRow; row <= endRow; row++) {
    const y = row * cellH;
    const xOffset = (row & 1) === 1 ? rowOffset : 0;
    const startCol = Math.ceil((-maxX - xOffset) / cellW);
    const endCol = Math.floor((maxX - xOffset) / cellW);
    for (let col = startCol; col <= endCol; col++) {
      tiles.push({ x: col * cellW + xOffset, y });
    }
  }
  return tiles;
}
