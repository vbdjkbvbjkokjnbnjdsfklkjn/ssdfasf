"use client";

import Link from "next/link";

export default function CarSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 px-4 text-white">
      <header className="mx-auto mt-6 flex w-full max-w-4xl items-center justify-between rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 shadow-lg shadow-slate-900/40">
        <Link
          href="/"
          className="text-sm font-semibold text-white transition hover:text-emerald-200"
        >
          CollabCar
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-300">
          <Link
            href="/projects"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-semibold text-white transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Projects
          </Link>
          <Link
            href="/"
            className="rounded-lg px-3 py-2 font-semibold text-emerald-200 transition hover:text-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 shadow-[0_20px_60px_-40px_rgba(16,185,129,0.8)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
              <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div>
              <p className="text-xl font-semibold text-white">Car Bought successfully</p>
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/projects"
              className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_38px_-22px_rgba(16,185,129,0.8)] transition hover:-translate-y-px hover:shadow-[0_18px_48px_-24px_rgba(16,185,129,0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
            >
              Open workspace
            </Link>
            <Link
              href="/"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:w-auto"
            >
              Back to projects
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
