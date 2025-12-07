import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  CarConfiguration,
  createConfigFromVariant,
  getBaseModel,
} from "@/data/configurator";

type RouteContext = { params: Promise<{ projectId: string }> };

const keyFor = (projectId: string) => `project:config:${projectId}`;

function sanitizeConfig(payload: unknown): CarConfiguration {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid payload");
  }
  const maybe = payload as { model?: unknown; selections?: unknown };
  if (typeof maybe.model !== "string" || !maybe.selections || typeof maybe.selections !== "object") {
    throw new Error("Missing model or selections");
  }

  const base = getBaseModel(maybe.model);
  return {
    model: base.name,
    brand: base.brand,
    basePrice: base.basePrice,
    selections: maybe.selections as Record<string, string>,
  };
}

export async function GET(_: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
  }
  try {
    const cached = await redis.get(keyFor(projectId));
    if (!cached) {
      return NextResponse.json(
        { config: createConfigFromVariant(getBaseModel().name) },
        { status: 200 }
      );
    }
    return NextResponse.json({ config: JSON.parse(cached) });
  } catch (error) {
    console.error("[GET /api/projects/:id/config]", error);
    return NextResponse.json({ error: "Failed to load config" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const config = sanitizeConfig(body.config ?? body);
    await redis.set(keyFor(projectId), JSON.stringify(config));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUT /api/projects/:id/config]", error);
    const message = error instanceof Error ? error.message : "Failed to save config";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
