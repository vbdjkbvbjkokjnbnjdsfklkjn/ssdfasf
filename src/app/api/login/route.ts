import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";

type LoginBody = {
  username?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const username = body.username?.trim();

    if (!username) {
      return NextResponse.json({ error: "username is required" }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findOneAndUpdate(
      { username },
      { username },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/login]", error);
    return NextResponse.json({ error: "Failed to login" }, { status: 500 });
  }
}
