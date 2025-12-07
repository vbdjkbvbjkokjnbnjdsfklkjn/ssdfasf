import { ProjectsSection } from "@/components/home/ProjectsSection";
import { NewProjectModal } from "@/components/home/NewProjectModal";
import { UserSwitcher } from "@/components/home/UserSwitcher";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-10 sm:px-10 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-18%] top-[-10%] h-72 w-72 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="absolute right-[-20%] top-[10%] h-80 w-80 rounded-full bg-sky-500/15 blur-3xl" />
        <div className="absolute left-[20%] bottom-[-40%] h-[420px] w-[420px] rounded-full bg-indigo-800/30 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col gap-8">
        <nav className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-100 ring-1 ring-white/10">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-sky-400 text-white shadow-[0_10px_30px_-18px_rgba(59,130,246,0.8)]">
              CC
            </span>
            Collaborative Configurator
          </div>
          <div className="flex items-center gap-3">
            <NewProjectModal />
            <UserSwitcher />
          </div>
        </nav>

        <ProjectsSection />
      </div>
    </main>
  );
}

