"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FocusEvent } from "react";
import type { Project } from "@/data/projects";
import { formatRelativeTime } from "@/lib/time";

type ProjectCardProps = {
  project: Project;
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

export function ProjectCard({ project }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleMenuBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setMenuOpen(false);
    }
  };

  const toggleMenu = () => setMenuOpen((open) => !open);

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
              onClick={() => setMenuOpen(false)}
            >
              Branch
            </button>
            <button
              className="rounded-lg px-3 py-2 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              type="button"
              onClick={() => setMenuOpen(false)}
            >
              Delete
            </button>
            <button
              className="rounded-lg px-3 py-2 text-center transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              type="button"
              onClick={() => setMenuOpen(false)}
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
            href={`/projects/${project.id}`}
            className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_40px_-22px_rgba(79,70,229,0.8)] transition hover:-translate-y-px hover:shadow-[0_18px_44px_-22px_rgba(79,70,229,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Open
          </Link>
          <button className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
            Details
          </button>
        </div>
      </div>
    </article>
  );
}
