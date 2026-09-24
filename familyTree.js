// =======================================================
// TSV PARSER + GOJS FAMILY TREE CONVERTER
// =======================================================

function setupTSVImport(onDataReady) {
  const fileInput = document.getElementById("tsvFileInput");
  const dropZone  = document.getElementById("dropZone");

  // File picker
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) parseTSV(file, onDataReady);
  });

  // Drag & drop
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.style.background = "#eef";
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.style.background = "";
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.style.background = "";
    const file = e.dataTransfer.files[0];
    if (file) parseTSV(file, onDataReady);
  });
}

// -------------------------------------------------------
// Parse TSV file using PapaParse
// -------------------------------------------------------
function parseTSV(file, callback) {
  Papa.parse(file, {
    header: true,
    delimiter: "\t",
    dynamicTyping: false,
    skipEmptyLines: true,
    complete: (results) => {
      console.log("TSV Parsed:", results.data);
      const json = convertBirdTSVToGoJS(results.data);
      callback(json);
    },
    error: (err) => alert("Error parsing TSV: " + err),
  });
}

// -------------------------------------------------------
// Convert raw TSV rows → GoJS nodeDataArray + linkDataArray
// -------------------------------------------------------
function convertBirdTSVToGoJS(rows) {
  const nodeDataArray = [];
  const linkDataArray = [];

  const byId = new Map();

  // First pass: create bird nodes
  for (const row of rows) {
    if (!row.id) continue;

    const bird = {
      key: row.id,
      name: row.name || "(Unnamed)",
      sex: row.sex || "?",
      fatherID: row.fatherID || "",
      motherID: row.motherID || "",
      category: "bird",
      // You can add more biological fields here
    };

    nodeDataArray.push(bird);
    byId.set(row.id, bird);
  }

  // Utility: ensure parent exists, otherwise create placeholder
  function ensureParent(id, gender) {
    if (id && byId.has(id)) return byId.get(id);
    if (!id) return null;

    // Create placeholder parent
    const p = {
      key: id,
      name: "?",
      sex: gender,
      fatherID: "",
      motherID: "",
      category: "bird",
      placeholder: true,
    };
    nodeDataArray.push(p);
    byId.set(id, p);
    return p;
  }

  // Create marriage nodes & links
  const marriageMap = new Map(); // "fatherID|motherID" → marriage node key
  let marriageCounter = 10000;

  function getMarriageNode(fatherID, motherID) {
    const key = `${fatherID}|${motherID}`;
    if (marriageMap.has(key)) return marriageMap.get(key);

    const mKey = "M" + (marriageCounter++);

    const marriageNode = {
      key: mKey,
      category: "marriage",
      fatherID,
      motherID,
    };

    marriageMap.set(key, mKey);
    nodeDataArray.push(marriageNode);

    // Connect parents → marriage node
    if (fatherID) linkDataArray.push({ from: fatherID, to: mKey });
    if (motherID) linkDataArray.push({ from: motherID, to: mKey });

    return mKey;
  }

  // Second pass: build relationships
  for (const bird of nodeDataArray) {
    if (bird.category !== "bird") continue;

    const f = bird.fatherID || "";
    const m = bird.motherID || "";

    // If only one parent exists, create the missing one with "?".
    let father = f ? ensureParent(f, "M") : null;
    let mother = m ? ensureParent(m, "F") : null;

    // If one parent exists but the other doesn't → create placeholder
    if (father && !mother) mother = ensureParent(`?${bird.key}M`, "F");
    if (mother && !father) father = ensureParent(`?${bird.key}F`, "M");

    // Skip if still missing both parents
    if (!father && !mother) continue;

    const marriageNodeKey = getMarriageNode(father.key, mother.key);

    // Marriage node → child
    linkDataArray.push({
      from: marriageNodeKey,
      to: bird.key
    });
  }

  return { nodeDataArray, linkDataArray };
}







function initFamilyTree(divId, nodeDataArray) {
  const $ = go.GraphObject.make;

  const diagram = $(go.Diagram, divId, {
    layout: $(go.TreeLayout, {
      angle: 90,
      nodeSpacing: 25,
      layerSpacing: 50
    }),
    "toolManager.hoverDelay": 50,
    initialContentAlignment: go.Spot.Center,
    allowZoom: true
  });

  //
  // ---- Node Template ----
  //
  diagram.nodeTemplate =
    $(go.Node, "Auto",
      {
        selectionAdorned: true,
        selectionChanged: part => {
          if (part.isSelected && part.data) {
            // ❗ This is where you call your sidebar update
            if (window.onPersonSelected) {
              window.onPersonSelected(part.data);
            }
          }
        }
      },
      $(go.Shape, "RoundedRectangle",
        {
          fill: "#ffffff",
          strokeWidth: 2
        },
        // Color border by gender (optional)
        new go.Binding("stroke", "gender", g =>
          g === "M" ? "#4A90E2" : "#E260A2"
        )
      ),
      $(go.Panel, "Table",
        { padding: 6 },
        $(go.TextBlock,
          {
            row: 0,
            font: "bold 14px sans-serif",
            stroke: "#333",
            margin: 2
          },
          new go.Binding("text", "name")
        ),
        $(go.TextBlock,
          {
            row: 1,
            font: "12px sans-serif",
            stroke: "#555",
            margin: 2
          },
          new go.Binding("text", "",
            d => (d.born || d.death) ? `${d.born ?? ""} – ${d.death ?? ""}` : ""
          )
        )
      )
    );

  //
  // ---- Link Template ----
  //
  diagram.linkTemplate =
    $(go.Link,
      {
        routing: go.Link.Orthogonal,
        corner: 4
      },
      $(go.Shape, { stroke: "#999", strokeWidth: 1.5 })
    );

  //
  // ---- Model ----
  //
  diagram.model = new go.TreeModel({
    nodeKeyProperty: "id",
    nodeParentKeyProperty: "parent"
  });

  diagram.model.addNodeDataCollection(nodeDataArray);

  //
  // ---- Optional Helpers ----
  //

  diagram.addDiagramListener("InitialLayoutCompleted", () => {
    diagram.zoomToFit();
  });

  // Expose a method to center on any person by ID
  window.centerOnPerson = id => {
    const node = diagram.findNodeForKey(id);
    if (node) diagram.commandHandler.scrollToPart(node);
  };

  return diagram;
}
