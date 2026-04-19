"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/src/context/ToastContext";
import { apiFetch } from "@/src/lib/api"; // 🔥 IMPORTANT

export default function useRequireDB() {
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const checkDB = async () => {
      try {
        const data = await apiFetch("/db/active-db"); // ✅ FIXED

        if (!data.success || !data.data) {
          showToast("Please connect a database first");
          router.push("/connect-db");
        }

      } catch {
        showToast("Please connect a database first");
        router.push("/connect-db");
      }
    };

    checkDB();
  }, []);
}