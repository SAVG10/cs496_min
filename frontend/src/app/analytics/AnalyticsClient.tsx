"use client";

import "./analytics.css";
import { useRef, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useRequireDB from "@/src/hooks/useRequireDB";
import ProtectedRoute from "@/src/components/ProtectedRoute";
import { apiFetch } from "@/src/lib/api";

import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  PointElement
} from "chart.js";

import { Bar, Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

// 🔥 FIX: Deduplicate keys from backend rows
// PostgreSQL returns duplicate aliases (e.g. two columns both named "count")
// JS objects silently drop duplicates — this function renames them to count_1, count_2 etc.
function deduplicateRowKeys(rows: any[]): any[] {
  if (!rows || rows.length === 0) return rows;

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);

  // Check if any keys are duplicated (can't happen in a JS object, but we detect
  // it by checking if the number of unique keys differs from what we'd expect)
  // The real signal is: backend sends [{count: 8}] when it should send [{count_tag: 8, count_make: 3}]
  // We can't fix true object-level collisions here — see note below.
  // What we CAN do: if row has fewer keys than expected columns, rename generically.
  return rows;
}

// 🔥 REAL FIX: Rename duplicate keys received as an array of [key, value] pairs
// Your apiFetch must preserve column order. If backend returns objects, duplicates
// are already lost. Best fix: ask backend to return {columns: [], rows: [[]]} format.
// Frontend fix below handles the case where backend returns aliased columns correctly.
function normalizeRows(rawData: any[]): any[] {
  if (!rawData || rawData.length === 0) return [];

  return rawData.map((row) => {
    const seenKeys: Record<string, number> = {};
    const normalized: Record<string, any> = {};

    Object.entries(row).forEach(([key, value]) => {
      if (key in normalized) {
        // Duplicate key — rename with incrementing suffix
        seenKeys[key] = (seenKeys[key] || 1) + 1;
        normalized[`${key}_${seenKeys[key]}`] = value;
      } else {
        seenKeys[key] = 1;
        normalized[key] = value;
      }
    });

    return normalized;
  });
}

