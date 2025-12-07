"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import { createPortal } from "react-dom";
import type { Project } from "@/data/projects";
import { formatRelativeTime } from "@/lib/time";

type ProjectCardProps = {
  project: Project;
  currentUsername?: string;
  onDelete?: (projectId: string) => void;
};

function ProjectVisual({ title }: { title: string }) {
  return (
    <div className="relative h-36 w-full overflow-hidden rounded-2xl bg-slate-900 ring-1 ring-white/5">
      <Image
        src="/car-visual.jpg"
        alt={`${title} illustration`}
        fill
        sizes="(min-width: 1024px) 420px, (min-width: 768px) 360px, 100vw"
        className="object-cover"
        priority
      />
    </div>
  );
}

export function ProjectCard({ project, currentUsername, onDelete }: ProjectCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const encodedId = useMemo(() => encodeURIComponent(project.id), [project.id]);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [copied, setCopied] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setMenuOpen(false);
    }
  };

  const toggleMenu = () => setMenuOpen((open) => !open);

  const handleBranch = async () => {
    setMenuOpen(false);
    const ownerUsername = (currentUsername ?? "").trim() || "Guest";
    setStatus("Branching...");

    try {
      const baseBranchName = `${project.title} Branch`;
      let branchName = baseBranchName;

      try {
        const listRes = await fetch(`/api/projects?username=${encodeURIComponent(ownerUsername)}`);
        if (listRes.ok) {
          const listBody = await listRes.json();
          const names = new Set(
            Array.isArray(listBody.projects)
              ? listBody.projects.map((p: Project) => p.title ?? p.name ?? "")
              : []
          );
          let suffix = 2;
          while (names.has(branchName)) {
            branchName = `${baseBranchName} - ${suffix}`;
            suffix += 1;
          }
        }
      } catch (err) {
        console.warn("Could not inspect existing branches", err);
      }

      const cfgRes = await fetch(`/api/projects/${encodedId}/config`);
      const cfgBody = cfgRes.ok ? await cfgRes.json().catch(() => ({})) : {};
      const config = cfgBody?.config;

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: branchName,
          baseModel: project.baseModel ?? config?.model ?? "Model",
          ownerUsername,
          description: project.description,
        }),
      });

      if (!res.ok) throw new Error("Branch creation failed");
      const body = await res.json();
      const newId = body.project?._id || body.project?.id;
      if (!newId) throw new Error("No project id returned");

      if (config) {
        await fetch(`/api/projects/${encodeURIComponent(newId)}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(config),
        });
      }

      setStatus(`Branched: ${branchName}`);
      router.refresh();
      if (typeof window !== "undefined") {
        // Ensure UI reflects new project immediately
        window.location.reload();
      }
    } catch (error) {
      console.error(error);
      setStatus("Branch failed");
    }
  };

  const handleDelete = async () => {
    setMenuOpen(false);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete "${project.title}"? This cannot be undone.`);
      if (!confirmed) return;
    }
    try {
      setStatus("Deleting...");
      const res = await fetch(`/api/projects/${encodedId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error || "Delete failed";
        setStatus(message);
        window.alert(message);
        return;
      }
      setStatus("Deleted");
      onDelete?.(project.id);
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatus("Delete failed");
      window.alert("Delete failed. Please try again.");
    }
  };

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (shareOpen) setShareOpen(false);
        if (detailsOpen) setDetailsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailsOpen, shareOpen]);

  const computeShareLink = () => {
    if (typeof window === "undefined") return `/projects/${encodedId}`;
    const origin = window.location.origin;
    return `${origin}/projects/${encodedId}`;
  };

  const handleShare = () => {
    setMenuOpen(false);
    const link = computeShareLink();
    setShareLink(link);
    setShareOpen(true);
  };

  const handleDetails = () => {
    setMenuOpen(false);
    setDetailsOpen(true);
  };

  const closeShare = () => {
    setShareOpen(false);
  };

  const copyLink = async () => {
    const link = shareLink || computeShareLink();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = link;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch (error) {
      console.error("Copy failed", error);
      setStatus("Copy failed");
    }
  };

  return (
    <article className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/5 bg-[linear-linear(135deg,rgba(17,25,45,0.9),rgba(10,18,35,0.9))] p-5 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)] ring-1 ring-slate-900/40 transition hover:-translate-y-0.5 hover:ring-indigo-500/50">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100">
        <div className="absolute -left-20 -top-32 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute -right-16 top-16 h-56 w-56 rounded-full bg-sky-500/15 blur-3xl" />
      </div>

      <header className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col gap-1">

          <h3 className="text-lg font-semibold text-white">{project.title}</h3>
          <p className="text-xs text-slate-400">
            Updated {formatRelativeTime(project.updatedAt)}
          </p>
        </div>
        <div
          className="relative"
          onBlur={handleMenuBlur}
        >
          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Project menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            type="button"
            onClick={toggleMenu}
          >
            <span className="inline-flex flex-col gap-1.5">
              <span className="h-0.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-0.5 w-1.5 rounded-full bg-slate-300" />
              <span className="h-0.5 w-1.5 rounded-full bg-slate-300" />
            </span>
          </button>
          <div
            className={`absolute right-0 top-12 z-20 ${menuOpen ? "flex" : "hidden"} min-w-36 flex-col rounded-xl border border-white/10 bg-slate-900/95 py-1 text-sm text-slate-200 shadow-lg ring-1 ring-indigo-500/20 transition`}
            role="menu"
          >
            <button
              className="rounded-lg px-3 py-2 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              type="button"
              onClick={handleBranch}
            >
              Branch
            </button>
            <button
              className="rounded-lg px-3 py-2 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              type="button"
              onClick={handleDelete}
            >
              Delete
            </button>
            <button
              className="rounded-lg px-3 py-2 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              type="button"
              onClick={handleShare}
            >
              Share
            </button>
          </div>
        </div>
      </header>

      <ProjectVisual title={project.title} />

      <p className="text-sm text-slate-200">{project.description}</p>

      <div className="flex items-center justify-end gap-2 text-sm text-slate-200">
        <div className="flex items-center gap-2">
          <Link
            href={`/projects/${encodedId}`}
            className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_40px_-22px_rgba(79,70,229,0.8)] transition hover:-translate-y-px hover:shadow-[0_18px_44px_-22px_rgba(79,70,229,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Open
          </Link>
          <button
            type="button"
            onClick={handleDetails}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Details
          </button>
        </div>
      </div>
      {status ? <p className="text-xs text-slate-400">{status}</p> : null}

      {mounted
        ? createPortal(
            <>
              {shareOpen ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur-[1px]"
                  onClick={closeShare}
                >
                  <div
                    className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-[0_24px_120px_-60px_rgba(8,15,30,0.9)] ring-1 ring-white/10"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -left-16 top-0 h-44 w-44 rounded-full bg-indigo-500/12 blur-xl" />
                      <div className="absolute right-[-10%] bottom-[-18%] h-56 w-56 rounded-full bg-emerald-400/10 blur-[60px]" />
                    </div>
                    <button
                      type="button"
                      aria-label="Close share"
                      onClick={closeShare}
                      className="absolute right-3 top-3 inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      <span aria-hidden="true">×</span>
                      <span>Close</span>
                    </button>
                    <div className="relative space-y-3">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/80">Share Project</p>
                        <h3 className="text-2xl font-semibold text-white">{project.title}</h3>
                        <p className="text-sm text-slate-300">
                          Copy this link to invite collaborators to the workspace.
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 ring-1 ring-white/10">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Shareable link</p>
                        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <input
                            readOnly
                            value={shareLink || computeShareLink()}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2.5 text-sm text-slate-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-400/30"
                          />
                          <button
                            type="button"
                            onClick={copyLink}
                            className="min-w-[120px] rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_16px_46px_-24px_rgba(79,70,229,0.85)] transition hover:-translate-y-px hover:shadow-[0_20px_56px_-24px_rgba(79,70,229,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            Copy link
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {detailsOpen ? (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/88 px-4 py-8 backdrop-blur"
                  onClick={() => setDetailsOpen(false)}
                >
                  <div
                    className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-[0_24px_120px_-60px_rgba(8,15,30,0.9)] ring-1 ring-white/10"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute -left-16 top-2 h-48 w-48 rounded-full bg-indigo-500/10 blur-xl" />
                      <div className="absolute right-[-10%] bottom-[-18%] h-60 w-60 rounded-full bg-sky-400/12 blur-[55px]" />
                    </div>
                    <button
                      type="button"
                      aria-label="Close details"
                      onClick={() => setDetailsOpen(false)}
                      className="absolute right-3 top-3 inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-white/25 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      <span aria-hidden="true">×</span>
                      <span>Close</span>
                    </button>
                    <div className="relative space-y-4">
                      <div className="space-y-1">
                        <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-200/80">Project details</p>
                        <h3 className="text-2xl font-semibold text-white">{project.title}</h3>
                        <p className="text-sm text-slate-300">
                          {project.description || "No description provided."}
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Base model</p>
                          <p className="text-sm text-white">{project.baseModel ?? "Not set"}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Stage</p>
                          <p className="text-sm text-white">{project.stage || "Active"}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Base branch</p>
                          <p className="text-sm text-white">{project.baseBranch || "main"}</p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Updated</p>
                          <p className="text-sm text-white">{formatRelativeTime(project.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Created</p>
                          <p className="text-sm text-white">
                            {project.createdAt ? formatRelativeTime(project.createdAt) : "Unknown"}
                          </p>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-3">
                          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Owner</p>
                          <p className="text-sm text-white">{project.owner ?? "Unknown"}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/projects/${encodedId}`}
                          className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_40px_-22px_rgba(79,70,229,0.9)] transition hover:-translate-y-px hover:shadow-[0_16px_48px_-22px_rgba(79,70,229,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          onClick={() => setDetailsOpen(false)}
                        >
                          Open workspace
                        </Link>
                        <button
                          type="button"
                          onClick={copyLink}
                          className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                        >
                          Copy link
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {copied ? (
                <div className="pointer-events-none fixed bottom-6 right-6 z-50 animate-[fadeIn_120ms_ease-out] rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100 shadow-xl ring-1 ring-emerald-400/30">
                  Link copied to clipboard
                </div>
              ) : null}
            </>,
            document.body
          )
        : null}
    </article>
  );
}
