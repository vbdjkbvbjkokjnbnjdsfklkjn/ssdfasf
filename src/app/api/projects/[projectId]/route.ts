import mongoose from "mongoose";
import { NextResponse, type NextRequest } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { redis } from "@/lib/redis";
import { Project } from "@/models/Project";

type RouteContext = { params: Promise<{ projectId: string }> };

const configKeyFor = (projectId: string) => `project:config:${projectId}`;

export async function GET(_: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(projectId);

  try {
    await connectToDatabase();
    const project = await Project.findOne(isObjectId ? { _id: projectId } : { name: projectId }).lean();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    console.error("[GET /api/projects/:id]", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: RouteContext) {
  const { projectId } = await context.params;
  const isObjectId = mongoose.Types.ObjectId.isValid(projectId);

  try {
    await connectToDatabase();
    const deleted = await Project.findOneAndDelete(isObjectId ? { _id: projectId } : { name: projectId });

    if (!deleted) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (redis) {
      try {
        await redis.del(
          configKeyFor(projectId),
          configKeyFor(deleted._id?.toString() || projectId)
        );
      } catch (error) {
        console.warn("[DELETE /api/projects/:id] Failed to clear cached config", error);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/projects/:id]", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
