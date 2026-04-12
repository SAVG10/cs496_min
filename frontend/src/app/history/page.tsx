"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./history.css";

export default function HistoryPage() {

  const [history, setHistory] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const router = useRouter();

  useEffect(() => {
    fetch("http://127.0.0.1:8000/query-history")
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setHistory(data.data);
        }
      })
      .catch(() => {
        setHistory([]);
      });
  }, []);

  // 🔥 REPLAY QUERY
  const handleReplay = (query: string) => {
    router.push(`/analytics?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="history-container">

      <h1 className="history-title">Query History</h1>

      {history.length === 0 ? (
        <div className="history-empty">No history yet</div>
      ) : (

        <div className="history-list">

          {history.map((item) => (

            <div
              key={item.id}
              className={`history-card ${expandedId === item.id ? "expanded" : ""}`}
            >

              {/* 🔥 HEADER (expand toggle) */}
              <div
                className="history-header"
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
              >
                <div className="history-query">{item.query}</div>
                <div className="history-arrow">▶</div>
              </div>

              {/* 🔥 META */}
              <div className="history-meta">
                <span className="history-db">
                  {item.db || "Unknown DB"}
                </span>
                <span className="history-time">
                  {item.time}
                </span>
              </div>

              {/* 🔥 ACTION BUTTON (REPLAY) */}
              <div style={{ marginTop: "8px" }}>
                <button
                  onClick={() => handleReplay(item.query)}
                  style={{
                    fontSize: "0.75rem",
                    background: "transparent",
                    border: "none",
                    color: "#60a5fa",
                    cursor: "pointer"
                  }}
                >
                  Run Again →
                </button>
              </div>

              {/* 🔥 EXPANDED SECTION */}
              {expandedId === item.id && (
                <div className="history-expanded">

                  {/* NATURAL QUERY */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Natural Query
                    </div>
                    <div style={{ fontSize: "0.85rem" }}>
                      {item.query}
                    </div>
                  </div>

                  {/* SQL QUERY */}
                  <div style={{ marginBottom: "6px", fontSize: "0.75rem", color: "#94a3b8" }}>
                    SQL Query
                  </div>

                  <div className="history-sql">
                    {item.sql}
                  </div>

                  {/* COPY BUTTON */}
                  <button
                    className="history-copy"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(item.sql);
                    }}
                  >
                    Copy SQL
                  </button>

                </div>
              )}

            </div>

          ))}

        </div>
      )}

    </div>
  );
}