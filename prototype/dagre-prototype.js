const DATA_FILE = "../Geneology Sample Data - Sheet1.tsv";

let birds = [];
let byId = new Map();
let selectedIds = new Set();

Papa.parse(DATA_FILE, {
  download: true,
  header: true,
  delimiter: "\t",
  skipEmptyLines: true,
  complete: results => {
    birds = cleanRows(results.data);
    byId = new Map(birds.map(b => [b.id, b]));
    populateBirdOptions();
    renderGraph();
  },
  error: err => alert("Failed to load data: " + err)
});

function cleanRows(rows) {
  const pad = v => (v || "").toString().trim().padStart(3, "0");
  return rows
    .filter(d => d.id && d.name)
    .map(d => ({ ...d, id: pad(d.id), fatherID: pad(d.fatherID), motherID: pad(d.motherID) }));
}

// ----- ancestor lookup, used only to flag consanguineous pairings ----- //
const ancestorCache = new Map();
function ancestorsOf(id, depth = 8) {
  if (ancestorCache.has(id)) return ancestorCache.get(id);
  const result = new Set();
  (function walk(curId, d) {
    if (!curId || d > depth) return;
    const b = byId.get(curId);
    if (!b) return;
    [b.motherID, b.fatherID].forEach(pid => {
      if (pid && byId.has(pid) && !result.has(pid)) {
        result.add(pid);
        walk(pid, d + 1);
      }
    });
  })(id, 0);
  ancestorCache.set(id, result);
  return result;
}
function isConsanguineous(motherID, fatherID) {
  if (!motherID || !fatherID) return false;
  const mAnc = ancestorsOf(motherID), fAnc = ancestorsOf(fatherID);
  if (mAnc.has(fatherID) || fAnc.has(motherID)) return true; // parent paired with own ancestor
  for (const a of mAnc) if (fAnc.has(a)) return true; // shared ancestor on both sides
  return false;
}

// A "pairing" is just: these two birds (or one, if the other is unrecorded) produced
// offspring together. No marriage/spouse semantics — a bird can appear in several pairings.
const pairKey = (m, f) => `${m || ""}:${f || ""}`;
function normalizedKey(bird) { return pairKey(bird.motherID, bird.fatherID); }

// ----- Selection UI ----- //

function populateBirdOptions() {
  const datalist = document.getElementById("birdOptions");
  datalist.innerHTML = birds
    .map(b => `<option value="${b.id} — ${b.name}">`)
    .join("");
}

function resolveSearchInput(text) {
  text = (text || "").trim();
  if (!text) return null;
  const idMatch = text.match(/^(\d{3})\b/);
  if (idMatch && byId.has(idMatch[1])) return byId.get(idMatch[1]);
  const lower = text.toLowerCase();
  return birds.find(b => b.name.toLowerCase() === lower) ||
         birds.find(b => b.name.toLowerCase().includes(lower)) ||
         null;
}

function addBirdToSelection() {
  const input = document.getElementById("birdSearch");
  const bird = resolveSearchInput(input.value);
  if (!bird) { input.select(); return; }
  selectedIds.add(bird.id);
  input.value = "";
  renderGraph();
}

function toggleBirdSelection(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderGraph();
}

function renderSelectedChips() {
  const wrap = document.getElementById("selectedChips");
  wrap.innerHTML = "";
  selectedIds.forEach(id => {
    const bird = byId.get(id);
    if (!bird) return;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = bird.name;
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = "Remove from tree";
    remove.addEventListener("click", () => { selectedIds.delete(id); renderGraph(); });
    chip.appendChild(remove);
    wrap.appendChild(chip);
  });
}

document.getElementById("addBirdBtn").addEventListener("click", addBirdToSelection);
document.getElementById("birdSearch").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); addBirdToSelection(); }
});
["showParents", "showSiblings", "showOffspring", "showAll"].forEach(id => {
  document.getElementById(id).addEventListener("change", renderGraph);
});
document.getElementById("toggleConsang").addEventListener("change", () => applyConsangVisibility());

// ----- Build the visible subset of birds + pairings for the current selection ----- //

