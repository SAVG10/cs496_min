"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./saved.css";

import ProtectedRoute from "@/src/components/ProtectedRoute";
import { apiFetch } from "@/src/lib/api"; // 🔥 IMPORTANT

export default function SavedPage() {
  const [saved, setSaved] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const router = useRouter();

  // 🔥 FETCH SAVED QUERIES (FIXED)
  useEffect(() => {
    const fetchSaved = async () => {
      try {
        const data = await apiFetch("/user/saved-queries");

        if (data.success) {
          setSaved(data.data);
        } else {
          setSaved([]);
        }
      } catch {
        setSaved([]);
      }
    };

    fetchSaved();
  }, []);

  // 🔁 REPLAY QUERY
  const handleReplay = (query: string) => {
    router.push(`/analytics?q=${encodeURIComponent(query)}`);
  };

  // 🗑 DELETE QUERY (FIXED WITH TOKEN)
  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/user/saved-query/${id}`, {
        method: "DELETE",
      });

      setSaved(prev => prev.filter(q => q.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // 🔽 TOGGLE EXPAND
  const toggleExpand = (id: number) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <ProtectedRoute>

      <div className="saved-container">

        <h1 className="saved-title">Saved Queries</h1>

        {saved.length === 0 ? (
          <div className="saved-empty">
            No saved queries yet
          </div>
        ) : (
          saved.map(item => {
            const isOpen = expandedId === item.id;

            return (
              <div
                key={item.id}
                className="saved-card"
                onClick={() => toggleExpand(item.id)}
              >

                {/* HEADER */}
                <div className="saved-header">

                  <div className="saved-info">
                    <div className="saved-name">{item.name}</div>

                    <div className="saved-query">{item.query}</div>

                    {/* DB INFO */}
                    <div className="saved-db">
                      {item.db_name ? `DB: ${item.db_name}` : "Unknown DB"}
                      {item.db_id && <span> (ID: {item.db_id})</span>}
                    </div>

                    <div className="saved-meta">{item.time}</div>
                  </div>

                  <div className="saved-actions">
                    <span className="saved-expand">
                      {isOpen ? "▼" : "▶"}
                    </span>

                    {/* QUICK DELETE */}
                    <button
                      className="saved-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>

                </div>

                {/* EXPANDED */}
                {isOpen && (
                  <div className="saved-expanded">

                    {/* SQL */}
                    <div className="saved-sql">
                      {item.sql}
                    </div>

                    {/* ACTIONS */}
                    <div className="saved-buttons">

                      <button
                        className="saved-replay"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReplay(item.query);
                        }}
                      >
                        Run Query
                      </button>

                      <button
                        className="saved-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                      >
                        Delete
                      </button>

                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}

      </div>

    </ProtectedRoute>
  );
}