"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/src/context/ToastContext"; // 🔥 NEW
import "./connect-db.css";

export default function ConnectDBPage() {

  const router = useRouter();
  const { showToast } = useToast(); // 🔥 NEW

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
      setError("Please fill all required fields");
      showToast("Please fill all required fields"); // 🔥 TOAST
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("http://127.0.0.1:8000/connect-db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      // 🔥 Proper error handling
      if (!res.ok || !data.success) {
        throw new Error(data.detail || data.error || "Connection failed");
      }

      // 🔥 SUCCESS TOAST (THIS WAS MISSING)
      showToast(data.message || "Database connected successfully");

      // 🔥 Redirect
      router.push("/dashboard");

    } catch (err: any) {
      const msg = err.message || "Connection failed";
      setError(msg);
      showToast(msg); // 🔥 ERROR TOAST
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}