function computeVisibleSubset() {
  const showParents = document.getElementById("showParents").checked;
  const showSiblings = document.getElementById("showSiblings").checked;
  const showOffspring = document.getElementById("showOffspring").checked;

  const visibleBirds = new Set();
  const pairingDefs = new Map(); // key -> { motherID, fatherID }

  selectedIds.forEach(selId => {
    const bird = byId.get(selId);
    if (!bird) return;
    visibleBirds.add(bird.id);

    // --- Parents / siblings: the pairing that produced THIS bird --- //
    const hasKnownParent = bird.motherID || bird.fatherID;
    if ((showParents || showSiblings) && hasKnownParent) {
      const key = normalizedKey(bird);
      pairingDefs.set(key, { motherID: bird.motherID, fatherID: bird.fatherID });

      if (showParents) {
        if (bird.motherID) visibleBirds.add(bird.motherID);
        if (bird.fatherID) visibleBirds.add(bird.fatherID);
      }
      if (showSiblings) {
        birds.forEach(c => { if (normalizedKey(c) === key) visibleBirds.add(c.id); });
      }
    }

    // --- Offspring: every pairing where THIS bird is a parent --- //
    if (showOffspring) {
      birds.forEach(c => {
        if (c.motherID === bird.id || c.fatherID === bird.id) {
          const key = normalizedKey(c);
          pairingDefs.set(key, { motherID: c.motherID, fatherID: c.fatherID });
          visibleBirds.add(c.id);            // the child
          if (c.motherID) visibleBirds.add(c.motherID); // the mate, so the pairing makes sense
          if (c.fatherID) visibleBirds.add(c.fatherID);
        }
      });
    }
  });

  return { visibleBirds, pairingDefs };
}

// ----- Layout + render ----- //

function renderGraph() {
  renderSelectedChips();

  const showAll = document.getElementById("showAll").checked;
  let visibleBirds, pairingDefs;

  if (showAll) {
    visibleBirds = new Set(birds.map(b => b.id));
    pairingDefs = new Map();
    birds.forEach(b => {
      if (b.motherID || b.fatherID) pairingDefs.set(normalizedKey(b), { motherID: b.motherID, fatherID: b.fatherID });
    });
  } else if (selectedIds.size) {
    ({ visibleBirds, pairingDefs } = computeVisibleSubset());
  } else {
    document.getElementById("canvas").innerHTML = "";
    document.getElementById("emptyState").style.display = "flex";
    document.getElementById("stats").textContent = "";
    return;
  }

  document.getElementById("emptyState").style.display = "none";

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  visibleBirds.forEach(id => {
    const b = byId.get(id);
    const label = b.name || "(unnamed)";
    const width = Math.max(70, label.length * 6.2 + 20);
    g.setNode(id, { width, height: 32, label, bird: b });
  });

  let consangCount = 0;
  pairingDefs.forEach((def, key) => {
    const consang = isConsanguineous(def.motherID, def.fatherID);
    if (consang) consangCount++;
    g.setNode(key, { width: 12, height: 12, pairing: true, consang });
    if (def.motherID && visibleBirds.has(def.motherID)) g.setEdge(def.motherID, key);
    if (def.fatherID && visibleBirds.has(def.fatherID)) g.setEdge(def.fatherID, key);
    visibleBirds.forEach(cid => {
      const c = byId.get(cid);
      if (normalizedKey(c) === key) g.setEdge(key, cid);
    });
  });

  dagre.layout(g);
  draw(g);

  document.getElementById("stats").textContent =
    `${visibleBirds.size} birds shown · ${pairingDefs.size} pairings · ${consangCount} consanguineous`;
}

