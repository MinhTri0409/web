import { NextResponse } from "next/server";

import { isCanonicalSpringRedirect, parseLoginRequest } from "../auth-contract";

const SPRING_BASE_URL = process.env.SPRING_BASE_URL ?? "http://localhost:8080";
const SPRING_TIMEOUT_MS = 5000;

function copySpringCookies(source: Response, destination: NextResponse) {
  const cookies = source.headers.getSetCookie?.() ?? [];
  for (const cookie of cookies) destination.headers.append("Set-Cookie", cookie);
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({
      authenticated: false,
      username: null,
      authorities: [],
      role: null,
      redirectTo: null,
      code: "INVALID_LOGIN_REQUEST",
      message: "Tên đăng nhập và mật khẩu là bắt buộc",
      csrf: null,
    }, { status: 400 });
  }

  const body = parseLoginRequest(input);
  if (!body) {
    return NextResponse.json({
      authenticated: false,
      username: null,
      authorities: [],
      role: null,
      redirectTo: null,
      code: "INVALID_LOGIN_REQUEST",
      message: "Tên đăng nhập và mật khẩu là bắt buộc",
      csrf: null,
    }, { status: 400 });
  }

  try {
    const springHeaders = new Headers({ "Content-Type": "application/json" });
    const incomingCookie = request.headers.get("cookie");
    if (incomingCookie) springHeaders.set("Cookie", incomingCookie);

    const response = await fetch(`${SPRING_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: springHeaders,
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(SPRING_TIMEOUT_MS),
    });

    let springBody: unknown;
    try {
      springBody = await response.json();
    } catch {
      const nextResponse = NextResponse.json({
        authenticated: false,
        username: null,
        authorities: [],
        role: null,
        redirectTo: null,
        code: "SPRING_INVALID_RESPONSE",
        message: "Máy chủ Spring trả về phản hồi không hợp lệ",
        csrf: null,
      }, { status: 502 });
      copySpringCookies(response, nextResponse);
      return nextResponse;
    }

    if (response.ok) {
      if (typeof springBody !== "object" || springBody === null || Array.isArray(springBody)) {
        const nextResponse = NextResponse.json({ authenticated: false, authorities: [], role: null, redirectTo: null, code: "SPRING_INVALID_RESPONSE", message: "Máy chủ Spring trả về phản hồi không hợp lệ", csrf: null }, { status: 502 });
        copySpringCookies(response, nextResponse);
        return nextResponse;
      }

      const contract = springBody as Record<string, unknown>;
      if (contract.authenticated !== true
        || typeof contract.username !== "string"
        || !Array.isArray(contract.authorities)
        || !contract.authorities.every((authority) => typeof authority === "string")
        || !isCanonicalSpringRedirect(contract.redirectTo)) {
        const nextResponse = NextResponse.json({ authenticated: false, authorities: [], role: null, redirectTo: null, code: "SPRING_INVALID_RESPONSE", message: "Máy chủ Spring trả về phản hồi không hợp lệ", csrf: null }, { status: 502 });
        copySpringCookies(response, nextResponse);
        return nextResponse;
      }
    }

    const nextResponse = NextResponse.json(springBody as object, { status: response.status });
    copySpringCookies(response, nextResponse);
    return nextResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json({
        authenticated: false,
        username: null,
        authorities: [],
        role: null,
        redirectTo: null,
        code: "SPRING_TIMEOUT",
        message: "Máy chủ Spring không phản hồi kịp thời",
        csrf: null,
      }, { status: 504 });
    }

    return NextResponse.json({
      authenticated: false,
      username: null,
      authorities: [],
      role: null,
      redirectTo: null,
      code: "SPRING_UNAVAILABLE",
      message: "Không thể kết nối máy chủ Spring Boot",
      csrf: null,
    }, { status: 502 });
  }
}
