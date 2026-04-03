import { NextResponse } from 'next/server';
import { getStoryChapters } from '@/lib/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const storyId = searchParams.get('story_id');

    if (!storyId) {
      return NextResponse.json({ error: "Missing story_id" }, { status: 400 });
    }

    const chapters = await getStoryChapters(storyId);
    return NextResponse.json({ chapters });
  } catch (error) {
    console.error("Error fetching story:", error);
    return NextResponse.json({ error: "Failed to fetch story" }, { status: 500 });
  }
}
