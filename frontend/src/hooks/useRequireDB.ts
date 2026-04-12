"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/src/context/ToastContext";

export default function useRequireDB() {
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const checkDB = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/active-db");
        const data = await res.json();

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