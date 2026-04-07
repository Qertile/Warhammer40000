import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const prompt = searchParams.get('prompt');
  const seed = searchParams.get('seed') || String(Math.floor(Math.random() * 1000000));

  if (!prompt) {
    return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
  }

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1200&height=600&nologo=true&seed=${seed}`;

  try {
    // Fetch the image server-side (no browser cookies, treated as anonymous)
    const imageResponse = await fetch(pollinationsUrl, {
      headers: {
        // Do NOT forward any authorization or cookie headers
        'User-Agent': 'Mozilla/5.0 (compatible; NextJS-Server)',
      },
      // Allow up to 60 seconds for AI image generation
      signal: AbortSignal.timeout(60000),
    });

    if (!imageResponse.ok) {
      return NextResponse.json({ error: 'Image generation failed', status: imageResponse.status }, { status: 502 });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (err: any) {
    console.error('Image proxy error:', err);
    return NextResponse.json({ error: 'Proxy failed', message: err.message }, { status: 500 });
  }
}
