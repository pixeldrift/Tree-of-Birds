
// Define our layout
const graphContainer = document.getElementById("graph");
const graphCanvas = document.getElementById("graphCanvas");
const intro = document.getElementById("intro-message");
const infoDiv = document.getElementById("info");
const birdListDiv = document.getElementById("bird-table");


// Get the Data
let data = [], selectedBirds = new Set(), fileLoaded = false;

// ----- Shared ingest for both the file picker and the bundled default dataset ----- //

function ingestParsedRows(results) {
  const allFields = results.meta.fields || [];
  const requiredFields = ['id', 'name', 'fatherID', 'motherID'];
  const missing = requiredFields.filter(f => !allFields.includes(f));
  if (missing.length) {
    console.error(`Missing fields: ${missing.join(', ')}`, results.meta.fields);
    return false;
  }

  data = results.data
    .filter(d => d.id && d.name)
    .map(d => {
      const clean = str => str ? str.toString().trim() : '';
      const pad = id => id ? id.toString().padStart(3, '0') : '';

      return {
        ...d,
        id: pad(clean(d.id)),
        fatherID: pad(clean(d.fatherID || d.father || '')),
        motherID: pad(clean(d.motherID || d.mother || ''))
      };
    });

  fileLoaded = true;

  $('#bird-table-placeholder').hide();
  $('#bird-table').show();

  updateIntro();
  populateList();
  drawGraph(selectedBirds, data);
  return true;
}

document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const delimiter = ext === "tsv" ? "\t" : ",";

  Papa.parse(file, {
    header: true,
    delimiter,
    complete: results => {
      if (!ingestParsedRows(results)) {
        alert(`Data is missing required fields: id, name, fatherID, motherID`);
        document.getElementById('learnMoreModal').style.display = 'block';
      }
    }
  });
});

// Load the bundled sample pedigree by default so there's something to explore right away.
// The file picker above still overrides it with your own data.
Papa.parse("data/Geneology Sample Data - Sheet1.tsv", {
  download: true,
  header: true,
  delimiter: "\t",
  complete: ingestParsedRows,
  error: err => console.error("Could not load the default dataset:", err)
});

// -----  Centralized function for selecting a bird ----- //

  // Deal with zero padded ID numbers
  function normalizeId(id) {
    if (!id && id !== 0) return '';
    return String(id).trim().padStart(3, '0');
  }

function selectBird(nodeId) {

  nodeId = normalizeId(nodeId);

  if (selectedBirds.has(nodeId)) {
    // Already selected → unselect
    selectedBirds.delete(nodeId);
  } else {
    // Not selected → add to selection
    selectedBirds.add(nodeId);
  }

  // Update UI
  updateIntro();
  updateSidebar();
  populateList();
  drawGraph(selectedBirds, data);
  refreshCoiPanelIfOpen();
  refreshMutationPanelIfOpen();
}

// ----- Get Random Bird Images ----- //

const birdImageMap = {};

function getBirdImage(id) {
  if (!birdImageMap[id]) {
    const randomIndex = Math.floor(Math.random() * birdImages.length);
    birdImageMap[id] = birdImages[randomIndex];
  }
  return birdImageMap[id];
}

// ----- Bird List Table ----- //

let birdTable = null;

// ----- Initialize Table Once ----- //

function initBirdTable() {
  birdTable = $('#bird-table').DataTable({
    paging: false,
    searching: false,
    info: false,
    select: false,
    scrollY: $('#list-pane').height() - $('#list-pane h3').outerHeight(true) + 'px',
    scrollCollapse: true,
    autoWidth: false,
    // Explicit widths so the header (DataTables clones it into a separate table for
    // scrollY) and body always divide columns identically, regardless of cell content.
    columns: [
      { title: "ID", width: "6%" },
      { title: "Sex", width: "6%" },
      { title: "Name", width: "18%" },
      { title: "Mutation", width: "12%" },
      { title: "Subspecies", width: "14%" },
      { title: "Species", width: "12%" },
      { title: "Scientific Name", width: "18%" },
      { title: "Family", width: "14%" }
    ]
  });
  birdTable.columns.adjust();
}

// ----- Populate / Refresh Table -----
function populateList() {
  if (!birdTable) initBirdTable();

  // Prepare rows
  const rows = data.map(b => {
    const gender = (b.sex || '').trim().toUpperCase();
    const symbol = gender === 'F' ? '♀' : '♂';
    const scientificName = `${b.scigenus || ''} ${b.scispecies || ''}`.trim();
    const rowClass = gender === 'F' ? 'female' : 'male';
    const isSelected = selectedBirds.has(b.id);
    return [
      b.id,
      symbol,
      b.name,
      b.mutation || '',
      b.subspecies || '',
      b.species || '',
      scientificName,
      b.scifamily || ''
    ];
  });

  // Clear existing rows & add new
  birdTable.clear();
  birdTable.rows.add(rows);
  birdTable.draw(false);

  // Apply classes properly after draw
  birdTable.rows().every(function (rowIdx, tableLoop, rowLoop) {
    const rowNode = this.node();
    const b = data[rowIdx];
    const gender = (b.sex || '').trim().toUpperCase();
    rowNode.className = (gender === 'F' ? 'female' : 'male') + (selectedBirds.has(b.id) ? ' selected' : '');
  });

  // Attach click handlers for row selection
  birdTable.rows().every(function () {
    const row = $(this.node());
    const birdId = row.find('td:first').text();
    row.off('click').on('click', () => selectBird(birdId));
  });
}

// ----- Resize Table on Pane Resize -----

function resizeBirdTable() {
  if (!birdTable) return;

  const listPane = document.getElementById('list-pane');
  const headerHeight = listPane.querySelector('h3').offsetHeight;
  const newHeight = listPane.clientHeight - headerHeight;

  birdTable.settings()[0].oScroll.sY = newHeight + 'px';
  $('.dataTables_scrollBody').css('height', newHeight + 'px');

  birdTable.draw(false);
}


// ----- Bind to pane resize -----

const listResizer = document.getElementById('list-resizer');
let isResizingList = false;
let startY = 0;
let startHeight = 0;

