"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/src/lib/api";

export default function ProtectedRoute({ children }: any) {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
    }
  }, []);

  return children;
}