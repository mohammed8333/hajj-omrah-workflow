"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (typeof window !== "undefined") {
        const search = window.location.search;
        if (search) {
          const params = new URLSearchParams(search);
          const req = params.get("requestId") || params.get("req");
          const doc = params.get("docId") || params.get("doc");
          if (req) {
            router.replace(`/requests/${req}${doc ? `?docId=${doc}` : ""}`);
            return;
          }
        }
      }

      if (user) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">جاري التوجيه...</span>
      </div>
    </div>
  );
}
