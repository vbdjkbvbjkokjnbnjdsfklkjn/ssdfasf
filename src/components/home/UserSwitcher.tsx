"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "collabcar_username";

export function UserSwitcher() {
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setUsername(saved);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setStatus("Enter a username");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      setUsername(trimmed);
      setStatus("Username saved");
      window.dispatchEvent(new CustomEvent("collabcar:user", { detail: { username: trimmed } }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-sm text-white ring-1 ring-white/10"
    >
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username"
        className="w-28 bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/15 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Set"}
      </button>
      {status ? <span className="text-[11px] text-slate-300">{status}</span> : null}
    </form>
  );
}


