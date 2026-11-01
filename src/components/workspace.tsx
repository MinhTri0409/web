"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import LandingNavigation from "./landing-navigation";
import CustomerUpdates from "./customer-updates";
import { groupParkingSlots, parkingLocation } from "../lib/parking-layout";
import { normalizeVietnamesePlate } from "../lib/license-plate";

type Session = {
  authenticated: boolean;
  username?: string;
  role?: string | null;
  redirectTo?: string | null;
};

type Csrf = { headerName: string; token: string };
type DataRow = Record<string, unknown>;

const ADMIN_LINKS = [
  ["/admin", "Tổng quan"],
  ["/admin/parking", "Bãi xe"],
  ["/admin/parking/history", "Lịch sử"],
  ["/admin/tickets", "Vé tháng"],
  ["/admin/reservations", "Đặt chỗ online"],
  ["/admin/users", "Tài khoản"],
  ["/admin/pricing", "Bảng giá"],
  ["/admin/reports", "Báo cáo"],
  ["/admin/support/inbox", "Hỗ trợ"],
];

const CUSTOMER_LINKS = [
  ["/customer/dashboard", "Tổng quan"],
  ["/reservations", "Đặt chỗ"],
  ["/customer/account", "Tài khoản"],
];

const STAFF_LINKS = ADMIN_LINKS.filter(([href]) => [
  "/admin",
  "/admin/parking",
  "/admin/parking/history",
  "/admin/tickets",
  "/admin/reservations",
].includes(href));

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function vehicleLabels(type: string): string {
  return ({ MOTORBIKE: "Xe máy", MOTORELECTRIC: "Xe máy điện", CAR: "Ô tô" } as Record<string, string>)[type] ?? type;
}

