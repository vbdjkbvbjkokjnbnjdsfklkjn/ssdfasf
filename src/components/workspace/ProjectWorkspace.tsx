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
  findSimilarCars,
  createConfigFromVariant,
  getOptionsForModel,
  listBaseModels,
  type SimilarCarMatch,
} from "@/data/configurator";
import type { Project } from "@/data/projects";
import { calculateEmi, DEFAULT_EMI_RATE } from "@/lib/emi";

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

function isCollabMessage(payload: unknown): payload is CollabMessage {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "kind" in payload &&
    "userId" in payload
  );
}

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

const randomId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;

const COLOR_PALETTE = [
  "#7C3AED",
  "#2563EB",
  "#0EA5E9",
  "#059669",
  "#F59E0B",
  "#EC4899",
  "#14B8A6",
  "#E11D48",
  "#8B5CF6",
  "#6366F1",
  "#10B981",
  "#F97316",
  "#EF4444",
  "#06B6D4",
  "#84CC16",
  "#A855F7",
  "#F59E0B",
  "#22D3EE",
  "#4ADE80",
  "#FB7185",
];

function optionLabel(value: string | number) {
  if (typeof value === "number") return `${value}"`;
  return value;
}

function attributeLabel(attribute: string) {
  return attribute
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function variantKey(variant: SimilarCarMatch["variant"]) {
  const selectionKey = Object.entries(variant.selections ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attribute, value]) => `${attribute}:${value ?? ""}`)
    .join("|");

  return `${variant.brand}-${variant.model}-${variant.variantName}-${selectionKey}`;
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
  const commentScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastCursorSent = useRef<number>(0);
  const hasRemoteConfig = useRef(false);
  const encodedProjectId = useMemo(() => encodeURIComponent(projectId), [projectId]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"full" | "emi">("full");
  const [emiMonths, setEmiMonths] = useState(24);
  const [similarityThreshold, setSimilarityThreshold] = useState(60);
  const [similarDialogOpen, setSimilarDialogOpen] = useState(false);
  const [detailVariantKey, setDetailVariantKey] = useState<string | null>(null);
  const [scheduledVariant, setScheduledVariant] = useState<SimilarCarMatch | null>(null);
  const [dealerDialogOpen, setDealerDialogOpen] = useState(false);
  const colorRegistryRef = useRef<Record<string, string>>({});
  const recentMessagesRef = useRef<{ key: string; seen: number }[]>([]);
  const emiRate = DEFAULT_EMI_RATE;

  const getColorForId = useCallback(
    (id: string) => {
      if (colorRegistryRef.current[id]) return colorRegistryRef.current[id];
      const used = new Set(Object.values(colorRegistryRef.current));
      const nextColor = COLOR_PALETTE.find((c) => !used.has(c));
      const fallbackHue = (Object.keys(colorRegistryRef.current).length * 137) % 360;
      const color = nextColor ?? `hsl(${fallbackHue} 70% 55%)`;
      colorRegistryRef.current[id] = color;
      return color;
    },
    []
  );

  const pricing = useMemo(() => calculatePricing(config), [config]);
  const numberFmt = useMemo(
    () =>
      typeof Intl !== "undefined"
        ? new Intl.NumberFormat("en-IN")
        : { format: (value: number) => value.toString() },
    []
  );
const emi = useMemo(
  () =>
      calculateEmi({
        principal: pricing.total,
        months: emiMonths,
        annualRate: emiRate,
      }),
    [emiMonths, emiRate, pricing.total]
  );
  const similarBuilds = useMemo(
    () => findSimilarCars(config, similarityThreshold).slice(0, 5),
    [config, similarityThreshold]
  );
  const [selfLastSeen] = useState(() => Date.now());
  const statusMessage = status || saveStatus;
  const emiMonthly = Math.round(emi.monthlyPayment);
  const emiInterest = Math.round(Math.max(0, emi.totalInterest));
  const emiTotalPayable = Math.round(emi.totalPayable);

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
      const now = Date.now();
      const latest = items[0];
      if (latest && latest.message === message && latest.user === user && now - latest.timestamp < 1200) {
        return items;
      }
      const next: ActivityItem[] = [
        {
          id: randomId(),
          message,
          user,
          timestamp: now,
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
      const nextThread = [...existing.filter((item) => item.id !== incoming.id), incoming]
        .sort((a, b) => a.timestamp - b.timestamp)
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
        color: prev[incoming.id]?.color ?? getColorForId(incoming.id),
      },
    }));
  }, [getColorForId]);

  useEffect(() => {
    Object.values(commentScrollRefs.current).forEach((node) => {
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    });
  }, [comments]);

  const handleIncoming = useCallback(
    (raw: unknown) => {
      if (!isCollabMessage(raw)) return;
      if (raw.userId === userId) return;

      const typed = raw;

      const messageKey = (() => {
        if (typed.kind === "cursor") return `cursor-${typed.userId}-${Math.round(typed.x)}-${Math.round(typed.y)}`;
        if (typed.kind === "focus") return `focus-${typed.userId}-${typed.field ?? "null"}`;
        if (typed.kind === "config") return `config-${typed.userId}-${JSON.stringify(typed.config.selections ?? {})}`;
        if (typed.kind === "comment") return `comment-${typed.userId}-${typed.comment.id}`;
        if (typed.kind === "project-meta") return `meta-${typed.userId}-${Object.keys(typed.project).join("-")}`;
        return `${typed.kind}-${typed.userId}`;
      })();

      const now = Date.now();
      const recent = recentMessagesRef.current;
      const already = recent.find((item) => item.key === messageKey && now - item.seen < 1500);
      if (already) return;
      recentMessagesRef.current = [{ key: messageKey, seen: now }, ...recent].slice(0, 32);

      if (typed.kind === "cursor") {
        upsertPeer({
          id: typed.userId,
          username: typed.username,
          x: typed.x,
          y: typed.y,
          lastSeen: Date.now(),
          focus: peersRef.current[typed.userId]?.focus,
        });
      }

      if (typed.kind === "config") {
        hasRemoteConfig.current = true;
        setConfig(typed.config);
        pushActivity(`${typed.username} adjusted the build`, typed.username);
        setSynced(true);
        setTimeout(() => setSynced(false), 1200);
      }

      if (typed.kind === "focus") {
        upsertPeer({
          id: typed.userId,
          username: typed.username,
          x: peersRef.current[typed.userId]?.x ?? 0,
          y: peersRef.current[typed.userId]?.y ?? 0,
          lastSeen: Date.now(),
          focus: typed.field,
        });
      }

      if (typed.kind === "comment") {
        upsertComment(typed.comment);
      }

      if (typed.kind === "project-meta") {
        setProjectMeta((prev) => ({
          title: typed.project.title ?? prev.title,
          description: typed.project.description ?? prev.description,
          baseModel: typed.project.baseModel ?? prev.baseModel,
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

  const clampMonths = (value: number) => Math.min(84, Math.max(6, Math.floor(value) || 6));
  const handleEmiMonthsChange = (value: string | number) => {
    const parsed = typeof value === "string" ? parseInt(value, 10) : value;
    if (Number.isNaN(parsed)) return;
    setEmiMonths(clampMonths(parsed));
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
            ? { ...comments, [latest.attribute]: [...(comments[latest.attribute] ?? []), latest] }
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
              const sorted: Record<string, CommentItem[]> = {};
              Object.entries(parsed).forEach(([attr, list]) => {
                sorted[attr] = (list ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
              });
              setComments(sorted);
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
                  color: getColorForId(userId),
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
          <button
            type="button"
            onClick={() => setDealerDialogOpen(true)}
            className="shrink-0 rounded-full border border-indigo-300/40 bg-indigo-500/15 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:border-indigo-200/70 hover:bg-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 min-w-[170px]"
          >
            Connect to dealer
          </button>
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
                <p className="text-[11px] text-slate-400">
                  {paymentMode === "emi" ? "EMI selected - see details below" : "One-time payment"}
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

          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/40 p-4 shadow-sm ring-1 ring-white/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/80">Payment preference</p>
                <p className="text-sm font-semibold text-white">Choose full payment or plan an EMI</p>
              </div>
              <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-indigo-100 shadow-sm">
                Fixed APR - Instant preview
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMode("full")}
                className={clsx(
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  paymentMode === "full"
                    ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                )}
              >
                Pay in full
              </button>
              <button
                type="button"
                onClick={() => setPaymentMode("emi")}
                className={clsx(
                  "rounded-xl border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  paymentMode === "emi"
                    ? "border-indigo-300/70 bg-indigo-500/15 text-indigo-100"
                    : "border-white/10 bg-white/5 text-slate-200 hover:border-white/20 hover:bg-white/10"
                )}
              >
                Plan EMI
              </button>
            </div>

            {paymentMode === "emi" ? (
              <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 ring-1 ring-white/10">
                <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950/70 p-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span>Adjust tenure</span>
                    <span>6 to 84 months</span>
                  </div>
                  <input
                    type="range"
                    min={6}
                    max={84}
                    step={1}
                    value={emiMonths}
                    onChange={(event) => handleEmiMonthsChange(event.target.value)}
                    className="w-full accent-indigo-400"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-300">
                      Months
                      <input
                        type="number"
                        min={6}
                        max={84}
                        value={emiMonths}
                        onChange={(event) => handleEmiMonthsChange(event.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white appearance-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none focus:border-indigo-300/70 focus:outline-none focus:ring-2 focus:ring-indigo-300/40"
                      />
                    </label>
                    <div className="flex flex-col gap-1 text-xs text-slate-300">
                      Interest (APR %)
                      <div className="rounded-lg border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-indigo-100/80 backdrop-blur-sm">
                        {emiRate}% (fixed)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-indigo-200/25 bg-slate-950/80 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-indigo-200/80">EMI summary</p>
                    <p className="text-xl font-semibold text-white">Rs {numberFmt.format(emiMonthly)} / month</p>
                    <p className="text-xs text-slate-300">
                      Based on Rs {numberFmt.format(pricing.total)} for {emiMonths} month{emiMonths === 1 ? "" : "s"}.
                    </p>
                    <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] text-indigo-100 ring-1 ring-white/10">
                      APR {emiRate}% (fixed)
                    </span>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3 text-sm text-slate-200">
                    <div className="flex items-center justify-between">
                      <span>Tenure</span>
                      <span>{emiMonths} months</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                      <span>Total payable</span>
                      <span className="text-white">Rs {numberFmt.format(emiTotalPayable)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>Total interest</span>
                      <span className="text-indigo-100">Rs {numberFmt.format(emiInterest)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Paying in full keeps the total at Rs {numberFmt.format(pricing.total)} with no interest.</p>
            )}
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSimilarDialogOpen(true)}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Show similar builds
            </button>
            <button
              type="button"
              onClick={() => router.push("/car-success")}
              className="w-full rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Checkout
            </button>
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
                  <div
                    className="max-h-32 space-y-1 overflow-y-auto pr-1"
                    ref={(node) => {
                      commentScrollRefs.current[attribute] = node;
                    }}
                  >
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
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addComment(attribute);
                        }
                      }}
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

      {similarDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="absolute inset-0" onClick={() => setSimilarDialogOpen(false)} />
          <div className="relative z-10 w-[min(960px,95vw)] max-h-[82vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl ring-1 ring-indigo-400/30">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-indigo-200/80">Similar builds</p>
                <p className="text-sm text-slate-200">
                  Showing variants at {similarityThreshold}%+ similarity for {config.model}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                  <span>{similarityThreshold}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={similarityThreshold}
                    onChange={(event) => setSimilarityThreshold(Number(event.target.value) || 0)}
                    className="w-28 accent-indigo-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSimilarDialogOpen(false)}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {similarBuilds.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No variants cross this threshold yet. Lower the slider to explore nearby builds.
                </p>
              ) : (
                similarBuilds.map((match) => {
                  const key = variantKey(match.variant);
                  const variantPricing = calculatePricing(match.configuration);
                  const differences = Object.entries(match.configuration.selections)
                    .filter(
                      ([attribute, value]) => (config.selections[attribute] ?? "") !== value
                    )
                    .slice(0, 3);

                  return (
                    <div
                      key={key}
                      className="space-y-2 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold text-white">{match.variant.variantName}</p>
                          <p className="text-[11px] text-slate-400">
                            {match.variant.brand} - {match.variant.model}
                          </p>
                          <p className="text-[11px] text-slate-300">
                            {differences.length === 0
                              ? "Matches your current selections."
                              : `Differs on ${differences
                                  .map(
                                    ([attribute, value]) =>
                                      `${attributeLabel(attribute)}: ${optionLabel(value)}`
                                  )
                                  .join(" | ")}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="min-w-[74px] rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-500/40">
                            {match.similarity}% match
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setDetailVariantKey((current) => (current === key ? null : key))
                            }
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            {detailVariantKey === key ? "Hide details" : "Details"}
                          </button>
                        </div>
                      </div>

                      {detailVariantKey === key ? (
                        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs text-slate-200">
                          <div className="grid gap-3 rounded-lg border border-white/5 bg-white/5 p-3 sm:grid-cols-[150px_1fr]">
                            <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900/60">
                              <img
                                src="/car-visual.jpg"
                                alt={`${match.variant.model} preview`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="space-y-2 text-sm">
                              <p className="font-semibold text-white">{match.variant.variantName}</p>
                              <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                                <span>Brand: {match.variant.brand}</span>
                                <span>Model: {match.variant.model}</span>
                                <span>Base: Rs {numberFmt.format(match.configuration.basePrice)}</span>
                                <span>Total: Rs {numberFmt.format(variantPricing.total)}</span>
                                <span>Match: {match.similarity}%</span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {differences.length === 0
                                  ? "This variant matches all your current selections."
                                  : `Differs on ${differences
                                      .map(
                                        ([attribute, value]) =>
                                          `${attributeLabel(attribute)}: ${optionLabel(value)}`
                                      )
                                      .join(" | ")}`}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1 rounded-lg border border-white/5 bg-white/5 p-2">
                            <p className="text-[11px] font-semibold text-indigo-100">Variant selections</p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {Object.entries(match.configuration.selections).map(
                                ([attribute, value]) => (
                                  <div
                                    key={`${key}-${attribute}`}
                                    className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-950/40 px-2 py-1"
                                  >
                                    <span className="text-[11px] text-slate-300">
                                      {attributeLabel(attribute)}
                                    </span>
                                    <span className="text-[11px] font-semibold text-white">
                                      {optionLabel(value)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setScheduledVariant(match)}
                            className="w-full rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                          >
                            Schedule a drive
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {scheduledVariant ? (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="absolute inset-0" onClick={() => setScheduledVariant(null)} />
          <div className="relative z-10 w-[min(420px,90vw)] rounded-2xl border border-emerald-300/40 bg-slate-950 p-5 text-center shadow-2xl ring-1 ring-emerald-300/30">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/40">
              OK
            </div>
            <p className="text-sm font-semibold text-white">Test drive scheduled!</p>
            <p className="mt-1 text-xs text-slate-300">
              {scheduledVariant.variant.variantName} - {scheduledVariant.variant.brand}{" "}
              {scheduledVariant.variant.model}
            </p>
          <button
            type="button"
            onClick={() => setScheduledVariant(null)}
            className="mt-4 w-full rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            Done
          </button>
          </div>
        </div>
      ) : null}

      {dealerDialogOpen ? (
        <div className="fixed inset-0 z-75 flex items-center justify-center bg-slate-950/70 backdrop-blur">
          <div className="absolute inset-0" onClick={() => setDealerDialogOpen(false)} />
          <div className="relative z-10 w-[min(460px,92vw)] overflow-hidden rounded-2xl border border-indigo-300/40 bg-slate-950 p-5 text-center shadow-2xl ring-1 ring-indigo-400/30">
            <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-indigo-500/10 blur-3xl" />
            <div className="absolute -right-10 -bottom-14 h-32 w-32 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-2xl text-indigo-100 ring-1 ring-white/10">
              🤝
            </div>
            <p className="text-lg font-semibold text-white">Connecting you to a dealer</p>
            <p className="mt-1 text-sm text-slate-300">
              A dealer representative will join shortly to assist with pricing, availability, and test drives.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>Live handoff in progress...</span>
            </div>
            <button
              type="button"
              onClick={() => setDealerDialogOpen(false)}
            className="mt-5 w-full rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_38px_-22px_rgba(59,130,246,0.8)] transition hover:-translate-y-px hover:shadow-[0_18px_48px_-24px_rgba(59,130,246,0.85)] active:translate-y-px active:shadow-[0_10px_26px_-18px_rgba(59,130,246,0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Okay
            </button>
          </div>
        </div>
      ) : null}

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
            <div className="flex items-center gap-1 text-[11px] text-white">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                className="-ml-1"
                style={{ fill: peer.color }}
              >
                <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z" />
              </svg>
              <span
                className="rounded-md px-2 py-1 text-[11px] font-semibold"
                style={{ backgroundColor: `${peer.color}22`, color: "#e2e8f0" }}
              >
                {peer.username}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}









