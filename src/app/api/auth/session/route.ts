import { NextResponse } from "next/server";

const SPRING_BASE_URL = process.env.SPRING_BASE_URL ?? "http://localhost:8080";
const SPRING_TIMEOUT_MS = 5000;

function copySpringCookies(source: Response, destination: NextResponse) {
  const cookies = source.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) destination.headers.append("Set-Cookie", cookie);
}

export async function GET(request: Request) {
  try {
    const springHeaders = new Headers();
    const incomingCookie = request.headers.get("cookie");
    if (incomingCookie) springHeaders.set("Cookie", incomingCookie);

    const response = await fetch(`${SPRING_BASE_URL}/api/auth/session`, {
      method: "GET",
      headers: springHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(SPRING_TIMEOUT_MS),
    });

    let springBody: unknown;
    try {
      springBody = await response.json();
    } catch {
      const nextResponse = NextResponse.json({ authenticated: false, username: null, authorities: [], role: null, redirectTo: null, csrf: null, code: "SPRING_INVALID_RESPONSE", message: "Máy chủ Spring trả về phản hồi không hợp lệ" }, { status: 502 });
      copySpringCookies(response, nextResponse);
      return nextResponse;
    }

    const nextResponse = NextResponse.json(springBody as object, { status: response.status });
    copySpringCookies(response, nextResponse);
    return nextResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ authenticated: false, username: null, authorities: [], role: null, redirectTo: null, csrf: null, code: "SPRING_TIMEOUT", message: "Máy chủ Spring không phản hồi kịp thời" }, { status: 504 });
    }
    return NextResponse.json({ authenticated: false, username: null, authorities: [], role: null, redirectTo: null, csrf: null, code: "SPRING_UNAVAILABLE", message: "Không thể kết nối máy chủ Spring Boot" }, { status: 502 });
  }
}
