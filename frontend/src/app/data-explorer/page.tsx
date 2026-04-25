"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/src/lib/api";
import "./data-explorer.css";

export default function DataExplorer() {
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [data, setData] = useState<any[]>([]);

  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState("");

  // 🔹 FETCH TABLES (FIXED PATH)
  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoadingTables(true);
        const res = await apiFetch("/analytics/db/tables"); // ✅ FIXED
        setTables(res || []);
      } catch (err: any) {
        console.error("Failed to fetch tables:", err);
        setError(err.message || "Failed to load tables");
      } finally {
        setLoadingTables(false);
      }
    };

    fetchTables();
  }, []);

  // 🔹 FETCH TABLE DATA (FIXED PATH)
  const loadTable = async (table: string) => {
    try {
      setSelectedTable(table);
      setLoadingData(true);
      setData([]);

      const res = await apiFetch(`/analytics/db/table/${table}`); // ✅ FIXED
      setData(res || []);
    } catch (err: any) {
      console.error("Failed to fetch table data:", err);
      setError(err.message || "Failed to load table data");
    } finally {
      setLoadingData(false);
    }
  };

  return (
    <div className="content-wrapper">
      <h2>Data Explorer</h2>

      {error && (
        <div style={{ color: "#f87171", marginBottom: "10px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "20px" }}>
        
        {/* LEFT: TABLE LIST */}
        <div style={{ width: "250px" }}>
          {loadingTables ? (
            <p>Loading tables...</p>
          ) : tables.length === 0 ? (
            <p>No tables found</p>
          ) : (
            tables.map((t) => (
              <div
                key={t}
                className="table-item"
                onClick={() => loadTable(t)}
              >
                {t}
              </div>
            ))
          )}
        </div>

        {/* RIGHT: DATA TABLE */}
        <div style={{ flex: 1 }}>
          {!selectedTable && (
            <p style={{ color: "#94a3b8" }}>
              Select a table to view data
            </p>
          )}

          {selectedTable && (
            <>
              <h3>{selectedTable}</h3>

              {loadingData ? (
                <p>Loading data...</p>
              ) : data.length === 0 ? (
                <p>No data available</p>
              ) : (
                <div className="data-table-container">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(data[0]).map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}