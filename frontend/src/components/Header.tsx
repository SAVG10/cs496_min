"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/src/context/ToastContext"; // 🔥 NEW

export default function Header() {
  const [activeDB, setActiveDB] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast(); // 🔥 NEW

  const fetchActiveDB = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/active-db");
      const data = await res.json();

      if (data.success && data.data) {
        setActiveDB(data.data.name);
      } else {
        setActiveDB(null);
      }
    } catch {
      setActiveDB(null);
    }
  };

  useEffect(() => {
    fetchActiveDB();
  }, [pathname]);

  // 🔥 DISCONNECT FUNCTION (UPDATED)
  const handleDisconnect = async () => {
    try {
      await fetch("http://127.0.0.1:8000/disconnect-db", {
        method: "POST",
      });

      setActiveDB(null);

      // 🔥 TOAST
      showToast("Database disconnected");

      // 🔥 REDIRECT
      router.push("/connect-db");

    } catch (err) {
      console.error("Disconnect failed", err);
      showToast("Failed to disconnect database");
    }
  };

  return (
    <header
      className="header"
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
      }}
    >
      {/* LEFT */}
      <h1 className="page-title">Helix</h1>

      {/* 🔥 FLEX SPACER */}
      <div style={{ flex: 1 }} />

      {/* RIGHT */}
      <div
        className="user-info"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {/* ACTIVE DB BADGE */}
        <div
          className="active-db-badge"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {activeDB ? (
            <>
              <span>Using: {activeDB}</span>

              <button
                onClick={handleDisconnect}
                style={{
                  color: "#f87171",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <span>No DB Selected</span>
          )}
        </div>

        {/* USER */}
        <div className="user-avatar">JD</div>
      </div>
    </header>
  );
}