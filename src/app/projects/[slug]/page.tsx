import { ProjectWorkspace } from "@/components/workspace/ProjectWorkspace";

type ProjectPageProps = PageProps<"/projects/[slug]">;

function decodeSlug(slug: string) {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const safeSlug = Array.isArray(slug) ? slug[0] : slug || "";
  const fallbackTitle = decodeSlug(safeSlug).replace(/-/g, " ");

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <ProjectWorkspace projectId={safeSlug} fallbackTitle={fallbackTitle || "Workspace"} />
      </div>
    </main>
  );
}

