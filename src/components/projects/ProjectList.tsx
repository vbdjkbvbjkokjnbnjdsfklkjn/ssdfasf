import type { Project } from "@/data/projects";
import { ProjectCard } from "./ProjectCard";

type ProjectListProps = {
  projects: Project[];
  currentUsername?: string;
  onDelete?: (projectId: string) => void;
};

export function ProjectList({ projects, currentUsername, onDelete }: ProjectListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          currentUsername={currentUsername}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
