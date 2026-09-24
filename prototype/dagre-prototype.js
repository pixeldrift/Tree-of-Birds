const DATA_FILE = "../Geneology Sample Data - Sheet1.tsv";

Papa.parse(DATA_FILE, {
  download: true,
  header: true,
  delimiter: "\t",
  skipEmptyLines: true,
  complete: results => buildAndRender(cleanRows(results.data)),
  error: err => alert("Failed to load data: " + err)
});

function cleanRows(rows) {
  const pad = v => (v || "").toString().trim().padStart(3, "0");
  return rows
    .filter(d => d.id && d.name)
    .map(d => ({ ...d, id: pad(d.id), fatherID: pad(d.fatherID), motherID: pad(d.motherID) }));
}

function buildAndRender(birds) {
  const byId = new Map(birds.map(b => [b.id, b]));

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

  // ----- build the DAG: parent(s) -> pairing node -> children ----- //
  // No "marriage" concept: a pairing node just marks "these two produced offspring together".
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 24, ranksep: 60, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));

  const pairingKey = (m, f) => `p:${m || "_"}:${f || "_"}`;
  const pairings = new Map();

  birds.forEach(b => {
    const label = b.name || "(unnamed)";
    const width = Math.max(70, label.length * 6.2 + 20);
    g.setNode(b.id, { width, height: 32, label, bird: b });
  });

  birds.forEach(b => {
    const { motherID, fatherID } = b;
    if (!motherID && !fatherID) return; // founder — no pairing needed

    const key = pairingKey(motherID, fatherID);
    if (!pairings.has(key)) {
      const consang = isConsanguineous(motherID, fatherID);
      pairings.set(key, { motherID, fatherID, consang });
      g.setNode(key, { width: 12, height: 12, pairing: true, consang });
      if (motherID && byId.has(motherID)) g.setEdge(motherID, key);
      if (fatherID && byId.has(fatherID)) g.setEdge(fatherID, key);
    }
    g.setEdge(key, b.id);
  });

  dagre.layout(g);
  render(g, byId);

  const consangCount = [...pairings.values()].filter(p => p.consang).length;
  document.getElementById("stats").textContent =
    `${birds.length} birds · ${pairings.size} pairings · ${consangCount} consanguineous`;
}

function render(g, byId) {
  const canvas = document.getElementById("canvas");
  const { width, height } = g.graph();
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "edges");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  canvas.appendChild(svg);

  const edgeEls = [];
  g.edges().forEach(e => {
    const edge = g.edge(e);
    const d = edge.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const targetNode = g.node(e.w);
    const consang = targetNode && targetNode.pairing && targetNode.consang;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d);
    path.setAttribute("class", "edge-line" + (consang ? " consang" : ""));
    svg.appendChild(path);
    edgeEls.push({ e, el: path });
  });

  const showConsang = document.getElementById("toggleConsang");
  const applyConsangToggle = () => {
    edgeEls.forEach(({ el }) => {
      if (el.classList.contains("consang")) el.style.display = showConsang.checked ? "" : "none";
    });
    document.querySelectorAll(".pairing-dot.consang").forEach(el => {
      el.style.display = showConsang.checked ? "" : "none";
    });
  };
  showConsang.addEventListener("change", applyConsangToggle);

  const cardEls = new Map();

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
      card.className = "node-card " + (sex === "F" ? "female" : sex === "M" ? "male" : "");
      card.style.left = node.x - node.width / 2 + "px";
      card.style.top = node.y - node.height / 2 + "px";
      card.style.width = node.width + "px";
      card.style.height = node.height + "px";
      card.textContent = node.label;
      card.title = `ID ${b.id} — ${b.mutation || ""} ${b.subspecies || ""} ${b.species || ""}`.trim();
      card.dataset.id = b.id;
      card.addEventListener("click", () => focusOn(b.id));
      canvas.appendChild(card);
      cardEls.set(b.id, card);
    }
  });

  // ----- click a bird to dim everything except its immediate family ----- //
  function focusOn(id) {
    const bird = byId.get(id);
    const related = new Set([id, bird.motherID, bird.fatherID]);
    byId.forEach(other => {
      if (other.motherID === id || other.fatherID === id) related.add(other.id);
      if (other.motherID === bird.motherID && other.fatherID === bird.fatherID && other.motherID) related.add(other.id);
    });

    cardEls.forEach((el, cid) => {
      el.classList.toggle("focus", cid === id);
      el.classList.toggle("dim", !related.has(cid));
    });
    edgeEls.forEach(({ e, el }) => {
      const touches = related.has(e.v) || related.has(e.w);
      el.classList.toggle("dim", !touches);
    });
  }

  applyConsangToggle();
}
