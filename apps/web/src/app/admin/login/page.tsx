"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!response.ok) {
      setError("Wrong password.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <form onSubmit={onSubmit} className="cab w-full p-6">
        <p className="kicker">Control room</p>
        <h1 className="font-display mt-2 text-4xl">Sign in</h1>
        <p className="mt-2 text-sm text-muted">Use the admin password from your environment.</p>
        <label className="mt-6 grid gap-2 text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="field"
            autoComplete="current-password"
          />
        </label>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full">
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </main>
  );
}
