
// Define our layout
const graphContainer = document.getElementById("graph");
const intro = document.getElementById("intro-message");
const infoDiv = document.getElementById("info");
const birdListDiv = document.getElementById("bird-table");


// Get the Data
let data = [], selectedBirds = new Set(), fileLoaded = false;
let network = null; // global
document.getElementById("fileInput").addEventListener("change", e => {
  const file = e.target.files[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const delimiter = ext === "tsv" ? "\t" : ","; 

  // ----- Parse data file ----- //
  Papa.parse(file, {
    header: true,
    delimiter,
    complete: results => {

      // Check for correct data format
      const allFields = results.meta.fields; // array of column names
      const requiredFields = ['id', 'name', 'fatherID', 'motherID'];
      const missing = requiredFields.filter(f => !allFields.includes(f));
      if (missing.length) {
        alert(`Data is missing required fields: ${missing.join(', ')}`);
        console.error(`Missing fields: ${missing.join(', ')}`, results.meta.fields);
        modal.style.display = 'block';
        return;
      }

      // If all required fields exist, continue processing
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

      // Hide placeholder, show table
      $('#bird-table-placeholder').hide();
      $('#bird-table').show();

      updateIntro();
      populateList();
      drawGraph(selectedBirds, data);
    }
  });

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

  // colors from CSS
  const rootStyles = getComputedStyle(document.documentElement);
  const lightPink = rootStyles.getPropertyValue('--lightPink').trim();
  const darkPink  = rootStyles.getPropertyValue('--darkPink').trim();
  const lightBlue = rootStyles.getPropertyValue('--lightBlue').trim();
  const darkBlue  = rootStyles.getPropertyValue('--darkBlue').trim();


// ----- Family Tree ----- //

function drawGraph(selectedSet, allBirds) {
  const showParents   = document.getElementById("showParents")?.checked ?? true;
  const showSiblings  = document.getElementById("showSiblings")?.checked ?? true;
  const showOffspring = document.getElementById("showOffspring")?.checked ?? true;

  const container = document.getElementById("graph");
  container.innerHTML = '';
  if (!allBirds.length || !selectedSet.size) return;

  const byId = Object.fromEntries(allBirds.map(b => [String(b.id), b]));

  const nodes = [];
  const edges = [];
  const pairingNodes = new Map(); // key: "motherID-fatherID", value: pairing node ID

  // Helper to generate unique pairing node IDs
  const getPairingId = (motherID, fatherID) => `${motherID||'null'}-${fatherID||'null'}`;

  // Step 1: Gather all relevant nodes
  const addedBirds = new Set();

  selectedSet.forEach(selId => {
    const bird = byId[selId];
    if (!bird) return;

    const mother = bird.motherID ? byId[bird.motherID] : null;
    const father = bird.fatherID ? byId[bird.fatherID] : null;

    // If parents exist or siblings/offspring are requested
    const hasParents = mother || father;

    // --- Parent Pairing Node ---
    let pairingId = null;
    if ((showSiblings || showOffspring) && hasParents) {
      pairingId = getPairingId(mother?.id, father?.id);
      if (!pairingNodes.has(pairingId)) {
        pairingNodes.set(pairingId, {
          id: pairingId,
          label: '', // small dot
          shape: 'dot',
          size: 10,
          color: '#888'
        });
      }
    }

    // --- Parents Nodes ---
    if (showParents && hasParents) {
      if (mother && !addedBirds.has(mother.id)) {
        nodes.push({
          id: mother.id,
          label: mother.name,
          group: 'female',
          borderWidth: selectedSet.has(mother.id) ? 6 : 1,
          color: {
            background: lightPink,
            border: darkPink,
            hover: { background: darkPink, border: darkPink }
          },
          font: { multi: 'html', size: 16 }
        });
        addedBirds.add(mother.id);
      }
      if (father && !addedBirds.has(father.id)) {
        nodes.push({
          id: father.id,
          label: father.name,
          group: 'male',
          borderWidth: selectedSet.has(father.id) ? 6 : 1,
          color: {
            background: lightBlue,
            border: darkBlue,
            hover: { background: darkBlue, border: darkBlue }
          },
          font: { multi: 'html', size: 16 }
        });
        addedBirds.add(father.id);
      }
    }

    // --- Children / Siblings ---
    if (showSiblings || showOffspring) {
      allBirds.forEach(c => {
        const isChildOfPair = c.motherID === mother?.id && c.fatherID === father?.id;
        if ((showSiblings && isChildOfPair) || (showOffspring && (c.motherID === bird.id || c.fatherID === bird.id))) {
          if (!addedBirds.has(c.id)) {
            const gender = (c.sex || "").trim().toUpperCase();
            const bgColor = gender === 'F' ? lightPink : lightBlue;
            const borderColor = gender === 'F' ? darkPink : darkBlue;

            nodes.push({
              id: c.id,
              label: c.name,
              group: gender === 'F' ? 'female' : 'male',
              borderWidth: selectedSet.has(c.id) ? 6 : 1,
              color: {
                background: selectedSet.has(c.id) ? borderColor : bgColor,
                border: borderColor,
                hover: { background: borderColor, border: borderColor }
              },
              font: { multi: 'html', size: 16 }
            });
            addedBirds.add(c.id);
          }

          // Link child to pairing node
          if (pairingId) {
            edges.push({ from: pairingId, to: c.id, color: "#C0C0C0", arrows: "to" });
          }
        }
      });
    }

    // --- Link parents → pairing dot ---
    if (pairingId && showParents) {
      if (mother) edges.push({ from: mother.id, to: pairingId, color: "#C0C0C0", arrows: "" });
      if (father) edges.push({ from: father.id, to: pairingId, color: "#C0C0C0", arrows: "" });
    }

    // Finally, add the selected bird if not already added
    if (!addedBirds.has(bird.id)) {
      const gender = (bird.sex || "").trim().toUpperCase();
      const bgColor = gender === 'F' ? lightPink : lightBlue;
      const borderColor = gender === 'F' ? darkPink : darkBlue;

      nodes.push({
        id: bird.id,
        label: bird.name,
        group: gender === 'F' ? 'female' : 'male',
        borderWidth: 6,
        color: {
          background: borderColor,
          border: borderColor,
          hover: { background: borderColor, border: borderColor }
        },
        font: { multi: 'html', size: 16 }
      });
      addedBirds.add(bird.id);
    }
  });

  // Add all pairing nodes
  nodes.push(...pairingNodes.values());

  const networkData = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };

  const options = {
    layout: { hierarchical: { direction: "UD", sortMethod: "directed", nodeSpacing: 120, levelSeparation: 150 } },
    edges: {
      color: "#C0C0C0",
      smooth: { enabled: true, type: "cubicBezier", forceDirection: "vertical", roundness: 0.4 },
      arrows: { to: { enabled: true, type: "arrow" } }
    },
    nodes: { shape: "box", margin: 8 },
    physics: { enabled: true, solver: "hierarchicalRepulsion", hierarchicalRepulsion: { nodeDistance: 150, avoidOverlap: 1 } },
    interaction: { hover: true, dragNodes: false, dragView: true, zoomView: true, multiselect: true }
  };

  network = new vis.Network(container, networkData, options);
  network.once('stabilizationIterationsDone', () => network.setOptions({ physics: false }));
  network.on('click', params => { if (params.nodes.length) selectBird(params.nodes[0]); });
}








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
  ["showParents", "showSiblings", "showOffspring"].forEach(id => {
  document.getElementById(id).addEventListener("change", () => {
    drawGraph(selectedBirds, data);
    });
  });

});
