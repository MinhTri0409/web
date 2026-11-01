import { NextResponse } from "next/server";

const SPRING_BASE_URL = process.env.SPRING_BASE_URL ?? "http://localhost:8080";
const SPRING_TIMEOUT_MS = 15_000;

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const legacy = segments[0] === "legacy";
  const path = legacy ? segments.slice(1) : segments;
  const incomingUrl = new URL(request.url);
  const upstreamPath = path.map(encodeURIComponent).join("/");
  const targetUrl = new URL(`${legacy ? "/" : "/api/"}${upstreamPath}${incomingUrl.search}`, SPRING_BASE_URL);
  const headers = new Headers();

  for (const name of ["accept", "content-type", "cookie", "x-csrf-token", "_csrf"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    cache: "no-store",
    redirect: "manual",
    signal: request.headers.get("accept")?.includes("text/event-stream")
      ? undefined
      : AbortSignal.timeout(SPRING_TIMEOUT_MS),
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, init);
    const responseHeaders = new Headers();
    for (const name of ["cache-control", "content-disposition", "content-type", "location"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie?.() ?? []) {
      responseHeaders.append("set-cookie", cookie);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    return NextResponse.json(
      {
        code: timedOut ? "SPRING_TIMEOUT" : "SPRING_UNAVAILABLE",
        message: timedOut
          ? "Máy chủ Spring không phản hồi kịp thời"
          : "Không thể kết nối máy chủ Spring Boot",
      },
      { status: timedOut ? 504 : 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
