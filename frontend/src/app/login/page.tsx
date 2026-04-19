"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/src/lib/api";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      alert("Please enter email and password");
      return;
    }

    try {
      setLoading(true);

      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // Debug (remove later if you want)
      console.log("LOGIN RESPONSE:", res);

      // Handle both backend formats safely
      const token = res.access_token || res.token;

      if (!token) {
        throw new Error("Login failed: token not received");
      }

      setToken(token);

      router.push("/connect-db");

    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">

        <h1 className="login-title">Login</h1>
        <p className="login-subtitle">Access your analytics dashboard</p>

        <div className="login-form">

          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="login-button"
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>

        </div>

        <p className="login-footer">
          Don’t have an account?{" "}
          <span
            className="login-link"
            onClick={() => router.push("/signup")}
          >
            Signup
          </span>
        </p>

      </div>
    </div>
  );
}