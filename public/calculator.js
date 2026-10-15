/**
 * Gridfinity drawer calculator for the /gridfinity-calculator content page.
 * Standalone vanilla JS (no bundler) so the static page stays CSP-clean
 * (script-src 'self') and loads without the app bundle.
 */
(function () {
  'use strict';

  const GRID_MM = 42;
  const HALF_GRID_MM = 21;
  const HEIGHT_UNIT_MM = 7;
  const BASEPLATE_MM = 5;
  const MAX_GRID_UNITS = 50;
  const MEASURED_MM_MIN = 1;
  const MEASURED_MM_MAX = 5000;

  function $(id) {
    return document.getElementById(id);
  }

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function update() {
    const width = parseFloat($('calc-width').value);
    const depth = parseFloat($('calc-depth').value);
    const height = parseFloat($('calc-height').value);

    const wUnits = width > 0 ? Math.floor(width / GRID_MM) : 0;
    const dUnits = depth > 0 ? Math.floor(depth / GRID_MM) : 0;
    const wHalf = width > 0 ? Math.floor(width / HALF_GRID_MM) / 2 : 0;
    const dHalf = depth > 0 ? Math.floor(depth / HALF_GRID_MM) / 2 : 0;
    const wLeft = width > 0 ? width - wUnits * GRID_MM : 0;
    const dLeft = depth > 0 ? depth - dUnits * GRID_MM : 0;

    $('calc-grid').textContent =
      wUnits > 0 && dUnits > 0 ? wUnits + ' × ' + dUnits : '—';
    $('calc-half').textContent =
      wHalf > 0 && dHalf > 0 ? fmt(wHalf) + ' × ' + fmt(dHalf) : '—';
    $('calc-gap').textContent =
      width > 0 && depth > 0 ? fmt(wLeft) + ' / ' + fmt(dLeft) + ' mm' : '—';

    const hUnits = height > 0 ? Math.floor((height - BASEPLATE_MM) / HEIGHT_UNIT_MM) : 0;
    $('calc-height-units').textContent = hUnits > 0 ? hUnits + 'U (' + hUnits * HEIGHT_UNIT_MM + ' mm)' : '—';

    updateDrawerLinks(width, depth, height);
  }

  // Mirrors what parseDrawerLink/buildDrawerLinkLayout accept in the app;
  // outside it the buttons fall back to opening the plain tool.
  function fitsGrid(sizeMm) {
    return sizeMm >= GRID_MM && sizeMm <= MAX_GRID_UNITS * GRID_MM;
  }

  function updateDrawerLinks(width, depth, height) {
    let size = fitsGrid(width) && fitsGrid(depth) ? width + 'x' + depth : null;
    if (size !== null && height >= MEASURED_MM_MIN && height <= MEASURED_MM_MAX) {
      size += 'x' + height;
    }
    const links = document.querySelectorAll('[data-drawer-link]');
    for (const link of links) {
      const path = link.getAttribute('data-drawer-link') === 'baseplate' ? '/baseplate' : '/';
      link.setAttribute('href', size === null ? path : path + '?drawer=' + size);
    }
  }

  function init() {
    const ids = ['calc-width', 'calc-depth', 'calc-height'];
    for (const id of ids) {
      const el = $(id);
      if (!el) return;
      el.addEventListener('input', update);
    }
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
