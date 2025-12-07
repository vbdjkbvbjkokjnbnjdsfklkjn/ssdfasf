export type BranchStatus = "active" | "review" | "archived" | "prototype";

export type Branch = {
  name: string;
  owner: string;
  updatedAt: string;
  summary: string;
  status: BranchStatus;
};

export type Project = {
  id: string;
  title: string;
  name?: string;
  description: string;
  stage: string;
  baseBranch: string;
  baseModel?: string;
  updatedAt: string;
  createdAt?: string;
  owner?: string;
  tags: string[];
  branches: Branch[];
};

export const projects: Project[] = [
  {
    id: "aurora-suv",
    title: "Aurora SUV Workspace",
    description:
      "Family-first SUV with panoramic roof, premium safety stack, and configurable seating.",
    stage: "In workshop",
    baseBranch: "main",
    baseModel: "Aurora SUV",
    updatedAt: "2025-12-05T08:30:00.000Z",
    tags: ["collaboration", "pricing", "live-preview"],
    branches: [
      {
        name: "pricing-experiments",
        owner: "Priya",
        updatedAt: "2025-12-05T13:20:00.000Z",
        summary: "Lease vs. EMI toggles and regional tax tweaks.",
        status: "active",
      },
      {
        name: "comfort-package",
        owner: "Zane",
        updatedAt: "2025-12-04T18:10:00.000Z",
        summary: "Ventilated seats + acoustic glass variant for demo.",
        status: "review",
      },
      {
        name: "offroad-pack",
        owner: "Mina",
        updatedAt: "2025-12-03T10:05:00.000Z",
        summary: "Raised suspension and all-terrain wheels bundle.",
        status: "prototype",
      },
    ],
  },
  {
    id: "lyra-ev",
    title: "Lyra EV Studio",
    description:
      "Urban EV with modular battery choices and AI route-based range planning.",
    stage: "Client review",
    baseBranch: "release/candidate",
    updatedAt: "2025-12-04T15:00:00.000Z",
    tags: ["ai-notes", "multi-cursor", "range"],
    branches: [
      {
        name: "interior-lighting",
        owner: "Haruto",
        updatedAt: "2025-12-05T12:05:00.000Z",
        summary: "Ambient lighting presets tied to persona prompts.",
        status: "active",
      },
      {
        name: "delivery-timeline",
        owner: "Sara",
        updatedAt: "2025-12-04T09:40:00.000Z",
        summary: "Inline lead-time notes and logistics blockers.",
        status: "review",
      },
    ],
  },
  {
    id: "zephyr-gt",
    title: "Zephyr GT Lab",
    description:
      "Performance coupe with adaptive aero, track telemetry, and curated finish packs.",
    stage: "Concepting",
    baseBranch: "develop",
    updatedAt: "2025-12-02T20:40:00.000Z",
    tags: ["telemetry", "visual-diffs"],
    branches: [
      {
        name: "track-day-demo",
        owner: "Lena",
        updatedAt: "2025-12-05T06:55:00.000Z",
        summary: "Brake kit swap + aero notes for weekend drive.",
        status: "active",
      },
      {
        name: "heritage-trim",
        owner: "Arjun",
        updatedAt: "2025-12-02T17:15:00.000Z",
        summary: "Two-tone leather and machined wheels showcase.",
        status: "prototype",
      },
      {
        name: "archived/v1",
        owner: "System",
        updatedAt: "2025-11-28T11:00:00.000Z",
        summary: "Early layout with dated pricing. Kept for audit.",
        status: "archived",
      },
    ],
  },
];
