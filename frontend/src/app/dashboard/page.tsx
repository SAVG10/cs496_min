"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "./dashboard.css";

import useRequireDB from "@/src/hooks/useRequireDB";
import ProtectedRoute from "@/src/components/ProtectedRoute";
import { apiFetch } from "@/src/lib/api"; // 🔥 IMPORTANT

function formatLabel(text: string) {
  return text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Dashboard() {

  useRequireDB(); // keeps DB logic

  const router = useRouter();

  const [hasDB, setHasDB] = useState(true);

  const [metrics, setMetrics] = useState({
    total_tables: "--",
    largest_table: "--",
    largest_table_count: "--",
    most_connected_table: "--",
    total_relationships: "--",
    schema_health: {
      label: "--",
      tables: 0,
      relationships: 0,
      ratio: 0
    }
  });

  const [questions, setQuestions] = useState<string[]>([]);

  // 🔥 CHECK ACTIVE DB (FIXED WITH TOKEN)
  useEffect(() => {
    const checkDB = async () => {
      try {
        const data = await apiFetch("/db/active-db");

        if (!data.success || !data.data) {
          setHasDB(false);
          router.push("/connect-db");
        }
      } catch {
        setHasDB(false);
        router.push("/connect-db");
      }
    };

    checkDB();
  }, []);

  // 🔹 FETCH METRICS (FIXED)
  useEffect(() => {
    if (!hasDB) return;

    const fetchMetrics = async () => {
      try {
        const data = await apiFetch("/analytics/dashboard");
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
      }
    };

    fetchMetrics();
  }, [hasDB]);

  // 🔹 FETCH SUGGESTIONS (FIXED)
  useEffect(() => {
    if (!hasDB) return;

    const fetchSuggestions = async () => {
      try {
        const data = await apiFetch("/analytics/suggestions");
        setQuestions(data);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    };

    fetchSuggestions();
  }, [hasDB]);

  return (
    <ProtectedRoute>

      <>
        {!hasDB && (
          <div style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            Redirecting to connect database...
          </div>
        )}

        {/* KPI CARDS */}
        <div className="dashboard-grid">

          <div className="stat-card">
            <div className="stat-card-title">Total Tables</div>
            <div className="stat-card-value">
              {hasDB ? metrics.total_tables : "--"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-title">Largest Table</div>
            <div className="stat-card-value">
              {hasDB
                ? `${metrics.largest_table} (${metrics.largest_table_count})`
                : "--"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-title">Most Connected Table</div>
            <div className="stat-card-value">
              {hasDB ? metrics.most_connected_table : "--"}
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-title">Total Relationships</div>
            <div className="stat-card-value">
              {hasDB ? metrics.total_relationships : "--"}
            </div>
          </div>

          <div className="stat-card tooltip-card">
            <div className="stat-card-title">Schema Health</div>

            <div className="stat-card-value">
              {hasDB ? metrics.schema_health.label : "--"}
            </div>

            {hasDB && (
              <div className="tooltip-content">
                <p><strong>Relationships:</strong> {metrics.schema_health.relationships}</p>
                <p><strong>Tables:</strong> {metrics.schema_health.tables}</p>
                <p><strong>Ratio:</strong> {metrics.schema_health.ratio}</p>

                <hr />

                <p><strong>Formula:</strong></p>
                <p>relationships / tables</p>
              </div>
            )}
          </div>

        </div>

        {/* EXPLORE */}
        <div className="activity-section">
          <div className="section-header">
            <h2 className="section-title">Explore Insights</h2>
          </div>

          <div className="activity-list">
            <Link href={{ pathname: "/analytics", query: { q: "Top 5 values in a column" }}} className="activity-item">
              <div className="activity-icon">📊</div>
              <div className="activity-content">
                <div className="activity-title">Top Values</div>
                <div className="activity-subtitle">Discover most frequent entries</div>
              </div>
            </Link>

            <Link href={{ pathname: "/analytics", query: { q: "Show trends over time" }}} className="activity-item">
              <div className="activity-icon">📈</div>
              <div className="activity-content">
                <div className="activity-title">Trend Analysis</div>
                <div className="activity-subtitle">Understand data over time</div>
              </div>
            </Link>
          </div>
        </div>

        {/* SUGGESTIONS */}
        <div className="activity-section">
          <div className="section-header">
            <h2 className="section-title">Smart Suggestions</h2>
          </div>

          <div className="activity-list">
            {!hasDB ? (
              <div className="activity-item">
                <div className="activity-content">
                  <div className="activity-title">Connect a database to see suggestions</div>
                </div>
              </div>
            ) : questions.length > 0 ? (
              questions.map((q, i) => (
                <Link key={i} href={{ pathname: "/analytics", query: { q }}} className="activity-item">
                  <div className="activity-icon">?</div>
                  <div className="activity-content">
                    <div className="activity-title">{formatLabel(q)}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="activity-item">
                <div className="activity-content">
                  <div className="activity-title">Loading suggestions...</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="section-header">
          <h2 className="section-title">Quick Actions</h2>
        </div>

        <div className="quick-actions">
          <Link href="/analytics" className="action-card">
            <div className="action-card-icon">◉</div>
            <h3 className="action-card-title">Start New Query</h3>
          </Link>

          <Link href="/schema" className="action-card">
            <div className="action-card-icon">▦</div>
            <h3 className="action-card-title">Explore Schema</h3>
          </Link>
        </div>
      </>

    </ProtectedRoute>
  );
}