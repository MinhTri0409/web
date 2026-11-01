"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DataRow = Record<string, unknown>;

function normalizeRows(value: unknown): DataRow[] {
  if (Array.isArray(value)) return value.filter((row): row is DataRow => typeof row === "object" && row !== null);
  if (typeof value === "object" && value !== null) {
    const record = value as DataRow;
    for (const key of ["content", "items", "data", "results"]) {
      if (Array.isArray(record[key])) return normalizeRows(record[key]);
    }
  }
  return [];
}

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

async function getCsrf(): Promise<{ headerName: string; token: string }> {
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

export default function CustomerUpdates() {
  const [notifications, setNotifications] = useState<DataRow[]>([]);
  const [paymentToast, setPaymentToast] = useState<DataRow | null>(null);
  const [messages, setMessages] = useState<DataRow[]>([]);
  const [status, setStatus] = useState<DataRow>({});
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const shownPaymentNotifications = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    try {
      const [nextNotifications, nextMessages, nextStatus] = await Promise.all([
        api("customer/notifications"),
        api("customer/support/messages"),
        api("customer/support/status"),
      ]);
      const notificationRows = normalizeRows(nextNotifications);
      const paymentNotification = notificationRows.find((item) =>
        String(item.message ?? "").includes("đã được xác nhận thanh toán thành công"));
      if (paymentNotification) {
        const notificationId = String(paymentNotification.id ?? "");
        if (notificationId && !shownPaymentNotifications.current.has(notificationId)) {
          shownPaymentNotifications.current.add(notificationId);
          setPaymentToast(paymentNotification);
          window.dispatchEvent(new CustomEvent("parking-payment-confirmed", {
            detail: { message: String(paymentNotification.message ?? "") },
          }));
        }
      }
      setNotifications(notificationRows.filter((item) =>
        !String(item.message ?? "").includes("đã được xác nhận thanh toán thành công")));
      setMessages(normalizeRows(nextMessages));
      setStatus(typeof nextStatus === "object" && nextStatus !== null ? nextStatus as DataRow : {});
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể cập nhật tin nhắn.");
    }
  }, []);

  const acknowledge = useCallback(async (id: unknown) => {
    try { await api(`customer/notifications/${id}/acknowledge`, "POST"); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Không xác nhận được thông báo."); }
  }, [refresh]);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 2000);
    const stream = new EventSource("/api/backend/customer/support/stream");
    const notificationStream = new EventSource("/api/backend/customer/notifications/stream");
    stream.onmessage = () => void refresh();
    notificationStream.onmessage = () => void refresh();
    return () => { window.clearTimeout(initial); window.clearInterval(timer); stream.close(); notificationStream.close(); };
  }, [refresh]);

  useEffect(() => {
    if (!paymentToast) return;
    const timer = window.setTimeout(() => {
      setPaymentToast(null);
      void acknowledge(paymentToast.id);
    }, 10_000);
    return () => window.clearTimeout(timer);
  }, [paymentToast, acknowledge]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await api("customer/support/messages", "POST", { message: draft });
      setDraft("");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không gửi được tin nhắn."); }
  }

  return <aside className="customer-updates">
    {paymentToast && typeof document !== "undefined" && createPortal(
      <div className="payment-success-toast" role="status" aria-live="polite">
        <span className="payment-success-toast-icon" aria-hidden="true">✓</span>
        <span>{display(paymentToast.message)}</span>
        <button type="button" onClick={() => { setPaymentToast(null); void acknowledge(paymentToast.id); }} aria-label="Đóng thông báo thanh toán">×</button>
      </div>,
      document.body,
    )}
    {notifications.length > 0 && <div className="notification-list" aria-live="polite">{notifications.map((item) => <div className="notification" key={String(item.id)}><span>{display(item.message)}</span><button onClick={() => void acknowledge(item.id)} aria-label="Đánh dấu đã đọc">×</button></div>)}</div>}
    <button className="button button-primary chat-toggle" aria-expanded={open} aria-label={open ? "Đóng chat hỗ trợ" : "Mở chat hỗ trợ"} onClick={() => setOpen((value) => !value)}>
      <span className="chat-toggle-icon" aria-hidden="true">{open ? "×" : "✉"}</span><span>Chat hỗ trợ</span>{Number(status.unreadCount) > 0 && <span className="chat-unread-count">{display(status.unreadCount)}</span>}
    </button>
    {open && <section className="chat-panel" aria-label="Trò chuyện với hỗ trợ"><header><span className="chat-panel-mark" aria-hidden="true">P</span><div><strong>Hỗ trợ nhà xe</strong><span><i className={status.adminOnline ? "chat-online" : ""} />{status.adminOnline ? "Đang trực tuyến" : "Ngoại tuyến"}{status.chatBlocked ? " · Chat đang bị khóa" : ""}</span></div><button type="button" className="chat-panel-close" aria-label="Đóng chat hỗ trợ" onClick={() => setOpen(false)}>×</button></header><div className="chat-messages">{messages.map((item, index) => <p className={item.senderRole === "CUSTOMER" ? "chat-message-customer" : "chat-message-admin"} key={String(item.id ?? index)}><strong>{display(item.senderName)}</strong><span>{display(item.message ?? item.content)}</span><small>{display(item.createdAt)}</small></p>)}</div>{error && <p role="alert" className="chat-error">{error}</p>}<form onSubmit={send}><input aria-label="Tin nhắn hỗ trợ" placeholder="Nhập tin nhắn..." value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} disabled={Boolean(status.chatBlocked)} required /><button className="button button-primary" disabled={Boolean(status.chatBlocked) || !draft.trim()}>Gửi</button></form></section>}
  </aside>;
}
