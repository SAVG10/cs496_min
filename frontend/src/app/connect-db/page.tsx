"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/src/context/ToastContext";
import { apiFetch } from "@/src/lib/api"; // 🔥 IMPORTANT
import ProtectedRoute from "@/src/components/ProtectedRoute";
import "./connect-db.css";

export default function ConnectDBPage() {

  const router = useRouter();
  const { showToast } = useToast();

  const [form, setForm] = useState({
    name: "",
    host: "localhost",
    port: "5432",
    dbname: "",
    username: "postgres",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: any) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleConnect = async () => {
    setError("");

    if (!form.name || !form.dbname || !form.password) {
      const msg = "Please fill all required fields";
      setError(msg);
      showToast(msg);
      return;
    }

    try {
      setLoading(true);

      // 🔥 FIXED: using apiFetch (sends JWT)
      const data = await apiFetch("/db/connect-db", {
        method: "POST",
        body: JSON.stringify(form),
      });

      showToast(data.message || "Database connected successfully");

      router.push("/dashboard");

    } catch (err: any) {
      const msg = err.message || "Connection failed";
      setError(msg);
      showToast(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="connect-container">

        <div className="connect-card">

          <h1 className="connect-title">Connect Database</h1>
          <p className="connect-subtitle">
            Add a PostgreSQL database to analyze
          </p>

          {/* ERROR */}
          {error && (
            <div className="connect-error">
              {error}
            </div>
          )}

          {/* FORM */}
          <div className="connect-form">

            <input
              name="name"
              placeholder="Connection Name (e.g. Sales DB)"
              value={form.name}
              onChange={handleChange}
            />

            <input
              name="host"
              placeholder="Host"
              value={form.host}
              onChange={handleChange}
            />

            <input
              name="port"
              placeholder="Port"
              value={form.port}
              onChange={handleChange}
            />

            <input
              name="dbname"
              placeholder="Database Name"
              value={form.dbname}
              onChange={handleChange}
            />

            <input
              name="username"
              placeholder="Username"
              value={form.username}
              onChange={handleChange}
            />

            <input
              name="password"
              type="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
            />

            <button
              className="connect-button"
              onClick={handleConnect}
              disabled={loading}
            >
              {loading ? "Connecting..." : "Connect Database"}
            </button>

          </div>

        </div>

      </div>
    </ProtectedRoute>
  );
}