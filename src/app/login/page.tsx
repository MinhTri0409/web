"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import "../login.css";

function isSafeBackendRedirect(value: unknown): value is "/admin" | "/dashboard" {
  return value === "/admin" || value === "/dashboard";
}

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        const query = new URLSearchParams(window.location.search);
        if (!cancelled && query.get("registered") === "true") setNotice("Tạo tài khoản thành công. Đăng nhập để bắt đầu đặt chỗ.");
        else if (!cancelled && query.has("logout")) setNotice("Bạn đã đăng xuất thành công.");
        if (!cancelled && data.authenticated === true && isSafeBackendRedirect(data.redirectTo)) {
          window.location.replace(data.redirectTo);
        }
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: String(form.get("username") || ""),
          password: String(form.get("password") || ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Đăng nhập thất bại");
        setLoading(false);
        return;
      }
      if (!isSafeBackendRedirect(data.redirectTo)) {
        setError(data.message || "Máy chủ không trả về tuyến đường hợp lệ");
        setLoading(false);
        return;
      }
      window.location.replace(data.redirectTo);
    } catch {
      setError("Không thể kết nối máy chủ đăng nhập");
      setLoading(false);
    }
  }

  return <main className="login-screen">
    <section className="login-showcase" aria-label="Nhà xe Hiếu Minh - quản lý bãi xe">
      <div className="showcase-top">
        <Link className="login-brand" href="/" aria-label="Nhà xe Hiếu Minh - Trang chủ"><span className="login-brand-mark">P</span><span>QUẢN LÝ NHÀ XE HIẾU MINH</span></Link>
        <span className="showcase-caption">NHÀ XE HIỆN ĐẠI VÀ THÔNG MINH</span>
      </div>
      <div className="showcase-copy">
        <span className="showcase-kicker"><i /> VẬN HÀNH BÃI XE</span>
        <h1>Mọi thứ về<br />bãi xe, trong<br /><span>tầm kiểm soát.</span></h1>
        <p>Theo dõi xe ra vào, quản lý vé tháng và nắm bắt hoạt động bãi xe trong một nơi.</p>
      </div>
      <svg className="garage-illustration" viewBox="0 0 800 350" role="img" aria-label="Minh họa xe trong bãi đỗ">
        <defs>
          <linearGradient id="garage-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#243b59" /><stop offset="1" stopColor="#14253b" /></linearGradient>
          <linearGradient id="garage-floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#35485c" /><stop offset="1" stopColor="#17283c" /></linearGradient>
          <linearGradient id="car-paint" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f8fbff" /><stop offset=".55" stopColor="#c9d8e8" /><stop offset="1" stopColor="#8097b0" /></linearGradient>
        </defs>
        <path d="M0 0h800v220H0z" fill="url(#garage-wall)" /><path d="M0 220h800v130H0z" fill="url(#garage-floor)" />
        <path d="M0 219h800M80 0v220M720 0v220" stroke="#72869a" strokeOpacity=".4" strokeWidth="5" />
        <path d="M164 39h132M500 39h132M148 274h505" stroke="#d6e6f0" strokeOpacity=".5" strokeWidth="4" strokeDasharray="22 18" />
        <path d="M110 178v-47h82v47M608 178v-47h82v47" fill="#17283c" stroke="#61778c" strokeWidth="2" />
        <path d="M225 250l24-52c8-17 25-28 44-30l76-7c20-2 38 5 53 18l57 49 46 10c16 4 28 18 28 35v17H211v-18c0-10 5-19 14-22z" fill="url(#car-paint)" stroke="#e7eef5" strokeWidth="2" />
        <path d="M302 178l-22 3c-12 1-22 9-27 20l-18 39h122v-63zM319 177l52-5c16-1 31 4 43 15l43 37H319z" fill="#42617c" stroke="#b8c9d8" strokeWidth="2" />
        <circle cx="295" cy="278" r="31" fill="#101923" /><circle cx="295" cy="278" r="18" fill="#a9b8c8" /><circle cx="475" cy="278" r="31" fill="#101923" /><circle cx="475" cy="278" r="18" fill="#a9b8c8" />
      </svg>
      <div className="showcase-foot"><span>✓ Hệ thống quản lý nhà xe HIẾU MINH</span><span>NHÀ XE HIẾU MINH</span></div>
    </section>
    <section className="login-main">
      <div className="login-card">
        <div className="login-heading"><span className="login-eyebrow">NHÀ XE HIẾU MINH</span><h2>Đăng nhập tài khoản</h2><p>Đăng nhập để quản lý bãi xe hoặc đặt chỗ trực tuyến.</p></div>
        {notice && <div className="login-alert alert-success" role="status">✓ {notice}</div>}
        {error && <div className="login-alert alert-danger" role="alert">! {error}</div>}
        <form className="login-form" onSubmit={submit}>
          <label className="field-block"><span className="form-label">Tên đăng nhập</span><span className="input-wrap"><i aria-hidden="true">♙</i><input className="form-control" name="username" placeholder="Nhập tên đăng nhập" autoComplete="username" required /></span></label>
          <label className="field-block"><span className="form-label">Mật khẩu</span><span className="input-wrap"><i aria-hidden="true">▣</i><input className="form-control" name="password" type="password" placeholder="Nhập mật khẩu" autoComplete="current-password" required /></span></label>
          <button className="btn-modern" disabled={loading}><span>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</span><b aria-hidden="true">→</b></button>
        </form>
        <p className="login-footnote">Chưa có tài khoản khách? <Link href="/register">Đăng ký đặt chỗ</Link></p>
      </div>
    </section>
  </main>;
}
