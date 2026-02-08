#!/usr/bin/env node
/**
 * Migration script to convert brepjs v4 method-based API to v7 functional API
 */

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node migrate-brepjs-api.js <file-path>');
  process.exit(1);
}

let content = fs.readFileSync(filePath, 'utf8');

// Replace .clone() with clone()
content = content.replace(/(\w+)\.clone\(\)/g, 'clone($1)');

// Replace .translate([...]) with translate(..., [...])
content = content.replace(/(\w+)\.translate\(\[([^\]]+)\]\)/g, 'translate($1, [$2])');

// Replace .translateX(...) with translate(..., [X, 0, 0])
content = content.replace(/(\w+)\.translateX\(([^)]+)\)/g, 'translate($1, [$2, 0, 0])');

// Replace .translateZ(...) with translate(..., [0, 0, Z])
content = content.replace(/(\w+)\.translateZ\(([^)]+)\)/g, 'translate($1, [0, 0, $2])');

// Replace .fuse(...) with unwrap(fuse(..., ...))
content = content.replace(/unwrap\((\w+)\.fuse\(([^)]+)\)\)/g, 'unwrap(fuse($1, $2))');
content = content.replace(/(\w+)\.fuse\(([^)]+)\)/g, 'unwrap(fuse($1, $2))');

// Replace .cut(...) with unwrap(cut(..., ...))
content = content.replace(/(\w+)\.cut\(([^)]+)\)/g, 'unwrap(cut($1, $2))');

// Replace .shell(...) with unwrap(shell(..., ...))
content = content.replace(/unwrap\((\w+)\.shell\(([^)]+)\)\)/g, 'unwrap(shell($1, $2))');
content = content.replace(/(\w+)\.shell\(([^)]+)\)/g, 'unwrap(shell($1, $2))');

// Replace .fillet(...) with unwrap(fillet(..., ...))
content = content.replace(/(\w+)\.fillet\(([^)]+)\)/g, 'unwrap(fillet($1, $2))');

// Replace .blobSTL() with unwrap(exportSTL(...))
content = content.replace(/(\w+)\.blobSTL\(\)/g, 'unwrap(exportSTL($1))');

// Replace .blobSTEP() with unwrap(exportSTEP(...))
content = content.replace(/(\w+)\.blobSTEP\(\)/g, 'unwrap(exportSTEP($1))');

// Replace FnPlane with Plane (if not already done)
content = content.replace(/FnPlane/g, 'Plane');

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✓ Migrated ${filePath}`);