function formatPrice(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${new Intl.NumberFormat("vi-VN").format(amount)} đ` : display(value);
}

function formatDateTime(value: unknown): string {
  if (typeof value !== "string") return display(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? display(value)
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(date);
}

async function getCsrf(): Promise<Csrf> {
  const response = await fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Không lấy được mã bảo vệ phiên. Hãy tải lại trang và thử lại.");
  return response.json();
}

async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (method !== "GET" && method !== "HEAD") {
    const csrf = await getCsrf();
    headers.set(csrf.headerName, csrf.token);
  }
  const response = await fetch(`/api/backend/${path.replace(/^\/+/, "")}`, {
    method,
    credentials: "same-origin",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof result === "object" && result !== null && "error" in result
      ? String((result as { error: unknown }).error)
      : typeof result === "object" && result !== null && "message" in result
        ? String((result as { message: unknown }).message)
        : `Yêu cầu thất bại (${response.status})`;
    throw new Error(message);
  }
  return result as T;
}

function AppFrame({
  path,
  session,
  children,
}: {
  path: string;
  session: Session | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const links = session?.role === "CUSTOMER" ? CUSTOMER_LINKS : session?.role === "ADMIN" ? ADMIN_LINKS : STAFF_LINKS;
  const isAdminArea = path.startsWith("/admin");
  const isCustomerArea = ["/customer/dashboard", "/reservations", "/customer/account"].includes(path);
  const isContactPage = path === "/contact";
  const isRegisterPage = path === "/register";

  async function logout() {
    try {
      const csrf = await getCsrf();
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { [csrf.headerName]: csrf.token },
      });
      if (!response.ok) throw new Error("Không thể đăng xuất. Hãy tải lại trang và thử lại.");
      router.replace("/login?logout");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Không thể đăng xuất.");
    }
  }

  return (
    <div className={`${isAdminArea ? "app-frame admin-frame" : "app-frame"}${isCustomerArea ? " customer-area-frame" : ""}${isContactPage ? " contact-frame" : ""}${isRegisterPage ? " register-frame" : ""}`}>
      {isContactPage ? <LandingNavigation contactPage /> : <header className="app-header">
        <Link className="brand" href="/"><span className="brand-mark">P</span><span>NHÀ XE <strong>HIẾU MINH</strong></span></Link>
        <nav aria-label="Điều hướng chính">
          {session?.authenticated ? links.map(([href, label]) => (
            <Link aria-current={path === href ? "page" : undefined} href={href} key={href}>{label}</Link>
          )) : <><Link href="/contact">Liên hệ</Link><Link href="/register">Đăng ký</Link><Link href="/login">Đăng nhập</Link></>}
        </nav>
        {session?.authenticated && <button className="button button-outline" onClick={logout}>Đăng xuất</button>}
      </header>}
      {session?.role === "CUSTOMER" && <CustomerUpdates />}
      <main className={isAdminArea ? "workspace admin-workspace" : "workspace"}><div className="workspace-heading"><div><span className="eyebrow">{isAdminArea ? "ĐIỀU HÀNH BÃI XE" : "NHÀ XE HIẾU MINH"}</span><p>{session?.username ? `Xin chào, ${session.username}` : "Quản lý và đặt chỗ gửi xe trực tuyến"}</p></div></div>{children}</main>
      {isContactPage
        ? <footer className="landing-footer contact-app-footer"><Link className="landing-brand" href="/"><span className="landing-brand-mark">P</span><span>NHÀ XE <strong>HIẾU MINH</strong></span></Link><span>Đặt chỗ thuận tiện · Gửi xe an tâm</span><Link href="/">Về trang chủ</Link></footer>
        : <footer className="app-footer"><strong>NHÀ XE HIẾU MINH</strong><span>Hệ thống quản lý bãi xe trực tuyến</span></footer>}
    </div>
  );
}

function DataTable({ rows }: { rows: DataRow[] }) {
  if (!rows.length) return <p className="empty-state">Chưa có dữ liệu.</p>;
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const columnLabels: Record<string, string> = {
    id: "Mã",
    licenseplate: "Biển số xe",
    plate: "Biển số xe",
    slotcode: "Mã vị trí",
    vehicletype: "Loại xe",
    checkin: "Giờ vào",
    checkout: "Giờ ra",
    fee: "Phí gửi xe",
    monthlyticket: "Vé tháng",
    createdby: "Người tạo",
    checkedoutby: "Nhân viên làm thủ tục ra",
    paymentmethod: "Phương thức thanh toán",
    ownername: "Tên chủ xe",
    phone: "Số điện thoại",
    startdate: "Ngày bắt đầu",
    enddate: "Ngày kết thúc",
    price: "Giá vé",
    renewalcancelled: "Đã dừng gia hạn",
    cancelledat: "Ngày hủy",
    refundamount: "Tiền hoàn",
    bookingcode: "Mã đặt chỗ",
    customerusername: "Tên đăng nhập khách hàng",
    customername: "Tên khách hàng",
    starttime: "Thời gian bắt đầu",
    endtime: "Thời gian kết thúc",
    hourlyrate: "Giá mỗi giờ",
    totalamount: "Tổng tiền",
    status: "Trạng thái",
    statuslabel: "Trạng thái",
    createdat: "Ngày tạo",
    username: "Tên đăng nhập",
    fullname: "Họ và tên",
    role: "Vai trò",
    enabled: "Đang hoạt động",
    turnprice: "Giá vé lượt",
    monthprice: "Giá vé tháng",
    capacity: "Sức chứa",
    reservationhourlyprice: "Giá đặt chỗ mỗi giờ",
  };
  return (
    <div className="table-scroll"><table><thead><tr>{columns.map((key) => <th key={key}>{columnLabels[key.toLowerCase()] ?? key}</th>)}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={String(row.id ?? row.bookingCode ?? index)}>{columns.map((key) => <td key={key}>{display(row[key])}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

function FormField({ name, label, type = "text", required = false, defaultValue, maxLength, minLength, pattern, autoComplete, placeholder, options }: {
  name: string; label: string; type?: string; required?: boolean; defaultValue?: string; maxLength?: number;
  minLength?: number; pattern?: string; autoComplete?: string; placeholder?: string;
  options?: Array<{ value: string; label: string }>;
}) {
  return <label className="field">{label}{options
    ? <select name={name} required={required} defaultValue={defaultValue ?? options[0]?.value}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
    : <input name={name} type={type} required={required} defaultValue={defaultValue} maxLength={maxLength} minLength={minLength} pattern={pattern} autoComplete={autoComplete} placeholder={placeholder} />}</label>;
}

function RecordForm({
  fields,
  submitLabel,
  onSubmit,
}: {
  fields: Array<{ name: string; label: string; type?: string; required?: boolean; defaultValue?: string; maxLength?: number; minLength?: number; pattern?: string; autoComplete?: string; placeholder?: string; options?: Array<{ value: string; label: string }> }>;
  submitLabel: string;
  onSubmit: (data: Record<string, string>) => Promise<void | boolean>;
}) {
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
    try {
      const succeeded = await onSubmit(values);
      if (succeeded !== false) form.reset();
    } finally {
      setBusy(false);
    }
  }
  return <form className="data-form" onSubmit={submit}>{fields.map((field) => <FormField key={field.name} {...field} />)}<button className="button button-primary" disabled={busy}>{busy ? "Đang xử lý..." : submitLabel}</button></form>;
}

function normalizeRows(value: unknown): DataRow[] {
  if (Array.isArray(value)) return value.filter((row): row is DataRow => typeof row === "object" && row !== null);
  if (typeof value === "object" && value !== null) {
    const data = value as Record<string, unknown>;
    const array = Object.values(data).find(Array.isArray);
    if (Array.isArray(array)) return array.filter((row): row is DataRow => typeof row === "object" && row !== null);
    return [data];
  }
  return [];
}

function normalizeRoute(path: string) {
  const route = path.replace(/\/+$/, "") || "/";
  const aliases: Record<string, string> = {
    "/staff/dashboard": "/admin",
    "/landing": "/",
    "/customer-dashboard": "/customer/dashboard",
    "/customer-account": "/customer/account",
    "/parking": "/admin/parking",
    "/history": "/admin/parking/history",
    "/tickets": "/admin/tickets",
    "/users": "/admin/users",
    "/pricing": "/admin/pricing",
    "/reports": "/admin/reports",
    "/reservation-management": "/admin/reservations",
    "/support-inbox": "/admin/support/inbox",
  };
  return aliases[route] || route;
}

export default function Workspace({ path }: { path: string }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const route = normalizeRoute(path);
  const publicRoute = ["/register", "/contact"].includes(route);
  const title = ({
    "/register": "Tạo tài khoản khách hàng",
    "/contact": "Liên hệ nhà xe",
    "/customer/dashboard": "Tổng quan khách hàng",
    "/customer/account": "Tài khoản của tôi",
    "/reservations": "Đặt chỗ gửi xe",
    "/admin": "Sơ đồ bãi đỗ xe",
    "/admin/parking": "Check-in và xe trong bãi",
    "/admin/parking/history": "Lịch sử xe",
    "/admin/tickets": "Quản lý vé tháng",
    "/admin/reservations": "Đơn đặt chỗ trực tuyến",
    "/admin/users": "Quản lý tài khoản",
    "/admin/pricing": "Bảng giá và sức chứa",
    "/admin/reports": "Báo cáo doanh thu",
    "/admin/support/inbox": "Hộp thư hỗ trợ",
  } as Record<string, string>)[route] || "Nhà xe Hiếu Minh";

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<Session> : null)
      .then((value) => {
        if (!active) return;
        setSession(value);
        if (value?.authenticated && value.redirectTo && ["/login", "/register"].includes(route)) {
          router.replace(value.redirectTo);
        }
        if (!publicRoute && route !== "/" && !value?.authenticated && !["/login"].includes(route)) {
          router.replace("/login");
        }
        if (value?.authenticated && route.startsWith("/admin") && value.role === "CUSTOMER") {
          router.replace("/customer/dashboard");
        }
        if (value?.authenticated && ["/customer/dashboard", "/reservations", "/customer/account"].includes(route)
          && value.role !== "CUSTOMER") {
          router.replace("/admin");
        }
      })
      .catch(() => { if (active) setError("Không thể kiểm tra phiên đăng nhập."); });
    return () => { active = false; };
  }, [route, publicRoute, router]);

  useEffect(() => {
    if (!session?.authenticated && !publicRoute && route !== "/") return;
    const endpoints: Record<string, string> = {
      "/customer/dashboard": "dashboard",
      "/customer/account": "customer/account",
      "/reservations": "customer/reservations",
      "/admin": "admin/dashboard",
      "/admin/parking": "admin/parking",
      "/admin/parking/history": "admin/parking/history",
      "/admin/tickets": "admin/tickets",
      "/admin/reservations": "admin/reservations",
      "/admin/users": "admin/users",
      "/admin/pricing": "admin/pricing",
      "/admin/reports": "admin/reports",
      "/admin/support/inbox": "admin/support/conversations",
    };
    const endpoint = route === "/" || route === "/register" || route === "/contact"
      ? "public/home"
      : endpoints[route];
    if (!endpoint) return;
    const timer = window.setTimeout(() => {
      api(endpoint).then((result) => {
        setData(result);
        setError("");
      }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Không tải được dữ liệu."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshKey, route, session?.authenticated, publicRoute]);

  async function mutate(url: string, method: string, body?: unknown): Promise<boolean> {
    setError("");
    setMessage("");
    try {
      await api(url, method, body);
      setMessage("Đã cập nhật thành công.");
      setRefreshKey((key) => key + 1);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Thao tác không thành công.");
      return false;
    }
  }

  const rows = normalizeRows(data);
  const isAdminArea = route.startsWith("/admin");

  let content: ReactNode;
  if (route === "/register") {
    content = <div className="register-screen">
      <section className="register-showcase">
        <div className="register-showcase-top"><Link className="register-brand" href="/"><span>P</span> NHÀ XE HIẾU MINH</Link><small>ĐẶT CHỖ NHANH CHÓNG VÀ AN TOÀN</small></div>
        <div className="register-showcase-copy"><span>DÀNH CHO KHÁCH HÀNG</span><h2>Chủ động<br />chỗ đỗ xe<br /><strong>của bạn.</strong></h2><p>Tạo tài khoản để xem chỗ trống, đặt vị trí và theo dõi lịch sử đặt chỗ.</p></div>
        <div className="register-showcase-foot">✓ Thông tin tài khoản được bảo mật</div>
      </section>
      <section className="register-main"><div className="register-card">
        <span className="login-eyebrow">BẮT ĐẦU ĐẶT CHỖ</span><h1>Tạo tài khoản khách</h1><p>Đăng ký miễn phí để đặt vị trí đỗ xe trực tuyến.</p>
        <RecordForm fields={[
          { name: "fullName", label: "Họ và tên", required: true, maxLength: 100, autoComplete: "name", placeholder: "Nhập họ và tên" },
          { name: "phone", label: "Số điện thoại", type: "tel", required: true, maxLength: 20, pattern: "[0-9+().\\- ]{7,20}", autoComplete: "tel", placeholder: "Nhập số điện thoại" },
          { name: "username", label: "Tên đăng nhập", required: true, minLength: 3, maxLength: 50, pattern: "[A-Za-z0-9._-]{3,50}", autoComplete: "username", placeholder: "Tên đăng nhập" },
          { name: "password", label: "Mật khẩu", type: "password", required: true, minLength: 8, autoComplete: "new-password" },
          { name: "confirmPassword", label: "Xác nhận mật khẩu", type: "password", required: true, minLength: 8, autoComplete: "new-password" },
        ]} submitLabel="Tạo tài khoản →" onSubmit={async (values) => {
          try { await api("public/register", "POST", values); router.push("/login?registered=true"); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đăng ký."); return false; }
        }} />
        <p className="register-login-link">Đã có tài khoản? <Link href="/login">Đăng nhập</Link></p>
      </div></section>
    </div>;
  } else if (route === "/contact") {
    content = <ContactPanel onSubmit={async (values) => {
      try {
        const result = await api<{ sent: boolean; message: string }>("public/contact", "POST", values);
        setMessage(result.message);
      }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được lời nhắn."); }
    }} />;
  } else if (route === "/customer/account") {
    content = <CustomerAccount data={data} onSave={(phone) => mutate("customer/account/phone", "PUT", { phone })} />;
  } else if (route === "/reservations") {
    content = <ReservationPanel data={data} onRefresh={() => setRefreshKey((key) => key + 1)} onError={setError} onMessage={setMessage} />;
  } else if (route === "/admin" || route === "/admin/parking") {
    content = <ParkingPanel data={data} onAction={mutate} />;
  } else if (route === "/admin/parking/history") {
    content = <HistoryPanel initial={data} isAdmin={session?.role === "ADMIN"} onError={setError} />;
  } else if (route === "/admin/tickets") {
    content = <TicketManager rows={rows} canManage={session?.role === "ADMIN"} onAction={mutate} />;
  } else if (route === "/admin/users") {
    content = <UserManager rows={rows} onAction={mutate} />;
  } else if (route === "/admin/pricing") {
    content = <PricingEditor rows={rows} onSave={mutate} />;
  } else if (route === "/admin/reports") {
    content = <ReportPanel initial={data} onError={setError} />;
  } else if (route === "/admin/reservations") {
    content = <ReservationAdminPanel rows={rows} onAction={mutate} />;
  } else if (/^\/admin\/parking\/checkout\/\d+$/.test(route)) {
    content = <ParkingPayment route={route} onError={setError} onMessage={setMessage} />;
  } else if (route === "/admin/support/inbox") {
    content = <SupportInbox rows={rows} onReload={() => setRefreshKey((key) => key + 1)} />;
  } else if (route === "/customer/dashboard") {
    content = <CustomerDashboard data={data} username={session?.username} />;
  } else {
    content = <section className="panel"><h2>Trang chưa được hỗ trợ</h2><p>Chọn một mục trên thanh điều hướng.</p></section>;
  }

  return <AppFrame path={route} session={session}>{!(route === "/admin" || route === "/admin/parking" || route === "/admin/reports" || route === "/customer/dashboard" || route === "/reservations" || route === "/customer/account" || route === "/register" || route === "/contact") && <h1>{title}</h1>}{error && <div className="alert alert-error" role="alert">{error}</div>}{message && <div className="alert alert-success" role="status">{message}</div>}{content}{isAdminArea && session?.role === "STAFF" && <p className="hint">Một số mục quản trị chỉ dành cho ADMIN.</p>}</AppFrame>;
}

function CustomerDashboard({ data, username }: { data: unknown; username?: string }) {
  const payload = typeof data === "object" && data !== null ? data as DataRow : {};
  const bookings = Array.isArray(payload.reservations) ? payload.reservations as DataRow[] : [];
  const upcoming = bookings.filter((booking) => ["PENDING_PAYMENT", "CONFIRMED", "ARRIVED"].includes(String(booking.status)));
  const confirmedCount = bookings.filter((booking) => ["CONFIRMED", "ARRIVED"].includes(String(booking.status))).length;
  const completedCount = bookings.filter((booking) => booking.status === "COMPLETED").length;
  const displayName = String(payload.fullName ?? "").trim() || username || "Khách hàng";
  return <div className="customer-area">
    <section className="reservation-welcome customer-dashboard-welcome">
      <div><span className="reservation-eyebrow">HIẾU MINH PARKING · KHU VỰC KHÁCH HÀNG</span><h1>Xin chào, <span>{displayName}</span></h1><p>Thông tin tài khoản và các đơn đặt chỗ của bạn được cập nhật từ hệ thống.</p></div>
      <div className="reservation-welcome-icon" aria-hidden="true">♙</div>
    </section>
    <section className="customer-dashboard-stats" aria-label="Tổng quan tài khoản và đặt chỗ">
      <article className="reservation-card customer-dashboard-stat"><span className="customer-stat-icon">♙</span><div><span>Tài khoản</span><strong className="customer-stat-username">{username ?? "—"}</strong></div></article>
      <article className="reservation-card customer-dashboard-stat"><span className="customer-stat-icon">▦</span><div><span>Tổng đơn đặt chỗ</span><strong>{display(payload.totalBookings ?? bookings.length)}</strong></div></article>
      <article className="reservation-card customer-dashboard-stat"><span className="customer-stat-icon pending-stat-icon">◷</span><div><span>Chờ thanh toán</span><strong>{display(payload.pendingPaymentCount ?? bookings.filter((booking) => booking.status === "PENDING_PAYMENT").length)}</strong></div></article>
      <article className="reservation-card customer-dashboard-stat"><span className="customer-stat-icon confirmed-stat-icon">✓</span><div><span>Đã xác nhận / đang gửi</span><strong>{confirmedCount}</strong></div></article>
    </section>
    <section className="reservation-card customer-dashboard-bookings customer-upcoming-card">
      <div className="reservation-section-heading"><div><span className="reservation-eyebrow">LỊCH CỦA BẠN</span><h2>Lịch đặt chỗ sắp tới</h2><p>Danh sách được lấy từ các đơn đặt chỗ gắn với tài khoản hiện tại.</p></div><span className="reservation-count">{completedCount} đơn hoàn tất</span></div>
      {upcoming.length > 0 ? <div className="customer-upcoming-list">{upcoming.slice(0, 5).map((booking) => <article className="customer-upcoming-item" key={String(booking.id)}>
        <span className="customer-upcoming-icon" aria-hidden="true">▰</span>
        <div className="customer-upcoming-details"><strong>{vehicleLabels(String(booking.vehicleType))} · {display(booking.plate ?? booking.licensePlate)}</strong><span>{formatDateTime(booking.startTime)} – {formatDateTime(booking.endTime)}</span></div>
        <span className={`reservation-status ${["CONFIRMED", "ARRIVED"].includes(String(booking.status)) ? "status-confirmed" : "status-pending"}`}>{display(booking.statusLabel ?? booking.status)}</span>
        <strong className="customer-upcoming-slot">{display(booking.slotCode)}</strong>
      </article>)}</div> : <div className="reservation-empty compact-empty"><span aria-hidden="true">▦</span><p>Bạn chưa có đơn đặt chỗ sắp tới. Chọn thời gian và vị trí bên dưới để bắt đầu.</p></div>}
      <Link className="customer-dashboard-link" href="/reservations">Đặt chỗ gửi xe <span aria-hidden="true">→</span></Link>
    </section>
    <section className="customer-booking-heading"><span className="reservation-eyebrow">TÀI KHOẢN CỦA BẠN</span><h2>Quản lý đặt chỗ thuận tiện</h2><p>Xem đơn, cập nhật thông tin hoặc chọn vị trí gửi xe.</p></section>
    <div className="panel-grid customer-dashboard-links">
      <Link className="panel customer-action-card" href="/reservations"><span>01 / ĐẶT CHỖ</span><strong>Đặt chỗ gửi xe</strong><small>Chọn loại xe, khung giờ và vị trí còn trống.</small><b aria-hidden="true">→</b></Link>
      <Link className="panel customer-action-card" href="/customer/account"><span>02 / TÀI KHOẢN</span><strong>Thông tin cá nhân</strong><small>Cập nhật hồ sơ và số điện thoại liên hệ.</small><b aria-hidden="true">→</b></Link>
    </div>
  </div>;
}

function CustomerAccount({ data, onSave }: { data: unknown; onSave: (phone: string) => Promise<boolean> }) {
  const profile = typeof data === "object" && data !== null ? data as DataRow : {};
  const [phone, setPhone] = useState(String(profile.phone ?? ""));
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const phoneValue = phoneEdited ? phone : String(profile.phone ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try { if (await onSave(phoneValue)) setPhoneEdited(false); }
    finally { setBusy(false); }
  }

  async function deletePhone() {
    setBusy(true);
    try { if (await onSave("")) { setPhone(""); setPhoneEdited(true); } }
    finally { setBusy(false); }
  }

  return <div className="customer-area">
    <section className="reservation-welcome customer-dashboard-welcome">
      <div><span className="reservation-eyebrow">KHU VỰC KHÁCH HÀNG</span><h1>Thông tin khách hàng</h1><p>Xem và cập nhật thông tin tài khoản của bạn.</p></div>
      <div className="reservation-welcome-icon" aria-hidden="true">♙</div>
    </section>
    <section className="reservation-card customer-account-card" aria-label="Thông tin tài khoản">
      <div className="reservation-section-heading"><div><span className="reservation-eyebrow">HỒ SƠ CỦA BẠN</span><h2>Thông tin cá nhân</h2><p>Thông tin này gắn với tài khoản đang đăng nhập.</p></div><span className="reservation-status status-confirmed">Khách hàng</span></div>
      <dl className="customer-account-details">
        <div><dt>Họ và tên</dt><dd>{display(profile.fullName) === "—" ? "Chưa cập nhật" : display(profile.fullName)}</dd></div>
        <div><dt>Tên đăng nhập</dt><dd>{display(profile.username)}</dd></div>
        <div><dt>Số điện thoại hiện tại</dt><dd>{display(profile.phone) === "—" ? "Chưa cập nhật" : display(profile.phone)}</dd></div>
        <div><dt>Trạng thái tài khoản</dt><dd>{profile.enabled === false ? "Đã khóa" : "Đang hoạt động"}</dd></div>
      </dl>
    </section>
    <section className="reservation-card customer-account-card">
      <div className="reservation-section-heading"><div><span className="reservation-eyebrow">LIÊN HỆ</span><h2>Số điện thoại</h2><p>Bạn có thể thêm, sửa hoặc xóa số điện thoại.</p></div></div>
      <form className="customer-account-phone-form" onSubmit={(event) => void submit(event)}>
        <label className="reservation-input-label" htmlFor="customer-phone">Số điện thoại</label>
        <div className="customer-account-phone-controls"><input id="customer-phone" type="tel" maxLength={20} value={phoneValue} onChange={(event) => { setPhone(event.target.value); setPhoneEdited(true); }} placeholder="Nhập số điện thoại" /><button className="reservation-button" type="submit" disabled={busy}>{busy ? "Đang lưu..." : "✓ Lưu số điện thoại"}</button></div>
        {Boolean(profile.phone) && <button className="customer-account-phone-delete" type="button" onClick={() => void deletePhone()} disabled={busy}>Xóa số điện thoại</button>}
      </form>
    </section>
    <div className="customer-account-actions"><Link className="reservation-button secondary-button" href="/customer/dashboard">⌂ Trang chủ</Link><Link className="reservation-button" href="/reservations">▦ Đặt chỗ ngay</Link></div>
  </div>;
}

function ContactPanel({ onSubmit }: { onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
    try { await onSubmit(values); }
    finally { setBusy(false); }
  }

  return <main className="contact-main">
    <section className="contact-hero"><span className="landing-eyebrow">NHÀ XE HIẾU MINH</span><h1>Chúng tôi luôn<br /><span>sẵn sàng lắng nghe.</span></h1><p>Gửi câu hỏi hoặc lời nhắn cho chúng tôi. Nhân viên sẽ tiếp nhận và phản hồi qua thông tin bạn cung cấp.</p></section>
    <section className="contact-layout" aria-label="Thông tin và biểu mẫu liên hệ">
      <aside className="contact-info-panel"><span className="contact-panel-eyebrow">KẾT NỐI VỚI CHÚNG TÔI</span><h2>Nhà xe Hiếu Minh</h2><p className="contact-panel-description">Liên hệ trực tiếp hoặc gửi lời nhắn, chúng tôi rất vui được hỗ trợ bạn.</p>
        <div className="contact-info-list">
          <a className="contact-info-item" href="tel:0862282415"><span>☎</span><div><small>Điện thoại</small><strong>0862 282 415</strong></div></a>
          <a className="contact-info-item" href="mailto:trantridung10122006@gmail.com"><span>@</span><div><small>Email</small><strong>trantridung10122006@gmail.com</strong></div></a>
          <a className="contact-info-item" href="https://www.google.com/maps/search/?api=1&query=100%2F3%20Quang%20Trung%2C%20T%C4%83ng%20Nh%C6%A1n%20Ph%C3%BA%2C%20TPHCM" target="_blank" rel="noopener noreferrer"><span>⌖</span><div><small>Địa chỉ</small><strong>100/3 Quang Trung, Tăng Nhơn Phú, TPHCM</strong></div></a>
        </div>
        <div className="contact-panel-foot">✓ Thông tin của bạn chỉ được dùng để phản hồi yêu cầu liên hệ.</div>
      </aside>
      <section className="contact-form-panel">
        <div className="contact-form-heading"><span className="landing-eyebrow">GỬI LỜI NHẮN</span><h2>Liên hệ với chúng tôi</h2><p>Vui lòng điền thông tin để nhà xe có thể phản hồi.</p></div>
        <form className="contact-form" onSubmit={(event) => void submit(event)}>
          <div className="contact-form-grid">
            <label className="contact-field"><span>Tên bạn <b>*</b></span><input name="name" maxLength={100} autoComplete="name" placeholder="Nhập họ và tên" required /></label>
            <label className="contact-field"><span>Số điện thoại <b>*</b></span><input name="phone" type="tel" maxLength={20} autoComplete="tel" placeholder="Nhập số điện thoại" required /></label>
            <label className="contact-field"><span>Email <b>*</b></span><input name="email" type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" required /></label>
            <fieldset className="contact-customer-type"><legend>Bạn là</legend><label><input name="customerType" type="radio" value="NEW" required /> Khách hàng mới</label><label><input name="customerType" type="radio" value="EXISTING" /> Khách hàng hiện tại</label></fieldset>
            <label className="contact-field contact-message-field"><span>Nội dung <b>*</b></span><textarea name="message" rows={5} minLength={10} maxLength={5000} placeholder="Bạn cần chúng tôi hỗ trợ điều gì?" required /><small>Từ 10 đến 5.000 ký tự</small></label>
          </div>
          <button className="contact-submit" type="submit" disabled={busy}>{busy ? "Đang gửi..." : "Gửi lời nhắn →"}</button>
        </form>
      </section>
    </section>
  </main>;
}

function HistoryPanel({ initial, isAdmin, onError }: { initial: unknown; isAdmin: boolean; onError: (message: string) => void }) {
  const [result, setResult] = useState<unknown>(undefined);
  const [plate, setPlate] = useState("");
  const [type, setType] = useState("");
  const [checkoutEmployee, setCheckoutEmployee] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  async function searchPage(pageNumber: number) {
    try {
      const query = new URLSearchParams({ plate, page: String(pageNumber) });
      if (type) query.set("type", type);
      if (isAdmin && checkoutEmployee) query.set("checkoutEmployee", checkoutEmployee);
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      setResult(await api(`admin/parking/history?${query}`));
      setPage(pageNumber);
      onError("");
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không tìm được lịch sử."); }
  }
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void searchPage(0);
  }
  const payload = typeof (result ?? initial) === "object" && (result ?? initial) !== null ? (result ?? initial) as DataRow : {};
  const pageInfo = typeof payload.page === "object" && payload.page !== null ? payload.page as DataRow : {};
  const currentPage = Number(pageInfo.number ?? page);
  const totalPages = Number(pageInfo.totalPages ?? 0);
  return <section className="panel"><form className="data-form" onSubmit={search}>
    <label className="field">Tìm biển số<input value={plate} onChange={(event) => setPlate(event.target.value)} /></label>
    <label className="field">Loại xe<select value={type} onChange={(event) => setType(event.target.value)}><option value="">Tất cả</option><option value="CAR">Ô tô</option><option value="MOTORBIKE">Xe máy</option><option value="MOTORELECTRIC">Xe máy điện</option></select></label>
    <label className="field">Từ ngày<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
    <label className="field">Đến ngày<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
    {isAdmin && <label className="field">Nhân viên check-out<input value={checkoutEmployee} onChange={(event) => setCheckoutEmployee(event.target.value)} /></label>}
    <button className="button button-primary">Tìm kiếm</button>
  </form>
  <div className="row-actions"><button type="button" className="button button-outline" disabled={currentPage <= 0} onClick={() => void searchPage(currentPage - 1)}>Trang trước</button><span>Trang {currentPage + 1}{totalPages > 0 ? ` / ${totalPages}` : ""}</span><button type="button" className="button button-outline" disabled={totalPages > 0 && currentPage + 1 >= totalPages} onClick={() => void searchPage(currentPage + 1)}>Trang sau</button></div>
  <DataTable rows={normalizeRows(pageInfo.content)} />
  <h2>Vé tháng khớp biển số</h2><DataTable rows={normalizeRows(payload.monthlyTickets)} />
  </section>;
}

function TicketManager({ rows, onAction, canManage }: { rows: DataRow[]; onAction: (url: string, method: string, body?: unknown) => Promise<boolean>; canManage: boolean }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DataRow[] | null>(null);
  const visibleRows = searchResults ?? rows;
  async function mutate(url: string, method: string, body?: unknown) {
    const succeeded = await onAction(url, method, body);
    if (succeeded) setSearchResults(null);
    return succeeded;
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { setSearchResults(normalizeRows(await api(`admin/tickets?${new URLSearchParams({ q: query })}`))); }
    catch (cause) { window.alert(cause instanceof Error ? cause.message : "Không tìm được vé tháng."); }
  }
  return <section className="panel"><RecordForm fields={[
      { name: "licensePlate", label: "Biển số xe", required: true },
      { name: "ownerName", label: "Tên chủ xe", required: true },
      { name: "phone", label: "Số điện thoại" },
      { name: "vehicleType", label: "Loại xe", required: true, options: [
        { value: "CAR", label: "Ô tô" }, { value: "MOTORBIKE", label: "Xe máy" }, { value: "MOTORELECTRIC", label: "Xe máy điện" },
      ] },
      { name: "months", label: "Số tháng (1–24)", type: "number", required: true, defaultValue: "1" },
  ]} submitLabel="Đăng ký vé tháng" onSubmit={(values) => mutate("admin/tickets", "POST", values)} />
  <form className="data-form" onSubmit={search}><label className="field">Tìm theo biển số<input value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="button button-outline">Tìm vé</button></form>
  <DataTable rows={visibleRows} />
  {canManage && <div className="row-actions">{visibleRows.map((row) => <div className="action-row" key={String(row.id)}><span>{display(row.licensePlate)} · {display(row.ownerName)}</span><details><summary>Sửa thông tin</summary><RecordForm fields={[
    { name: "licensePlate", label: "Biển số xe", required: true, defaultValue: String(row.licensePlate ?? "") },
    { name: "ownerName", label: "Tên chủ xe", required: true, defaultValue: String(row.ownerName ?? "") },
  ]} submitLabel="Lưu vé" onSubmit={(values) => mutate(`admin/tickets/${row.id}/rename`, "POST", values)} /></details><button className="button button-outline" onClick={() => void mutate(`admin/tickets/${row.id}/cancel-renewal`, "POST")}>Ngừng gia hạn</button><button className="button button-danger" onClick={() => {
    if (window.confirm("Hủy vé này và tính khoản hoàn tiền theo ngày còn lại?")) void mutate(`admin/tickets/${row.id}/cancel`, "POST");
  }}>Hủy vé</button><button className="button button-danger" onClick={() => {
    if (window.confirm("Xóa vé tháng này?")) void mutate(`admin/tickets/${row.id}`, "DELETE");
  }}>Xóa</button></div>)}</div>}</section>;
}

function UserManager({ rows, onAction }: { rows: DataRow[]; onAction: (url: string, method: string, body?: unknown) => Promise<boolean> }) {
  return <section className="panel"><RecordForm fields={[
    { name: "username", label: "Tên đăng nhập", required: true },
    { name: "fullName", label: "Họ và tên" },
    { name: "password", label: "Mật khẩu", type: "password", required: true },
    { name: "role", label: "Vai trò", required: true, options: [{ value: "STAFF", label: "Nhân viên" }, { value: "ADMIN", label: "Quản trị viên" }] },
  ]} submitLabel="Tạo tài khoản" onSubmit={(values) => onAction("admin/users", "POST", values)} /><DataTable rows={rows} /><div className="row-actions">{rows.map((row) => <div className="action-row" key={String(row.id)}><span>{display(row.username)} · {display(row.role)}</span><details><summary>Chỉnh sửa tài khoản</summary><RecordForm fields={[
    { name: "username", label: "Tên đăng nhập", required: true, defaultValue: String(row.username ?? "") },
    { name: "fullName", label: "Họ và tên", defaultValue: String(row.fullName ?? "") },
  ]} submitLabel="Lưu thông tin" onSubmit={(values) => onAction(`admin/users/${row.id}`, "PUT", values)} /><RecordForm fields={[
    { name: "phone", label: "Số điện thoại", defaultValue: String(row.phone ?? "") },
  ]} submitLabel="Lưu số điện thoại" onSubmit={(values) => onAction(`admin/users/${row.id}/phone`, "PUT", values)} /><RecordForm fields={[
    { name: "newPassword", label: "Mật khẩu mới", type: "password", required: true },
    { name: "confirmPassword", label: "Xác nhận mật khẩu", type: "password", required: true },
  ]} submitLabel="Đổi mật khẩu" onSubmit={(values) => onAction(`admin/users/${row.id}/password`, "PUT", values)} /></details><button className="button button-outline" onClick={() => void onAction(`admin/users/${row.id}/toggle`, "PUT", { enabled: row.enabled !== true })}>{row.enabled ? "Khóa" : "Mở khóa"}</button><button className="button button-danger" onClick={() => {
      if (window.confirm(`Xóa tài khoản ${display(row.username)}?`)) void onAction(`admin/users/${row.id}`, "DELETE");
    }}>Xóa</button></div>)}</div></section>;
}

function ReportPanel({ initial, onError }: { initial: unknown; onError: (message: string) => void }) {
  const today = new Date();
  const dateValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const [from, setFrom] = useState(dateValue(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(dateValue(today));
  const [result, setResult] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(false);
  async function load(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (from > to) {
      onError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams({ from, to });
      setResult(await api(`admin/reports?${query}`));
      onError("");
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Không tải được báo cáo.");
    } finally {
      setLoading(false);
    }
  }
  const payload = typeof (result ?? initial) === "object" && (result ?? initial) !== null ? (result ?? initial) as DataRow : {};
  const exportUrl = `/api/backend/admin/reports/export?${new URLSearchParams({ from, to })}`;
  const days = normalizeRows(payload.days ?? payload.dailyRows ?? payload.rows);
  const total = Number(payload.total ?? (
    Number(payload.turnRevenue ?? 0) + Number(payload.reservationRevenue ?? 0) + Number(payload.ticketRevenue ?? 0)
  )) || 0;
  const turnRevenue = Number(payload.turnRevenue) || 0;
  const reservationRevenue = Number(payload.reservationRevenue) || 0;
  const ticketRevenue = Number(payload.ticketRevenue) || 0;
  const vehicles = Number(payload.vehicles) || 0;
  const reservations = Number(payload.reservations) || 0;
  const maxRevenue = Math.max(1, ...days.map((day) => Number(day.revenue) || 0));
  const byType = typeof payload.byType === "object" && payload.byType !== null ? payload.byType as Record<string, unknown> : {};
  const sources = [
    { key: "turn", label: "Vé lượt", value: turnRevenue, tone: "turn" },
    { key: "online", label: "Đặt chỗ trực tuyến", value: reservationRevenue, tone: "online" },
    { key: "monthly", label: "Vé tháng", value: ticketRevenue, tone: "monthly" },
  ];
  const sourceTotal = sources.reduce((sum, source) => sum + source.value, 0);
  const turnPercent = sourceTotal ? turnRevenue / sourceTotal * 100 : 0;
  const onlinePercent = sourceTotal ? reservationRevenue / sourceTotal * 100 : 0;
  const monthPercent = sourceTotal ? ticketRevenue / sourceTotal * 100 : 0;
  const chartBackground = `conic-gradient(#4f8cff 0% ${turnPercent}%, #35c99a ${turnPercent}% ${turnPercent + onlinePercent}%, #ae8bff ${turnPercent + onlinePercent}% ${turnPercent + onlinePercent + monthPercent}%, #26364b ${turnPercent + onlinePercent + monthPercent}% 100%)`;
  const chartDates = new Set(days.length > 10
    ? days.filter((_, index) => index % Math.ceil(days.length / 7) === 0 || index === days.length - 1).map((day) => String(day.date))
    : days.map((day) => String(day.date)));

  function applyPreset(range: "today" | "week" | "month" | "thisMonth") {
    const end = new Date();
    const start = new Date(end);
    if (range === "today") start.setHours(0, 0, 0, 0);
    if (range === "week") start.setDate(start.getDate() - 6);
    if (range === "month") start.setDate(start.getDate() - 29);
    if (range === "thisMonth") start.setDate(1);
    setFrom(dateValue(start));
    setTo(dateValue(end));
  }

  return <div className="revenue-report-page">
    <header className="revenue-report-heading">
      <div><span className="revenue-report-eyebrow">TRUNG TÂM PHÂN TÍCH</span><h2>Báo cáo doanh thu</h2><p>Theo dõi doanh thu, lượt xe và các nguồn thu trong khoảng thời gian đã chọn.</p></div>
      <a className="revenue-export-button" href={exportUrl}>↓ <span>Xuất báo cáo CSV</span></a>
    </header>

    <form className="revenue-filter-panel" onSubmit={(event) => void load(event)}>
      <div className="revenue-filter-title"><span className="revenue-filter-icon">▦</span><div><strong>Khoảng thời gian</strong><small>Chọn ngày để cập nhật báo cáo</small></div></div>
      <label className="revenue-date-field"><span>Từ ngày</span><input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} required /></label>
      <span className="revenue-date-separator" aria-hidden="true">→</span>
      <label className="revenue-date-field"><span>Đến ngày</span><input type="date" value={to} min={from} max={dateValue(new Date())} onChange={(event) => setTo(event.target.value)} required /></label>
      <button className="revenue-apply-button" disabled={loading}>{loading ? "Đang cập nhật..." : "⌕ Cập nhật"}</button>
      <div className="revenue-presets" aria-label="Khoảng thời gian nhanh">
        <button type="button" onClick={() => applyPreset("today")}>Hôm nay</button>
        <button type="button" onClick={() => applyPreset("week")}>7 ngày</button>
        <button type="button" onClick={() => applyPreset("month")}>30 ngày</button>
        <button type="button" onClick={() => applyPreset("thisMonth")}>Tháng này</button>
      </div>
    </form>

    <section className="revenue-kpis" aria-label="Tổng quan doanh thu">
      <article className="revenue-kpi revenue-kpi-total"><span className="revenue-kpi-icon">₫</span><span className="revenue-kpi-label">TỔNG DOANH THU</span><strong>{formatPrice(total)} <small>đ</small></strong><p>Trong khoảng thời gian đã chọn</p></article>
      <article className="revenue-kpi"><span className="revenue-kpi-icon revenue-icon-turn">▰</span><span className="revenue-kpi-label">DOANH THU VÉ LƯỢT</span><strong>{formatPrice(turnRevenue)} <small>đ</small></strong><p>Phí gửi xe theo lượt</p></article>
      <article className="revenue-kpi"><span className="revenue-kpi-icon revenue-icon-online">↗</span><span className="revenue-kpi-label">ĐẶT CHỖ TRỰC TUYẾN</span><strong>{formatPrice(reservationRevenue)} <small>đ</small></strong><p>{reservations} đơn đã thanh toán</p></article>
      <article className="revenue-kpi"><span className="revenue-kpi-icon revenue-icon-monthly">▤</span><span className="revenue-kpi-label">DOANH THU VÉ THÁNG</span><strong>{formatPrice(ticketRevenue)} <small>đ</small></strong><p>Vé đăng ký trong kỳ</p></article>
      <article className="revenue-kpi"><span className="revenue-kpi-icon revenue-icon-vehicles">⌁</span><span className="revenue-kpi-label">LƯỢT XE HOÀN TẤT</span><strong>{vehicles} <small>lượt</small></strong><p>{reservations} đơn đặt chỗ đã xác nhận</p></article>
    </section>

    <section className="revenue-analytics-grid">
      <article className="revenue-panel revenue-trend-panel">
        <header className="revenue-panel-heading"><div><span>DOANH THU</span><h3>Xu hướng theo ngày</h3></div><small>{from} — {to}</small></header>
        {days.length ? <div className="revenue-chart-scroll" role="img" aria-label="Biểu đồ doanh thu từng ngày">
          <div className="revenue-chart-y-axis"><span>{formatPrice(maxRevenue)}</span><span>{formatPrice(Math.round(maxRevenue * .66))}</span><span>{formatPrice(Math.round(maxRevenue * .33))}</span><span>0 đ</span></div>
          <div className="revenue-chart">
            {[1, 0.66, 0.33, 0].map((line) => <span className="revenue-chart-gridline" style={{ bottom: `${line * 100}%` }} key={line} />)}
            <div className="revenue-chart-bars">{days.map((day, index) => {
              const revenue = Number(day.revenue) || 0;
              const height = revenue ? Math.max(3, revenue / maxRevenue * 100) : 0;
              const date = String(day.date ?? "");
              const label = date.slice(5).replace("-", "/");
              return <div className="revenue-chart-column" key={`${date}-${index}`} title={`${date}: ${formatPrice(revenue)} đ`}>
                <strong>{revenue ? formatPrice(revenue) : ""}</strong><span className="revenue-chart-bar" style={{ height: `${height}%` }} />
                <small>{chartDates.has(date) ? label : ""}</small>
              </div>;
            })}</div>
          </div>
        </div> : <div className="revenue-empty-state"><span>▥</span><strong>Chưa có doanh thu trong khoảng thời gian này</strong><p>Hãy chọn khoảng ngày khác để xem số liệu.</p></div>}
        <footer className="revenue-chart-legend"><span><i /> Tổng doanh thu mỗi ngày</span><small>Đơn vị: Việt Nam đồng</small></footer>
      </article>

      <article className="revenue-panel revenue-source-panel">
        <header className="revenue-panel-heading"><div><span>CƠ CẤU DOANH THU</span><h3>Nguồn thu trong kỳ</h3></div></header>
        <div className="revenue-source-overview">
          <div className="revenue-donut" style={{ background: chartBackground }} role="img" aria-label={`Cơ cấu tổng doanh thu ${formatPrice(total)} đồng`}>
            <div><strong title={formatPrice(total)}>{formatPrice(total).replace(/\sđ$/, "")}</strong><small>Tổng doanh thu · đ</small></div>
          </div>
          <div className="revenue-source-list">{sources.map((source) => <div className="revenue-source-row" key={source.key}>
            <i className={`revenue-source-dot ${source.tone}`} /><span>{source.label}</span><strong>{formatPrice(source.value)} đ</strong><small>{sourceTotal ? `${Math.round(source.value / sourceTotal * 100)}%` : "0%"}</small>
          </div>)}</div>
        </div>
        <div className="revenue-source-note"><span aria-hidden="true">ⓘ</span> Doanh thu chỉ tính giao dịch đã hoàn tất hoặc được xác nhận thanh toán.</div>
      </article>
    </section>

    <section className="revenue-details-grid">
      <article className="revenue-panel revenue-daily-panel">
        <header className="revenue-panel-heading"><div><span>CHI TIẾT GIAO DỊCH</span><h3>Doanh thu từng ngày</h3></div><small>{days.length} ngày có giao dịch</small></header>
        {days.length ? <div className="revenue-table-scroll"><table className="revenue-table"><thead><tr><th>Ngày</th><th>Lượt xe</th><th>Đơn đặt chỗ</th><th>Doanh thu</th><th>Tỷ trọng</th></tr></thead><tbody>{days.map((day, index) => {
          const share = total ? (Number(day.revenue) || 0) / total * 100 : 0;
          const date = String(day.date ?? "");
          const dateLabel = date ? new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)) : "—";
          return <tr key={`${date}-${index}`}><td><strong>{dateLabel}</strong></td><td>{display(day.count ?? 0)}</td><td>{display(day.reservationCount ?? 0)}</td><td className="revenue-table-amount">{formatPrice(day.revenue)} đ</td><td><span className="revenue-share-track"><i style={{ width: `${Math.min(100, share)}%` }} /></span><small>{share.toFixed(1)}%</small></td></tr>;
        })}</tbody><tfoot><tr><th>Tổng cộng</th><th>{vehicles}</th><th>{reservations}</th><th>{formatPrice(total)} đ</th><th>100%</th></tr></tfoot></table></div>
          : <div className="revenue-empty-table">Chưa có giao dịch doanh thu trong khoảng thời gian này.</div>}
      </article>
      <article className="revenue-panel revenue-vehicle-panel">
        <header className="revenue-panel-heading"><div><span>PHÂN TÍCH PHƯƠNG TIỆN</span><h3>Doanh thu theo loại xe</h3></div></header>
        <div className="revenue-vehicle-list">{Object.entries(byType).map(([typeName, value], index) => {
          const revenue = Number(value) || 0;
          const share = total ? revenue / total * 100 : 0;
          const tones = ["blue", "green", "violet"];
          return <div className="revenue-vehicle-row" key={typeName}><div className="revenue-vehicle-heading"><span><i className={tones[index % tones.length]} />{typeName}</span><strong>{formatPrice(revenue)} đ</strong></div><div className="revenue-vehicle-track"><i className={tones[index % tones.length]} style={{ width: `${Math.min(100, share)}%` }} /></div><small>{share.toFixed(1)}% tổng doanh thu</small></div>;
        })}</div>
        <div className="revenue-method-summary"><strong>Ghi nhận trong kỳ</strong><span>{vehicles} lượt xe hoàn tất</span><span>{reservations} đơn đặt chỗ đã thanh toán</span></div>
      </article>
    </section>
  </div>;
}

