"use client";

import "./analytics.css";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import useRequireDB from "@/src/hooks/useRequireDB";


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

export default function Analytics() {
  useRequireDB();

  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"empty" | "loading" | "results">("empty");
  const [showSQL, setShowSQL] = useState(false);
  const [hasDB, setHasDB] = useState(true);

  const [query, setQuery] = useState("");
  const [sqlQuery, setSqlQuery] = useState("");

  const [rows, setRows] = useState<any[]>([]);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState("");

  const [confidence, setConfidence] = useState("");
  const [reason, setReason] = useState("");

  const [copied, setCopied] = useState(false);

  const [chartOverride, setChartOverride] = useState<string | null>(null);

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

 // 🔹 Fetch tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/tables");

        // 🔥 Handle HTTP errors
        if (!res.ok) {
          throw new Error("Failed to fetch tables");
        }

        const data = await res.json();

        // ✅ Strict validation
        if (Array.isArray(data)) {
          setTables(data);

          if (data.length > 0) {
            setSelectedTable(data[0]);
          }
        } else {
          console.error("Invalid tables response:", data);
          setTables([]);
        }

      } catch (err) {
        console.error("Failed to fetch tables:", err);
        setTables([]);
      }
    };

    fetchTables();
  }, []);


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


  // 🔹 Auto-run query from dashboard
  useEffect(() => {
    const q = searchParams.get("q");

    if (q && tables.length > 0 && selectedTable) {
      setQuery(q);
      handleAnalyze(q);
    }
  }, [searchParams, tables, selectedTable]);

  // 🔥 SMART CHART DETECTION
  const getChartType = () => {
    if (!rows.length) return "none";

    const keys = Object.keys(rows[0]);
    const values = Object.values(rows[0]);

    if (keys.length === 1 && typeof values[0] === "number") {
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

  // 🔹 Execute query
  const handleAnalyze = async (inputQuery?: string) => {
    if (!hasDB) {
      alert("Please connect to a database first");
      return;
    }

    const finalQuery = inputQuery || query;

    if (!finalQuery.trim() || !selectedTable) return;

    try {
      setStatus("loading");
      setShowSQL(false);
      setChartOverride(null); // reset override

      const res = await fetch("http://127.0.0.1:8000/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: finalQuery,
          table: selectedTable,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Query failed");
      }

      setSqlQuery(data.sql);
      setRows(data.data || []);
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
      // ✅ Try modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(sqlQuery);
      } else {
        // 🔥 Fallback for localhost / HTTP / blocked clipboard
        const textArea = document.createElement("textarea");
        textArea.value = sqlQuery;

        // Prevent UI jump
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

        if (!successful) {
          throw new Error("Fallback copy failed");
        }
      }

      // ✅ Success UI
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);

    } catch (err) {
      console.error("Copy failed:", err);

      // 🔥 FINAL fallback (guaranteed)
      prompt("Copy this SQL manually:", sqlQuery);
    }
  };

  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];


  const handleSaveQuery = async () => {
    if (!query || !sqlQuery) return;

    const name = prompt("Enter a name for this query:");
    if (!name) return;

    try {
      const res = await fetch("http://127.0.0.1:8000/save-query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          query,
          sql: sqlQuery,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save");
      }

      alert("Query saved successfully ⭐");

    } catch (err: any) {
      alert(err.message || "Save failed");
    }
  };

  return (
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

      {/* QUERY */}
      <section className="query-section">

        <div className="query-header">
          <h1 className="query-title">What would you like to explore?</h1>
          <p className="query-subtitle">Ask questions about your data</p>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="table-dropdown"
          >
            {tables.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
              <div
                className="confidence-box"
                style={getConfidenceStyle(confidence)}
              >
                {confidence}
              </div>
            </div>

            <div className="reason-block">
              <span className="reason-label">Reason</span>
              <div className="reason-box">{reason}</div>
            </div>
          </div>

          {/* 🔥 CHART SWITCHER */}
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

          {/* 🔥 VISUALIZATION */}
          <div className="chart-section">
            <div className="chart-container">

              {rows.length === 0 ? (
                <p>No data available</p>

              ) : finalChartType === "kpi" ? (

                <div style={{ fontSize: "2.5rem", fontWeight: "bold" }}>
                  {String(Object.values(rows[0])[0])}
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
                    plugins: {
                      legend: {
                        labels: { color: "#e2e8f0" }
                      }
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: keys[0] || "",
                          color: "#e2e8f0"
                        },
                        ticks: { color: "#cbd5f5" },
                        grid: { color: "#1e293b" }
                      },
                      y: {
                        title: {
                          display: true,
                          text: keys[1] || "",
                          color: "#e2e8f0"
                        },
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
                    plugins: {
                      legend: {
                        labels: { color: "#e2e8f0" }
                      }
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: keys[0] || "",
                          color: "#e2e8f0"
                        },
                        ticks: { color: "#cbd5f5" },
                        grid: { color: "#1e293b" }
                      },
                      y: {
                        title: {
                          display: true,
                          text: keys[1] || "",
                          color: "#e2e8f0"
                        },
                        ticks: { color: "#cbd5f5" },
                        grid: { color: "#1e293b" }
                      }
                    }
                  }}
                />

              ) : (

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

                    {/* ⭐ SAVE BUTTON */}
                    <button
                      className="copy-button"
                      onClick={handleSaveQuery}
                      disabled={!sqlQuery}
                      style={{ background: "#22c55e" }}
                    >
                      Save
                    </button>

                    {/* COPY BUTTON */}
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
  );
}