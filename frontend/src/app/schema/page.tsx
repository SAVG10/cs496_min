"use client";

import "@xyflow/react/dist/style.css";
import "./schema.css";

import { useEffect, useState, useRef } from "react";
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
import { forceCollide } from "d3-force";

import useRequireDB from "@/src/hooks/useRequireDB";
import ProtectedRoute from "@/src/components/ProtectedRoute";
import { apiFetch } from "@/src/lib/api"; // 🔥 IMPORTANT

export default function SchemaPage() {

  useRequireDB(); // ✅ keep this ONLY

  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const schemaRef = useRef<any>(null);
  const relationshipsRef = useRef<any[]>([]);

  // 🔥 FETCH SCHEMA GRAPH (FIXED)
  useEffect(() => {
    fetchSchema();
  }, []);

  const fetchSchema = async () => {
    try {
      const data = await apiFetch("/analytics/schema-graph");

      if (!data.success) return;

      schemaRef.current = data.tables;
      relationshipsRef.current = data.relationships;

      buildGraph(data.tables, data.relationships);

    } catch {
      console.error("Failed to fetch schema graph");
    }
  };

  // 🔥 GRAPH BUILDER (UNCHANGED)
  const buildGraph = (schema: any, relationships: any[]) => {
    const tableNames = Object.keys(schema);

    let simNodes: any[] = tableNames.map((table) => ({
      id: table,
    }));

    let simLinks: any[] = relationships.map((rel) => ({
      source: rel[0],
      target: rel[2],
      label: `${rel[1]} → ${rel[3]}`,
      confidence: rel[4],
    }));

    const simulation = forceSimulation(simNodes)
      .force("charge", forceManyBody().strength(-900))
      .force("center", forceCenter(800, 450))
      .force(
        "link",
        forceLink(simLinks)
          .id((d: any) => d.id)
          .distance(300)
      )
      .force("collision", forceCollide().radius(300))
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

    const newEdges = relationships.map((rel: any, index: number) => ({
      id: `e-${index}`,
      source: rel[0],
      target: rel[2],
      label: `${rel[1]} → ${rel[3]}`,
      type: "smoothstep",
      animated: true,
      style: {
        stroke: "#60a5fa",
        strokeWidth: 3,
      },
      labelStyle: { fill: "#94a3b8", fontSize: 12 },
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const onNodesChange = (changes: any) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  };

  const handleRelayout = () => {
    if (!schemaRef.current) return;
    buildGraph(schemaRef.current, relationshipsRef.current);
  };

  return (
    <ProtectedRoute>

      <div className="schema-container">

        <button
          className="relayout-button"
          onClick={handleRelayout}
        >
          Re-layout
        </button>

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

        {selectedNode && (
          <div className="info-panel">
            <h3>{selectedNode}</h3>
            <p>Showing relationships for this table</p>
          </div>
        )}

      </div>

    </ProtectedRoute>
  );
}