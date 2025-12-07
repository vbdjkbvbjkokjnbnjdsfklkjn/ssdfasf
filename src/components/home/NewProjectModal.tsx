"use client";

import { useEffect, useState, type FormEvent } from "react";
import { listBaseModels } from "@/data/configurator";

const STORAGE_KEY = "collabcar_username";

export function NewProjectModal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseModel, setBaseModel] = useState(() => listBaseModels()[0]?.name ?? "");
  const baseModelOptions = listBaseModels();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) setUsername(saved);

    const handleUser = (event: Event) => {
      const detail = (event as CustomEvent).detail as { username?: string };
      if (detail?.username) setUsername(detail.username);
    };

    window.addEventListener("collabcar:user", handleUser as EventListener);
    return () => window.removeEventListener("collabcar:user", handleUser as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    setStatus(null);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ownerUsername = username?.trim();
    if (!ownerUsername) {
      setStatus("Set a username first");
      return;
    }
    if (!name.trim() || !baseModel) {
      setStatus("Name and base model are required");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          baseModel,
          ownerUsername,
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create project");
      }

      setStatus("Project created");
      window.dispatchEvent(
        new CustomEvent("collabcar:project-created", { detail: { username: ownerUsername } })
      );
      setTimeout(() => setStatus(null), 1500);
      setOpen(false);
      setName("");
      setDescription("");
      setBaseModel("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="rounded-full border border-white/15 bg-white/10 px-3 py-2 font-semibold text-white transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
        onClick={() => setOpen(true)}
      >
        New project
      </button>

      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 px-4 py-10 backdrop-blur">
          <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 text-slate-100 shadow-2xl ring-1 ring-indigo-500/25">
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onClick={close}
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
              <span>Close</span>
            </button>
            <div className="space-y-1">
              <h2 className="text-2xl font-semibold text-slate-100">Build a Car</h2>
              <p className="text-sm text-slate-300">
                Name it, add a short description, and choose a base model to start from.
              </p>
              {username ? (
                <p className="text-xs text-slate-400">Creating as @{username}</p>
              ) : (
                <p className="text-xs text-amber-300">Set a username before creating</p>
              )}
              {status ? <p className="text-xs text-rose-300">{status}</p> : null}
            </div>

            <form className="mt-5 grid gap-4" onSubmit={onSubmit}>
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-100">Project name</span>
                <input
                  type="text"
                  name="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name your project"
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-100">Description</span>
                <textarea
                  name="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what you want to build."
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-slate-100">Base model</span>
                <select
                  name="base"
                  value={baseModel}
                  onChange={(e) => setBaseModel(e.target.value)}
                  className="rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="" disabled>
                    Select a starting model
                  </option>
                  {baseModelOptions.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name} ({model.brand})
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-full border border-white/10 bg-slate-900/80 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-slate-200/60 focus:ring-offset-2 focus:ring-offset-slate-950"
                  onClick={close}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_40px_-22px_rgba(79,70,229,0.8)] transition hover:-translate-y-px hover:shadow-[0_18px_44px_-22px_rgba(79,70,229,0.8)] focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-60"
                >
                  {loading ? "Creating..." : "Create project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
