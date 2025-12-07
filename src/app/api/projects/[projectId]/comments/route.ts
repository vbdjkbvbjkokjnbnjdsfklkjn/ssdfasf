import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";

type RouteContext = { params: Promise<{ projectId: string }> };
const keyFor = (projectId: string) => `project:comments:${projectId}`;

export async function GET(_: NextRequest, context: RouteContext) {
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
  try {
    const { projectId } = await context.params;
    const cached = await redis.get(keyFor(projectId));
    const comments = cached ? JSON.parse(cached) : {};
    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[GET /api/projects/:id/comments]", error);
    return NextResponse.json({ error: "Failed to load comments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!redis) return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const comments = typeof body.comments === "object" && body.comments ? body.comments : {};
    await redis.set(keyFor(projectId), JSON.stringify(comments));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/projects/:id/comments]", error);
    return NextResponse.json({ error: "Failed to save comments" }, { status: 500 });
  }
}
