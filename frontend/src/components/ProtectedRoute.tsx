"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/src/lib/api";

export default function ProtectedRoute({ children }: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/login"); // 🔥 better than push
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) return null; // or spinner

  return children;
}