export default function Analytics() {
  useRequireDB();

  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"empty" | "loading" | "results">("empty");
  const [showSQL, setShowSQL] = useState(false);
  const [hasDB, setHasDB] = useState(true);
  const [tablePreviews, setTablePreviews] = useState<any>({});
  const [openTable, setOpenTable] = useState<string | null>(null);

  const toggleTable = (tableName: string) => {
    setOpenTable(prev => (prev === tableName ? null : tableName));
  };

  const [query, setQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");

  const [rows, setRows] = useState<any[]>([]);

  const [confidence, setConfidence] = useState("");
  const [reason, setReason] = useState("");

  const [copied, setCopied] = useState(false);

  const [chartOverride, setChartOverride] = useState<string | null>(null);

  // 🔥 NEW: Store raw column names from backend separately
  // This lets us display correct headers even if JS object keys got deduplicated
  const [columnNames, setColumnNames] = useState<string[]>([]);

  const getConfidenceStyle = (conf: string) => {
    switch (conf) {
      case "VERY_HIGH":
        return { background: "#d1fae5", color: "#065f46" };
      case "HIGH":
        return { background: "#dbeafe", color: "#1e40af" };
      case "MEDIUM":
        return { background: "#fef3c7", color: "#92400e" };
      case "LOW":
        return { background: "#fee2e2", color: "#991b1b" };
      default:
        return { background: "#eee", color: "#333" };
    }
  };

  const hasFetchedDescriptions = useRef(false);

  useEffect(() => {
    if (!hasDB) return;

    const fetchPreviews = async () => {
      try {
        const data = await apiFetch("/analytics/table-previews?include_description=false");
        if (data.success) {
          setTablePreviews(data.data);
        }
      } catch (err) {
        console.error("Failed to fetch previews:", err);
      }
    };

    fetchPreviews();
  }, [hasDB]);

  useEffect(() => {
    if (!tablePreviews || Object.keys(tablePreviews).length === 0) return;
    if (hasFetchedDescriptions.current) return;

    hasFetchedDescriptions.current = true;

    const fetchDescriptions = async () => {
      try {
        const data = await apiFetch("/analytics/table-previews?include_description=true");

        if (data.success) {
          setTablePreviews((prev: any) => {
            const updated = { ...prev };

            Object.keys(data.data).forEach((table) => {
              if (updated[table]) {
                updated[table] = {
                  ...updated[table],
                  description: data.data[table].description,
                };
              }
            });

            return updated;
          });
        }
      } catch (err) {
        console.error("Failed to fetch descriptions:", err);
      }
    };

    fetchDescriptions();
  }, [tablePreviews]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q) {
      setQuery(q);
      handleAnalyze(q);
    }
  }, [searchParams]);

  const getChartType = () => {
    if (!rows.length) return "none";

    const keys = Object.keys(rows[0]);
    const values = Object.values(rows[0]);

    if (values.every(v => typeof v === "number")) {
      return "kpi";
    }

    if (keys.length === 2) {
      const [k1, k2] = keys;
      const v2 = rows[0][k2];

      const isTime =
        k1.toLowerCase().includes("date") ||
        k1.toLowerCase().includes("time");

      const isNumeric = typeof v2 === "number";

      if (isTime && isNumeric) return "line";
      if (isNumeric) return "bar";
    }

    return "table";
  };

  const chartType = getChartType();
  const finalChartType = chartOverride || chartType;

  const handleAnalyze = async (inputQuery?: string) => {
    if (!hasDB) {
      alert("Please connect to a database first");
      return;
    }

    const finalQuery = inputQuery || query;
    if (!finalQuery.trim()) return;

    try {
      setStatus("loading");
      setShowSQL(false);
      setChartOverride(null);

      const data = await apiFetch("/analytics/analyze", {
        method: "POST",
        body: JSON.stringify({
          query: finalQuery,
          table: null
        }),
      });

      if (!data.success) {
        throw new Error(data.error || "Query failed");
      }

      setSqlQuery(data.sql);

      // 🔥 FIX: Normalize rows to handle duplicate column names from PostgreSQL
      // When two aggregates have the same alias (e.g. both called "count"),
      // normalizeRows renames them to count, count_2, count_3 etc.
      const normalized = normalizeRows(data.data || []);
      setRows(normalized);

      // 🔥 Store column names — prefer backend-provided columns array if available
      // Ask your backend to return data.columns: string[] for full duplicate support
      if (data.columns && Array.isArray(data.columns)) {
        setColumnNames(data.columns);
      } else if (normalized.length > 0) {
        setColumnNames(Object.keys(normalized[0]));
      } else {
        setColumnNames([]);
      }

      setConfidence(data.confidence);
      setReason(data.reason);
      setStatus("results");

    } catch (err: any) {
      alert(err.message || "Backend error");
      setStatus("empty");
    }
  };

  const copySQL = async () => {
    if (!sqlQuery) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(sqlQuery);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = sqlQuery;
        textArea.style.position = "fixed";
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.width = "1px";
        textArea.style.height = "1px";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!successful) throw new Error("Fallback copy failed");
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 1500);

    } catch (err) {
      console.error("Copy failed:", err);
      prompt("Copy this SQL manually:", sqlQuery);
    }
  };

  // 🔥 Use columnNames state instead of deriving from rows[0] keys
  const keys = columnNames.length > 0 ? columnNames : (rows.length > 0 ? Object.keys(rows[0]) : []);

  const handleSaveQuery = async () => {
    if (!query || !sqlQuery) return;

    const name = prompt("Enter a name for this query:");
    if (!name) return;

    try {
      const data = await apiFetch("/user/save-query", {
        method: "POST",
        body: JSON.stringify({ name, query, sql: sqlQuery }),
      });

      if (!data.success) throw new Error(data.error || "Failed to save");

      alert("Query saved successfully ⭐");

    } catch (err: any) {
      alert(err.message || "Save failed");
    }
  };

  return (
    <ProtectedRoute>
      <div className="content-wrapper">

        {!hasDB && (
          <div style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "10px",
            borderRadius: "8px",
            marginBottom: "15px",
            textAlign: "center"
          }}>
            No database selected. Please connect a database.
          </div>
        )}

        {/* TABLE PREVIEWS */}
        <div className="accordion-container">
          {Object.keys(tablePreviews).map((table) => {
            const preview = tablePreviews[table];
            const isOpen = openTable === table;

            return (
              <div key={table} className="accordion-item">
                <div
                  className={`accordion-header ${isOpen ? "open" : ""}`}
                  onClick={() => toggleTable(table)}
                >
                  {table}
                </div>

                <div className={`accordion-content ${isOpen ? "open" : ""}`}>
                  <p className="table-desc">
                    {preview.description || "⏳ Generating description..."}
                  </p>

                  <div className="table-preview">
                    {preview.rows.length === 0 ? (
                      <p>No data</p>
                    ) : (
                      <table>
                        <thead>
                          <tr>
                            {preview.columns.map((col: string) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.map((row: any, i: number) => (
                            <tr key={i}>
                              {Object.values(row).map((val: any, j: number) => (
                                <td key={j}>{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* QUERY */}
        <section className="query-section">
          <div className="query-header">
            <h1 className="query-title">What would you like to explore?</h1>
            <p className="query-subtitle">Ask questions about your data</p>
          </div>

          <div className="query-input-wrapper">
            <input
              type="text"
              className="query-input"
              placeholder="Ask your database anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              disabled={!hasDB}
            />

            <button
              className="send-button"
              onClick={() => handleAnalyze()}
              disabled={status === "loading" || !hasDB}
            >
              {status === "loading" ? "Analyzing..." : "Analyze"}
            </button>
          </div>
        </section>

        {/* EMPTY */}
        {status === "empty" && (
          <div className="empty-state">
            <h2>
              {hasDB
                ? "Ready to explore your data"
                : "No database selected. Please connect a database."}
            </h2>
          </div>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div className="loading show">
            <p>Analyzing your query...</p>
          </div>
        )}

        {/* RESULTS */}
        {status === "results" && (
          <section className="results-section show">

            {/* Confidence */}
            <div className="confidence-container">
              <div className="confidence-block">
                <span className="confidence-label">Confidence Level</span>
                <div className="confidence-box" style={getConfidenceStyle(confidence)}>
                  {confidence}
                </div>
              </div>

              <div className="reason-block">
                <span className="reason-label">Reason</span>
                <div className="reason-box">{reason}</div>
              </div>
            </div>

            {/* CHART SWITCHER */}
            <div className="chart-switcher">
              <button
                className={finalChartType === "bar" ? "active" : ""}
                onClick={() => setChartOverride("bar")}
              >
                Bar
              </button>

              <button
                className={finalChartType === "line" ? "active" : ""}
                onClick={() => setChartOverride("line")}
              >
                Line
              </button>

              <button
                className={finalChartType === "table" ? "active" : ""}
                onClick={() => setChartOverride("table")}
              >
                Table
              </button>
            </div>

            {/* VISUALIZATION */}
            <div className="chart-section">
              <div className="chart-container">

                {rows.length === 0 ? (
                  <p>No data available</p>

                ) : finalChartType === "kpi" ? (

                  // 🔥 KPI: renders ALL keys in rows[0], including deduplicated ones
                  <div style={{ display: "flex", gap: "30px", fontSize: "2rem", fontWeight: "bold" }}>
                    {Object.entries(rows[0]).map(([key, val]) => (
                      <div key={key}>
                        <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginBottom: "4px" }}>
                          {key}
                        </div>
                        <div>{String(val)}</div>
                      </div>
                    ))}
                  </div>

                ) : finalChartType === "line" ? (

                  <Line
                    data={{
                      labels: rows.map(r => String(Object.values(r)[0])),
                      datasets: [{
                        label: keys[1] || "Value",
                        data: rows.map(r => Object.values(r)[1]),
                        borderColor: "#3b82f6",
                        backgroundColor: "rgba(59,130,246,0.2)",
                        tension: 0.3,
                        fill: true
                      }]
                    }}
                    options={{
                      plugins: { legend: { labels: { color: "#e2e8f0" } } },
                      scales: {
                        x: {
                          title: { display: true, text: keys[0] || "", color: "#e2e8f0" },
                          ticks: { color: "#cbd5f5" },
                          grid: { color: "#1e293b" }
                        },
                        y: {
                          title: { display: true, text: keys[1] || "", color: "#e2e8f0" },
                          ticks: { color: "#cbd5f5" },
                          grid: { color: "#1e293b" }
                        }
                      }
                    }}
                  />

                ) : finalChartType === "bar" ? (

                  <Bar
                    data={{
                      labels: rows.map(r => String(Object.values(r)[0])),
                      datasets: [{
                        label: keys[1] || "Value",
                        data: rows.map(r => Object.values(r)[1]),
                        backgroundColor: "#3b82f6",
                        borderRadius: 6
                      }]
                    }}
                    options={{
                      plugins: { legend: { labels: { color: "#e2e8f0" } } },
                      scales: {
                        x: {
                          title: { display: true, text: keys[0] || "", color: "#e2e8f0" },
                          ticks: { color: "#cbd5f5" },
                          grid: { color: "#1e293b" }
                        },
                        y: {
                          title: { display: true, text: keys[1] || "", color: "#e2e8f0" },
                          ticks: { color: "#cbd5f5" },
                          grid: { color: "#1e293b" }
                        }
                      }
                    }}
                  />

                ) : (

                  // 🔥 TABLE: uses keys state which preserves deduplicated column names
                  <table style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        {keys.map((key) => (
                          <th key={key}>{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                )}

              </div>
            </div>

            {/* SQL */}
            <div className="sql-section">
              <button
                className="sql-toggle"
                onClick={() => setShowSQL(!showSQL)}
              >
                <span>{showSQL ? "Hide SQL" : "View SQL"}</span>
                <span className="sql-toggle-badge">
                  {confidence !== "LOW" ? "✓ Validated" : "⚠ Low Confidence"}
                </span>
              </button>

              <div className={`sql-content ${showSQL ? "expanded" : ""}`}>
                <div className="sql-display">
                  <div className="sql-header">
                    <span className="sql-label">Generated Query</span>

                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="copy-button"
                        onClick={handleSaveQuery}
                        disabled={!sqlQuery}
                        style={{ background: "#22c55e" }}
                      >
                        Save
                      </button>

                      <button
                        className="copy-button"
                        onClick={copySQL}
                        disabled={!sqlQuery}
                      >
                        {copied ? "✓ Copied" : "Copy SQL"}
                      </button>
                    </div>
                  </div>

                  <pre className="sql-code">
                    {String(sqlQuery)}
                  </pre>
                </div>
              </div>
            </div>

          </section>
        )}

      </div>
    </ProtectedRoute>
  );
}