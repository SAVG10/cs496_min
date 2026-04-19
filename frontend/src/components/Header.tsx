"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useToast } from "@/src/context/ToastContext";
import { apiFetch, removeToken } from "@/src/lib/api"; // 🔥 FIXED

export default function Header() {
  const [activeDB, setActiveDB] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const { showToast } = useToast();

  // 🔹 FETCH ACTIVE DB (JWT SAFE)
  const fetchActiveDB = async () => {
    try {
      const data = await apiFetch("/db/active-db");

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

  // 🔹 DISCONNECT DB
  const handleDisconnect = async () => {
    try {
      await apiFetch("/db/disconnect-db", {
        method: "POST",
      });

      setActiveDB(null);
      showToast("Database disconnected");
      router.push("/connect-db");

    } catch (err) {
      console.error("Disconnect failed", err);
      showToast("Failed to disconnect database");
    }
  };

  // 🔹 LOGOUT
  const handleLogout = () => {
    removeToken();
    showToast("Logged out");
    router.push("/login");
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

      {/* FLEX SPACER */}
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
        {/* ACTIVE DB */}
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

        {/* USER AVATAR */}
        <div className="user-avatar">JD</div>

        {/* 🔥 LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          style={{
            background: "#ef4444",
            color: "white",
            border: "none",
            padding: "6px 10px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}