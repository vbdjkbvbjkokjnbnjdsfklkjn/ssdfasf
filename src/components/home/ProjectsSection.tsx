"use client";

import { useCallback, useEffect, useState } from "react";
import { ProjectList } from "@/components/projects/ProjectList";
import type { Project } from "@/data/projects";

const STORAGE_KEY = "collabcar_username";

export function ProjectsSection() {
  const [username, setUsername] = useState<string | null>(null);
  const [items, setItems] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const hasUser = Boolean(username?.trim());

  const adaptProjects = (raw: unknown[]): Project[] =>
    raw
      .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
      .map((p) => {
        const cast = p as Record<string, unknown>;
        return {
          id: (cast._id as string) ?? (cast.id as string) ?? (cast.name as string) ?? crypto.randomUUID(),
          title: (cast.name as string) ?? (cast.title as string) ?? "Untitled",
          description: (cast.description as string) ?? "No description provided.",
          stage: (cast.stage as string) ?? "Active",
          baseBranch: (cast.baseBranch as string) ?? "main",
          updatedAt: (cast.updatedAt as string) ?? new Date().toISOString(),
          tags: (cast.tags as string[]) ?? [],
          branches: (cast.branches as []) ?? [],
        };
      });

  const fetchProjects = useCallback(async (user: string) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/projects?username=${encodeURIComponent(user)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load projects");
      }
      const data = await res.json();
      const adapted = Array.isArray(data.projects) ? adaptProjects(data.projects) : [];
      setItems(adapted);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load projects");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      setUsername(saved);
      fetchProjects(saved);
    }

    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail as { username?: string };
      if (detail?.username) {
        setUsername(detail.username);
        fetchProjects(detail.username);
      }
    };

    const handleProjectCreated = (event: Event) => {
      const detail = (event as CustomEvent).detail as { username?: string };
      const targetUser = detail?.username ?? username;
      if (targetUser) fetchProjects(targetUser);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        setUsername(event.newValue);
        fetchProjects(event.newValue);
      }
    };

    window.addEventListener("collabcar:user", handleCustom as EventListener);
    window.addEventListener("collabcar:project-created", handleProjectCreated as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("collabcar:user", handleCustom as EventListener);
      window.removeEventListener("collabcar:project-created", handleProjectCreated as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchProjects, username]);

  return (
    <section id="projects" className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-slate-200">
        <span>{hasUser ? "Projects" : "Log in to see your projects"}</span>
        {loading ? <span className="text-xs text-slate-400">Loading...</span> : null}
        {status ? <span className="text-xs text-rose-300">{status}</span> : null}
      </div>
      {hasUser ? null : (
        <p className="text-xs text-amber-300">Log in with your username to load your projects.</p>
      )}
      {items.length > 0 ? (
        <ProjectList projects={items} />
      ) : (
        <p className="text-sm text-slate-400">No projects yet - create one to get started.</p>
      )}
    </section>
  );
}