function draw(g) {
  const canvas = document.getElementById("canvas");
  canvas.innerHTML = "";
  const { width, height } = g.graph();
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  state.graphWidth = width;
  state.graphHeight = height;

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "edges");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  canvas.appendChild(svg);

  g.edges().forEach(e => {
    const edge = g.edge(e);
    const d = edge.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const targetNode = g.node(e.w);
    const consang = targetNode && targetNode.pairing && targetNode.consang;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "edge-line" + (consang ? " consang" : ""));
    svg.appendChild(path);
  });

  g.nodes().forEach(id => {
    const node = g.node(id);
    if (node.pairing) {
      const dot = document.createElement("div");
      dot.className = "pairing-dot" + (node.consang ? " consang" : "");
      dot.style.left = node.x - node.width / 2 + "px";
      dot.style.top = node.y - node.height / 2 + "px";
      canvas.appendChild(dot);
    } else {
      const b = node.bird;
      const sex = (b.sex || "").trim().toUpperCase();
      const card = document.createElement("div");
      card.className = "node-card " + (sex === "F" ? "female" : sex === "M" ? "male" : "") +
        (selectedIds.has(b.id) ? " selected" : "");
      card.style.left = node.x - node.width / 2 + "px";
      card.style.top = node.y - node.height / 2 + "px";
      card.style.width = node.width + "px";
      card.style.height = node.height + "px";
      card.textContent = node.label;
      card.title = `ID ${b.id} — ${b.mutation || ""} ${b.subspecies || ""} ${b.species || ""}`.trim();
      card.dataset.id = b.id;
      card.addEventListener("mousedown", e => e.stopPropagation()); // don't start a pan-drag
      card.addEventListener("click", () => toggleBirdSelection(b.id));
      canvas.appendChild(card);
    }
  });

  applyConsangVisibility();
  autoFit();
}

function applyConsangVisibility() {
  const show = document.getElementById("toggleConsang").checked;
  document.querySelectorAll(".edge-line.consang, .pairing-dot.consang")
    .forEach(el => { el.style.display = show ? "" : "none"; });
}

// ----- Pan & zoom (replacing what vis-network gave us for free) ----- //

const state = { pan: { x: 40, y: 20 }, zoom: 1, graphWidth: 0, graphHeight: 0 };
const viewport = document.getElementById("viewport");
const canvasEl = document.getElementById("canvas");

function applyTransform() {
  canvasEl.style.transform = `translate(${state.pan.x}px, ${state.pan.y}px) scale(${state.zoom})`;
}

function zoomAround(clientX, clientY, factor) {
  const rect = viewport.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  const newZoom = Math.min(3, Math.max(0.08, state.zoom * factor));
  const ratio = newZoom / state.zoom;
  state.pan.x = x - (x - state.pan.x) * ratio;
  state.pan.y = y - (y - state.pan.y) * ratio;
  state.zoom = newZoom;
  applyTransform();
}

function autoFit() {
  if (!state.graphWidth || !state.graphHeight) return;
  const rect = viewport.getBoundingClientRect();
  const pad = 60;
  const scale = Math.min(
    (rect.width - pad) / state.graphWidth,
    (rect.height - pad) / state.graphHeight,
    1.25
  );
  state.zoom = Math.max(scale, 0.05);
  state.pan.x = (rect.width - state.graphWidth * state.zoom) / 2;
  state.pan.y = (rect.height - state.graphHeight * state.zoom) / 2;
  applyTransform();
}

viewport.addEventListener("wheel", e => {
  e.preventDefault();
  zoomAround(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
}, { passive: false });

let dragging = false, dragStart = null;
viewport.addEventListener("mousedown", e => {
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY, panX: state.pan.x, panY: state.pan.y };
  viewport.classList.add("panning");
});
window.addEventListener("mousemove", e => {
  if (!dragging) return;
  state.pan.x = dragStart.panX + (e.clientX - dragStart.x);
  state.pan.y = dragStart.panY + (e.clientY - dragStart.y);
  applyTransform();
});
window.addEventListener("mouseup", () => { dragging = false; viewport.classList.remove("panning"); });

document.getElementById("zoomInBtn").addEventListener("click", () => {
  const r = viewport.getBoundingClientRect();
  zoomAround(r.left + r.width / 2, r.top + r.height / 2, 1.2);
});
document.getElementById("zoomOutBtn").addEventListener("click", () => {
  const r = viewport.getBoundingClientRect();
  zoomAround(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
});
document.getElementById("fitBtn").addEventListener("click", autoFit);
window.addEventListener("resize", autoFit);
