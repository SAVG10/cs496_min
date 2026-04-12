"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {

  const router = useRouter();

  useEffect(() => {
    const checkDB = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/active-db");
        const data = await res.json();

        if (data.success && data.data) {
          router.push("/dashboard");
        } else {
          router.push("/connect-db");
        }

      } catch {
        router.push("/connect-db");
      }
    };

    checkDB();
  }, []);

  return null; // 🔥 no UI
}