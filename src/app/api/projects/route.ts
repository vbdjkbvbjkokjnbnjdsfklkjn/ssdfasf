import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Project } from "@/models/Project";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json({ error: "username query param is required" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const projects = await Project.find({ ownerUsername: username }).lean();
    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[GET /api/projects]", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, baseModel, ownerUsername, description } = body;

    if (!name || !baseModel || !ownerUsername) {
      return NextResponse.json({ error: "name, baseModel, and ownerUsername are required" }, { status: 400 });
    }

    await connectToDatabase();

    const project = await Project.create({
      name,
      baseModel,
      ownerUsername,
      description,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/projects]", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
