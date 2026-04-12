"use client";

import "@xyflow/react/dist/style.css";
import "./schema.css";
import useRequireDB from "@/src/hooks/useRequireDB";


import { useEffect, useState, useRef, use } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
} from "@xyflow/react";

import {
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
} from "d3-force";

export default function SchemaPage() {

  useRequireDB(); // 🔥 NEW: Redirects if no DB

  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // 🔥 NEW
  const [hasDB, setHasDB] = useState(true);

  const schemaRef = useRef<any>(null);

  // 🔥 Check active DB
  useEffect(() => {
    fetch("http://127.0.0.1:8000/active-db")
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) {
          setHasDB(false);
        }
      })
      .catch(() => setHasDB(false));
  }, []);

  useEffect(() => {
    if (!hasDB) return; // 🔥 IMPORTANT FIX

    fetchSchema();
  }, [hasDB]);

  const fetchSchema = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/schema");
      const schema = await res.json();

      schemaRef.current = schema;
      buildGraph(schema);
    } catch {
      console.error("Failed to fetch schema");
    }
  };

  // 🔥 physics layout
  const buildGraph = (schema: any) => {
    const tableNames = Object.keys(schema);

    let simNodes: any[] = tableNames.map((table) => ({
      id: table,
    }));

    let simLinks: any[] = [];

    for (let i = 0; i < tableNames.length; i++) {
      for (let j = i + 1; j < tableNames.length; j++) {
        const t1 = tableNames[i];
        const t2 = tableNames[j];

        const cols1 = schema[t1].map((c: any) => c[0]);
        const cols2 = schema[t2].map((c: any) => c[0]);

        const common = cols1.find((c: string) => cols2.includes(c));

        if (common) {
          simLinks.push({
            source: t1,
            target: t2,
            label: common,
          });
        }
      }
    }

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-300))
      .force("center", forceCenter(500, 320))
      .force("link", forceLink(simLinks).id((d: any) => d.id).distance(160))
      .stop();

    for (let i = 0; i < 300; i++) simulation.tick();

    const newNodes = simNodes.map((node) => {
      const isSelected = selectedNode === node.id;

      return {
        id: node.id,
        position: { x: node.x, y: node.y },
        draggable: true,
        data: {
          label: (
            <div className="node-card">
              <div className="node-title">{node.id}</div>
              <div className="node-columns">
                {schema[node.id].map((col: any) => (
                  <div key={col[0]} className="node-column">
                    • {col[0]}
                  </div>
                ))}
              </div>
            </div>
          ),
        },
        className: isSelected ? "node-selected" : "",
        style: {
          opacity: selectedNode && !isSelected ? 0.3 : 1,
        },
      };
    });

    const newEdges = simLinks.map((link) => {
      const isConnected =
        selectedNode &&
        (selectedNode === link.source || selectedNode === link.target);

      return {
        id: `${link.source}-${link.target}`,
        source: link.source,
        target: link.target,
        label: link.label,
        type: "smoothstep",
        animated: !!isConnected,
        style: {
          stroke: isConnected ? "#60a5fa" : "#334155",
          strokeWidth: isConnected ? 2.5 : 1.5,
          opacity: selectedNode ? (isConnected ? 1 : 0.2) : 0.7,
        },
      };
    });

    setNodes(newNodes);
    setEdges(newEdges);
  };

  // 🔥 drag fix
  const onNodesChange = (changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  // 🔥 re-layout
  const handleRelayout = () => {
    if (!schemaRef.current) return;
    buildGraph(schemaRef.current);
  };

  return (
    <div className="schema-container">

      {/* 🔥 NO DB BANNER */}
      {!hasDB && (
        <div style={{
          background: "#fee2e2",
          color: "#991b1b",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "15px",
          textAlign: "center"
        }}>
          No database selected. Please connect a database to view schema.
        </div>
      )}

      {/* 🔥 Button */}
      <button
        className="relayout-button"
        onClick={handleRelayout}
        disabled={!hasDB}
      >
        Re-layout
      </button>

      {hasDB && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          fitView
          minZoom={0.5}
          maxZoom={1.5}
          fitViewOptions={{ padding: 0.3 }}
          onNodeClick={(_, node) => setSelectedNode(node.id)}
          onPaneClick={() => setSelectedNode(null)}
        >
          <Background gap={24} size={1} color="#1e293b" />
          <Controls />
        </ReactFlow>
      )}

      {selectedNode && hasDB && (
        <div className="info-panel">
          <h3>{selectedNode}</h3>
          <p>Showing relationships for this table</p>
        </div>
      )}

    </div>
  );
}