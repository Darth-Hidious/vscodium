// @ts-check
/// <reference lib="dom" />

/**
 * PRISM Materials Explorer — Client-side JS
 * Interactive periodic table, composition builder, property filters.
 *
 * All DOM manipulation uses createElement / appendChild — no innerHTML.
 */

(function () {
  'use strict';

  // VS Code webview API
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  /* ==========================================================
     Element Data — all 118 elements
     Fields: [number, symbol, name, category, atomicMass]
     ========================================================== */

  /** @type {Array<[number, string, string, string, number]>} */
  const ELEMENTS = [
    [1,   'H',  'Hydrogen',      'nonmetal',              1.008],
    [2,   'He', 'Helium',        'noble-gas',             4.003],
    [3,   'Li', 'Lithium',       'alkali-metal',          6.941],
    [4,   'Be', 'Beryllium',     'alkaline-earth-metal',  9.012],
    [5,   'B',  'Boron',         'metalloid',            10.81],
    [6,   'C',  'Carbon',        'nonmetal',             12.011],
    [7,   'N',  'Nitrogen',      'nonmetal',             14.007],
    [8,   'O',  'Oxygen',        'nonmetal',             15.999],
    [9,   'F',  'Fluorine',      'halogen',              18.998],
    [10,  'Ne', 'Neon',          'noble-gas',            20.180],
    [11,  'Na', 'Sodium',        'alkali-metal',         22.990],
    [12,  'Mg', 'Magnesium',     'alkaline-earth-metal', 24.305],
    [13,  'Al', 'Aluminium',     'post-transition-metal',26.982],
    [14,  'Si', 'Silicon',       'metalloid',            28.086],
    [15,  'P',  'Phosphorus',    'nonmetal',             30.974],
    [16,  'S',  'Sulfur',        'nonmetal',             32.065],
    [17,  'Cl', 'Chlorine',      'halogen',              35.453],
    [18,  'Ar', 'Argon',         'noble-gas',            39.948],
    [19,  'K',  'Potassium',     'alkali-metal',         39.098],
    [20,  'Ca', 'Calcium',       'alkaline-earth-metal', 40.078],
    [21,  'Sc', 'Scandium',      'transition-metal',     44.956],
    [22,  'Ti', 'Titanium',      'transition-metal',     47.867],
    [23,  'V',  'Vanadium',      'transition-metal',     50.942],
    [24,  'Cr', 'Chromium',      'transition-metal',     51.996],
    [25,  'Mn', 'Manganese',     'transition-metal',     54.938],
    [26,  'Fe', 'Iron',          'transition-metal',     55.845],
    [27,  'Co', 'Cobalt',        'transition-metal',     58.933],
    [28,  'Ni', 'Nickel',        'transition-metal',     58.693],
    [29,  'Cu', 'Copper',        'transition-metal',     63.546],
    [30,  'Zn', 'Zinc',          'transition-metal',     65.38],
    [31,  'Ga', 'Gallium',       'post-transition-metal',69.723],
    [32,  'Ge', 'Germanium',     'metalloid',            72.630],
    [33,  'As', 'Arsenic',       'metalloid',            74.922],
    [34,  'Se', 'Selenium',      'nonmetal',             78.971],
    [35,  'Br', 'Bromine',       'halogen',              79.904],
    [36,  'Kr', 'Krypton',       'noble-gas',            83.798],
    [37,  'Rb', 'Rubidium',      'alkali-metal',         85.468],
    [38,  'Sr', 'Strontium',     'alkaline-earth-metal', 87.62],
    [39,  'Y',  'Yttrium',       'transition-metal',     88.906],
    [40,  'Zr', 'Zirconium',     'transition-metal',     91.224],
    [41,  'Nb', 'Niobium',       'transition-metal',     92.906],
    [42,  'Mo', 'Molybdenum',    'transition-metal',     95.95],
    [43,  'Tc', 'Technetium',    'transition-metal',     97],
    [44,  'Ru', 'Ruthenium',     'transition-metal',    101.07],
    [45,  'Rh', 'Rhodium',       'transition-metal',    102.906],
    [46,  'Pd', 'Palladium',     'transition-metal',    106.42],
    [47,  'Ag', 'Silver',        'transition-metal',    107.868],
    [48,  'Cd', 'Cadmium',       'transition-metal',    112.414],
    [49,  'In', 'Indium',        'post-transition-metal',114.818],
    [50,  'Sn', 'Tin',           'post-transition-metal',118.710],
    [51,  'Sb', 'Antimony',      'metalloid',           121.760],
    [52,  'Te', 'Tellurium',     'metalloid',           127.60],
    [53,  'I',  'Iodine',        'halogen',             126.904],
    [54,  'Xe', 'Xenon',         'noble-gas',           131.293],
    [55,  'Cs', 'Caesium',       'alkali-metal',        132.905],
    [56,  'Ba', 'Barium',        'alkaline-earth-metal',137.327],
    // 57-71: Lanthanides
    [57,  'La', 'Lanthanum',     'lanthanide',          138.905],
    [58,  'Ce', 'Cerium',        'lanthanide',          140.116],
    [59,  'Pr', 'Praseodymium',  'lanthanide',          140.908],
    [60,  'Nd', 'Neodymium',     'lanthanide',          144.242],
    [61,  'Pm', 'Promethium',    'lanthanide',          145],
    [62,  'Sm', 'Samarium',      'lanthanide',          150.36],
    [63,  'Eu', 'Europium',      'lanthanide',          151.964],
    [64,  'Gd', 'Gadolinium',    'lanthanide',          157.25],
    [65,  'Tb', 'Terbium',       'lanthanide',          158.925],
    [66,  'Dy', 'Dysprosium',    'lanthanide',          162.500],
    [67,  'Ho', 'Holmium',       'lanthanide',          164.930],
    [68,  'Er', 'Erbium',        'lanthanide',          167.259],
    [69,  'Tm', 'Thulium',       'lanthanide',          168.934],
    [70,  'Yb', 'Ytterbium',     'lanthanide',          173.045],
    [71,  'Lu', 'Lutetium',      'lanthanide',          174.967],
    // 72-86: Period 6 continues
    [72,  'Hf', 'Hafnium',       'transition-metal',    178.49],
    [73,  'Ta', 'Tantalum',      'transition-metal',    180.948],
    [74,  'W',  'Tungsten',      'transition-metal',    183.84],
    [75,  'Re', 'Rhenium',       'transition-metal',    186.207],
    [76,  'Os', 'Osmium',        'transition-metal',    190.23],
    [77,  'Ir', 'Iridium',       'transition-metal',    192.217],
    [78,  'Pt', 'Platinum',      'transition-metal',    195.084],
    [79,  'Au', 'Gold',          'transition-metal',    196.967],
    [80,  'Hg', 'Mercury',       'transition-metal',    200.592],
    [81,  'Tl', 'Thallium',      'post-transition-metal',204.383],
    [82,  'Pb', 'Lead',          'post-transition-metal',207.2],
    [83,  'Bi', 'Bismuth',       'post-transition-metal',208.980],
    [84,  'Po', 'Polonium',      'post-transition-metal',209],
    [85,  'At', 'Astatine',      'halogen',             210],
    [86,  'Rn', 'Radon',         'noble-gas',           222],
    [87,  'Fr', 'Francium',      'alkali-metal',        223],
    [88,  'Ra', 'Radium',        'alkaline-earth-metal',226],
    // 89-103: Actinides
    [89,  'Ac', 'Actinium',      'actinide',            227],
    [90,  'Th', 'Thorium',       'actinide',            232.038],
    [91,  'Pa', 'Protactinium',  'actinide',            231.036],
    [92,  'U',  'Uranium',       'actinide',            238.029],
    [93,  'Np', 'Neptunium',     'actinide',            237],
    [94,  'Pu', 'Plutonium',     'actinide',            244],
    [95,  'Am', 'Americium',     'actinide',            243],
    [96,  'Cm', 'Curium',        'actinide',            247],
    [97,  'Bk', 'Berkelium',     'actinide',            247],
    [98,  'Cf', 'Californium',   'actinide',            251],
    [99,  'Es', 'Einsteinium',   'actinide',            252],
    [100, 'Fm', 'Fermium',       'actinide',            257],
    [101, 'Md', 'Mendelevium',   'actinide',            258],
    [102, 'No', 'Nobelium',      'actinide',            259],
    [103, 'Lr', 'Lawrencium',    'actinide',            266],
    // 104-118: Period 7 continues
    [104, 'Rf', 'Rutherfordium', 'transition-metal',    267],
    [105, 'Db', 'Dubnium',       'transition-metal',    268],
    [106, 'Sg', 'Seaborgium',    'transition-metal',    269],
    [107, 'Bh', 'Bohrium',       'transition-metal',    270],
    [108, 'Hs', 'Hassium',       'transition-metal',    277],
    [109, 'Mt', 'Meitnerium',    'unknown',             278],
    [110, 'Ds', 'Darmstadtium',  'unknown',             281],
    [111, 'Rg', 'Roentgenium',   'unknown',             282],
    [112, 'Cn', 'Copernicium',   'transition-metal',    285],
    [113, 'Nh', 'Nihonium',      'unknown',             286],
    [114, 'Fl', 'Flerovium',     'unknown',             289],
    [115, 'Mc', 'Moscovium',     'unknown',             290],
    [116, 'Lv', 'Livermorium',   'unknown',             293],
    [117, 'Ts', 'Tennessine',    'unknown',             294],
    [118, 'Og', 'Oganesson',     'noble-gas',           294],
  ];

  /* ==========================================================
     Standard periodic table layout.
     Each entry: [atomicNumber, gridColumn, gridRow]
     Lanthanides (57-71) and Actinides (89-103) go in separate rows.
     ========================================================== */

  /** @type {Array<[number, number, number]>} */
  const MAIN_TABLE_POSITIONS = [
    // Period 1
    [1,  1,  1], [2,  18, 1],
    // Period 2
    [3,  1,  2], [4,  2,  2],
    [5,  13, 2], [6,  14, 2], [7,  15, 2], [8,  16, 2], [9,  17, 2], [10, 18, 2],
    // Period 3
    [11, 1,  3], [12, 2,  3],
    [13, 13, 3], [14, 14, 3], [15, 15, 3], [16, 16, 3], [17, 17, 3], [18, 18, 3],
    // Period 4
    [19, 1,  4], [20, 2,  4],
    [21, 3,  4], [22, 4,  4], [23, 5,  4], [24, 6,  4], [25, 7,  4], [26, 8,  4],
    [27, 9,  4], [28, 10, 4], [29, 11, 4], [30, 12, 4],
    [31, 13, 4], [32, 14, 4], [33, 15, 4], [34, 16, 4], [35, 17, 4], [36, 18, 4],
    // Period 5
    [37, 1,  5], [38, 2,  5],
    [39, 3,  5], [40, 4,  5], [41, 5,  5], [42, 6,  5], [43, 7,  5], [44, 8,  5],
    [45, 9,  5], [46, 10, 5], [47, 11, 5], [48, 12, 5],
    [49, 13, 5], [50, 14, 5], [51, 15, 5], [52, 16, 5], [53, 17, 5], [54, 18, 5],
    // Period 6 (with La placeholder at col 3, then Hf-Rn at cols 4-18)
    [55, 1,  6], [56, 2,  6],
    // Col 3 row 6 = lanthanide indicator (handled separately)
    [72, 4,  6], [73, 5,  6], [74, 6,  6], [75, 7,  6], [76, 8,  6],
    [77, 9,  6], [78, 10, 6], [79, 11, 6], [80, 12, 6],
    [81, 13, 6], [82, 14, 6], [83, 15, 6], [84, 16, 6], [85, 17, 6], [86, 18, 6],
    // Period 7 (with Ac placeholder at col 3, then Rf-Og at cols 4-18)
    [87, 1,  7], [88, 2,  7],
    // Col 3 row 7 = actinide indicator (handled separately)
    [104, 4, 7], [105, 5, 7], [106, 6, 7], [107, 7, 7], [108, 8, 7],
    [109, 9, 7], [110, 10,7], [111, 11,7], [112, 12,7],
    [113, 13,7], [114, 14,7], [115, 15,7], [116, 16,7], [117, 17,7], [118, 18,7],
  ];

  // Lanthanides go in column 3 of row 6 visually, but rendered separately below
  const LANTHANIDE_NUMBERS = [57,58,59,60,61,62,63,64,65,66,67,68,69,70,71];
  const ACTINIDE_NUMBERS   = [89,90,91,92,93,94,95,96,97,98,99,100,101,102,103];

  /* ==========================================================
     State
     ========================================================== */

  /** @type {Map<number, number>} atomicNumber -> ratio */
  const selectedElements = new Map();

  /** Look up element tuple by atomic number */
  function getElement(z) {
    return ELEMENTS.find(function (e) { return e[0] === z; });
  }

  /* ==========================================================
     Build the periodic table
     ========================================================== */

  const tableContainer = document.getElementById('periodic-table');
  const lanthContainer = document.getElementById('lanthanides');
  const actinContainer = document.getElementById('actinides');
  const infoSpan       = document.getElementById('element-info');

  /** @type {Map<number, HTMLElement>} */
  const cellMap = new Map();

  /**
   * Create one element cell.
   * @param {[number, string, string, string, number]} el
   * @returns {HTMLElement}
   */
  function createCell(el) {
    var z = el[0], sym = el[1], name = el[2], cat = el[3];

    var cell = document.createElement('div');
    cell.className = 'element-cell cat-' + cat;
    cell.dataset.z = String(z);
    cell.title = z + ' ' + name;

    var numSpan = document.createElement('span');
    numSpan.className = 'atomic-number';
    numSpan.textContent = String(z);
    cell.appendChild(numSpan);

    var symSpan = document.createElement('span');
    symSpan.className = 'symbol';
    symSpan.textContent = sym;
    cell.appendChild(symSpan);

    var nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name;
    cell.appendChild(nameSpan);

    cell.addEventListener('click', function () {
      toggleElement(z);
    });

    cell.addEventListener('mouseenter', function () {
      infoSpan.textContent = z + ' ' + sym + ' \u2014 ' + name + ' (' + el[4] + ' u)';
    });

    cell.addEventListener('mouseleave', function () {
      infoSpan.textContent = '';
    });

    cellMap.set(z, cell);
    return cell;
  }

  // Build main 18-column grid.
  // We use CSS grid-column / grid-row placement.
  // First, fill all 7 rows x 18 cols with empty placeholders so the grid shapes correctly.
  (function buildMainTable() {
    var posMap = {};
    MAIN_TABLE_POSITIONS.forEach(function (p) {
      posMap[p[2] + '-' + p[1]] = p[0];
    });

    for (var row = 1; row <= 7; row++) {
      for (var col = 1; col <= 18; col++) {
        var key = row + '-' + col;
        var z = posMap[key];

        if (z) {
          var el = getElement(z);
          if (el) {
            var cell = createCell(el);
            cell.style.gridColumn = String(col);
            cell.style.gridRow = String(row);
            tableContainer.appendChild(cell);
          }
        } else {
          // Placeholder cells for row 6 col 3 and row 7 col 3 (lanthanide/actinide markers)
          if ((row === 6 || row === 7) && col === 3) {
            var marker = document.createElement('div');
            marker.className = 'element-cell cat-' + (row === 6 ? 'lanthanide' : 'actinide');
            marker.style.gridColumn = String(col);
            marker.style.gridRow = String(row);
            marker.style.opacity = '0.5';
            marker.style.cursor = 'default';

            var markerSym = document.createElement('span');
            markerSym.className = 'symbol';
            markerSym.textContent = row === 6 ? 'La' : 'Ac';
            markerSym.style.fontSize = '9px';
            marker.appendChild(markerSym);

            var markerDots = document.createElement('span');
            markerDots.className = 'atomic-number';
            markerDots.textContent = row === 6 ? '57-71' : '89-103';
            markerDots.style.fontSize = '5px';
            marker.appendChild(markerDots);

            tableContainer.appendChild(marker);
          }
          // Other empty cells are simply not placed — CSS grid handles gaps naturally
        }
      }
    }
  })();

  // Lanthanides
  LANTHANIDE_NUMBERS.forEach(function (z) {
    var el = getElement(z);
    if (el) {
      lanthContainer.appendChild(createCell(el));
    }
  });

  // Actinides
  ACTINIDE_NUMBERS.forEach(function (z) {
    var el = getElement(z);
    if (el) {
      actinContainer.appendChild(createCell(el));
    }
  });

  /* ==========================================================
     Selection & Composition
     ========================================================== */

  function toggleElement(z) {
    if (selectedElements.has(z)) {
      selectedElements.delete(z);
      var cell = cellMap.get(z);
      if (cell) { cell.classList.remove('selected'); }
    } else {
      // Default ratio: distribute evenly
      selectedElements.set(z, 1);
      var cell2 = cellMap.get(z);
      if (cell2) { cell2.classList.add('selected'); }
    }
    normalizeRatios();
    renderComposition();
    notifyCompositionChanged();
  }

  function removeElement(z) {
    selectedElements.delete(z);
    var cell = cellMap.get(z);
    if (cell) { cell.classList.remove('selected'); }
    normalizeRatios();
    renderComposition();
    notifyCompositionChanged();
  }

  function normalizeRatios() {
    if (selectedElements.size === 0) { return; }
    var sum = 0;
    selectedElements.forEach(function (v) { sum += v; });
    if (sum === 0) { sum = 1; }
    selectedElements.forEach(function (v, k) {
      selectedElements.set(k, v / sum);
    });
  }

  function renderComposition() {
    var list = document.getElementById('composition-list');
    var totalDiv = document.getElementById('composition-total');

    // Clear
    while (list.firstChild) { list.removeChild(list.firstChild); }
    totalDiv.textContent = '';
    totalDiv.className = '';

    if (selectedElements.size === 0) {
      var p = document.createElement('p');
      p.className = 'placeholder';
      p.textContent = 'Click elements above to build a composition';
      list.appendChild(p);
      return;
    }

    var sum = 0;

    selectedElements.forEach(function (ratio, z) {
      var el = getElement(z);
      if (!el) { return; }

      sum += ratio;

      var row = document.createElement('div');
      row.className = 'comp-row';

      var symSpan = document.createElement('span');
      symSpan.className = 'comp-symbol';
      symSpan.textContent = el[1];
      row.appendChild(symSpan);

      var nameSpan = document.createElement('span');
      nameSpan.className = 'comp-name';
      nameSpan.textContent = el[2];
      row.appendChild(nameSpan);

      var input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '1';
      input.step = '0.01';
      input.value = ratio.toFixed(4);

      input.addEventListener('change', function () {
        var val = parseFloat(input.value);
        if (isNaN(val) || val < 0) { val = 0; }
        if (val > 1) { val = 1; }
        selectedElements.set(z, val);
        // Re-render to show updated total (don't auto-normalize on manual edit)
        renderComposition();
        notifyCompositionChanged();
      });

      row.appendChild(input);

      var removeBtn = document.createElement('button');
      removeBtn.className = 'comp-remove';
      removeBtn.textContent = '\u00d7';
      removeBtn.title = 'Remove ' + el[1];
      removeBtn.addEventListener('click', function () {
        removeElement(z);
      });
      row.appendChild(removeBtn);

      list.appendChild(row);
    });

    // Show total
    var rounded = Math.round(sum * 10000) / 10000;
    totalDiv.textContent = 'Total: ' + rounded.toFixed(4);
    if (Math.abs(rounded - 1.0) < 0.001) {
      totalDiv.className = 'ok';
    } else {
      totalDiv.className = 'warn';
    }
  }

  /** Build composition string like "Ti0.90-Al0.06-V0.04" */
  function getCompositionString() {
    if (selectedElements.size === 0) { return ''; }
    var parts = [];
    selectedElements.forEach(function (ratio, z) {
      var el = getElement(z);
      if (el) {
        parts.push(el[1] + ratio.toFixed(4));
      }
    });
    return parts.join('-');
  }

  function notifyCompositionChanged() {
    vscode.postMessage({
      type: 'composition-changed',
      composition: getCompositionString(),
    });
  }

  /* ==========================================================
     Property Filters
     ========================================================== */

  function getFilters() {
    return {
      meltingPointMin: getNumericValue('filter-mp-min'),
      meltingPointMax: getNumericValue('filter-mp-max'),
      densityMin:      getNumericValue('filter-density-min'),
      densityMax:      getNumericValue('filter-density-max'),
      bandGapMin:      getNumericValue('filter-bg-min'),
      bandGapMax:      getNumericValue('filter-bg-max'),
    };
  }

  function getNumericValue(id) {
    var el = document.getElementById(id);
    if (!el) { return null; }
    var val = parseFloat(/** @type {HTMLInputElement} */ (el).value);
    return isNaN(val) ? null : val;
  }

  /* ==========================================================
     Actions
     ========================================================== */

  document.getElementById('btn-search').addEventListener('click', function () {
    doSearch();
  });

  document.getElementById('btn-ask-agent').addEventListener('click', function () {
    var comp = getCompositionString();
    if (!comp) {
      // Nothing selected — still allow asking
      comp = '(no composition selected)';
    }
    vscode.postMessage({
      type: 'ask-agent',
      composition: comp,
      filters: getFilters(),
    });
  });

  function doSearch() {
    var comp = getCompositionString();
    if (!comp) { return; }
    vscode.postMessage({
      type: 'search',
      composition: comp,
      filters: getFilters(),
    });
  }

  /* ==========================================================
     Messages from extension host
     ========================================================== */

  window.addEventListener('message', function (event) {
    var msg = event.data;
    switch (msg.type) {
      case 'trigger-search':
        doSearch();
        break;
      case 'search-results':
        showResults(msg.results || []);
        break;
    }
  });

  function showResults(results) {
    var section = document.getElementById('results-section');
    var list = document.getElementById('results-list');

    while (list.firstChild) { list.removeChild(list.firstChild); }

    if (results.length === 0) {
      var p = document.createElement('p');
      p.className = 'placeholder';
      p.textContent = 'No results — connect a PRISM server to search the materials database.';
      list.appendChild(p);
    } else {
      results.forEach(function (r) {
        var div = document.createElement('div');
        div.textContent = r.name || r.formula || JSON.stringify(r);
        list.appendChild(div);
      });
    }

    section.classList.remove('hidden');
  }

  /* ==========================================================
     Keyboard: Enter in filter inputs triggers search
     ========================================================== */

  document.querySelectorAll('#filters-section input').forEach(function (input) {
    input.addEventListener('keydown', function (e) {
      if (/** @type {KeyboardEvent} */ (e).key === 'Enter') {
        doSearch();
      }
    });
  });

  // Initial render
  renderComposition();

})();
