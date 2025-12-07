"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { io, type Socket } from "socket.io-client";
import {
  calculatePricing,
  CarConfiguration,
  createConfigFromVariant,
  getOptionsForModel,
  listBaseModels,
} from "@/data/configurator";
import type { Project } from "@/data/projects";

type ProjectWorkspaceProps = {
  projectId: string;
  fallbackTitle: string;
};

type CursorPeer = {
  id: string;
  username: string;
  color: string;
  x: number;
  y: number;
  lastSeen: number;
  focus?: string | null;
};

type CollabMessage =
  | { kind: "cursor"; userId: string; username: string; x: number; y: number }
  | { kind: "config"; userId: string; username: string; config: CarConfiguration }
  | { kind: "focus"; userId: string; username: string; field: string | null }
  | { kind: "project-meta"; userId: string; username: string; project: Partial<ProjectMeta> }
  | { kind: "comment"; userId: string; username: string; comment: CommentItem };

type ProjectMeta = {
  title: string;
  description?: string;
  baseModel: string;
};

type ActivityItem = {
  id: string;
  message: string;
  user: string;
  timestamp: number;
};

type CommentItem = {
  id: string;
  attribute: string;
  user: string;
  text: string;
  timestamp: number;
};

type ApiProject = Project & {
  _id?: string;
  baseModel?: string;
  title?: string;
  name?: string;
  description?: string;
};

const USERNAME_KEY = "collabcar_username";
const SESSION_KEY = "collabcar_session_id";

const palette = [
  "#7C3AED",
  "#2563EB",
  "#0EA5E9",
  "#059669",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#E11D48",
];

const randomId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

function hashToIndex(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % palette.length;
}

function createColor(id: string) {
  return palette[hashToIndex(id)];
}

function optionLabel(value: string | number) {
  if (typeof value === "number") return `${value}"`;
  return value;
}

function attributeLabel(attribute: string) {
  return attribute
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readIdentity() {
  if (typeof window === "undefined") return { id: "", name: "Guest" };
  const storedId = window.sessionStorage.getItem(SESSION_KEY) ?? randomId();
  window.sessionStorage.setItem(SESSION_KEY, storedId);
  const savedUser = window.localStorage.getItem(USERNAME_KEY);
  return { id: storedId, name: savedUser?.trim() || "Guest" };
}

function useIdentity() {
  const [identity, setIdentity] = useState<{ id: string; name: string }>({ id: "", name: "" });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdentity(readIdentity());
  }, []);

  return { userId: identity.id, username: identity.name };
}

function PresenceBadge({ peer }: { peer: CursorPeer }) {
  return (
    <span
      className="flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white ring-1 ring-white/10"
      style={{ borderColor: `${peer.color}44` }}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: peer.color }} />
      {peer.username}
    </span>
  );
}

function FieldHeader({
  title,
  description,
  collaborators,
}: {
  title: string;
  description?: string;
  collaborators?: string[];
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {description ? <p className="text-xs text-slate-400">{description}</p> : null}
      </div>
      {collaborators && collaborators.length > 0 ? (
        <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-100 ring-1 ring-white/10">
          {collaborators.join(", ")}
        </span>
      ) : null}
    </div>
  );
}

