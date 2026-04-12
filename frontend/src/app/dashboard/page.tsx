"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // 🔥 NEW
import "./dashboard.css";
import useRequireDB from "@/src/hooks/useRequireDB";


export default function Dashboard() {

  useRequireDB(); // 🔥 NEW: Redirects if no DB

  const router = useRouter(); // 🔥 NEW

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

  // 🔥 Check active DB + REDIRECT
  useEffect(() => {
    fetch("http://localhost:8000/active-db")
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.data) {
          setHasDB(false);

          // 🔥 REDIRECT TO CONNECT PAGE
          router.push("/connect-db");
        }
      })
      .catch(() => {
        setHasDB(false);
        router.push("/connect-db");
      });
  }, []);

  // 🔹 Fetch dashboard metrics
  useEffect(() => {
    if (!hasDB) return;

    const fetchMetrics = async () => {
      try {
        const res = await fetch("http://localhost:8000/dashboard");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
      }
    };

    fetchMetrics();
  }, [hasDB]);

  // 🔹 Fetch schema-based suggestions
  useEffect(() => {
    if (!hasDB) return;

    const fetchSuggestions = async () => {
      try {
        const res = await fetch("http://localhost:8000/suggestions");
        const data = await res.json();
        setQuestions(data);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
      }
    };

    fetchSuggestions();
  }, [hasDB]);

  return (
    <>
      {/* 🔥 OPTIONAL: fallback UI (will barely show due to redirect) */}
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

        {/* SCHEMA HEALTH */}
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

      {/* EXPLORE INSIGHTS */}
      <div className="activity-section">
        <div className="section-header">
          <h2 className="section-title">Explore Insights</h2>
        </div>

        <div className="activity-list">
          <Link
            href={{
              pathname: "/analytics",
              query: { q: "Top 5 values in a column" }
            }}
            className="activity-item"
          >
            <div className="activity-icon">📊</div>
            <div className="activity-content">
              <div className="activity-title">Top Values</div>
              <div className="activity-subtitle">
                Discover most frequent entries in your dataset
              </div>
            </div>
          </Link>

          <Link
            href={{
              pathname: "/analytics",
              query: { q: "Show trends over time" }
            }}
            className="activity-item"
          >
            <div className="activity-icon">📈</div>
            <div className="activity-content">
              <div className="activity-title">Trend Analysis</div>
              <div className="activity-subtitle">
                Understand how data evolves over time
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* SMART SUGGESTIONS */}
      <div className="activity-section">
        <div className="section-header">
          <h2 className="section-title">Smart Suggestions</h2>
        </div>

        <div className="activity-list">
          {!hasDB ? (
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-title">
                  Connect a database to see suggestions
                </div>
              </div>
            </div>
          ) : questions.length > 0 ? (
            questions.map((q, i) => (
              <Link
                key={i}
                href={{
                  pathname: "/analytics",
                  query: { q }
                }}
                className="activity-item"
              >
                <div className="activity-icon">?</div>
                <div className="activity-content">
                  <div className="activity-title">{q}</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="activity-item">
              <div className="activity-content">
                <div className="activity-title">
                  Loading suggestions...
                </div>
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
          <p className="action-card-description">
            Ask questions in natural language
          </p>
        </Link>

        <Link href="/schema" className="action-card">
          <div className="action-card-icon">▦</div>
          <h3 className="action-card-title">Explore Schema</h3>
          <p className="action-card-description">
            View tables and relationships
          </p>
        </Link>
      </div>
    </>
  );
}