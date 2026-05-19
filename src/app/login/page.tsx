"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, setSession, type StoredUser } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("meera@taskboard.dev");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await apiFetch<{ token: string; user: StoredUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setSession(data.token, data.user);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm bg-surface border border-border rounded-lg p-8">
        <h1 className="text-2xl font-semibold mb-1">TaskBoard</h1>
        <p className="text-muted text-sm mb-6">sign in to continue</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-muted">email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-sm text-muted">password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md bg-bg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </label>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-accent hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-md py-2"
          >
            {submitting ? "signing in…" : "sign in"}
          </button>
        </form>

        <p className="text-xs text-muted mt-6">
          no account?{" "}
          <Link href="/register" className="text-accent hover:underline">
            register
          </Link>
        </p>
      </div>
    </main>
  );
}