listResizer.addEventListener('mousedown', e => {
  isResizingList = true;
  startY = e.clientY;
  startHeight = document.getElementById('list-pane').offsetHeight;
  document.body.style.cursor = 'ns-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

window.addEventListener('mousemove', e => {
  if (!isResizingList) return;
  const dy = startY - e.clientY;
  let newHeight = startHeight + dy;
  newHeight = Math.max(100, Math.min(600, newHeight));
  document.getElementById('list-pane').style.height = newHeight + 'px';
  resizeBirdTable();
});

window.addEventListener('mouseup', () => {
  if (isResizingList) {
    isResizingList = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});


// ----- Info Sidebar ----- //

function updateSidebar() {
  infoDiv.innerHTML = '';

  if (!selectedBirds.size) {
    infoDiv.innerHTML = '<em>No birds selected</em>';
    return;
  }

  const template = document.getElementById('info-card-template');

  selectedBirds.forEach(id => {
    const bird = data.find(b => b.id === id);
    if (!bird) return;

    const clone = template.content.cloneNode(true);
    const card = clone.querySelector('.info-card'); // must be defined before querying children

    const birdImage = getBirdImage(bird.id);
    if (birdImage) {
      const imgEl = card.querySelector(".bird-thumb");
      imgEl.src = birdImage;
      imgEl.alt = bird.name;
    }

    const gender = (bird.sex || '').trim().toUpperCase();
    const mother = data.find(b => b.id === bird.motherID);
    const father = data.find(b => b.id === bird.fatherID);
    const offspring = data.filter(b => b.motherID === bird.id || b.fatherID === bird.id);

    // Apply gender color
    card.classList.add(gender === 'F' ? 'female' : 'male');

    // Fill header
    card.querySelector('.bird-name').textContent = `${gender === 'F' ? '♀' : '♂'} ${bird.name}`;

    // Close button
    card.querySelector('.close-btn').addEventListener('click', () => {
      selectedBirds.delete(bird.id);
      updateSidebar();
      populateList();
      drawGraph(selectedBirds, data);
      refreshCoiPanelIfOpen();
      refreshMutationPanelIfOpen();
    });

    // Fill table
    card.querySelector('.bird-id').textContent = bird.id;
    card.querySelector('.mutation').textContent = bird.mutation || '';
    card.querySelector('.subspecies').textContent = bird.subspecies || '';
    card.querySelector('.species').textContent = bird.species || '';
    card.querySelector('.scientific-name').textContent = `${bird.scigenus || ''} ${bird.scispecies || ''}`;
    card.querySelector('.scifamily').textContent = bird.scifamily || '';

    const motherCell = card.querySelector('.mother');
    if (mother) {
      motherCell.innerHTML = `♀ ${mother.name}`;
      motherCell.classList.add('female');
      motherCell.dataset.id = mother.id;
    } else {
      motherCell.textContent = 'Unknown';
    }

    const fatherCell = card.querySelector('.father');
    if (father) {
      fatherCell.innerHTML = `♂ ${father.name}`;
      fatherCell.classList.add('male');
      fatherCell.dataset.id = father.id;
    } else {
      fatherCell.textContent = 'Unknown';
    }

    const offspringCell = card.querySelector('.offspring-list');
    if (offspring.length) {
      offspringCell.innerHTML = offspring.map(o => {
        const cls = (o.sex || '').trim().toUpperCase() === 'F' ? 'female' : 'male';
        const symbol = cls === 'female' ? '♀' : '♂';
        return `<span class="${cls} offspring" data-id="${o.id}">${symbol} ${o.name}</span>`;
      }).join('<br>');
    } else {
      offspringCell.textContent = 'None';
    }

    // Add click listeners for mother, father, offspring
    card.querySelectorAll('.parent, .offspring').forEach(el => {
      el.addEventListener('click', e => {
        const selId = e.target.dataset.id;
        if (selId) selectBird(selId);
      });
    });

    infoDiv.appendChild(clone);
  });
}


function updateIntro() {
  if(!fileLoaded) {
    intro.innerHTML = `<p>To begin, select a data source above. ⬆</p><a href="#" id="learnMoreLink">Learn more</a>`;
    intro.style.display = 'block';
  } else if(selectedBirds.size === 0) {
    intro.innerHTML = '<p>Select at least one bird below to explore. ⬇</p>';
    intro.style.display = 'block';
  } else {
    intro.style.display = 'none';
  }
}


// ----- Family Tree ----- //
//
// Layout is computed by Dagre (a free, open-source layered-graph algorithm) and rendered
// by hand as absolutely-positioned cards + an SVG edge layer — no vis-network/GoJS involved.
// A "pairing" node just marks "these two birds produced offspring together" (no marriage
// semantics), which is also what lets a bird appear in several pairings across mates.

const pairKey = (m, f) => `${m || ''}:${f || ''}`;
const normalizedKey = bird => pairKey(bird.motherID, bird.fatherID);

// Two points: a vertical-tangent S-curve (bounded to the two points' own box, so it can
// never overshoot). Three or more: straight segments with each interior waypoint rounded
// off by a quadratic curve that uses the waypoint itself as the control point — like the
// "round corners" effect in a vector editor. Because the curve's control point IS the
// original corner, it stays inside that corner instead of bowing past it the way a fitted
// spline (e.g. Catmull-Rom) can when the path changes direction sharply.
function smoothEdgePath(points) {
  if (!points.length) return '';
  if (points.length === 2) {
    const [p0, p1] = points;
    const midY = (p0.y + p1.y) / 2;
    return `M ${p0.x} ${p0.y} C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
  }

  const ROUND_RADIUS = 30;
  const pointToward = (from, to, maxDist) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y);
    if (len === 0) return { x: from.x, y: from.y };
    const t = Math.min(maxDist, len / 2) / len; // never eat more than half a segment
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  };

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i];
    const entry = pointToward(corner, points[i - 1], ROUND_RADIUS);
    const exit = pointToward(corner, points[i + 1], ROUND_RADIUS);
    d += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y}, ${exit.x} ${exit.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

// Map of ancestorId -> minimal number of generations above `id` (breadth-first, so the
// first depth recorded for an ancestor is always the shortest path to them).
function ancestorDepths(id, byId, maxDepth = 10) {
  const depths = new Map();
  let frontier = [id];
  for (let depth = 1; frontier.length && depth <= maxDepth; depth++) {
    const next = [];
    frontier.forEach(curId => {
      const b = byId[curId];
      if (!b) return;
      [b.motherID, b.fatherID].forEach(pid => {
        if (pid && byId[pid] && pid !== id && !depths.has(pid)) {
          depths.set(pid, depth);
          next.push(pid);
        }
      });
    });
    frontier = next;
  }
  return depths;
}

function isConsanguineous(motherID, fatherID, byId) {
  if (!motherID || !fatherID) return false;
  if (motherID === fatherID) return true;
  const mAnc = ancestorDepths(motherID, byId), fAnc = ancestorDepths(fatherID, byId);
  if (mAnc.has(fatherID) || fAnc.has(motherID)) return true; // parent paired with own ancestor
  for (const a of mAnc.keys()) if (fAnc.has(a)) return true; // shared ancestor on both sides
  return false;
}

function drawGraph(selectedSet, allBirds) {
  const showParents   = document.getElementById("showParents")?.checked ?? true;
  const showSiblings  = document.getElementById("showSiblings")?.checked ?? true;
  const showOffspring = document.getElementById("showOffspring")?.checked ?? true;
  const showConsang   = document.getElementById("showConsang")?.checked ?? true;

  graphCanvas.innerHTML = '';
  graphViewState.contentWidth = 0;
  graphViewState.contentHeight = 0;
  if (!allBirds.length || !selectedSet.size) return;

  const byId = Object.fromEntries(allBirds.map(b => [String(b.id), b]));

  // ----- which birds and pairings belong in view around the current selection ----- //
  const visibleBirds = new Set();
  const pairingDefs = new Map(); // key -> { motherID, fatherID }

  selectedSet.forEach(selId => {
    const bird = byId[selId];
    if (!bird) return;
    visibleBirds.add(bird.id);

    // Parents / siblings: the pairing that produced THIS bird
    const hasKnownParent = bird.motherID || bird.fatherID;
    if ((showParents || showSiblings) && hasKnownParent) {
      const key = normalizedKey(bird);
      pairingDefs.set(key, { motherID: bird.motherID, fatherID: bird.fatherID });

      if (showParents) {
        if (bird.motherID) visibleBirds.add(bird.motherID);
        if (bird.fatherID) visibleBirds.add(bird.fatherID);
      }
      if (showSiblings) {
        allBirds.forEach(c => { if (normalizedKey(c) === key) visibleBirds.add(c.id); });
      }
    }

    // Offspring: every pairing where THIS bird is a parent
    if (showOffspring) {
      allBirds.forEach(c => {
        if (c.motherID === bird.id || c.fatherID === bird.id) {
          const key = normalizedKey(c);
          pairingDefs.set(key, { motherID: c.motherID, fatherID: c.fatherID });
          visibleBirds.add(c.id);
          if (c.motherID) visibleBirds.add(c.motherID); // the mate, so the pairing makes sense
          if (c.fatherID) visibleBirds.add(c.fatherID);
        }
      });
    }
  });

  // ----- lay it out ----- //
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  visibleBirds.forEach(id => {
    const b = byId[id];
    const label = b.name || "(unnamed)";
    const width = Math.max(70, label.length * 6.2 + 20);
    g.setNode(id, { width, height: 32, label, bird: b });
  });

  pairingDefs.forEach((def, key) => {
    const consang = isConsanguineous(def.motherID, def.fatherID, byId);
    g.setNode(key, { width: 12, height: 12, pairing: true, consang });
    if (def.motherID && visibleBirds.has(def.motherID)) g.setEdge(def.motherID, key);
    if (def.fatherID && visibleBirds.has(def.fatherID)) g.setEdge(def.fatherID, key);
    visibleBirds.forEach(cid => {
      const c = byId[cid];
      if (normalizedKey(c) === key) g.setEdge(key, cid);
    });
  });

  dagre.layout(g);
  renderGraph(g, selectedSet, showConsang);
}

function renderGraph(g, selectedSet, showConsang) {
  const { width, height } = g.graph();
  graphCanvas.style.width = width + 'px';
  graphCanvas.style.height = height + 'px';
  graphViewState.contentWidth = width;
  graphViewState.contentHeight = height;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "edges");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  graphCanvas.appendChild(svg);

  g.edges().forEach(e => {
    const edge = g.edge(e);
    const d = smoothEdgePath(edge.points);
    const targetNode = g.node(e.w);
    const consang = showConsang && targetNode && targetNode.pairing && targetNode.consang;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "edge-line" + (consang ? " consang" : ""));
    svg.appendChild(path);
  });

  g.nodes().forEach(id => {
    const node = g.node(id);
    if (node.pairing) {
      const dot = document.createElement("div");
      dot.className = "pairing-dot" + (showConsang && node.consang ? " consang" : "");
      dot.style.left = node.x - node.width / 2 + "px";
      dot.style.top = node.y - node.height / 2 + "px";
      graphCanvas.appendChild(dot);
    } else {
      const b = node.bird;
      const sex = (b.sex || "").trim().toUpperCase();
      const card = document.createElement("div");
      card.className = "node-card " + (sex === "F" ? "female" : sex === "M" ? "male" : "") +
        (selectedSet.has(b.id) ? " selected" : "");
      card.style.left = node.x - node.width / 2 + "px";
      card.style.top = node.y - node.height / 2 + "px";
      card.style.width = node.width + "px";
      card.style.height = node.height + "px";
      card.textContent = node.label;
      card.title = `ID ${b.id} — ${b.mutation || ""} ${b.subspecies || ""} ${b.species || ""}`.trim();
      card.addEventListener("mousedown", e => e.stopPropagation()); // don't start a pan-drag
      card.addEventListener("click", () => selectBird(b.id));
      graphCanvas.appendChild(card);
    }
  });

  autoFitGraph();
}


// ----- Pan & zoom for the graph pane ----- //

const graphViewState = { pan: { x: 0, y: 0 }, zoom: 1, contentWidth: 0, contentHeight: 0 };

function applyGraphTransform() {
  graphCanvas.style.transform =
    `translate(${graphViewState.pan.x}px, ${graphViewState.pan.y}px) scale(${graphViewState.zoom})`;
}

function zoomGraphAround(clientX, clientY, factor) {
  const rect = graphContainer.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  const newZoom = Math.min(3, Math.max(0.08, graphViewState.zoom * factor));
  const ratio = newZoom / graphViewState.zoom;
  graphViewState.pan.x = x - (x - graphViewState.pan.x) * ratio;
  graphViewState.pan.y = y - (y - graphViewState.pan.y) * ratio;
  graphViewState.zoom = newZoom;
  applyGraphTransform();
}

function autoFitGraph() {
  if (!graphViewState.contentWidth || !graphViewState.contentHeight) return;
  const rect = graphContainer.getBoundingClientRect();
  const pad = 60;
  const scale = Math.min(
    (rect.width - pad) / graphViewState.contentWidth,
    (rect.height - pad) / graphViewState.contentHeight,
    1.25
  );
  graphViewState.zoom = Math.max(scale, 0.05);
  graphViewState.pan.x = (rect.width - graphViewState.contentWidth * graphViewState.zoom) / 2;
  graphViewState.pan.y = (rect.height - graphViewState.contentHeight * graphViewState.zoom) / 2;
  applyGraphTransform();
}

graphContainer.addEventListener("wheel", e => {
  e.preventDefault();
  zoomGraphAround(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

let isPanningGraph = false, panStart = null;
graphContainer.addEventListener("mousedown", e => {
  isPanningGraph = true;
  panStart = { x: e.clientX, y: e.clientY, panX: graphViewState.pan.x, panY: graphViewState.pan.y };
  graphContainer.classList.add("panning");
});
window.addEventListener("mousemove", e => {
  if (!isPanningGraph) return;
  graphViewState.pan.x = panStart.panX + (e.clientX - panStart.x);
  graphViewState.pan.y = panStart.panY + (e.clientY - panStart.y);
  applyGraphTransform();
});
window.addEventListener("mouseup", () => { isPanningGraph = false; graphContainer.classList.remove("panning"); });

document.getElementById("zoomInBtn").addEventListener("click", () => {
  const r = graphContainer.getBoundingClientRect();
  zoomGraphAround(r.left + r.width / 2, r.top + r.height / 2, 1.2);
});
document.getElementById("zoomOutBtn").addEventListener("click", () => {
  const r = graphContainer.getBoundingClientRect();
  zoomGraphAround(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
});
document.getElementById("fitBtn").addEventListener("click", autoFitGraph);
window.addEventListener("resize", autoFitGraph);


// -------------------- Coefficient of Inbreeding tool -------------------- //
//
// Kinship is computed with the standard recursive/tabular method: the kinship coefficient
// between two parents equals the inbreeding coefficient their offspring would have, and a
// bird's own inbreeding coefficient is just the kinship between ITS two parents. This
// handles arbitrary inbreeding loops correctly (tested against the sample data's
// Targaryen and Lannister lines) without needing to enumerate pedigree paths by hand.

// Longest path from a founder (no known parents) down to each bird — used to decide which
// side of a kinship(a, b) call to expand next (always expand whichever is "younger").
function computeGenerationDepths(byId) {
  const depth = {};
  function d(id) {
    if (id in depth) return depth[id];
    depth[id] = 0; // guards against a malformed cyclic reference while resolving
    const b = byId[id];
    if (!b) return (depth[id] = 0);
    const fatherD = b.fatherID && byId[b.fatherID] ? d(b.fatherID) : -1;
    const motherD = b.motherID && byId[b.motherID] ? d(b.motherID) : -1;
    return (depth[id] = Math.max(fatherD, motherD) + 1);
  }
  Object.keys(byId).forEach(d);
  return depth;
}

function kinshipCoefficient(aId, bId, byId, depthOf, memo) {
  if (!aId || !bId || !byId[aId] || !byId[bId]) return 0;
  const key = aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
  if (memo.has(key)) return memo.get(key);

  let result;
  if (aId === bId) {
    const bird = byId[aId];
    result = 0.5 * (1 + kinshipCoefficient(bird.fatherID, bird.motherID, byId, depthOf, memo));
  } else {
    const expandId = (depthOf[aId] ?? 0) >= (depthOf[bId] ?? 0) ? aId : bId;
    const otherId = expandId === aId ? bId : aId;
    const expand = byId[expandId];
    result = !expand.fatherID && !expand.motherID ? 0 : 0.5 * (
      kinshipCoefficient(expand.fatherID, otherId, byId, depthOf, memo) +
      kinshipCoefficient(expand.motherID, otherId, byId, depthOf, memo)
    );
  }
  memo.set(key, result);
  return result;
}

// F: inbreeding coefficient of a hypothetical offspring of A and B.
// R: coefficient of relatedness between A and B themselves.
function calculateCoi(aId, bId, byId) {
  const depthOf = computeGenerationDepths(byId);
  const memo = new Map();
  const F = kinshipCoefficient(aId, bId, byId, depthOf, memo);
  const a = byId[aId], b = byId[bId];
  const Fa = kinshipCoefficient(a.fatherID, a.motherID, byId, depthOf, memo);
  const Fb = kinshipCoefficient(b.fatherID, b.motherID, byId, depthOf, memo);
  const denom = Math.sqrt((1 + Fa) * (1 + Fb));
  return { F, R: denom > 0 ? (2 * F) / denom : 0 };
}

function describeRelationship(aId, bId, byId) {
  const a = byId[aId], b = byId[bId];
  const describeDirect = (n, ancestorName, descendantName) => {
    if (n === 1) return `${descendantName} is a direct offspring of ${ancestorName} — they are parent and offspring.`;
    if (n === 2) return `${descendantName} is a grandchild of ${ancestorName} — they are grandparent and grandchild.`;
    return `${descendantName} is a descendant of ${ancestorName}, ${n} generations back.`;
  };

  const ancA = ancestorDepths(aId, byId);
  const ancB = ancestorDepths(bId, byId);
  if (ancA.has(bId)) return describeDirect(ancA.get(bId), b.name, a.name);
  if (ancB.has(aId)) return describeDirect(ancB.get(aId), a.name, b.name);

  const sameMother = a.motherID && a.motherID === b.motherID;
  const sameFather = a.fatherID && a.fatherID === b.fatherID;
  if (sameMother && sameFather) return "These two birds are full siblings — they share the same mother and father.";
  if (sameMother || sameFather) return "These two birds are half-siblings — they share one parent.";

  let closest = null;
  ancA.forEach((dA, id) => {
    if (ancB.has(id)) {
      const dB = ancB.get(id);
      if (!closest || dA + dB < closest.dA + closest.dB) closest = { id, dA, dB };
    }
  });

  if (closest) {
    const ancestor = byId[closest.id];
    const { dA, dB } = closest;
    if (dA + dB === 3) { // one generation on one side, two on the other
      return `These two birds share a grandparent (${ancestor.name}) — one is the other's aunt/uncle.`;
    }
    if (dA === 2 && dB === 2) {
      return `These two birds share a grandparent (${ancestor.name}).`;
    }
    return `These two birds share a common ancestor, ${ancestor.name}, ${dA} generation(s) back on one side and ${dB} on the other.`;
  }

  return "No shared ancestry was found between these two birds in the available pedigree.";
}

function refreshCoiPanelIfOpen() {
  if (document.getElementById('coiPanel').style.display !== 'none') renderCoiPanel();
}

function renderCoiPanel() {
  const content = document.getElementById('coiContent');

  if (selectedBirds.size !== 2) {
    content.innerHTML = `<p class="coi-hint">Select exactly two birds to compare (currently ${selectedBirds.size} selected).</p>`;
    return;
  }

  const [aId, bId] = selectedBirds;
  const a = data.find(b => b.id === aId);
  const b = data.find(b => b.id === bId);
  if (!a || !b) {
    content.innerHTML = `<p class="coi-hint">Could not find the selected birds.</p>`;
    return;
  }

  const sexA = (a.sex || '').trim().toUpperCase();
  const sexB = (b.sex || '').trim().toUpperCase();

  if (sexA && sexB && sexA === sexB) {
    const sexWord = sexA === 'F' ? 'female' : 'male';
    content.innerHTML = `<p class="coi-samesex">${a.name} and ${b.name} are both ${sexWord} and cannot be bred together.</p>`;
    return;
  }

  const byId = Object.fromEntries(data.map(bd => [String(bd.id), bd]));
  const { F, R } = calculateCoi(aId, bId, byId);
  const relationship = describeRelationship(aId, bId, byId);
  const Fpct = F * 100, Rpct = R * 100;

  let tier;
  if (Fpct < 3)        tier = { label: 'Safe to breed', cls: 'tier-safe' };
  else if (Fpct < 12.5) tier = { label: 'Caution: mild inbreeding risk', cls: 'tier-caution' };
  else if (Fpct < 25)   tier = { label: 'Warning: significant health risks likely', cls: 'tier-warning' };
  else                  tier = { label: 'Warning: Serious health problems could result!', cls: 'tier-danger' };

  const meterPct = Math.min(100, (Fpct / 50) * 100);

  content.innerHTML = `
    <div class="coi-pair">${a.name} <span>&times;</span> ${b.name}</div>
    <div class="coi-stat"><span>Coefficient of Relatedness (R)</span><strong>${Rpct.toFixed(1)}%</strong></div>
    <div class="coi-stat"><span>Coefficient of Inbreeding (F)</span><strong>${Fpct.toFixed(1)}%</strong></div>
    <div class="coi-meter">
      <div class="coi-meter-track"><div class="coi-meter-marker" style="left:${meterPct}%"></div></div>
      <div class="coi-meter-labels"><span>Safe to breed</span><span>Completely related</span></div>
    </div>
    <div class="coi-conclusion ${tier.cls}">${tier.label}</div>
    <p class="coi-relationship">${relationship}</p>
  `;
}

document.getElementById('coiToolBtn').addEventListener('click', () => {
  const panel = document.getElementById('coiPanel');
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'block' : 'none';
  if (opening) renderCoiPanel();
});
document.getElementById('coiCloseBtn').addEventListener('click', () => {
  document.getElementById('coiPanel').style.display = 'none';
});
document.getElementById('coiInfoBtn').addEventListener('click', () => {
  document.getElementById('coiInfoModal').style.display = 'block';
});


// -------------------- Mutation Predictor -------------------- //
//
// One generic Mendelian engine shared by every species: each entry in SPECIES_PROFILES
// supplies its own gene list (with inheritance type), how to recognize its birds, how to
// read a phenotype out of the free-text mutation field, and how to name a resulting
// genotype. A bird's spreadsheet entry only records what it looks like, not what it
// silently carries, so genotypes are reconstructed from (1) the bird's own visible
// phenotype and (2) "proven" splits inferred from its recorded offspring in the pedigree —
// no new data entry required, at the cost of not being able to detect a split that's never
// been bred to reveal it (predictions are a floor). Started from the Green-Cheek Conure
// switches prototype in archive/research/Mutation Switches/birdGenetics.html.

function normalizeMutationText(text) {
  return (text || '').trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');
}

// Some real-world spreadsheets record the mutation name under "subspecies" instead of
// "mutation" (this app's own Cockatiel sample rows used to, until it was cleaned up) --
// search both rather than assume one column holds it.
function mutationSourceText(bird) {
  return normalizeMutationText(`${bird.mutation || ''} ${bird.subspecies || ''}`);
}

// ----- Generic Mendelian engine (shared by every species profile) ----- //

// Distribution of a hypothetical offspring's copies (0/1/2) of one gene's mutant allele,
// given each parent's copies. Sex-linked genes get the ZW-specific treatment (a daughter's
// single Z comes only from the father); every other inheritance type -- simple recessive,
// simple dominant, incomplete dominant -- uses the same autosomal Mendelian transmission,
// since they differ only in how "copies" maps to a visible phenotype, not in how they pass
// from parent to offspring.
function geneOffspringDistribution(gene, motherCopies, fatherCopies, offspringSex) {
  const pFather = fatherCopies / 2;
  if (gene.inheritance === 'sexlinked') {
    if (offspringSex === 'daughter') {
      return [{ copies: 0, probability: 1 - pFather }, { copies: 2, probability: pFather }]; // her Z comes only from dad
    }
    const pMother = motherCopies / 2;
    const outcomes = {};
    [[1 - pMother, 0], [pMother, 1]].forEach(([pm, m]) => {
      [[1 - pFather, 0], [pFather, 1]].forEach(([pf, f]) => {
        const c = m + f; outcomes[c] = (outcomes[c] || 0) + pm * pf;
      });
    });
    return Object.entries(outcomes).map(([c, p]) => ({ copies: +c, probability: p }));
  }
  const pMother = motherCopies / 2;
  const outcomes = {};
  [[1 - pMother, 0], [pMother, 1]].forEach(([pm, m]) => {
    [[1 - pFather, 0], [pFather, 1]].forEach(([pf, f]) => {
      const c = m + f; outcomes[c] = (outcomes[c] || 0) + pm * pf;
    });
  });
  return Object.entries(outcomes).map(([c, p]) => ({ copies: +c, probability: p }));
}

// The visible label this gene contributes at a given copy count, or null if invisible.
// Simple dominant genes look the same at 1 or 2 copies (no "single/double factor" visual
// distinction); incomplete-dominant genes look genuinely different at every copy count.
function geneVisualLabel(gene, copies) {
  if (gene.inheritance === 'incompleteDominant') return gene.states[copies] || null;
  if (gene.inheritance === 'dominant') return copies >= 1 ? gene.label : null;
  return copies === 2 ? gene.label : null; // recessive or sexlinked-recessive
}

// Splits an owner-supplied "splits" column into this species' matching gene keys. Lets you
// record what a previous owner told you about a bird's known carrier status -- e.g. proven
// through pairings you don't have the pedigree for -- even when the pedigree we do have
// can't prove it. Free text, comma/slash/semicolon-separated, matched against each gene's
// label (e.g. "Cinnamon, Pied" or "Cinnamon / Pied").
function parseDeclaredSplits(bird, profile) {
  const raw = (bird.splits || '').toLowerCase();
  const declared = new Set();
  if (!raw.trim()) return declared;
  const tokens = raw.split(/[,/;]+/).map(t => t.trim()).filter(Boolean);
  profile.genes.forEach(g => {
    const label = g.label.toLowerCase();
    if (tokens.some(t => t === label || t.includes(label))) declared.add(g.key);
  });
  return declared;
}

// { copies, tag } for one bird at one gene. tag is 'visual' | 'split' | 'split-declared' |
// 'clear' | 'unknown' -- 'unknown' is treated as clear (copies: 0) for the headline
// prediction, flagged in the UI since it's an assumption, not a fact proven by the pedigree
// or declared by the owner.
function geneStatus(bird, gene, profile, allBirds) {
  const ownCopies = profile.parseVisualStates(mutationSourceText(bird))[gene.key] || 0;

  if (gene.inheritance === 'incompleteDominant') {
    return { copies: ownCopies, tag: ownCopies === 0 ? 'clear' : 'visual' }; // always fully visible, no hidden state
  }
  if (gene.inheritance === 'dominant') {
    if (ownCopies === 0) return { copies: 0, tag: 'clear' }; // not showing it is definitive
    return { copies: ownCopies, tag: 'visual' }; // showing it -- single/double factor assumed, not provable here
  }

  // recessive or sexlinked-recessive
  if (ownCopies === 2) return { copies: 2, tag: 'visual' };
  const sex = (bird.sex || '').trim().toUpperCase();
  if (gene.inheritance === 'sexlinked' && sex === 'F') {
    return { copies: 0, tag: 'clear' }; // a hen can't hide a sex-linked recessive
  }
  if (parseDeclaredSplits(bird, profile).has(gene.key)) {
    return { copies: 1, tag: 'split-declared' };
  }
  const children = allBirds.filter(c => c.motherID === bird.id || c.fatherID === bird.id);
  const provenSplit = children.some(c => (profile.parseVisualStates(mutationSourceText(c))[gene.key] || 0) === 2);
  if (provenSplit) return { copies: 1, tag: 'split' };
  return { copies: 0, tag: 'unknown' };
}

function statusOf(bird, profile, allBirds) {
  const status = {};
  profile.genes.forEach(g => { status[g.key] = geneStatus(bird, g, profile, allBirds); });
  return status;
}

// Full named-phenotype probability distribution for a hypothetical son or daughter.
function offspringDistribution(profile, motherStatus, fatherStatus, offspringSex) {
  let combos = [{ states: {}, probability: 1 }];
  profile.genes.forEach(g => {
    const dist = geneOffspringDistribution(g, motherStatus[g.key].copies, fatherStatus[g.key].copies, offspringSex);
    const next = [];
    combos.forEach(c => dist.forEach(d => {
      if (d.probability > 0) next.push({ states: { ...c.states, [g.key]: d.copies }, probability: c.probability * d.probability });
    }));
    combos = next;
  });

  const byName = new Map(); // combos with the same visible name (e.g. carrier vs clear) collapse together
  combos.forEach(c => {
    const name = profile.nameForStates(c.states);
    byName.set(name, (byName.get(name) || 0) + c.probability);
  });
  return [...byName.entries()]
    .map(([name, probability]) => ({ name, probability }))
    .filter(r => r.probability > 1e-9)
    .sort((a, b) => b.probability - a.probability);
}

function combineDistributions(sonDist, daughterDist) {
  const byName = new Map();
  sonDist.forEach(r => byName.set(r.name, (byName.get(r.name) || 0) + r.probability * 0.5));
  daughterDist.forEach(r => byName.set(r.name, (byName.get(r.name) || 0) + r.probability * 0.5));
  return [...byName.entries()].map(([name, probability]) => ({ name, probability })).sort((a, b) => b.probability - a.probability);
}

// Default naming: base name, plus every gene's visible label, in gene-list order.
function genericComposeName(genes, baseName, states) {
  const labels = genes.map(g => geneVisualLabel(g, states[g.key])).filter(Boolean);
  return labels.length ? labels.join(' ') : baseName;
}

// ----- Species profiles ----- //

function matchesSciOrCommonName(bird, { genus, species, subspeciesIncludes = [], speciesIncludes = [] }) {
  const g = (bird.scigenus || '').trim().toLowerCase();
  const s = (bird.scispecies || '').trim().toLowerCase();
  if (genus && species && g === genus && s === species) return true;
  if (!subspeciesIncludes.length || !speciesIncludes.length) return false;
  const sub = (bird.subspecies || '').trim().toLowerCase();
  const sp = (bird.species || '').trim().toLowerCase();
  return subspeciesIncludes.some(k => sub.includes(k)) && speciesIncludes.some(k => sp.includes(k));
}

const SPECIES_PROFILES = [
  // ----- Green-Cheek Conure (Pyrrhura molinae) ----- //
  {
    id: 'green-cheek-conure',
    label: 'Green-Cheek Conure',
    matches: bird => matchesSciOrCommonName(bird, {
      genus: 'pyrrhura', species: 'molinae', subspeciesIncludes: ['green'], speciesIncludes: ['conure'],
    }),
    genes: [
      { key: 'dilute', label: 'Dilute', inheritance: 'recessive' },
      { key: 'opaline', label: 'Opaline', inheritance: 'sexlinked' },
      { key: 'cinnamon', label: 'Cinnamon', inheritance: 'sexlinked' },
      { key: 'turquoise', label: 'Turquoise', inheritance: 'recessive' },
    ],
    baseName: 'Normal',
    nicknameBits: {
      'normal': '0000', 'turquoise': '0001', 'turqoise': '0001', 'turqouise': '0001',
      'cinnamon': '0010', 'turquoise cinnamon': '0011',
      'opaline': '0100', 'yellow sided': '0100', 'turquoise yellow sided': '0101',
      'pineapple': '0110', 'turquoise cinnamon yellow sided': '0111',
      'dilute': '1000', 'mint': '1001', 'dilute cinnamon': '1010', 'cinnamint': '1011',
      'dilute yellow sided': '1100', 'dillute yellow sided': '1100',
      'opamint': '1101', 'suncheek': '1110', 'mooncheek': '1111',
    },
    parseVisualStates(raw) {
      const bits = this.nicknameBits[raw];
      if (bits) return { dilute: +bits[0] * 2, opaline: +bits[1] * 2, cinnamon: +bits[2] * 2, turquoise: +bits[3] * 2 };
      return {
        dilute: /dilut/.test(raw) ? 2 : 0,
        opaline: (/opalin/.test(raw) || /yellow ?sided/.test(raw)) ? 2 : 0,
        cinnamon: /cinnamon/.test(raw) ? 2 : 0,
        turquoise: /turqu?o?ise/.test(raw) ? 2 : 0,
      };
    },
    nameForStates(states) { return genericComposeName(this.genes, this.baseName, states); },
  },

  // ----- Cockatiel (Nymphicus hollandicus) ----- //
  {
    id: 'cockatiel',
    label: 'Cockatiel',
    matches: bird => matchesSciOrCommonName(bird, {
      genus: 'nymphicus', species: 'hollandicus', speciesIncludes: ['cockatiel'],
    }),
    genes: [
      { key: 'pied', label: 'Pied', inheritance: 'recessive' },
      { key: 'whiteface', label: 'Whiteface', inheritance: 'recessive' },
      { key: 'fallow', label: 'Fallow', inheritance: 'recessive' },
      { key: 'cinnamon', label: 'Cinnamon', inheritance: 'sexlinked' },
      { key: 'pearl', label: 'Pearl', inheritance: 'sexlinked' },
      { key: 'lutino', label: 'Lutino', inheritance: 'sexlinked' },
      { key: 'silver', label: 'Silver', inheritance: 'incompleteDominant', states: [null, 'Single Factor Silver', 'Double Factor Silver'] },
    ],
    baseName: 'Normal Grey',
    parseVisualStates(raw) {
      return {
        pied: /\bpied\b/.test(raw) ? 2 : 0,
        whiteface: /white ?face/.test(raw) ? 2 : 0,
        fallow: /fallow/.test(raw) ? 2 : 0,
        cinnamon: /cinnamon/.test(raw) ? 2 : 0,
        pearl: /pearl/.test(raw) ? 2 : 0,
        lutino: /lutino/.test(raw) ? 2 : 0,
        silver: /silver/.test(raw) ? (/double/.test(raw) ? 2 : 1) : 0,
      };
    },
    nameForStates(states) { return genericComposeName(this.genes, this.baseName, states); },
  },

  // ----- Indian Ringneck Parakeet (Psittacula krameri) ----- //
  {
    id: 'indian-ringneck',
    label: 'Indian Ringneck Parakeet',
    matches: bird => matchesSciOrCommonName(bird, {
      genus: 'psittacula', species: 'krameri', subspeciesIncludes: ['ringneck'], speciesIncludes: ['parakeet'],
    }),
    genes: [
      { key: 'blue', label: 'Blue', inheritance: 'recessive' },
      { key: 'pied', label: 'Pied', inheritance: 'recessive' },
      { key: 'dilute', label: 'Dilute', inheritance: 'recessive' },
      { key: 'grey', label: 'Grey', inheritance: 'dominant' },
      { key: 'cinnamon', label: 'Cinnamon', inheritance: 'sexlinked' },
      { key: 'lutino', label: 'Lutino', inheritance: 'sexlinked' },
    ],
    baseName: 'Green',
    parseVisualStates(raw) {
      return {
        blue: /\bblue\b/.test(raw) ? 2 : 0,
        pied: /\bpied\b/.test(raw) ? 2 : 0,
        dilute: /dilut/.test(raw) ? 2 : 0,
        grey: /\bgrey\b|\bgray\b|slaty/.test(raw) ? 1 : 0,
        cinnamon: /cinnamon/.test(raw) ? 2 : 0,
        lutino: /lutino/.test(raw) ? 2 : 0,
      };
    },
    nameForStates(states) {
      const base = states.blue === 2 ? 'Blue' : this.baseName;
      const others = this.genes.filter(g => g.key !== 'blue').map(g => geneVisualLabel(g, states[g.key])).filter(Boolean);
      return others.length ? `${base} ${others.join(' ')}` : base;
    },
  },

  // ----- Peach-Faced Lovebird (Agapornis roseicollis) ----- //
  {
    id: 'peachfaced-lovebird',
    label: 'Peach-Faced Lovebird',
    matches: bird => matchesSciOrCommonName(bird, {
      genus: 'agapornis', species: 'roseicollis', subspeciesIncludes: ['peach'], speciesIncludes: ['lovebird'],
    }),
    genes: [
      { key: 'blue', label: 'Blue', inheritance: 'recessive' },
      { key: 'darkFactor', label: 'Dark Factor', inheritance: 'incompleteDominant', states: [null, null, null] }, // resolved jointly with blue below
      { key: 'violet', label: 'Violet', inheritance: 'incompleteDominant', states: [null, 'Violet', 'Full Violet'] },
      { key: 'pied', label: 'Pied', inheritance: 'recessive' },
      { key: 'pallid', label: 'Pallid', inheritance: 'recessive' },
      { key: 'cinnamon', label: 'Cinnamon', inheritance: 'sexlinked' },
    ],
    baseName: 'Normal',
    // Blue x Dark Factor is a classic joint-named 2-gene grid, not two independent labels.
    colorGrid: {
      '0,0': 'Normal', '0,1': 'Olive', '0,2': 'Jade',
      '2,0': 'Blue', '2,1': 'Cobalt', '2,2': 'Mauve',
    },
    parseVisualStates(raw) {
      const gridMatch = Object.entries({
        normal: [0, 0], green: [0, 0], olive: [0, 1], jade: [0, 2], 'deep olive': [0, 2],
        blue: [2, 0], cobalt: [2, 1], mauve: [2, 2],
      }).find(([word]) => new RegExp(`\\b${word}\\b`).test(raw));
      const [blue, darkFactor] = gridMatch ? gridMatch[1] : [/\bblue\b/.test(raw) ? 2 : 0, 0];
      return {
        blue, darkFactor,
        violet: /violet/.test(raw) ? (/full/.test(raw) ? 2 : 1) : 0,
        pied: /\bpied\b/.test(raw) ? 2 : 0,
        pallid: /pallid/.test(raw) ? 2 : 0,
        cinnamon: /cinnamon/.test(raw) ? 2 : 0,
      };
    },
    nameForStates(states) {
      const base = this.colorGrid[`${states.blue === 2 ? 2 : 0},${states.darkFactor}`] || this.baseName;
      const others = this.genes
        .filter(g => g.key !== 'blue' && g.key !== 'darkFactor')
        .map(g => geneVisualLabel(g, states[g.key])).filter(Boolean);
      return others.length ? `${base} ${others.join(' ')}` : base;
    },
  },

  // ----- Gouldian Finch (Chloebia gouldiae) ----- //
  // Core 3-gene model (head/body/breast color); doesn't cover rarer factors like Dilute or
  // Lightback.
  {
    id: 'gouldian-finch',
    label: 'Gouldian Finch',
    matches: bird => matchesSciOrCommonName(bird, {
      genus: 'chloebia', species: 'gouldiae', speciesIncludes: ['gouldian'],
    }),
    genes: [
      { key: 'redHead', label: 'Red-Headed', inheritance: 'sexlinked' },
      { key: 'blueBody', label: 'Blue', inheritance: 'recessive' },
      { key: 'whiteBreast', label: 'White-Breasted', inheritance: 'recessive' },
    ],
    baseName: 'Black-Headed Green',
    parseVisualStates(raw) {
      // Yellow/orange-headed is Red-Headed + Blue body combined, not text containing
      // "red" or "blue" -- has to be recognized as its own phenotype name first.
      if (/yellow.?head|orange.?head/.test(raw)) {
        return { redHead: 2, blueBody: 2, whiteBreast: /white.?breast/.test(raw) ? 2 : 0 };
      }
      return {
        redHead: /red.?head/.test(raw) ? 2 : 0,
        blueBody: /\bblue\b/.test(raw) ? 2 : 0,
        whiteBreast: /white.?breast/.test(raw) ? 2 : 0,
      };
    },
    nameForStates(states) {
      // Yellow/orange-headed is Red-Headed + Blue body combined, not its own gene.
      const head = states.redHead === 2
        ? (states.blueBody === 2 ? 'Yellow-Headed' : 'Red-Headed')
        : 'Black-Headed';
      const body = states.blueBody === 2 ? 'Blue' : 'Green';
      const breast = states.whiteBreast === 2 ? 'White-Breasted' : null;
      return [head, body, breast].filter(Boolean).join(' ');
    },
  },
];

function matchSpeciesProfile(bird) {
  return SPECIES_PROFILES.find(p => p.matches(bird)) || null;
}

function geneStatusLabel(tag) {
  return {
    visual: 'visual', split: 'split (proven)', 'split-declared': 'split (declared)',
    clear: 'clear', unknown: 'clear (unproven)',
  }[tag] || tag;
}

function renderGeneStatusRow(gene, status) {
  return `<span class="gene-chip gene-${status.tag}">${gene.label}: ${geneStatusLabel(status.tag)}</span>`;
}

function renderOutcomeList(rows, limit = 6) {
  const shown = rows.filter(r => r.probability > 0.001).slice(0, limit);
  return shown.map(r => `
    <div class="outcome-row">
      <span class="outcome-name">${r.name}</span>
      <span class="outcome-bar"><span style="width:${Math.min(100, r.probability * 100)}%"></span></span>
      <span class="outcome-pct">${(r.probability * 100).toFixed(1)}%</span>
    </div>`).join('');
}

function refreshMutationPanelIfOpen() {
  if (document.getElementById('mutationPanel').style.display !== 'none') renderMutationPanel();
}

function renderMutationPanel() {
  const content = document.getElementById('mutationContent');
  const byId = Object.fromEntries(data.map(bd => [String(bd.id), bd]));
  const selected = [...selectedBirds].map(id => byId[id]).filter(Boolean);
  const supportedNames = SPECIES_PROFILES.map(p => p.label).join(', ');

  if (selected.length === 0) {
    content.innerHTML = `<p class="coi-hint">Select one bird to search for a mate, or two to predict their offspring. Supports: ${supportedNames}.</p>`;
    return;
  }
  if (selected.length > 2) {
    content.innerHTML = `<p class="coi-hint">Select just one or two birds for this tool (currently ${selected.length} selected).</p>`;
    return;
  }

  const profiles = selected.map(matchSpeciesProfile);
  if (profiles.some(p => !p)) {
    content.innerHTML = `<p class="coi-hint">This tool currently only supports: ${supportedNames}.</p>`;
    return;
  }
  if (profiles.length === 2 && profiles[0].id !== profiles[1].id) {
    content.innerHTML = `<p class="coi-hint">${selected[0].name} (${profiles[0].label}) and ${selected[1].name} (${profiles[1].label}) are different species and can't be bred together.</p>`;
    return;
  }

  const profile = profiles[0];
  if (selected.length === 1) {
    renderMateSearch(content, selected[0], profile, byId);
    return;
  }

  const [a, b] = selected;
  const sexA = (a.sex || '').trim().toUpperCase(), sexB = (b.sex || '').trim().toUpperCase();
  if (sexA && sexB && sexA === sexB) {
    content.innerHTML = `<p class="coi-samesex">${a.name} and ${b.name} are both ${sexA === 'F' ? 'female' : 'male'} and cannot be bred together.</p>`;
    return;
  }

  const mother = sexA === 'F' ? a : b, father = sexA === 'F' ? b : a;
  renderPairPrediction(content, mother, father, profile, data);
}

function renderPairPrediction(content, mother, father, profile, allBirds) {
  const motherStatus = statusOf(mother, profile, allBirds);
  const fatherStatus = statusOf(father, profile, allBirds);
  const sonDist = offspringDistribution(profile, motherStatus, fatherStatus, 'son');
  const daughterDist = offspringDistribution(profile, motherStatus, fatherStatus, 'daughter');
  const combined = combineDistributions(sonDist, daughterDist);
  const anyUnknown = profile.genes.some(g => motherStatus[g.key].tag === 'unknown' || fatherStatus[g.key].tag === 'unknown');
  const hasSexLinked = profile.genes.some(g => g.inheritance === 'sexlinked');

  content.innerHTML = `
    <div class="coi-pair">${mother.name} <span>&times;</span> ${father.name}</div>
    <p class="coi-hint">${profile.label}</p>
    <div class="gene-status-block">
      <div><strong>${mother.name}</strong> (mother): ${profile.genes.map(g => renderGeneStatusRow(g, motherStatus[g.key])).join(' ')}</div>
      <div><strong>${father.name}</strong> (father): ${profile.genes.map(g => renderGeneStatusRow(g, fatherStatus[g.key])).join(' ')}</div>
    </div>
    <h4 class="mutation-section-title">Likely outcomes</h4>
    <div class="outcome-list">${renderOutcomeList(combined)}</div>
    ${hasSexLinked ? `
    <details class="sex-breakdown">
      <summary>Some of these genes are sex-linked — odds differ for sons vs. daughters</summary>
      <div class="sex-breakdown-cols">
        <div><h5>As sons</h5>${renderOutcomeList(sonDist, 4)}</div>
        <div><h5>As daughters</h5>${renderOutcomeList(daughterDist, 4)}</div>
      </div>
    </details>` : ''}
    ${anyUnknown ? `<p class="coi-hint">Genes marked "clear (unproven)" have never been proven either way by an offspring — actual results could include more than shown here.</p>` : ''}
  `;
}

function renderMateSearch(content, bird, profile, byId) {
  // Enumerate every reachable outcome name by brute-forcing all copy-count combinations
  // (0/1/2 per gene) so the dropdown only offers names this species profile can actually
  // produce -- including joint-named combinations (e.g. a lovebird's Cobalt needs its Blue
  // and Dark Factor genes non-zero at the same time, so genes can't be enumerated one at a
  // time in isolation).
  let combos = [{}];
  profile.genes.forEach(g => {
    const next = [];
    combos.forEach(c => [0, 1, 2].forEach(v => next.push({ ...c, [g.key]: v })));
    combos = next;
  });
  const allNames = new Set(combos.map(c => profile.nameForStates(c)));
  const optionsHtml = [...allNames].sort().map(name => `<option value="${name}">${name}</option>`).join('');

  content.innerHTML = `
    <div class="coi-pair">Best mate for ${bird.name}</div>
    <p class="coi-hint">${profile.label}</p>
    <label class="mate-search-label">Desired outcome in the chicks:
      <select id="mateDesiredOutcome">${optionsHtml}</select>
    </label>
    <button id="mateSearchBtn" class="tool-btn" style="margin-top:8px;">Search my collection</button>
    <div id="mateSearchResults"></div>
  `;

  document.getElementById('mateSearchBtn').addEventListener('click', () => {
    const desiredName = document.getElementById('mateDesiredOutcome').value;
    const sex = (bird.sex || '').trim().toUpperCase();
    if (!sex) {
      document.getElementById('mateSearchResults').innerHTML =
        `<p class="coi-hint">${bird.name}'s sex isn't recorded, so candidate mates can't be filtered.</p>`;
      return;
    }
    const candidates = data.filter(other => {
      if (other.id === bird.id) return false;
      const otherProfile = matchSpeciesProfile(other);
      if (!otherProfile || otherProfile.id !== profile.id) return false;
      const otherSex = (other.sex || '').trim().toUpperCase();
      return otherSex && otherSex !== sex;
    });

    const ranked = candidates.map(other => {
      const mother = sex === 'F' ? bird : other, father = sex === 'F' ? other : bird;
      const motherStatus = statusOf(mother, profile, data);
      const fatherStatus = statusOf(father, profile, data);
      const combined = combineDistributions(
        offspringDistribution(profile, motherStatus, fatherStatus, 'son'),
        offspringDistribution(profile, motherStatus, fatherStatus, 'daughter')
      );
      const match = combined.find(r => r.name === desiredName);
      return { other, probability: match ? match.probability : 0 };
    }).filter(r => r.probability > 0.001)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 6);

    const results = document.getElementById('mateSearchResults');
    if (!ranked.length) {
      results.innerHTML = `<p class="coi-hint">No bird in your collection has any real chance of producing "${desiredName}" with ${bird.name}.</p>`;
      return;
    }
    results.innerHTML = ranked.map(({ other, probability }) => {
      const relationship = describeRelationship(bird.id, other.id, byId);
      return `
        <div class="mate-result">
          <div class="outcome-row">
            <span class="outcome-name">${other.name}</span>
            <span class="outcome-bar"><span style="width:${Math.min(100, probability * 100)}%"></span></span>
            <span class="outcome-pct">${(probability * 100).toFixed(1)}%</span>
          </div>
          <div class="mate-relationship">${relationship}</div>
        </div>`;
    }).join('');
  });
}

document.getElementById('mutationToolBtn').addEventListener('click', () => {
  const panel = document.getElementById('mutationPanel');
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'block' : 'none';
  if (opening) renderMutationPanel();
});
document.getElementById('mutationCloseBtn').addEventListener('click', () => {
  document.getElementById('mutationPanel').style.display = 'none';
});
document.getElementById('mutationInfoBtn').addEventListener('click', () => {
  document.getElementById('mutationInfoModal').style.display = 'block';
});



// -------------------- Modal Popups --------------------

document.addEventListener('click', e=>{
  if(e.target.id==='learnMoreLink'){ e.preventDefault(); document.getElementById('learnMoreModal').style.display='block'; }
  if(e.target.classList.contains('modal')) e.target.style.display='none';
});
document.querySelectorAll('.close-modal').forEach(btn => {
  btn.onclick = () => { btn.closest('.modal').style.display = 'none'; };
});
updateIntro();


// -------------------- Sidebar & Bottom Pane Resizing --------------------

document.addEventListener('DOMContentLoaded', () => {
  // ---- Sidebar Horizontal Resize ----
  const sidebar = document.getElementById('sidebar');
  const sidebarResizer = document.getElementById('sidebar-resizer');

  let isResizingSidebar = false;
  let sidebarFrameId = null;

  sidebarResizer.addEventListener('mousedown', e => {
    isResizingSidebar = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  });

  window.addEventListener('mousemove', e => {
    if (!isResizingSidebar) return;
    if (sidebarFrameId) return;

    sidebarFrameId = requestAnimationFrame(() => {
      sidebarFrameId = null;
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 200), 600);
      sidebar.style.width = newWidth + 'px';
    });
  });

  window.addEventListener('mouseup', () => {
    if (!isResizingSidebar) return;
    isResizingSidebar = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // ---- Bottom Pane Vertical Resize ----

  const listPane = document.getElementById('list-pane');
  const listResizer = document.getElementById('list-resizer');
  let isResizingList = false;
  let listFrameId = null;
  let startY = 0;
  let startHeight = 0;

  function resizeBirdTable() {
    const headerHeight = listPane.querySelector('h3').offsetHeight;
    const newHeight = listPane.clientHeight - headerHeight;

    const scrollBody = document.querySelector('#bird-table_wrapper .dataTables_scrollBody');
    if (scrollBody) scrollBody.style.height = newHeight + 'px';

    if (birdTable) {
      birdTable.settings()[0].oScroll.sY = newHeight + "px";
      birdTable.draw(false); // redraw without resetting paging
    }
  }

  listResizer.addEventListener('mousedown', e => {
    isResizingList = true;
    startY = e.clientY;
    startHeight = listPane.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!isResizingList) return;
    if (listFrameId) return;

    listFrameId = requestAnimationFrame(() => {
      listFrameId = null;
      let dy = startY - e.clientY;
      let newHeight = startHeight + dy;
      newHeight = Math.max(100, Math.min(600, newHeight)); // clamp
      listPane.style.height = newHeight + 'px';
      resizeBirdTable();
    });
  });

  window.addEventListener('mouseup', () => {
    if (!isResizingList) return;
    isResizingList = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // ---- Initial table resize ----
  resizeBirdTable();

  // ---- Listen for checkboxes ----
  ["showParents", "showSiblings", "showOffspring", "showConsang"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    drawGraph(selectedBirds, data);
    });
  });

});
