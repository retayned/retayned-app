// ============================================================
// WORKER DASHBOARD
// 2026-05-02
//
// Magic-link page for Workers. Token in URL is the credential.
// Mount at /w/:token.
//
// Calls Edge Functions:
//   - worker-magic-load (GET)     → loads tasks
//   - worker-task-complete (POST) → marks done/undone
// ============================================================

import { useEffect, useState } from "react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const C = {
  primary: "#33543E",
  primaryDeep: "#1C3224",
  btn: "#5B21B6",
  btnLight: "#EDE4FA",
  bg: "#FAFAF7",
  card: "#FFFFFF",
  surfaceWarm: "#F2EEE8",
  text: "#1E261F",
  textSec: "#6B6B66",
  textMuted: "#9A9A93",
  border: "#D8DFD8",
  borderLight: "#EFEFEA",
  danger: "#C4432B",
  success: "#2D8659",
};

export default function WorkerDashboard() {
  // Pull token from URL — supports both /w/{token} and ?token={token}
  const token = (() => {
    const m = window.location.pathname.match(/\/w\/([^/?#]+)/);
    if (m) return m[1];
    return new URLSearchParams(window.location.search).get("token") || null;
  })();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null); // { worker, operator, tasks }

  useEffect(() => {
    if (!token) { setError("No token in URL"); setLoading(false); return; }
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadTasks() {
    setLoading(true);
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/worker-magic-load?token=${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${SUPABASE_ANON}` },
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j.error || "Failed to load");
      setData(j);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function toggle(taskId, isDone) {
    // Optimistic update
    setData(d => ({
      ...d,
      tasks: d.tasks.map(t => t.id === taskId
        ? { ...t, is_done: isDone, worker_completed_at: isDone ? new Date().toISOString() : null }
        : t
      ),
    }));
    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/worker-task-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON}` },
        body: JSON.stringify({ token, task_id: taskId, done: isDone }),
      });
      if (!resp.ok) throw new Error("toggle failed");
    } catch (e) {
      console.error(e);
      // Roll back on failure
      setData(d => ({
        ...d,
        tasks: d.tasks.map(t => t.id === taskId
          ? { ...t, is_done: !isDone }
          : t
        ),
      }));
    }
  }

  if (loading) {
    return <ScreenWrap><div style={{ padding: 60, textAlign: "center", color: C.textMuted }}>Loading…</div></ScreenWrap>;
  }
  if (error) {
    return (
      <ScreenWrap>
        <div style={{ padding: "60px 30px", textAlign: "center" }}>
          <div style={{
            fontFamily: "'Fraunces', Georgia, serif",
            fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
            fontStyle: "italic",
            fontSize: 22,
            color: C.text,
            marginBottom: 8,
          }}>This link isn't valid anymore.</div>
          <div style={{ fontSize: 13, color: C.textMuted, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
            Magic links expire after 7 days. If you still need access, ask the person who sent it to assign a new task.
          </div>
        </div>
      </ScreenWrap>
    );
  }

  const { worker, operator, tasks } = data;
  const today = todayStr();
  const tomorrow = tomorrowStr();

  // Bucket tasks into Today / Tomorrow / Later (same logic as Operator side)
  const bucketOf = (t) => {
    if (t.is_recurring) return "today";
    if (!t.due_date) return "today";
    const d = String(t.due_date).slice(0, 10);
    if (d <= today) return "today";
    if (d === tomorrow) return "tomorrow";
    return "later";
  };
  const todayTasks = tasks.filter(t => bucketOf(t) === "today");
  const tomorrowTasks = tasks.filter(t => bucketOf(t) === "tomorrow");
  const laterTasks = tasks.filter(t => bucketOf(t) === "later");

  // Greeting
  const fromLine = operator.business_name
    ? `${operator.name} at ${operator.business_name}`
    : operator.name;

  return (
    <ScreenWrap>
      <div style={{
        padding: "28px 32px 20px",
        borderBottom: "1px solid " + C.borderLight,
        background: C.card,
      }}>
        <div style={{
          fontFamily: "'Fraunces', Georgia, serif",
          fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
          fontStyle: "italic",
          fontSize: 16,
          color: C.primary,
          marginBottom: 18,
          fontWeight: 400,
        }}>retayned</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em", margin: "0 0 6px" }}>Hey {worker.name.split(" ")[0]}.</h2>
        <div style={{ fontSize: 13.5, color: C.textMuted }}>
          <b style={{ fontWeight: 700, color: C.text }}>{fromLine}</b> needs help with these tasks. No login needed — just mark them done as you go.
        </div>
      </div>

      <div style={{ padding: "24px 32px 32px", background: C.bg }}>
        {tasks.length === 0 ? (
          <div style={{
            background: C.card,
            border: "1px dashed " + C.border,
            borderRadius: 12,
            padding: "28px 20px",
            textAlign: "center",
            fontFamily: "'Fraunces', Georgia, serif",
            fontVariationSettings: "'opsz' 96, 'SOFT' 50, 'WONK' 0",
            fontStyle: "italic",
            color: C.textMuted,
            fontSize: 14,
          }}>
            No tasks assigned to you right now.
          </div>
        ) : (
          <>
            {todayTasks.length > 0 && (
              <>
                <BucketLabel name="Today" dimmed={false} />
                <TaskList tasks={todayTasks} onToggle={toggle} />
              </>
            )}
            {tomorrowTasks.length > 0 && (
              <>
                <BucketLabel name="Tomorrow" dimmed={true} />
                <TaskList tasks={tomorrowTasks} onToggle={toggle} dimmed={true} />
              </>
            )}
            {laterTasks.length > 0 && (
              <>
                <BucketLabel name="Later" dimmed={true} />
                <TaskList tasks={laterTasks} onToggle={toggle} dimmed={true} />
              </>
            )}
          </>
        )}

        <div style={{
          marginTop: 22,
          padding: "16px 4px 0",
          borderTop: "1px solid " + C.borderLight,
          fontSize: 11.5,
          color: C.textMuted,
          lineHeight: 1.55,
        }}>
          Tasks here come from <b>{fromLine}</b>. This page is your private link — don't share it. The link expires after 7 days. Questions? Email {operator.name} directly.
        </div>
      </div>
    </ScreenWrap>
  );
}

function BucketLabel({ name, dimmed }) {
  return (
    <div style={{
      fontSize: 11,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: dimmed ? C.textMuted : C.text,
      fontWeight: 700,
      margin: "8px 4px 12px",
    }}>{name}</div>
  );
}

function TaskList({ tasks, onToggle, dimmed = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22, opacity: dimmed ? 0.78 : 1 }}>
      {tasks.map(t => (
        <TaskRow key={t.id} task={t} onToggle={onToggle} />
      ))}
    </div>
  );
}

function TaskRow({ task: t, onToggle }) {
  const isDone = !!t.is_done;
  return (
    <div style={{
      background: C.card,
      border: "1px solid " + C.borderLight,
      borderRadius: 12,
      padding: "14px 16px",
      display: "flex",
      alignItems: "flex-start",
      gap: 14,
    }}>
      <button
        onClick={() => onToggle(t.id, !isDone)}
        aria-label={isDone ? "mark incomplete" : "mark complete"}
        style={{
          width: 24, height: 24,
          marginTop: 1,
          border: isDone ? "2px solid " + C.success : "2px solid #C4C4BC",
          borderRadius: 6,
          background: isDone ? C.success : "#fff",
          display: "grid", placeItems: "center",
          flexShrink: 0,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {isDone && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15,
          fontWeight: 600,
          color: isDone ? C.textMuted : C.text,
          textDecoration: isDone ? "line-through" : "none",
          lineHeight: 1.3,
        }}>{t.text}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, flexWrap: "wrap" }}>
          {t.client_name ? (
            <span style={{ fontSize: 12.5, color: C.textSec }}>{t.client_name}</span>
          ) : (
            <span style={{ fontSize: 12.5, color: C.textMuted, fontStyle: "italic" }}>No client context shared</span>
          )}
          {t.is_recurring ? (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 9px", borderRadius: 999,
              fontSize: 11.5, fontWeight: 600,
              border: "1px solid " + C.borderLight,
              color: C.textMuted,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 100 8c2 0 4-1.33 6-4zm0 0c2 2.67 4 4 6 4a4 4 0 100-8c-2 0-4 1.33-6 4z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Recurring
            </span>
          ) : t.due_date ? (
            <DuePill dueDate={t.due_date} />
          ) : null}
          {isDone && t.worker_completed_at && (
            <span style={{ fontSize: 11.5, color: C.success, fontWeight: 600 }}>
              Done · {timeAgo(t.worker_completed_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DuePill({ dueDate }) {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const ds = String(dueDate).slice(0, 10);
  const isToday = ds === today;
  const isTomorrow = ds === tomorrow;
  const isOverdue = ds < today;
  const label = isOverdue
    ? (() => {
        const days = Math.round((new Date(today) - new Date(ds)) / 86400000);
        return days === 1 ? "1d late" : days + "d late";
      })()
    : isToday ? "Today"
    : isTomorrow ? "Tomorrow"
    : new Date(ds + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 999,
      fontSize: 11.5, fontWeight: 600,
      background: isOverdue ? "rgba(196,67,43,0.10)" : isToday ? C.surfaceWarm : "transparent",
      color: isOverdue ? C.danger : isToday ? C.text : C.textMuted,
      border: (isOverdue || isToday) ? "none" : "1px solid " + C.borderLight,
    }}>{label}</span>
  );
}

function ScreenWrap({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Manrope', system-ui, sans-serif", color: C.text }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 0 60px" }}>
        <div style={{
          background: C.card,
          border: "1px solid " + C.borderLight,
          borderRadius: 16,
          overflow: "hidden",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Day boundaries anchored to 2am local time.
// Between midnight and 2am, "today" still refers to yesterday's calendar date —
// matches the Operator side's day-rollover rule (tasks reset at 2am, not at 12am).
function todayStr() {
  const n = new Date();
  if (n.getHours() < 2) n.setDate(n.getDate() - 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function tomorrowStr() {
  const n = new Date();
  if (n.getHours() < 2) n.setDate(n.getDate() - 1);
  n.setDate(n.getDate() + 1);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}
