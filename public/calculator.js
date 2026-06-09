/**
 * Gridfinity drawer calculator for the /gridfinity-calculator content page.
 * Standalone vanilla JS (no bundler) so the static page stays CSP-clean
 * (script-src 'self') and loads without the app bundle.
 */
(function () {
  'use strict';

  var GRID_MM = 42;
  var HALF_GRID_MM = 21;
  var HEIGHT_UNIT_MM = 7;
  var BASEPLATE_MM = 5;

  function $(id) {
    return document.getElementById(id);
  }

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function update() {
    var width = parseFloat($('calc-width').value);
    var depth = parseFloat($('calc-depth').value);
    var height = parseFloat($('calc-height').value);

    var wUnits = width > 0 ? Math.floor(width / GRID_MM) : 0;
    var dUnits = depth > 0 ? Math.floor(depth / GRID_MM) : 0;
    var wHalf = width > 0 ? Math.floor(width / HALF_GRID_MM) / 2 : 0;
    var dHalf = depth > 0 ? Math.floor(depth / HALF_GRID_MM) / 2 : 0;
    var wLeft = width > 0 ? width - wUnits * GRID_MM : 0;
    var dLeft = depth > 0 ? depth - dUnits * GRID_MM : 0;

    $('calc-grid').textContent =
      wUnits > 0 && dUnits > 0 ? wUnits + ' × ' + dUnits : '—';
    $('calc-half').textContent =
      wHalf > 0 && dHalf > 0 ? fmt(wHalf) + ' × ' + fmt(dHalf) : '—';
    $('calc-gap').textContent =
      width > 0 && depth > 0 ? fmt(wLeft) + ' / ' + fmt(dLeft) + ' mm' : '—';

    var hUnits = height > 0 ? Math.floor((height - BASEPLATE_MM) / HEIGHT_UNIT_MM) : 0;
    $('calc-height-units').textContent = hUnits > 0 ? hUnits + 'U (' + hUnits * HEIGHT_UNIT_MM + ' mm)' : '—';
  }

  function init() {
    var ids = ['calc-width', 'calc-depth', 'calc-height'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
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
