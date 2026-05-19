"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/api-client";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = getToken();
    router.replace(token ? "/dashboard" : "/login");
  }, [router]);
  return null;
}
