"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CustomerUpdates from "./customer-updates";

type Session = {
  authenticated: boolean;
  username?: string;
  role?: "ADMIN" | "STAFF" | "CUSTOMER" | null;
};

export default function LandingNavigation({ contactPage = false }: { contactPage?: boolean }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Không kiểm tra được phiên đăng nhập (${response.status}).`);
        const result = await response.json() as Session;
        if (active) setSession(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Không kiểm tra được phiên đăng nhập.");
      });
    return () => { active = false; };
  }, []);

  async function logout() {
    setError("");
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
      if (!csrfResponse.ok) throw new Error(`Không lấy được mã bảo vệ phiên (${csrfResponse.status}).`);
      const csrf = await csrfResponse.json() as { headerName: string; token: string };
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { [csrf.headerName]: csrf.token },
      });
      if (!response.ok) throw new Error(`Đăng xuất thất bại (${response.status}).`);
      router.replace("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể đăng xuất.");
    }
  }

  return <>
    <header className="landing-header">
      <nav className="landing-nav" aria-label="Điều hướng chính">
        <Link className="landing-brand" href="/" aria-label="Nhà xe Hiếu Minh - Trang chủ">
          <span className="landing-brand-mark">P</span><span>NHÀ XE <strong>HIẾU MINH</strong></span>
        </Link>
        <div className="landing-nav-links">
          {contactPage ? <>
            <Link href="/">Trang chủ</Link>
            <Link href="/#gioi-thieu">Giới thiệu</Link>
            <Link href="/#dich-vu">Dịch vụ</Link>
          </> : <>
            <a href="#gioi-thieu">Giới thiệu</a>
            <a href="#dich-vu">Dịch vụ</a>
            <a href="#quy-trinh">Cách đặt chỗ</a>
            <a href="#bang-gia">Bảng giá</a>
            <a href="#lien-he">Liên hệ</a>
          </>}
        </div>
        <div className="landing-nav-actions">
          {session?.authenticated ? (
            <>
              <Link className="landing-login" href={session.role === "CUSTOMER" ? "/customer/dashboard" : "/admin"}>
                {session.role === "CUSTOMER" ? (session.username ?? "Tài khoản") : session.role === "ADMIN" ? "Quản lý" : "Điều hành"}
              </Link>
              <button className="landing-login landing-logout-button" type="button" onClick={() => void logout()}>Đăng xuất</button>
            </>
          ) : <Link className="landing-login" href="/login">Đăng nhập</Link>}
        </div>
      </nav>
      {error && <p className="landing-nav-error" role="alert">{error}</p>}
    </header>
    {!contactPage && session?.role === "CUSTOMER" && <CustomerUpdates />}
  </>;
}