function PillOptions<T extends string | number>({
  value,
  options,
  onChange,
  onFocus,
}: {
  value: T;
  options: { label: string; value: T; hint?: string }[];
  onChange: (val: T) => void;
  onFocus?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          onFocus={onFocus}
          className={clsx(
            "flex flex-col gap-1 rounded-2xl border px-3 py-3 text-left text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
            value === option.value
              ? "border-indigo-400/60 bg-indigo-500/10 text-white"
              : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
          )}
        >
          <span className="font-semibold">{option.label}</span>
          {option.hint ? <span className="text-xs text-slate-400">{option.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ProjectWorkspace({ projectId, fallbackTitle }: ProjectWorkspaceProps) {
  const router = useRouter();
  const { userId, username } = useIdentity();
  const defaultBaseModel = listBaseModels()[0]?.name || "Model";
  const [projectMeta, setProjectMeta] = useState<ProjectMeta>({
    title: fallbackTitle,
    description: "",
    baseModel: defaultBaseModel,
  });
  const [config, setConfig] = useState<CarConfiguration>(() =>
    createConfigFromVariant(defaultBaseModel)
  );
  const [peers, setPeers] = useState<Record<string, CursorPeer>>({});
  const peersRef = useRef<Record<string, CursorPeer>>({});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [synced, setSynced] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentItem[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastCursorSent = useRef<number>(0);
  const hasRemoteConfig = useRef(false);
  const encodedProjectId = useMemo(() => encodeURIComponent(projectId), [projectId]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  const pricing = useMemo(() => calculatePricing(config), [config]);
  const numberFmt = useMemo(
    () =>
      typeof Intl !== "undefined"
        ? new Intl.NumberFormat("en-IN")
        : { format: (value: number) => value.toString() },
    []
  );
  const [selfLastSeen] = useState(() => Date.now());
  const statusMessage = status || saveStatus;

  const fieldOwners = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.values(peers).forEach((peer) => {
      if (!peer.focus) return;
      map[peer.focus] = map[peer.focus] ? [...map[peer.focus], peer.username] : [peer.username];
    });
    return map;
  }, [peers]);

  const pushActivity = useCallback((message: string, user: string) => {
    setActivity((items) => {
      const next: ActivityItem[] = [
        {
          id: randomId(),
          message,
          user,
          timestamp: Date.now(),
        },
        ...items,
      ].slice(0, 12);
      return next;
    });
  }, []);

  const emit = useCallback(
    (message: CollabMessage) => {
      channelRef.current?.postMessage(message);
      socketRef.current?.emit("collab-message", message);
    },
    []
  );

  const upsertComment = useCallback((incoming: CommentItem) => {
    setComments((prev) => {
      const existing = prev[incoming.attribute] ?? [];
      const nextThread = [incoming, ...existing.filter((item) => item.id !== incoming.id)]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 30);
      return { ...prev, [incoming.attribute]: nextThread };
    });
  }, []);

  const upsertPeer = useCallback((incoming: Omit<CursorPeer, "color">) => {
    setPeers((prev) => ({
      ...prev,
      [incoming.id]: {
        ...prev[incoming.id],
        ...incoming,
        color: prev[incoming.id]?.color ?? createColor(incoming.id),
      },
    }));
  }, []);

  const handleIncoming = useCallback(
    (message: CollabMessage) => {
      if (!message || (message as CollabMessage).userId === userId) return;

      if (message.kind === "cursor") {
        upsertPeer({
          id: message.userId,
          username: message.username,
          x: message.x,
          y: message.y,
          lastSeen: Date.now(),
          focus: peersRef.current[message.userId]?.focus,
        });
      }

      if (message.kind === "config") {
        hasRemoteConfig.current = true;
        setConfig(message.config);
        pushActivity(`${message.username} adjusted the build`, message.username);
        setSynced(true);
        setTimeout(() => setSynced(false), 1200);
      }

      if (message.kind === "focus") {
        upsertPeer({
          id: message.userId,
          username: message.username,
          x: peersRef.current[message.userId]?.x ?? 0,
          y: peersRef.current[message.userId]?.y ?? 0,
          lastSeen: Date.now(),
          focus: message.field,
        });
      }

      if (message.kind === "comment") {
        upsertComment(message.comment);
      }

      if (message.kind === "project-meta") {
        setProjectMeta((prev) => ({
          title: message.project.title ?? prev.title,
          description: message.project.description ?? prev.description,
          baseModel: message.project.baseModel ?? prev.baseModel,
        }));
      }
    },
    [pushActivity, upsertComment, upsertPeer, userId]
  );

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !userId) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const now = Date.now();

    if (now - lastCursorSent.current > 30) {
      emit({ kind: "cursor", userId, username, x, y });
      lastCursorSent.current = now;
    }
  };

  const markFocus = (field: string | null) => {
    if (!userId) return;
    emit({ kind: "focus", field, userId, username });
  };

  const addComment = (attribute: string) => {
    const draft = commentDrafts[attribute]?.trim();
    if (!draft) return;
    const comment: CommentItem = {
      id: randomId(),
      attribute,
      user: username,
      text: draft,
      timestamp: Date.now(),
    };
    upsertComment(comment);
    setCommentDrafts((prev) => ({ ...prev, [attribute]: "" }));
    emit({ kind: "comment", userId, username, comment });
    pushActivity(`${username} left a note on ${attributeLabel(attribute)}`, username);
    persistComments(comment);
  };

  const persistComments = useCallback(
    async (latest?: CommentItem) => {
      try {
        const payload =
          latest && latest.attribute
            ? { ...comments, [latest.attribute]: [latest, ...(comments[latest.attribute] ?? [])] }
            : comments;
        await fetch(`/api/projects/${encodedProjectId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comments: payload }),
        });
      } catch (error) {
        console.error("Failed to persist comments", error);
      }
    },
    [comments, encodedProjectId]
  );

  const persistConfig = useCallback(
    async (configToSave: CarConfiguration) => {
      try {
        setSaveStatus("Saving...");
        await fetch(`/api/projects/${encodedProjectId}/config`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configToSave),
        });
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(null), 1000);
      } catch (error) {
        console.error("Failed to persist config", error);
        setSaveStatus("Save failed");
      }
    },
    [projectId]
  );

  const updateConfig = (attribute: string, value: string) => {
    setConfig((prev) => {
      const next: CarConfiguration = {
        ...prev,
        selections: { ...prev.selections, [attribute]: value },
      };
      hasRemoteConfig.current = true;
      emit({ kind: "config", userId, username, config: next });
      pushActivity(`${username} set ${attributeLabel(attribute)} to ${optionLabel(value)}`, username);
      setSynced(true);
      setTimeout(() => setSynced(false), 1200);
      persistConfig(next);
      return next;
    });
  };

  const branchProject = async () => {
    const ownerUsername = username?.trim() || "Guest";
    const baseName =
      projectMeta.title && projectMeta.title !== fallbackTitle
        ? `${projectMeta.title} Branch`
        : `${fallbackTitle} Branch`;

    try {
      setStatus("Creating branch...");

      // Try to find next branch number by checking existing projects for this user with same baseName prefix
      const listRes = await fetch(`/api/projects?username=${encodeURIComponent(ownerUsername)}`);
      let branchName = baseName;
      if (listRes.ok) {
        const data = await listRes.json().catch(() => ({}));
        const existing: ApiProject[] = Array.isArray(data.projects) ? (data.projects as ApiProject[]) : [];
        const matching = existing
          .map((p) => p.name || p.title || p.id || "")
          .filter((name) => typeof name === "string" && name.startsWith(baseName));
        if (matching.length > 0) {
          const numbers = matching
            .map((name) => {
              const suffix = name.replace(baseName, "").trim();
              const num = parseInt(suffix, 10);
              return Number.isFinite(num) ? num : 1;
            })
            .filter((n) => Number.isFinite(n));
          const nextNum = Math.max(1, ...numbers) + 1;
          branchName = `${baseName} ${nextNum}`;
        }
      }

      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: branchName,
          baseModel: projectMeta.baseModel || defaultBaseModel,
          ownerUsername,
          description: projectMeta.description,
        }),
      });

      if (!res.ok) throw new Error("Branch creation failed");
      const body = await res.json();
      const newId = body.project?._id || body.project?.id;
      if (!newId) throw new Error("No project id returned");

      await fetch(`/api/projects/${encodeURIComponent(newId)}/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      setStatus(`Branched to ${branchName}`);
      router.refresh();
      if (typeof window !== "undefined") {
        // Ensure the page reflects the new branch state immediately
        window.location.reload();
      }
    } catch (error) {
      console.error("Branch failed", error);
      setStatus("Branch failed");
    }
  };

  const deleteProject = async () => {
    if (typeof window !== "undefined") {
      const confirmDelete = window.confirm("Delete this project? This cannot be undone.");
      if (!confirmDelete) return;
    }

    try {
      setStatus("Deleting project...");
      const res = await fetch(`/api/projects/${encodedProjectId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message = body?.error || "Delete failed";
        setStatus(message);
        if (typeof window !== "undefined") window.alert(message);
        return;
      }
      setStatus("Project deleted");
      router.push("/");
    } catch (error) {
      console.error("Delete failed", error);
      setStatus("Delete failed");
      if (typeof window !== "undefined") window.alert("Delete failed. Please try again.");
    }
  };

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const channel = new BroadcastChannel(`collabcar-${projectId}`);
    channelRef.current = channel;

    const onMessage = (event: MessageEvent<CollabMessage>) => {
      const message = event.data;
      handleIncoming(message);
    };

    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
  }, [handleIncoming, projectId, userId]);

  useEffect(() => {
    if (!userId) return;
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const socketPath = socketUrl ? "/socket.io" : "/api/socket";

    // Ensure local server-side Socket.IO is initialized when using in-app server
    if (!socketUrl) {
      fetch("/api/socket").catch(() => undefined);
    }

    const socket = io(socketUrl ?? undefined, {
      path: socketPath,
      transports: ["websocket"],
      query: { projectId, username, userId },
    });
    socketRef.current = socket;

    socket.on("collab-message", (message: CollabMessage) => {
      handleIncoming(message);
    });

    socket.on("connect", () => {
      socket.emit("collab-message", { kind: "focus", field: null, userId, username });
    });

    return () => {
      socket.off("collab-message");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [handleIncoming, projectId, userId, username]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    const fetchComments = async () => {
      if (!projectId || commentsLoaded) return;
      try {
        const res = await fetch(`/api/projects/${encodedProjectId}/comments`);
        if (res.ok) {
          const body = await res.json();
          if (body?.comments && typeof body.comments === "object") {
            const parsed = body.comments as Record<string, CommentItem[]>;
            setComments(parsed);
          }
        }
      } catch (error) {
        console.warn("Failed to load comments", error);
      } finally {
        setCommentsLoaded(true);
      }
    };
    fetchComments();
  }, [commentsLoaded, encodedProjectId, projectId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPeers((prev) => {
        const next: Record<string, CursorPeer> = {};
        Object.values(prev).forEach((peer) => {
          if (now - peer.lastSeen < 12000) {
            next[peer.id] = peer;
          }
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const effectiveUser = username;
    const fetchProjects = async () => {
      try {
        setStatus("Loading project config...");

        // Always try to pull the saved config first (even if viewer isn't the owner)
        if (!hasRemoteConfig.current) {
          try {
            const cfgRes = await fetch(`/api/projects/${encodedProjectId}/config`);
            if (cfgRes.ok) {
              const body = await cfgRes.json();
              if (body?.config) {
                setConfig(body.config);
                hasRemoteConfig.current = true;
              }
            }
          } catch (err) {
            console.warn("Config load fallback to default", err);
          }
        }

        // Now try to fetch project meta (owner or collaborator listing)
        const res = await fetch(`/api/projects?username=${encodeURIComponent(effectiveUser)}`);
        if (res.ok) {
          const data = await res.json();
          const items: ApiProject[] = Array.isArray(data.projects) ? (data.projects as ApiProject[]) : [];
          const match = items.find(
            (item) => item.id === projectId || item.title === projectId || item._id === projectId
          );
          if (match) {
            const meta: ProjectMeta = {
              title: match.title ?? match.name ?? fallbackTitle,
              description: match.description,
              baseModel: match.baseModel || defaultBaseModel,
            };
            setProjectMeta(meta);
            emit({ kind: "project-meta", userId, username, project: meta });
          } else if (!hasRemoteConfig.current) {
            // No meta and no saved config; seed local only
            const initial = createConfigFromVariant(defaultBaseModel);
            setConfig(initial);
            hasRemoteConfig.current = true;
          }
        } else if (!hasRemoteConfig.current) {
          const initial = createConfigFromVariant(defaultBaseModel);
          setConfig(initial);
          hasRemoteConfig.current = true;
        }

        // Fallback meta if none loaded
        setProjectMeta((prev) => ({
          title: prev.title || fallbackTitle,
          description: prev.description,
          baseModel: prev.baseModel || config.model || defaultBaseModel,
        }));

        setStatus(saveStatus ?? null);
      } catch (error) {
        console.error(error);
        setStatus("Project not found; using local sandbox");
        if (!hasRemoteConfig.current) {
          const initial = createConfigFromVariant(defaultBaseModel);
          setConfig(initial);
          hasRemoteConfig.current = true;
        }
      }
    };
    fetchProjects();
  }, [config.model, defaultBaseModel, emit, fallbackTitle, projectId, saveStatus, userId, username]);

  const peersList = Object.values(peers);

  const fieldCollab = (field: string) => fieldOwners[field] ?? [];
  const displayTitle =
    projectMeta.title && projectMeta.title !== fallbackTitle
      ? projectMeta.title
      : fallbackTitle.replace(/[-_]/g, " ");

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => markFocus(null)}
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-[0_28px_120px_-56px_rgba(15,23,42,0.9)] ring-1 ring-indigo-500/20"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute right-0 top-12 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
      </div>

      <nav className="relative z-10 mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <span aria-hidden="true">&lt;-</span>
          Back to projects
        </Link>
        <span className="text-xs text-slate-400">Collaborate live on this build</span>
      </nav>

      <header className="relative z-10 flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.32em] text-slate-400">Live workspace</p>
          <h1 className="text-2xl font-semibold text-white">{displayTitle}</h1>
          <p className="text-sm text-slate-300">
            Base model: {projectMeta.baseModel} - Project ID {projectId}
          </p>
          {projectMeta.description ? (
            <p className="mt-1 text-xs text-slate-400">{projectMeta.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-400/40">
              {synced ? "Synced" : "Live"}
            </span>
            {userId ? (
              <PresenceBadge
                peer={{
                  id: userId,
                  username: username || "Guest",
                  x: 0,
                  y: 0,
                  lastSeen: selfLastSeen,
                  color: createColor(userId),
                }}
              />
            ) : null}
            {peersList.map((peer) => (
              <PresenceBadge key={peer.id} peer={peer} />
            ))}
            <button
              type="button"
              onClick={branchProject}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Branch
            </button>
            <button
              type="button"
              onClick={deleteProject}
              className="rounded-full border border-rose-300/40 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-100 transition hover:border-rose-200/70 hover:bg-rose-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Delete
            </button>
          </div>
          <span
            className={clsx(
              "min-w-[140px] text-xs",
              statusMessage ? "text-amber-300" : "text-slate-600"
            )}
          >
            {statusMessage || " "}
          </span>
        </div>
      </header>

      <div className="relative z-10 mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Pricing</p>
                <p className="text-sm text-slate-200">
                  Base Rs {numberFmt.format(pricing.basePrice)} - {pricing.adjustments.length} adjustment{pricing.adjustments.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Instant total</p>
                <p className="text-3xl font-semibold text-emerald-300">
                  Rs {numberFmt.format(pricing.total)}
                </p>
              </div>
            </div>
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <span>Base price</span>
                <span>Rs {numberFmt.format(pricing.basePrice)}</span>
              </div>
              {pricing.adjustments.length === 0 ? (
                <p className="text-xs text-slate-400">No adjustments yet.</p>
              ) : (
                pricing.adjustments.map((item) => (
                  <div key={item.label} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-emerald-200">+Rs {numberFmt.format(item.delta)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 ring-1 ring-white/5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-300">Live preview</p>
              <h2 className="text-xl font-semibold text-white">
                {config.model} - {config.brand}
              </h2>
              <p className="text-sm text-slate-300">
                Tyres {config.selections.tyre_size ?? "N/A"} - Roof {config.selections.roof_type ?? "N/A"} - Cabin {config.selections.upholstery_material ?? "N/A"}
              </p>
            </div>

            <div className="mt-5 grid gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Safety & tech</p>
                <p className="text-sm text-slate-200">
                  ADAS {config.selections.ADAS_package ?? "N/A"} - Screen {config.selections.infotainment_screen_size ?? "N/A"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Summary</p>
                <p className="text-sm text-slate-200">{config.model} configured with selected options.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          {getOptionsForModel(config.model).map(({ attribute, options }) => (
            <div
              key={attribute}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10"
            >
              <FieldHeader
                title={attributeLabel(attribute)}
                description="Tap to compare price deltas"
                collaborators={fieldCollab(attribute)}
              />
              <div className="mt-3">
                <PillOptions
                  value={config.selections[attribute] ?? Object.keys(options)[0]}
                  onChange={(val) => updateConfig(attribute, val)}
                  onFocus={() => markFocus(attribute)}
                  options={Object.entries(options).map(([value, delta]) => ({
                    value: value as string,
                    label: value,
                    hint: Number(delta) === 0 ? "Included" : `+Rs ${numberFmt.format(Number(delta))}`,
                  }))}
                />
                <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>Inline notes</span>
                    <span className="text-slate-500">
                      {(comments[attribute]?.length ?? 0)} message
                      {(comments[attribute]?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
                    {(comments[attribute] ?? []).length === 0 ? (
                      <p className="text-[11px] text-slate-500">No notes yet. Start a thread for this part.</p>
                    ) : (
                      (comments[attribute] ?? []).map((item) => (
                        <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-2 py-1">
                          <div>
                            <p className="text-[11px] font-semibold text-white">{item.user}</p>
                            <p className="text-[11px] text-slate-200">{item.text}</p>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(item.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={commentDrafts[attribute] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({ ...prev, [attribute]: e.target.value }))
                      }
                      onFocus={() => markFocus(attribute)}
                      placeholder="Add a quick note..."
                      className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => addComment(attribute)}
                      className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="relative z-10 mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 ring-1 ring-white/10">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Activity</p>
          <p className="text-xs text-slate-400">Auto-shared across all viewers</p>
        </div>
        <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
          {activity.length === 0 ? (
            <p className="text-xs text-slate-400">Start editing to populate the activity log.</p>
          ) : (
            activity.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs"
              >
                <span className="text-slate-200">{item.message}</span>
                <span className="text-[11px] text-slate-400">
                  {item.user} - {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0">
        {peersList.map((peer) => (
          <div
            key={peer.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${peer.x}%`,
              top: `${peer.y}%`,
            }}
          >
            <div
              className="flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[11px] text-white shadow-lg ring-1 ring-white/10"
              style={{ borderColor: `${peer.color}55` }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: peer.color }}
              />
              <span>{peer.username}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}









