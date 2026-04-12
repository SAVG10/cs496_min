"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export default function Sidebar() {

  const pathname = usePathname();

  // 🔥 NEW: Active DB state
  const [activeDB, setActiveDB] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/active-db")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setActiveDB(data.data.name);
        } else {
          setActiveDB(null);
        }
      })
      .catch(() => setActiveDB(null));
  }, []);

  return (
    <aside className="sidebar">

      {/* Logo */}
      <div className="logo">
        <div className="logo-icon">H</div>
        <div>
          <div className="logo-text">Helix</div>
          <div className="logo-subtext">Analytics</div>
        </div>
      </div>


      {/* Navigation */}
      <nav className="nav-menu">

        {/* Primary Section */}
        <div className="nav-section">
          <div className="nav-section-title">Primary</div>

          <Link
            href="/dashboard"
            className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`}
          >
            <span className="nav-icon">◆</span>
            <span>Dashboard</span>
          </Link>

          <Link
            href="/analytics"
            className={`nav-item ${pathname === "/analytics" ? "active" : ""}`}
          >
            <span className="nav-icon">◉</span>
            <span>Explore</span>
          </Link>

          <Link
            href="/schema"
            className={`nav-item ${pathname === "/schema" ? "active" : ""}`}
          >
            <span className="nav-icon">🧠</span>
            <span>Schema</span>
          </Link>

          {/* 🔥 NEW: Connect DB */}
          <Link
            href="/connect-db"
            className={`nav-item ${pathname === "/connect-db" ? "active" : ""}`}
          >
            <span className="nav-icon">🔌</span>
            <span>Connect DB</span>
          </Link>

        </div>

        {/* History Section */}
        <div className="nav-section">
          <div className="nav-section-title">History</div>

          <Link
            href="/saved"
            className={`nav-item ${pathname === "/saved" ? "active" : ""}`}
          >
            <span className="nav-icon">★</span>
            <span>Saved Queries</span>
          </Link>

          <Link
            href="/history"
            className={`nav-item ${pathname === "/history" ? "active" : ""}`}
          >
            <span className="nav-icon">⟲</span>
            <span>Query History</span>
          </Link>
        </div>

      </nav>

    </aside>
  );
}