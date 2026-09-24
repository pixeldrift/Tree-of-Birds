
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
        modal.style.display = 'block';
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
    autoWidth: false, // important to prevent misalignment
    columns: [
      { title: "ID" },
      { title: "Sex" },
      { title: "Name" },
      { title: "Mutation" },
      { title: "Subspecies" },
      { title: "Species" },
      { title: "Scientific Name" },
      { title: "Family" }
    ]
  });
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

function ancestorsOf(id, byId, depth = 8) {
  const result = new Set();
  (function walk(curId, d) {
    if (!curId || d > depth) return;
    const b = byId[curId];
    if (!b) return;
    [b.motherID, b.fatherID].forEach(pid => {
      if (pid && byId[pid] && !result.has(pid)) {
        result.add(pid);
        walk(pid, d + 1);
      }
    });
  })(id, 0);
  return result;
}

function isConsanguineous(motherID, fatherID, byId) {
  if (!motherID || !fatherID) return false;
  const mAnc = ancestorsOf(motherID, byId), fAnc = ancestorsOf(fatherID, byId);
  if (mAnc.has(fatherID) || fAnc.has(motherID)) return true; // parent paired with own ancestor
  for (const a of mAnc) if (fAnc.has(a)) return true; // shared ancestor on both sides
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
    const d = edge.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
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


// -------------------- Modal Popup --------------------

const modal=document.getElementById('learnMoreModal');
document.addEventListener('click', e=>{
  if(e.target.id==='learnMoreLink'){ e.preventDefault(); modal.style.display='block'; }
  if(e.target===modal) modal.style.display='none';
});
document.querySelector('.close-modal').onclick=()=>{modal.style.display='none';};
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
