import { NextResponse } from "next/server";

const SPRING_BASE_URL = process.env.SPRING_BASE_URL ?? "http://localhost:8080";
const SPRING_TIMEOUT_MS = 5000;

function copySpringCookies(source: Response, destination: NextResponse) {
  const cookies = source.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) destination.headers.append("Set-Cookie", cookie);
}

export async function POST(request: Request) {
  try {
    const springHeaders = new Headers();
    const incomingCookie = request.headers.get("cookie");
    if (incomingCookie) springHeaders.set("Cookie", incomingCookie);

    for (const headerName of ["X-CSRF-TOKEN", "_csrf", "Content-Type"]) {
      const value = request.headers.get(headerName);
      if (value) springHeaders.set(headerName, value);
    }

    const response = await fetch(`${SPRING_BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: springHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(SPRING_TIMEOUT_MS),
    });

    let springBody: unknown;
    try {
      springBody = await response.json();
    } catch {
      const nextResponse = NextResponse.json({ code: "SPRING_INVALID_RESPONSE", message: "Máy chủ Spring trả về phản hồi không hợp lệ" }, { status: 502 });
      copySpringCookies(response, nextResponse);
      return nextResponse;
    }

    if (response.status === 403) {
      const nextResponse = NextResponse.json({ authenticated: true, code: "CSRF_REJECTED", message: "Phiên CSRF không hợp lệ hoặc đã hết hạn", csrf: null }, { status: 403 });
      copySpringCookies(response, nextResponse);
      return nextResponse;
    }

    const nextResponse = NextResponse.json(springBody as object, { status: response.status });
    copySpringCookies(response, nextResponse);
    return nextResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({ code: "SPRING_TIMEOUT", message: "Máy chủ Spring không phản hồi kịp thời" }, { status: 504 });
    }
    return NextResponse.json({ code: "SPRING_UNAVAILABLE", message: "Không thể kết nối máy chủ Spring Boot" }, { status: 502 });
  }
}