function ReservationPanel({
  data,
  onRefresh,
  onError,
  onMessage,
}: {
  data: unknown;
  onRefresh: () => void;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const payload = typeof data === "object" && data !== null ? data as Record<string, unknown> : {};
  const bookings = Array.isArray(payload.reservations) ? payload.reservations as DataRow[] : [];
  const [availability, setAvailability] = useState<Record<string, unknown> | null>(null);
  const [vehicleType, setVehicleType] = useState("CAR");
  const [start, setStart] = useState(() => localDateTimeInput(30));
  const [end, setEnd] = useState(() => localDateTimeInput(150));
  const [plate, setPlate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentReservation, setPaymentReservation] = useState<DataRow | null>(null);
  const availabilityRequest = useRef(0);
  const quoteMatchesCurrentRange = availability?.quotedType === vehicleType
    && availability.quotedStart === start
    && availability.quotedEnd === end;
  const selectedAvailability = quoteMatchesCurrentRange
    ? availability
    : { slots: [], estimatedAmount: 0, hourlyRate: 0, billableHours: 0, loading: true };
  const slots = Array.isArray(selectedAvailability.slots) ? selectedAvailability.slots as DataRow[] : [];
  const availableSlots = slots.filter((slot) => slot.available === true);
  const isAvailabilityLoading = selectedAvailability.loading === true;
  const quotedHours = Number(selectedAvailability.billableHours) || 0;
  const quotedHourlyRate = Number(selectedAvailability.hourlyRate) || 0;
  const durationMinutes = new Date(end).getTime() - new Date(start).getTime();
  const durationLabel = Number.isFinite(durationMinutes) && durationMinutes > 0
    ? `${Math.ceil(durationMinutes / 3_600_000)} giờ`
    : "—";

  useEffect(() => {
    if (!paymentReservation) return;

    const closeTimer = window.setTimeout(() => setPaymentReservation(null), 120_000);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPaymentReservation(null);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.clearTimeout(closeTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [paymentReservation]);

  useEffect(() => {
    if (!paymentReservation) return;
    const closeAfterPaymentConfirmation = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string }>).detail;
      if (detail?.message?.includes(String(paymentReservation.bookingCode))) {
        setPaymentReservation(null);
        onRefresh();
      }
    };
    window.addEventListener("parking-payment-confirmed", closeAfterPaymentConfirmation);
    return () => window.removeEventListener("parking-payment-confirmed", closeAfterPaymentConfirmation);
  }, [paymentReservation, onRefresh]);

  const loadAvailability = useCallback(async (type: string, from: string, to: string) => {
    const requestId = ++availabilityRequest.current;
    setAvailability({
      slots: [],
      estimatedAmount: 0,
      hourlyRate: 0,
      billableHours: 0,
      loading: true,
      quotedType: type,
      quotedStart: from,
      quotedEnd: to,
    });
    setBusy(true);
    onError("");
    try {
      const query = new URLSearchParams({ type, start: from, end: to });
      const result = await api<Record<string, unknown>>(`customer/reservations?${query}`);
      if (requestId === availabilityRequest.current) {
        setAvailability({
          ...result,
          quotedType: type,
          quotedStart: from,
          quotedEnd: to,
        });
      }
    } catch (cause) {
      if (requestId === availabilityRequest.current) {
        setAvailability({
          slots: [],
          estimatedAmount: 0,
          hourlyRate: 0,
          billableHours: 0,
          quotedType: type,
          quotedStart: from,
          quotedEnd: to,
          error: cause instanceof Error ? cause.message : "Không tải được tình trạng chỗ.",
        });
      }
    } finally {
      if (requestId === availabilityRequest.current) setBusy(false);
    }
  }, [onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAvailability(vehicleType, start, end);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAvailability, vehicleType, start, end]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSelectedSlot("");
    await loadAvailability(vehicleType, start, end);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) {
      onError("Hãy chọn một vị trí còn trống.");
      return;
    }
    setBusy(true);
    try {
      const created = await api<DataRow>("customer/reservations", "POST", {
        plate,
        type: vehicleType,
        slotCode: selectedSlot,
        start,
        end,
      });
      setPaymentReservation(created);
      onMessage(`Đã tạo đơn ${display(created.bookingCode)}. Hoàn tất chuyển khoản trong 2 phút.`);
      setAvailability(null);
      setPlate("");
      setSelectedSlot("");
      onRefresh();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không tạo được đơn đặt chỗ."); }
    finally { setBusy(false); }
  }

  async function cancelBooking(id: unknown) {
    try {
      await api(`customer/reservations/${id}/cancel`, "POST");
      onMessage("Đã hủy đơn đặt chỗ.");
      onRefresh();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không hủy được đơn đặt chỗ."); }
  }

  return <div className="customer-area">
    <section className="reservation-welcome">
      <div><span className="reservation-eyebrow">ĐẶT CHỖ TRỰC TUYẾN</span><h1>Chọn chỗ đỗ phù hợp</h1><p>Xem chỗ trống theo khung giờ, đặt trước và thanh toán chuyển khoản.</p></div>
      <div className="reservation-welcome-icon" aria-hidden="true">P</div>
    </section>
    <section className="reservation-card reservation-search">
      <form className="reservation-filter-form" onSubmit={search}>
        <label><span>Loại xe</span><select value={vehicleType} onChange={(event) => { setVehicleType(event.target.value); setSelectedSlot(""); }} aria-label="Loại xe"><option value="CAR">Ô tô</option><option value="MOTORBIKE">Xe máy</option><option value="MOTORELECTRIC">Xe máy điện</option></select></label>
        <label><span>Thời gian nhận xe</span><input type="datetime-local" value={start} onChange={(event) => { setStart(event.target.value); setSelectedSlot(""); }} required /></label>
        <label><span>Thời gian trả xe dự kiến</span><input type="datetime-local" value={end} onChange={(event) => { setEnd(event.target.value); setSelectedSlot(""); }} required /></label>
        <button className="reservation-button secondary-button" disabled={busy}>{busy ? "Đang kiểm tra..." : "⌕ Xem chỗ trống"}</button>
      </form>
    </section>
    <div className="reservation-layout customer-reservation-layout">
      <div className="reservation-main-column">
        <section className="reservation-card customer-slot-card">
          <div className="reservation-section-heading"><div><span className="reservation-eyebrow">SƠ ĐỒ BÃI XE</span><h2>Chọn một vị trí còn trống</h2><p>Chỗ đỏ đã có xe hoặc được đặt. Mỗi khu gồm tối đa 10 vị trí; mã hệ thống được ghi bên dưới mã khu.</p></div><span className="reservation-legend"><i /> Còn trống</span></div>
          {isAvailabilityLoading ? <div className="reservation-empty"><span aria-hidden="true">⌕</span><p>Đang cập nhật vị trí cho loại xe đã chọn...</p></div> : slots.length > 0 ? <div className="reservation-zone-grid">{groupParkingSlots(slots).map((zone) => <section className={`reservation-zone reservation-zone-${zone.index % 4}`} key={zone.label}>
            <header className="reservation-zone-heading"><strong>{zone.label}</strong><span>{zone.corner}</span><small>{zone.slots.filter((slot) => slot.available === true).length}/{zone.slots.length} chỗ trống</small></header>
            <div className="reservation-slot-grid">{zone.slots.map((slot) => {
              const code = String(slot.code ?? "");
              const location = parkingLocation(code);
              const available = slot.available === true;
              const selected = selectedSlot === code;
              return <button type="button" key={code} disabled={!available} aria-pressed={selected} aria-label={`${location.label}, ${code}, ${available ? "còn trống" : "đã được đặt"}`} className={`reservation-slot ${available ? "slot-available" : "slot-unavailable"}${selected ? " reservation-slot-selected" : ""}`} onClick={() => setSelectedSlot(code)}>
                <span className="reservation-slot-code">{location.position}</span><span className="reservation-slot-id">{code}</span><span className="reservation-slot-state">{selected ? "Đã chọn" : available ? "Còn trống" : "Đã đặt"}</span>
              </button>;
            })}</div>
          </section>)}</div> : <div className="reservation-empty"><span aria-hidden="true">⚠</span><p>{display(selectedAvailability.error) === "—" ? "Không có vị trí phù hợp hoặc chưa cấu hình sức chứa cho loại xe này." : display(selectedAvailability.error)}</p></div>}
          <p className="reservation-price-note">{availableSlots.length} vị trí còn trống trong khoảng thời gian đã chọn.</p>
        </section>
        <section className="reservation-card reservation-bookings">
          <div className="reservation-section-heading"><div><span className="reservation-eyebrow">CÁ NHÂN</span><h2>Đơn đặt chỗ của tôi</h2></div><span className="reservation-count">{bookings.length} đơn</span></div>
          {bookings.length > 0 ? <div className="reservation-table-wrap"><table className="reservation-table"><thead><tr><th>Mã đặt chỗ</th><th>Xe / vị trí</th><th>Thời gian</th><th>Thanh toán</th><th /></tr></thead><tbody>{bookings.map((booking) => <tr key={String(booking.id)}>
            <td><strong className="booking-code">{display(booking.bookingCode)}</strong><span className={`reservation-status ${booking.status === "CANCELLED" ? "status-cancelled" : ["CONFIRMED", "ARRIVED", "COMPLETED"].includes(String(booking.status)) ? "status-confirmed" : "status-pending"}`}>{display(booking.statusLabel ?? booking.status)}</span></td>
            <td><strong>{display(booking.plate ?? booking.licensePlate)}</strong><small>{vehicleLabels(String(booking.vehicleType))} · {parkingLocation(String(booking.slotCode ?? "")).label} ({display(booking.slotCode)})</small></td>
            <td><small>{formatDateTime(booking.startTime)}</small><small>đến {formatDateTime(booking.endTime)}</small></td>
            <td><strong>{formatPrice(booking.totalAmount)}</strong></td>
            <td>{booking.status === "PENDING_PAYMENT" && <div className="reservation-booking-actions">
              <button className="button button-primary" type="button" onClick={() => setPaymentReservation(booking)}>Thanh toán</button>
              <button className="button button-outline" type="button" onClick={() => void cancelBooking(booking.id)}>Hủy</button>
            </div>}</td>
          </tr>)}</tbody></table></div> : <div className="reservation-empty compact-empty"><span aria-hidden="true">▦</span><p>Bạn chưa có đơn đặt chỗ nào.</p></div>}
        </section>
      </div>
      <aside className="reservation-side-column">
        <section className="reservation-card reservation-summary">
          <span className="reservation-eyebrow">CHI PHÍ DỰ KIẾN</span><h2>Tóm tắt đặt chỗ</h2>
          <div className="reservation-summary-line"><span>Loại xe</span><strong>{vehicleLabels(vehicleType)}</strong></div>
          <div className="reservation-summary-line"><span>Thời gian</span><strong>{isAvailabilityLoading ? "Đang tính..." : `${durationLabel}${quotedHours > 0 && quotedHours !== Math.ceil(durationMinutes / 3_600_000) ? ` · tính ${quotedHours} giờ` : ""}`}</strong></div>
          <div className="reservation-summary-line"><span>Đơn giá theo bảng giá</span><strong>{isAvailabilityLoading ? "Đang lấy giá..." : quotedHourlyRate > 0 ? `${formatPrice(quotedHourlyRate)} / giờ` : "Chưa cấu hình"}</strong></div>
          <div className="reservation-summary-line"><span>Vị trí</span><strong>{selectedSlot ? `${parkingLocation(selectedSlot).label} (${selectedSlot})` : "Chưa chọn"}</strong></div>
          <div className="reservation-summary-total"><span>Tổng thanh toán</span><strong>{isAvailabilityLoading ? "Đang tính..." : formatPrice(selectedAvailability.estimatedAmount)}</strong></div>
          {!isAvailabilityLoading && quotedHours > 0 && quotedHourlyRate > 0 && <p className="reservation-price-note">Cách tính: {quotedHours} giờ × {formatPrice(quotedHourlyRate)}/giờ = {formatPrice(selectedAvailability.estimatedAmount)}. Giá lấy từ bảng giá admin; mỗi giờ lẻ được làm tròn lên.</p>}
          <form onSubmit={create} className="reservation-create-form">
            <label className="reservation-input-label" htmlFor="reservation-plate">Biển số xe</label>
            <input id="reservation-plate" value={plate} onChange={(event) => setPlate(event.target.value)} maxLength={20} placeholder="Ví dụ: 51A-123.45" required />
            <button className="reservation-button confirm-button" disabled={busy || isAvailabilityLoading || !selectedSlot || !availableSlots.some((slot) => slot.code === selectedSlot)}>{busy ? "Đang cập nhật..." : "✓ Đặt chỗ và thanh toán"}</button>
          </form>
        </section>
      </aside>
    </div>
    {paymentReservation && typeof document !== "undefined" && createPortal(<div className="customer-area">
      <div className="reservation-payment-overlay" onClick={() => setPaymentReservation(null)}>
      <section
        className="reservation-payment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-payment-title"
        aria-describedby="reservation-payment-description"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="reservation-payment-close-icon" type="button" aria-label="Đóng bảng thanh toán" onClick={() => setPaymentReservation(null)}>×</button>
        <div className="reservation-payment-heading">
          <span className="reservation-payment-icon" aria-hidden="true">▦</span>
          <div><span className="reservation-eyebrow">ĐẶT CHỖ THÀNH CÔNG</span><h2 id="reservation-payment-title">Thanh toán chuyển khoản</h2></div>
        </div>
        <p id="reservation-payment-description" className="reservation-payment-description">Quét mã QR và nhập chính xác nội dung chuyển khoản bên dưới. Nhân viên sẽ xác nhận sau khi kiểm tra giao dịch.</p>
        <dl className="reservation-payment-details">
          <div><dt>Tên người đặt</dt><dd>{display(paymentReservation.customerName)}</dd></div>
          <div><dt>Vị trí đỗ</dt><dd>{display(paymentReservation.slotCode)}</dd></div>
          <div><dt>Biển số xe</dt><dd>{display(paymentReservation.plate ?? paymentReservation.licensePlate)}</dd></div>
          <div><dt>Số tiền</dt><dd>{formatPrice(paymentReservation.totalAmount)}</dd></div>
          <div className="reservation-payment-transfer"><dt>Nội dung chuyển khoản</dt><dd>{display(paymentReservation.bookingCode)}</dd></div>
        </dl>
        <Image className="payment-qr" src="/api/backend/reservations/payment/qr" alt="Mã QR thanh toán đặt chỗ" width={200} height={200} unoptimized />
        <p className="reservation-payment-timeout">Bảng thanh toán sẽ tự đóng sau 2 phút.</p>
        <button className="reservation-button confirm-button" type="button" onClick={() => setPaymentReservation(null)}>Đóng</button>
      </section>
      </div>
    </div>, document.body)}
  </div>;
}

function localDateTimeInput(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60_000);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}T${two(date.getHours())}:${two(date.getMinutes())}`;
}

function ParkingPanel({ data, onAction }: { data: unknown; onAction: (url: string, method: string, body?: unknown) => Promise<boolean> }) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [checkinType, setCheckinType] = useState("CAR");
  const [checkinPlate, setCheckinPlate] = useState("");
  const [checkinSlot, setCheckinSlot] = useState("");
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const [platePhoto, setPlatePhoto] = useState<string | null>(null);
  const [plateOcrStatus, setPlateOcrStatus] = useState("");
  const [plateOcrProgress, setPlateOcrProgress] = useState(0);
  const [captureTarget, setCaptureTarget] = useState<"front" | "plate">("front");
  const [cameraDevices, setCameraDevices] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const ocrRequestRef = useRef(0);
  const payload = typeof data === "object" && data !== null ? data as DataRow : {};
  const sections = Array.isArray(payload.parkingSections)
    ? payload.parkingSections as DataRow[]
    : normalizeRows(data);
  const totalCapacity = sections.reduce((total, section) => {
    const stats = typeof section.stats === "object" && section.stats !== null ? section.stats as DataRow : {};
    return total + Number(stats.capacity ?? 0);
  }, 0);
  const usedCount = sections.reduce((total, section) => {
    const stats = typeof section.stats === "object" && section.stats !== null ? section.stats as DataRow : {};
    return total + Number(stats.used ?? 0);
  }, 0);
  const reservedCount = sections.reduce((total, section) => {
    const slots = Array.isArray(section.slots) ? section.slots as DataRow[] : [];
    return total + slots.filter((slot) => !slot.record && slot.reservation).length;
  }, 0);
  const overflowCount = sections.reduce((total, section) =>
    total + (Array.isArray(section.overflowRecords) ? section.overflowRecords.length : 0), 0);
  const availableCount = Math.max(0, totalCapacity - usedCount - reservedCount);
  const visibleSections: Array<DataRow & { visibleSlots: DataRow[] }> = sections.map((section): DataRow & { visibleSlots: DataRow[] } => {
    const slots = Array.isArray(section.slots) ? section.slots as DataRow[] : [];
    const filteredSlots = slots.filter((slot) => {
      const record = typeof slot.record === "object" && slot.record !== null ? slot.record as DataRow : null;
      const reservation = typeof slot.reservation === "object" && slot.reservation !== null ? slot.reservation as DataRow : null;
      const status = record ? "occupied" : reservation ? "reserved" : "available";
      const plate = String(record?.licensePlate ?? record?.plate ?? reservation?.licensePlate ?? reservation?.plate ?? "");
      const matchesStatus = statusFilter === "all" || statusFilter === status;
      const matchesQuery = !query || String(slot.code ?? "").toLocaleLowerCase().includes(query.toLocaleLowerCase())
        || plate.toLocaleLowerCase().includes(query.toLocaleLowerCase());
      return matchesStatus && matchesQuery;
    });
    return { ...section, visibleSlots: filteredSlots };
  }).filter((section) => (typeFilter === "ALL" || section.type === typeFilter)
    && (section.visibleSlots.length > 0
      || (Array.isArray(section.overflowRecords) && section.overflowRecords.length > 0)));
  const today = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  useEffect(() => {
    const video = videoRef.current;
    if (!cameraStream || !video) return;
    video.srcObject = cameraStream;
    void video.play().catch(() => setCameraError("Không thể phát hình ảnh từ camera. Vui lòng kiểm tra quyền truy cập."));
    return () => { video.srcObject = null; };
  }, [cameraStream]);
  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);
  async function startPlateCamera(target: "front" | "plate" = frontPhoto ? "plate" : "front", deviceId = selectedCameraId) {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Trình duyệt không hỗ trợ camera. Hãy dùng HTTPS hoặc localhost và nhập biển số thủ công.");
      return;
    }
    try {
      stopPlateCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      setCameraStream(stream);
      setCaptureTarget(target);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter((device) => device.kind === "videoinput");
        setCameraDevices(cameras.map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        })));
        const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
        if (activeDeviceId) setSelectedCameraId(activeDeviceId);
      } catch {
        setCameraError("Camera đang hoạt động nhưng không thể tải danh sách thiết bị camera.");
      }
    } catch (cause) {
      const cameraErrorName = cause instanceof DOMException ? cause.name : "";
      setCameraError(cameraErrorName === "NotAllowedError"
        ? "Bạn chưa cấp quyền camera. Hãy cho phép truy cập camera hoặc nhập biển số thủ công."
        : cameraErrorName === "NotFoundError"
          ? "Không tìm thấy camera trên thiết bị. Bạn vẫn có thể nhập biển số thủ công."
          : cameraErrorName === "OverconstrainedError"
            ? "Camera đã chọn không còn khả dụng. Hãy chọn thiết bị khác."
            : "Không mở được camera. Hãy kiểm tra thiết bị và quyền truy cập rồi thử lại.");
    }
  }
  function stopPlateCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  }

  async function recognizePlate(photo: string) {
    const requestId = ++ocrRequestRef.current;
    setPlateOcrStatus("Đang khởi tạo nhận diện...");
    setPlateOcrProgress(0);
    try {
      const sourceImage = new window.Image();
      sourceImage.src = photo;
      await sourceImage.decode();
      const processedCanvas = document.createElement("canvas");
      const upscale = Math.max(3, Math.ceil(180 / sourceImage.height));
      processedCanvas.width = sourceImage.width * upscale;
      processedCanvas.height = sourceImage.height * upscale;
      const processedContext = processedCanvas.getContext("2d", { willReadFrequently: true });
      if (!processedContext) throw new Error("Không thể tăng độ tương phản ảnh biển số.");
      processedContext.imageSmoothingEnabled = true;
      processedContext.imageSmoothingQuality = "high";
      processedContext.drawImage(sourceImage, 0, 0, processedCanvas.width, processedCanvas.height);
      const imageData = processedContext.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
      for (let index = 0; index < imageData.data.length; index += 4) {
        const gray = Math.round(imageData.data[index] * 0.299 + imageData.data[index + 1] * 0.587 + imageData.data[index + 2] * 0.114);
        const contrast = gray >= 155 ? 255 : 0;
        imageData.data[index] = contrast;
        imageData.data[index + 1] = contrast;
        imageData.data[index + 2] = contrast;
      }
      processedContext.putImageData(imageData, 0, 0);
      const processedPhoto = processedCanvas.toDataURL("image/png");
      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("eng", Tesseract.OEM.LSTM_ONLY, {
        logger: (message) => {
          if (requestId !== ocrRequestRef.current) return;
          setPlateOcrProgress(Math.round(message.progress * 100));
          if (message.status === "loading language traineddata") setPlateOcrStatus("Đang tải dữ liệu nhận diện biển số...");
          else if (message.status === "recognizing text") setPlateOcrStatus("Đang đọc ký tự trên biển số...");
          else if (message.status) setPlateOcrStatus("Đang chuẩn bị bộ nhận diện...");
        },
      });
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,
          tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-",
          user_defined_dpi: "300",
        });
        let recognizedText = "";
        let confidence = 0;
        let plate: string | null = null;
        for (const candidatePhoto of [processedPhoto, photo]) {
          const { data } = await worker.recognize(candidatePhoto);
          if (requestId !== ocrRequestRef.current) return;
          recognizedText = [recognizedText, data.text].filter(Boolean).join(" | ");
          confidence = Math.max(confidence, data.confidence);
          plate = normalizeVietnamesePlate(data.text);
          if (plate) break;
        }
        if (plate) {
          setCheckinPlate(plate);
          setPlateOcrStatus(`Đã điền ${plate} · độ tin cậy OCR ${Math.round(confidence)}%. Vui lòng đối chiếu ảnh trước khi xác nhận.`);
        } else {
          const rawText = recognizedText.replace(/\s+/g, " ").trim();
          setPlateOcrStatus(rawText
            ? `OCR đọc được “${rawText}” nhưng không khớp định dạng biển số. Hãy thử nhận diện lại hoặc nhập biển số bằng tay.`
            : "Chưa đọc được ký tự trên biển số. Hãy chụp gần, rõ hơn và đủ sáng, hoặc nhập biển số bằng tay.");
        }
      } finally {
        await worker.terminate();
      }
    } catch (cause) {
      console.error("Plate OCR failed", cause);
      if (requestId === ocrRequestRef.current) {
        setPlateOcrStatus("Không tải được bộ nhận diện. Kiểm tra kết nối Internet rồi thử chụp lại hoặc nhập biển số bằng tay.");
      }
    }
  }

  function captureVehiclePhoto() {
    const video = videoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera chưa sẵn sàng. Vui lòng đợi hình ảnh xuất hiện rồi chụp lại.");
      return;
    }
    const source = document.createElement("canvas");
    const maxWidth = 1280;
    const sourceScale = Math.min(1, maxWidth / video.videoWidth);
    source.width = Math.round(video.videoWidth * sourceScale);
    source.height = Math.round(video.videoHeight * sourceScale);
    const sourceContext = source.getContext("2d");
    if (!sourceContext) {
      setCameraError("Không thể xử lý ảnh chụp trên trình duyệt này.");
      return;
    }
    sourceContext.drawImage(video, 0, 0, source.width, source.height);
    const crop = captureTarget === "plate"
      ? {
          x: Math.round(source.width * 0.09),
          y: Math.round(source.height * 0.33),
          width: Math.round(source.width * 0.82),
          height: Math.round(source.height * 0.34),
        }
      : { x: 0, y: 0, width: source.width, height: source.height };
    const outputScale = captureTarget === "plate" ? 2 : 1;
    canvas.width = crop.width * outputScale;
    canvas.height = crop.height * outputScale;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Không thể xử lý ảnh chụp trên trình duyệt này.");
      return;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.82);
    if (captureTarget === "front") {
      setFrontPhoto(photo);
      if (platePhoto) stopPlateCamera();
      else setCaptureTarget("plate");
    } else {
      setPlatePhoto(photo);
      void recognizePlate(photo);
      if (frontPhoto) stopPlateCamera();
      else setCaptureTarget("front");
    }
    setCameraError("");
  }
  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckinBusy(true);
    const succeeded = await onAction("admin/parking/checkin", "POST", {
      plate: checkinPlate,
      type: checkinType,
      slotCode: checkinSlot,
      frontPhoto,
      platePhoto,
    });
    if (succeeded) {
      setCheckinPlate("");
      setCheckinSlot("");
      setFrontPhoto(null);
      setPlatePhoto(null);
      setPlateOcrStatus("");
      setPlateOcrProgress(0);
      ocrRequestRef.current += 1;
    }
    setCheckinBusy(false);
  }
  return <div className="parking-dashboard-view">
    <div className="parking-dashboard-heading">
      <div><h1>Sơ đồ bãi đỗ xe</h1><p>Trạng thái vị trí và lượt xe đang hoạt động trong hệ thống.</p></div>
      <div className="parking-dashboard-actions"><span className="parking-date">{today}</span>
        {overflowCount > 0 && <button className="parking-overflow-action" onClick={() => {
          if (window.confirm(`Check-out toàn bộ ${overflowCount} xe vé tháng vượt sức chứa? Xe cần thanh toán không bị ảnh hưởng.`)) {
            void onAction("admin/parking/checkout-overflow-monthly", "POST");
          }
        }}>Check-out xe miễn phí vượt chỗ <strong>{overflowCount}</strong></button>}
        <button className="button button-outline" onClick={() => router.push("/admin/parking/history")}>Lịch sử vào / ra</button>
      </div>
    </div>
    <section className="parking-summary" aria-label="Tổng quan bãi xe">
      <article className="parking-stat"><span className="parking-stat-icon cyan">▦</span><span className="parking-stat-label">Tổng sức chứa</span><strong>{totalCapacity}<small> vị trí</small></strong></article>
      <article className="parking-stat"><span className="parking-stat-icon rose">▰</span><span className="parking-stat-label">Đang trong bãi</span><strong>{usedCount}</strong></article>
      <article className="parking-stat"><span className="parking-stat-icon green">✓</span><span className="parking-stat-label">Vị trí còn trống</span><strong>{availableCount}</strong></article>
      <article className="parking-stat"><span className="parking-stat-icon violet">↘</span><span className="parking-stat-label">Xe vào hôm nay</span><strong>{display(payload.todayCheckIns ?? 0)}</strong></article>
      <article className="parking-stat"><span className="parking-stat-icon amber">₫</span><span className="parking-stat-label">Doanh thu hôm nay</span><strong>{formatPrice(payload.todayRevenue ?? 0)}</strong></article>
    </section>
    <details className="parking-checkin" onToggle={(event) => { if (!event.currentTarget.open) stopPlateCamera(); }}>
      <summary><span><strong>Tiếp nhận phương tiện</strong><small>Check-in xe vào bãi</small></span><span className="parking-add">+ Check-in xe</span></summary>
      <form className="data-form" onSubmit={checkIn}>
        <label className="field">Loại xe<select value={checkinType} onChange={(event) => setCheckinType(event.target.value)}><option value="CAR">Ô tô</option><option value="MOTORBIKE">Xe máy</option><option value="MOTORELECTRIC">Xe máy điện</option></select></label>
        <label className="field">Biển số xe<input value={checkinPlate} onChange={(event) => { ocrRequestRef.current += 1; if (platePhoto) { setPlateOcrStatus("Đã ưu tiên nội dung bạn nhập. Vui lòng kiểm tra trước khi xác nhận."); setPlateOcrProgress(0); } setCheckinPlate(event.target.value); }} placeholder="Ví dụ: 51A-123.45" maxLength={20} required /></label>
        <label className="field">Vị trí<select value={checkinSlot} onChange={(event) => setCheckinSlot(event.target.value)}><option value="">Tự động chọn vị trí</option>{sections.filter((section) => section.type === checkinType).flatMap((section) => (Array.isArray(section.slots) ? section.slots as DataRow[] : []).filter((slot) => !slot.record && !slot.reservation).map((slot) => <option key={String(slot.code)} value={String(slot.code)}>{parkingLocation(String(slot.code)).label} ({String(slot.code)})</option>))}</select></label>
        <button className="button button-primary" disabled={checkinBusy}>{checkinBusy ? "Đang tiếp nhận..." : "Xác nhận xe vào"}</button>
      </form>
      <section className="plate-capture" aria-label="Chụp ảnh biển số xe">
        <div className="plate-capture-heading"><div><strong>Ảnh đầu xe và biển số</strong><small>Chụp hai góc bằng camera đã chọn để đối chiếu trước khi xác nhận check-in.</small></div>
          {!cameraStream && <button className="button button-outline" type="button" onClick={() => void startPlateCamera()}>{frontPhoto || platePhoto ? "Chụp ảnh còn thiếu / chụp lại" : "◎ Mở camera"}</button>}
        </div>
        {cameraError && <p className="plate-capture-error" role="alert">{cameraError}</p>}
        {cameraStream && <div className="plate-camera-view">
          {cameraDevices.length > 1 && <label className="plate-camera-select">Chọn camera hướng ra xe<select aria-label="Chọn camera" value={selectedCameraId} onChange={(event) => { const deviceId = event.target.value; setSelectedCameraId(deviceId); void startPlateCamera(captureTarget, deviceId); }}>{cameraDevices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></label>}
          <video ref={videoRef} autoPlay muted playsInline aria-label="Hình ảnh camera đang phát" />
          <div className="plate-camera-guide" aria-hidden="true"><span>{captureTarget === "front" ? "Căn toàn bộ phần đầu xe vào khung hình" : "Đưa biển số xe vào khung hình"}</span></div>
          <div className="plate-camera-actions"><button className="button button-primary" type="button" onClick={captureVehiclePhoto}>Chụp {captureTarget === "front" ? "đầu xe" : "biển số"}</button><button className="button button-outline" type="button" onClick={stopPlateCamera}>Đóng camera</button></div>
        </div>}
        <div className="plate-photo-grid">
          <article className={`plate-photo-card${frontPhoto ? " has-photo" : ""}`}>
            <strong>1. Toàn đầu xe</strong>
            {frontPhoto ? <Image src={frontPhoto} alt="Ảnh toàn bộ phần đầu xe" width={640} height={360} unoptimized /> : <span className="plate-photo-empty">Chưa chụp ảnh đầu xe</span>}
            <button type="button" onClick={() => void startPlateCamera("front")}>{frontPhoto ? "Chụp lại đầu xe" : "Chụp đầu xe"}</button>
            {frontPhoto && <button className="plate-photo-remove" type="button" onClick={() => setFrontPhoto(null)}>Xóa ảnh</button>}
          </article>
          <article className={`plate-photo-card${platePhoto ? " has-photo" : ""}`}>
            <strong>2. Cận cảnh biển số</strong>
            {platePhoto ? <Image src={platePhoto} alt="Ảnh cận cảnh biển số xe" width={640} height={360} unoptimized /> : <span className="plate-photo-empty">Chưa chụp ảnh biển số</span>}
            <button type="button" onClick={() => void startPlateCamera("plate")}>{platePhoto ? "Chụp lại biển số" : "Chụp biển số"}</button>
            {platePhoto && <><button type="button" onClick={() => void recognizePlate(platePhoto)}>Nhận diện lại biển số</button><button className="plate-photo-remove" type="button" onClick={() => { ocrRequestRef.current += 1; setPlatePhoto(null); setPlateOcrStatus(""); setPlateOcrProgress(0); }}>Xóa ảnh</button></>}
          </article>
        </div>
        {plateOcrStatus && <div className="plate-ocr-status" role="status" aria-live="polite">
          <span>{plateOcrStatus}</span>
          {plateOcrStatus.startsWith("Đang") && <><progress max={100} value={plateOcrProgress} /><small>{plateOcrProgress}%</small></>}
        </div>}
        <p className="plate-capture-note">OCR tự điền sau khi chụp cận biển số; nhân viên cần kiểm tra rồi mới xác nhận xe vào. Ảnh được xử lý trong trình duyệt, không gửi lên máy chủ; lần đầu cần Internet để tải bộ nhận diện.</p>
        <canvas ref={cameraCanvasRef} className="plate-camera-canvas" aria-hidden="true" />
      </section>
      <p className="hint">Hệ thống tự kiểm tra vé tháng và vị trí hợp lệ trước khi tiếp nhận xe.</p>
    </details>
    <section className="parking-toolbar" aria-label="Lọc sơ đồ bãi xe">
      <div className="parking-toolbar-title"><span className="parking-map-icon">▦</span><div><h2>Sơ đồ vị trí</h2><p>Dữ liệu trực tiếp từ lượt gửi xe và bảng giá</p></div></div>
      <div className="parking-toolbar-controls">
        <label className="parking-filter-select"><span className="sr-only">Lọc theo loại xe</span><select aria-label="Lọc theo loại xe" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="ALL">Tất cả loại xe</option><option value="CAR">Ô tô</option><option value="MOTORBIKE">Xe máy</option><option value="MOTORELECTRIC">Xe máy điện</option></select></label>
        <label className="parking-search"><span aria-hidden="true">⌕</span><input aria-label="Tìm biển số hoặc vị trí" type="search" placeholder="Tìm biển số, vị trí..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="parking-status-filters" role="group" aria-label="Lọc trạng thái">
          {[["all", "Tất cả"], ["occupied", "Có xe"], ["reserved", "Đã đặt"], ["available", "Còn trống"]].map(([value, label]) => <button type="button" className={statusFilter === value ? "active" : ""} key={value} onClick={() => setStatusFilter(value)}>{label}</button>)}
        </div>
      </div>
    </section>
    <section className="parking-map-view" aria-label="Sơ đồ vị trí bãi xe">
      <div className="parking-legend"><span><i className="occupied-dot" />Đang có xe</span><span><i className="reserved-dot" />Đã được đặt</span><span><i className="available-dot" />Còn trống</span><span>{reservedCount} vị trí đã đặt</span></div>
    {visibleSections.map((section, index) => {
      const stats = typeof section.stats === "object" && section.stats !== null ? section.stats as DataRow : {};
      const overflow = Array.isArray(section.overflowRecords) ? section.overflowRecords as DataRow[] : [];
      const visibleSlots = section.visibleSlots;
      const type = String(section.type ?? "");
      const icon = type === "CAR" ? "▰" : type === "MOTORELECTRIC" ? "ϟ" : "◉";
      return <section className="parking-map-section" key={String(section.type ?? index)}>
        <header className="parking-map-section-heading"><div className={`parking-type-icon ${type.toLowerCase()}`}>{icon}</div><div className="parking-type-title"><h3>{display(section.typeLabel ?? section.type)}</h3><span>Sức chứa {display(stats.capacity)} vị trí</span></div><div className="parking-occupancy"><strong>{display(stats.used)}</strong><span>/</span><span>{display(stats.capacity)}</span><small>đang đỗ</small></div></header>
        <div className="admin-parking-zone-grid">{groupParkingSlots(visibleSlots).map((zone) => <section className={`admin-parking-zone admin-parking-zone-${zone.index % 4}`} key={zone.label}>
          <header><strong>{zone.label}</strong><span>{zone.corner}</span><small>{zone.slots.length} vị trí</small></header>
          <div className="parking-grid">{zone.slots.map((slot) => {
            const record = typeof slot.record === "object" && slot.record !== null ? slot.record as DataRow : null;
            const reserved = typeof slot.reservation === "object" && slot.reservation !== null ? slot.reservation as DataRow : null;
            const className = record ? "parking-cell occupied" : reserved ? "parking-cell reserved" : "parking-cell available";
            const plate = record?.licensePlate ?? record?.plate ?? reserved?.licensePlate ?? reserved?.plate;
            const location = parkingLocation(String(slot.code ?? ""));
            return <div className={className} key={String(slot.code)}><span className="parking-slot-code">{location.position} · {display(slot.code)}</span>{record ? <strong>{display(plate)}</strong> : reserved ? <strong>{display(plate)}</strong> : <strong className="parking-empty-label">Còn trống</strong>}{reserved && <small>Đã đặt · {formatDateTime(reserved.startTime)}</small>}{record && <small>{record.monthlyTicket === true ? "Vé tháng" : `Vào bãi · ${formatDateTime(record.checkIn)}`}</small>}{!record && !reserved && <button className="parking-slot-select" type="button" onClick={() => {
              setCheckinType(type);
              setCheckinSlot(String(slot.code ?? ""));
              setCheckinPlate("");
              const checkin = document.querySelector<HTMLDetailsElement>(".parking-checkin");
              if (checkin) checkin.open = true;
              checkin?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>+ Nhận xe</button>}{reserved && <button className="parking-slot-select" type="button" onClick={() => {
              setCheckinType(type);
              setCheckinSlot(String(slot.code ?? ""));
              setCheckinPlate(String(plate ?? ""));
              const checkin = document.querySelector<HTMLDetailsElement>(".parking-checkin");
              if (checkin) checkin.open = true;
              checkin?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>+ Nhận xe</button>}{record && <button className="button button-outline" onClick={() => {
              if (record.monthlyTicket === true) void onAction(`admin/parking/checkout/${record.id}`, "POST", {});
              else router.push(`/admin/parking/checkout/${record.id}`);
            }}>Check-out</button>}</div>;
          })}</div>
        </section>)}</div>
        {overflow.length > 0 && <><h3>Xe vé tháng vượt sức chứa</h3><DataTable rows={overflow} /></>}
      </section>;
    })}
    {visibleSections.length === 0 && <p className="parking-no-results">Không tìm thấy vị trí phù hợp.</p>}
    </section>
  </div>;
}

function ReservationAdminPanel({ rows, onAction }: { rows: DataRow[]; onAction: (url: string, method: string, body?: unknown) => Promise<boolean> }) {
  return <div className="reservation-admin-list">{rows.map((row) => {
    const status = String(row.status ?? "");
    const statusLabels: Record<string, string> = {
      PENDING_PAYMENT: "Chờ thanh toán",
      CONFIRMED: "Đã xác nhận",
      ARRIVED: "Đã đến",
      COMPLETED: "Hoàn thành",
      CANCELLED: "Đã hủy",
    };
    return <article className="panel reservation-admin-card" key={String(row.id)}>
      <header className="reservation-admin-card-heading">
        <div><span>MÃ ĐẶT CHỖ</span><h2>{display(row.bookingCode)}</h2></div>
        <span className={`reservation-admin-status reservation-admin-status-${status.toLowerCase()}`}>{display(row.statusLabel ?? statusLabels[status] ?? status)}</span>
      </header>
      <dl className="reservation-admin-details">
        <div><dt>Khách hàng</dt><dd>{display(row.customerName)}{Boolean(row.customerUsername) && <small>@{display(row.customerUsername)}</small>}</dd></div>
        <div><dt>Xe</dt><dd>{display(row.plate)}<small>{vehicleLabels(String(row.vehicleType ?? ""))}</small></dd></div>
        <div><dt>Vị trí đỗ</dt><dd>{display(row.slotCode)}</dd></div>
        <div><dt>Thời gian nhận xe</dt><dd>{formatDateTime(row.startTime)}</dd></div>
        <div><dt>Thời gian trả xe</dt><dd>{formatDateTime(row.endTime)}</dd></div>
        <div><dt>Giá theo giờ</dt><dd>{formatPrice(row.hourlyRate)}</dd></div>
        <div><dt>Tổng thanh toán</dt><dd className="reservation-admin-total">{formatPrice(row.totalAmount)}</dd></div>
        <div><dt>Ngày tạo đơn</dt><dd>{formatDateTime(row.createdAt)}</dd></div>
      </dl>
      {status === "PENDING_PAYMENT" && <div className="reservation-admin-payment">
        <label className="check-field"><input type="checkbox" id={`verified-${row.id}`} /> Đã đối chiếu giao dịch ngân hàng</label>
        <button className="button button-primary" onClick={() => {
          const checkbox = document.getElementById(`verified-${row.id}`) as HTMLInputElement | null;
          if (checkbox?.checked) void onAction(`admin/reservations/${row.id}/confirm-payment`, "POST", { paymentVerified: true });
        }}>Xác nhận thanh toán</button>
      </div>}
    </article>;
  })}</div>;
}

function PricingEditor({ rows, onSave }: { rows: DataRow[]; onSave: (url: string, method: string, body?: unknown) => Promise<boolean> }) {
  return <div className="panel-grid">{rows.map((row) => <section className="panel" key={String(row.id)}><h2>{display(row.vehicleTypeLabel ?? row.vehicleType)}</h2><RecordForm fields={[
    { name: "turnPrice", label: "Giá lượt", type: "number", required: true, defaultValue: String(row.turnPrice ?? 0) },
    { name: "monthPrice", label: "Giá vé tháng", type: "number", required: true, defaultValue: String(row.monthPrice ?? 0) },
    { name: "reservationHourlyPrice", label: "Giá đặt chỗ theo giờ", type: "number", required: true, defaultValue: String(row.reservationHourlyPrice ?? 0) },
    { name: "capacity", label: "Sức chứa", type: "number", required: true, defaultValue: String(row.capacity ?? 0) },
  ]} submitLabel="Lưu bảng giá" onSubmit={(values) => onSave(`admin/pricing/${row.id}`, "PUT", values)} /></section>)}</div>;
}

function ParkingPayment({ route, onError, onMessage }: { route: string; onError: (message: string) => void; onMessage: (message: string) => void }) {
  const router = useRouter();
  const id = route.split("/").at(-1);
  const [quote, setQuote] = useState<DataRow | null>(null);
  const [method, setMethod] = useState("QR");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prepaidCheckoutStatus, setPrepaidCheckoutStatus] = useState<"idle" | "processing" | "complete" | "error">("idle");
  const autoCheckoutRequestRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<DataRow>(`admin/parking/checkout/${id}/quote`, "POST")
      .then(setQuote)
      .catch((cause: unknown) => onError(cause instanceof Error ? cause.message : "Không tải được thông tin thanh toán."));
  }, [id, onError]);

  const autoCheckoutPrepaidReservation = useCallback(async () => {
    if (!id) return;
    autoCheckoutRequestRef.current = id;
    setPrepaidCheckoutStatus("processing");
    try {
      await api(`admin/parking/checkout/${id}`, "POST");
      setPrepaidCheckoutStatus("complete");
      onMessage("Đặt chỗ đã thanh toán trước; hệ thống tự động xác nhận xe ra, không thu thêm.");
      router.replace("/admin");
    } catch (cause) {
      autoCheckoutRequestRef.current = null;
      setPrepaidCheckoutStatus("error");
      onError(cause instanceof Error ? cause.message : "Không tự động xác nhận được xe ra.");
    }
  }, [id, onError, onMessage, router]);

  useEffect(() => {
    if (!id || quote?.prepaidReservation !== true || Number(quote.amount) !== 0
      || autoCheckoutRequestRef.current === id) return;
    void autoCheckoutPrepaidReservation();
  }, [id, quote, autoCheckoutPrepaidReservation]);

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const prepaidReservation = quote?.prepaidReservation === true;
    const needsPayment = !prepaidReservation || Number(quote?.amount) > 0;
    const alreadyPaid = method === "ALREADY_PAID";
    if (needsPayment && !alreadyPaid && !verified) return;
    setBusy(true);
    try {
      const body = needsPayment ? { paymentMethod: method, paymentVerified: alreadyPaid || verified } : {};
      await api(`admin/parking/checkout/${id}`, "POST", body);
      onMessage(prepaidReservation && !needsPayment
        ? "Đặt chỗ đã thanh toán trước; đã cho xe ra mà không thu thêm."
        : alreadyPaid
          ? "Đã ghi nhận khoản thanh toán trước đó và check-out xe."
          : "Đã ghi nhận thanh toán và check-out xe.");
      router.replace("/admin");
    } catch (cause) { onError(cause instanceof Error ? cause.message : "Không hoàn tất được thanh toán."); }
    finally { setBusy(false); }
  }
  const prepaidReservation = quote?.prepaidReservation === true;
  const photos = typeof quote?.photos === "object" && quote.photos !== null ? quote.photos as DataRow : {};
  const extraHours = Number(quote?.extraHours) || 0;
  const needsPayment = !prepaidReservation || Number(quote?.amount) > 0;
  const alreadyPaid = method === "ALREADY_PAID";
  return <section className="panel"><h2>{prepaidReservation ? "Trả xe đặt chỗ online" : "Thanh toán lượt xe"}</h2>{quote ? <>
    <p>Biển số: {display((quote.record as DataRow | undefined)?.plate)} · Vị trí: {display((quote.record as DataRow | undefined)?.slotCode)}</p>
    <section className="checkout-vehicle-photos" aria-label="Ảnh chụp xe lúc check-in">
      <h3>Ảnh chụp lúc xe vào bãi</h3>
      <div className="checkout-vehicle-photo-grid">
        {(["front", "plate"] as const).map((kind) => {
          const hasPhoto = photos[kind] === true;
          const label = kind === "front" ? "Toàn đầu xe" : "Cận cảnh biển số";
          return <article className="checkout-vehicle-photo" key={kind}>
            <strong>{label}</strong>
            {hasPhoto && id
              ? <Image src={`/api/backend/admin/parking/${id}/photos/${kind}`} alt={`Ảnh ${label.toLocaleLowerCase("vi")} chụp lúc check-in`} width={640} height={360} unoptimized />
              : <p>Không có ảnh được lưu lúc check-in.</p>}
          </article>;
        })}
      </div>
    </section>
    {prepaidReservation && <div className="reservation-checkout-notice">
      <strong>Đơn {display(quote.bookingCode)} đã thanh toán trước</strong>
      <span>Thời hạn đặt chỗ đến {formatDateTime(quote.reservedUntil)}.</span>
      {extraHours > 0
        ? <span>Xe trả trễ {extraHours} giờ; phụ thu {formatPrice(quote.hourlyRate)} mỗi giờ.</span>
        : <span>Trả xe đúng giờ hoặc sớm hơn sẽ không phát sinh phí.</span>}
    </div>}
    <p>Số tiền cần thanh toán: <strong>{formatPrice(quote.amount)}</strong></p>
    {prepaidReservation && Number(quote.amount) === 0 ? <div className="prepaid-auto-checkout" role="status" aria-live="polite">
      {prepaidCheckoutStatus === "processing" && <p>Đặt chỗ đã được thanh toán. Đang tự động xác nhận xe ra...</p>}
      {prepaidCheckoutStatus === "complete" && <p>Xe đã được xác nhận ra bãi. Không cần thanh toán thêm.</p>}
      {prepaidCheckoutStatus === "error" && <><p>Chưa xác nhận được xe ra. Vui lòng thử lại.</p><button className="button button-primary" type="button" onClick={() => void autoCheckoutPrepaidReservation()}>Thử xác nhận lại</button></>}
      {prepaidCheckoutStatus === "complete" && <button className="button button-outline" type="button" onClick={() => router.push("/admin/parking")}>Quay lại bãi xe</button>}
    </div> : <form className="data-form" onSubmit={confirm}>
      {needsPayment ? <>
        <label className="field">Phương thức thanh toán<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="QR">Chuyển khoản QR</option><option value="CASH">Tiền mặt</option><option value="CARD">Thẻ tín dụng qua POS</option><option value="ALREADY_PAID">Đã thanh toán rồi</option></select></label>
        {method === "QR" && <Image className="payment-qr" src="/api/backend/admin/parking/payment/qr" alt="Mã QR thanh toán" width={280} height={280} unoptimized />}
        {alreadyPaid
          ? <p className="checkout-already-paid-note">Ghi nhận khoản tiền đã được thanh toán trước đó; không cần xác nhận thanh toán thêm.</p>
          : <label className="check-field"><input type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} /> Đã xác nhận hoàn tất thanh toán</label>}
      </> : <p>Đơn đặt chỗ đã được thanh toán; không cần thu thêm tiền.</p>}
      <button className="button button-primary" disabled={busy || (needsPayment && !alreadyPaid && !verified)}>{busy ? "Đang xử lý..." : needsPayment ? "Xác nhận thanh toán và cho xe ra" : "Cho xe ra (không thu thêm)"}</button>
    </form>}
  </> : <p>Đang tải báo giá...</p>}</section>;
}

function SupportInbox({ rows, onReload }: { rows: DataRow[]; onReload: () => void }) {
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<DataRow[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadTotal = rows.reduce((total, row) => total + (Number(row.unreadCount) || 0), 0);
  const filteredRows = rows.filter((row) => {
    const name = String(row.username ?? row.customerUsername ?? row.name ?? "");
    const label = String(row.displayName ?? name);
    return `${label} ${name} ${display(row.lastMessage)}`.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi"));
  });
  const lastMessageKey = messages.length ? String(messages[messages.length - 1].id ?? messages.length) : "";

  const loadMessages = useCallback(async (name: string) => {
    setUsername(name);
    try {
      setMessages(normalizeRows(await api(`admin/support/conversations/${encodeURIComponent(name)}/messages`)));
      const selected = rows.find((row) => String(row.username ?? row.customerUsername ?? row.name ?? "") === name);
      setBlocked(selected?.blocked === true);
      setError("");
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không tải được cuộc trò chuyện."); }
  }, [rows]);

  useEffect(() => {
    if (!username) return;
    const stream = new EventSource("/api/backend/admin/support/stream");
    const timer = window.setInterval(() => void loadMessages(username), 3000);
    stream.onmessage = () => void loadMessages(username);
    return () => { stream.close(); window.clearInterval(timer); };
  }, [username, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [lastMessageKey, username]);

  function selectConversation(name: string) {
    if (name !== username) {
      setDraft("");
      setMessages([]);
      setBlocked(false);
      setError("");
      setAttachment(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
    void loadMessages(name);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username) return;
    if (attachment) {
      await uploadImage(event);
      return;
    }
    if (!draft.trim()) return;
    setSending(true);
    try {
      await api(`admin/support/conversations/${encodeURIComponent(username)}/messages`, "POST", { message: draft });
      setDraft("");
      await loadMessages(username);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được tin nhắn."); }
    finally { setSending(false); }
  }

  async function toggleBlocked() {
    if (!username) return;
    try {
      const result = await api<{ blocked: boolean }>(`admin/support/conversations/${encodeURIComponent(username)}/block`, "POST", { blocked: !blocked });
      setBlocked(result.blocked);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không đổi được trạng thái hỗ trợ."); }
  }
  async function removeMessage(id: unknown) {
    try {
      await api(`admin/support/conversations/${encodeURIComponent(username)}/messages/${id}`, "DELETE");
      await loadMessages(username);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không xóa được tin nhắn."); }
  }

  async function uploadImage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username || !attachment) return;
    const form = event.currentTarget;
    setSending(true);
    try {
      const csrf = await getCsrf();
      const response = await fetch(`/api/backend/legacy/admin/support/conversations/${encodeURIComponent(username)}/messages/image`, {
        method: "POST",
        credentials: "same-origin",
        headers: { [csrf.headerName]: csrf.token },
        body: new FormData(form),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(typeof result?.error === "string" ? result.error : `Gửi ảnh thất bại (${response.status})`);
      }
      form.reset();
      setDraft("");
      setAttachment(null);
      await loadMessages(username);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không gửi được ảnh.");
    } finally {
      setSending(false);
    }
  }
  return <div className="support-layout support-inbox-layout">
    <aside className="panel support-conversations">
      <header className="support-inbox-heading">
        <div><span className="support-panel-eyebrow">TRUNG TÂM HỖ TRỢ</span><h2>Hộp thư đến <small>{rows.length}</small></h2></div>
        <button className="support-refresh-button" type="button" onClick={onReload} aria-label="Làm mới danh sách" title="Làm mới danh sách">↻</button>
      </header>
      <label className="support-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm cuộc trò chuyện..." aria-label="Tìm cuộc trò chuyện" /></label>
      <div className="support-inbox-summary"><span>Tất cả tin nhắn</span><span>{unreadTotal > 0 ? `${unreadTotal} chưa đọc` : "Đã cập nhật"}</span></div>
      <div className="support-conversation-list">
        {!rows.length && <p className="support-empty">{error || "Chưa có cuộc trò chuyện nào."}</p>}
        {!!rows.length && !filteredRows.length && <p className="support-empty">Không tìm thấy cuộc trò chuyện phù hợp.</p>}
        {filteredRows.map((row, index) => {
          const name = String(row.username ?? row.customerUsername ?? row.name ?? "");
          const label = String(row.displayName ?? name);
          const unreadCount = Number(row.unreadCount) || 0;
          return <button className={`conversation-button${username === name ? " selected" : ""}`} key={name || index} onClick={() => selectConversation(name)} aria-current={username === name ? "true" : undefined}>
            <span className="conversation-avatar" aria-hidden="true">{label.trim().charAt(0).toUpperCase() || "K"}</span>
            <span className="conversation-preview"><strong>{label}</strong><span>{display(row.lastMessage)}</span><small>{display(row.lastMessageAt) === "—" ? "Chưa có tin nhắn" : display(row.lastMessageAt)}</small></span>
            {unreadCount > 0 && <span className="conversation-unread">{unreadCount}</span>}
          </button>;
        })}
      </div>
    </aside>

    <section className="panel support-conversation-panel">
      <header className="support-chat-heading">
        {username ? <>
          <div className="support-active-customer">
            <span className="conversation-avatar" aria-hidden="true">{username.trim().charAt(0).toUpperCase() || "K"}</span>
            <div><span className="support-panel-eyebrow">ĐANG TRAO ĐỔI</span><h2>{username}</h2><small>{blocked ? "Khách hàng hiện đang bị chặn nhắn tin" : "Cuộc trò chuyện với khách hàng"}</small></div>
          </div>
          <button className={`button support-block-button${blocked ? " is-unblocked" : ""}`} type="button" onClick={() => void toggleBlocked()}><span aria-hidden="true">{blocked ? "✓" : "⊘"}</span>{blocked ? "Mở khóa" : "Chặn khách hàng"}</button>
        </> : <div className="support-chat-placeholder"><span className="support-panel-eyebrow">HỘP THƯ HỖ TRỢ</span><h2>Chọn cuộc trò chuyện</h2><p>Chọn một khách hàng trong danh sách để xem và phản hồi tin nhắn.</p></div>}
      </header>
      {error && <p className="support-error" role="alert">{error}</p>}
      <div className="chat-messages support-message-list" aria-live="polite">
        {messages.length ? messages.map((item, index) => {
          const isAdminMessage = item.senderRole === "ADMIN";
          return <article className={`chat-message support-message${isAdminMessage ? " from-admin" : ""}`} key={String(item.id ?? index)}>
            <div className="support-message-meta"><strong>{isAdminMessage ? "Bạn" : display(item.senderName)}</strong><small>{display(item.createdAt)}</small></div>
            {display(item.message) !== "—" && <p>{display(item.message)}</p>}
            {typeof item.imageUrl === "string" && <Image src={`/api/backend${item.imageUrl.replace(/^\/api/, "")}`} alt="Ảnh đính kèm trong tin nhắn" width={240} height={180} unoptimized />}
            {item.id !== undefined && <button className="button button-danger support-delete-message" aria-label="Xóa tin nhắn" title="Xóa tin nhắn" onClick={() => void removeMessage(item.id)}>×</button>}
          </article>;
        }) : username
          ? <div className="support-empty-state"><span aria-hidden="true">✉</span><strong>Chưa có tin nhắn</strong><p>Bắt đầu cuộc trò chuyện bằng cách gửi phản hồi bên dưới.</p></div>
          : <div className="support-empty-state"><span aria-hidden="true">☏</span><strong>Hỗ trợ khách hàng</strong><p>Tin nhắn mới sẽ xuất hiện trong danh sách ở bên trái.</p></div>}
        <div ref={messagesEndRef} />
      </div>
      <form className="support-composer" onSubmit={send}>
        {attachment && <div className="support-attachment-chip"><span aria-hidden="true">▧</span><span title={attachment.name}>{attachment.name}</span><button type="button" onClick={() => { setAttachment(null); if (imageInputRef.current) imageInputRef.current.value = ""; }} aria-label="Bỏ ảnh đính kèm">×</button></div>}
        <div className="support-composer-row">
          <button className="support-attach-button" type="button" onClick={() => imageInputRef.current?.click()} disabled={!username || blocked || sending} aria-label="Đính kèm ảnh" title="Đính kèm ảnh">＋</button>
          <input ref={imageInputRef} className="support-file-input" type="file" name="image" accept="image/*" disabled={!username || blocked || sending} onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
          <textarea name="message" maxLength={2000} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} disabled={!username || blocked || sending} placeholder={blocked ? "Mở khóa khách hàng để gửi tin nhắn" : "Nhập tin nhắn..."} aria-label="Nội dung tin nhắn" />
          <button className="support-send-button" type="submit" disabled={!username || blocked || sending || (!draft.trim() && !attachment)} aria-label={sending ? "Đang gửi" : "Gửi tin nhắn"}>{sending ? "…" : "➤"}<span>{sending ? "Đang gửi" : "Gửi"}</span></button>
        </div>
        <small className="support-composer-hint">{blocked ? "Khách hàng đang bị chặn. Mở khóa để tiếp tục hỗ trợ." : "Enter để gửi · Shift + Enter để xuống dòng · Tối đa 2.000 ký tự"}</small>
      </form>
    </section>
  </div>;
}
