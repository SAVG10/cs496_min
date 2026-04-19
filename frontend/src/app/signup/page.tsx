"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, setToken } from "@/src/lib/api";
import "./signup.css";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async () => {
    if (!email || !password) {
      alert("Please fill all fields");
      return;
    }

    try {
      setLoading(true);

      const res = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // 🔐 Save token
      setToken(res.token);

      // 🔁 Redirect to DB selection (correct flow)
      router.push("/connect-db");

    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-container">
      <div className="signup-card">

        <h1 className="signup-title">Create Account</h1>
        <p className="signup-subtitle">Start analyzing your data</p>

        <div className="signup-form">

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
            className="signup-button"
            onClick={handleSignup}
            disabled={loading}
          >
            {loading ? "Creating account..." : "Signup"}
          </button>

        </div>

        <p className="signup-footer">
          Already have an account?{" "}
          <span
            className="signup-link"
            onClick={() => router.push("/login")}
          >
            Login
          </span>
        </p>

      </div>
    </div>
  );
}