// ── AgencyTeam (Jul 2026) ────────────────────────────────────────────
// The agency's people layer, in its right home: Settings → Team, right
// under Plan & Billing where someone who just paid $99 goes looking.
// Moved verbatim from WorkersPage — Workers is contractors (people you
// track); this is SEATS (people who log in: AMs with accounts, briefs,
// and assigned clients). Renders: the activation card (paid Agency, no
// org yet), the Seats card (invites, meter, roles), and Coverage
// (per-AM load + uncovered clients). Solo/trial accounts render nothing.

import { useState, useEffect } from "react";
import { C } from "../theme";
import { supabase } from "../lib/supabase";

export default function AgencyTeam({ app }) {
  const {
    org, orgRole, user, billing, orgLoading, refetchOrg,
    orgMembers, clientAssignments, clients, assignClient,
  } = app;

  const isOwnerRole = org && (orgRole === "owner");
  const isRoot = org && user && org.owner_user_id === user.id;
  const [seatMembers, setSeatMembers] = useState(null);
  const [seatInviteEmail, setSeatInviteEmail] = useState("");
  const [seatInviteLink, setSeatInviteLink] = useState(null);
  const [seatBusy, setSeatBusy] = useState(false);
  const loadSeats = async () => {
    if (!isOwnerRole) return;
    const { data } = await supabase
      .from("org_members")
      .select("id, user_id, invited_email, role, status, created_at")
      .eq("org_id", org.id)
      .in("status", ["invited", "active"])
      .order("created_at", { ascending: true });
    setSeatMembers(data || []);
  };
  useEffect(() => { loadSeats(); }, [org?.id, orgRole]);
  const callOrgFn = async (fn, body) => {
    const { data: sess } = await supabase.auth.getSession();
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.session?.access_token || ""}` },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out?.error || `${fn} failed (${res.status})`);
    return out;
  };
  const inviteSeat = async () => {
    const email = seatInviteEmail.trim().toLowerCase();
    if (!email || seatBusy) return;
    setSeatBusy(true); setSeatInviteLink(null);
    try {
      const out = await callOrgFn("org-invite", { email });
      setSeatInviteLink(out.invite_url);
      setSeatInviteEmail("");
      loadSeats();
    } catch (e) { alert(e.message); }
    setSeatBusy(false);
  };
  const removeSeat = async (memberUserId) => {
    if (!window.confirm("Remove this seat? Their assignments are released immediately.")) return;
    await supabase.rpc("rt_remove_seat", { p_org: org.id, p_member: memberUserId });
    loadSeats();
  };
  const revokeInvite = async (memberId) => {
    await supabase.from("org_members").update({ status: "removed", removed_at: new Date().toISOString() }).eq("id", memberId);
    loadSeats();
  };
  const setRole = async (memberUserId, role) => {
    const { error } = await supabase.rpc("rt_set_member_role", { p_org: org.id, p_member: memberUserId, p_role: role });
    if (error) alert(error.message);
    loadSeats();
  };
  const activeSeatCount = (seatMembers || []).filter(m => m.status === "active").length;

  const showAnything = (billing?.plan === "agency" && !org && !orgLoading) || (org && orgRole);
  if (!showAnything) return null;
  if (org && orgRole && orgRole !== "owner") {
    return (
      <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 6 }}>Team</div>
        <div style={{ fontSize: 13.5, color: C.text }}>You're a seat at <b>{org.name || "this agency"}</b> · role: {orgRole}. The owner manages seats and assignments.</div>
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 8 }}>
        {/* ── AGENCY ACTIVATION (Jul 2026). Paying for Agency
            removes the cap; the SEATS spine activates when an org
            exists. This card is the bridge: one field, one click,
            org created with the payer as owner, seats UI appears
            in place. Solo/trial accounts never see it. */}
        {billing?.plan === "agency" && !org && !orgLoading && (
          <AgencyActivationCard user={user} refetchOrg={refetchOrg} />
        )}
        {isOwnerRole && (
          <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "16px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted }}>Seats</div>
              <div style={{ fontSize: 12, color: C.textMuted }}>{activeSeatCount} of 5 included · extra seats $19/mo</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: (seatMembers || []).length ? 12 : 0 }}>
              <input
                value={seatInviteEmail}
                onChange={e => setSeatInviteEmail(e.target.value)}
                placeholder="teammate@agency.com"
                style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1px solid " + C.border, borderRadius: 10, fontFamily: "inherit", fontSize: 13, background: C.bg, color: C.text }}
              />
              <button onClick={inviteSeat} disabled={seatBusy} className="r-btn" data-tone="green" style={{ padding: "9px 16px", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: seatBusy ? 0.6 : 1 }}>
                Invite
              </button>
            </div>
            {seatInviteLink && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: C.primarySoft, border: "1px solid rgba(51,84,62,0.22)", borderRadius: 10, marginBottom: 12, fontSize: 12.5, color: C.text, flexWrap: "wrap" }}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{seatInviteLink}</span>
                <button onClick={() => { try { navigator.clipboard.writeText(seatInviteLink); } catch (_) {} }} style={{ background: "transparent", border: "none", color: C.primary, fontWeight: 600, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Copy link</button>
              </div>
            )}
            {(seatMembers || []).map(m => (
              <div key={m.id} className="rt-divider-inset" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 2px" }}>
                <span style={{ flex: 1, fontSize: 13, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{m.invited_email || m.user_id}</span>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: m.role === "owner" ? C.primary : C.textMuted }}>{m.status === "invited" ? "invited" : m.role}</span>
                {m.status === "invited" && (
                  <button onClick={() => revokeInvite(m.id)} style={{ background: "transparent", border: "none", color: "#A03422", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Revoke</button>
                )}
                {m.status === "active" && m.user_id !== org.owner_user_id && (
                  <>
                    {isRoot && (
                      <button onClick={() => setRole(m.user_id, m.role === "owner" ? "am" : "owner")} style={{ background: "transparent", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        {m.role === "owner" ? "Make AM" : "Make owner"}
                      </button>
                    )}
                    <button onClick={() => removeSeat(m.user_id)} style={{ background: "transparent", border: "none", color: "#A03422", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Remove</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── COVERAGE (Agency) — owner-only ─────────────────────
            Who covers what: per-AM load (count + revenue + share
            bar) and the clients nobody covers, with inline assign.
            Uncovered clients stay in the OWNER's sweep lane; covered
            clients get their AM's nightly sweep. */}
        {isOwnerRole && (() => {
          const ams = (orgMembers || []).filter(m => m.role === "am");
          if (ams.length === 0) return null;
          const assigns = clientAssignments || [];
          const byMember = {};
          for (const a of assigns) {
            if (!byMember[a.member_user_id]) byMember[a.member_user_id] = new Set();
            byMember[a.member_user_id].add(a.client_id);
          }
          const clientById = {};
          for (const c of clients) clientById[c.id] = c;
          const coveredIds = new Set(assigns.map(a => a.client_id));
          const uncovered = clients.filter(c => !coveredIds.has(c.id));
          const rows = ams.map(m => {
            const ids = [...(byMember[m.user_id] || [])].filter(id => clientById[id]);
            const revenue = ids.reduce((a, id) => a + (clientById[id].revenue || 0), 0);
            return { member: m, count: ids.length, revenue, names: ids.map(id => clientById[id].name) };
          });
          const maxRevenue = Math.max(1, ...rows.map(r => r.revenue));
          const shortName = (m) => ((m.invited_email || "") || m.user_id).split("@")[0];
          return (
            <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, boxShadow: "var(--rt-sh-card)", padding: "16px 18px", marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, color: C.textMuted }}>Coverage</div>
                <div style={{ fontSize: 12, color: uncovered.length ? "#8A6A2F" : C.textMuted }}>
                  {uncovered.length ? `${uncovered.length} client${uncovered.length === 1 ? "" : "s"} uncovered` : "every client covered"}
                </div>
              </div>
              {rows.map((r, i) => (
                <div key={r.member.user_id} className={i === rows.length - 1 && uncovered.length === 0 ? undefined : "rt-divider-inset"} style={{ padding: "9px 2px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ flex: 1, fontSize: 13, color: C.text, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }} title={r.names.join(", ")}>{shortName(r.member)}</span>
                    <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>{r.count} client{r.count === 1 ? "" : "s"}</span>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 76, textAlign: "right" }}>${r.revenue.toLocaleString()}/mo</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: C.borderLight, marginTop: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.round((r.revenue / maxRevenue) * 100)}%`, background: C.primary, borderRadius: 2 }} />
                  </div>
                </div>
              ))}
              {uncovered.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#8A6A2F", marginBottom: 6 }}>No coverage</div>
                  {uncovered.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 2px" }}>
                      <span style={{ flex: 1, fontSize: 13, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                      {c.revenue > 0 && <span style={{ fontSize: 11.5, color: C.textMuted, fontVariantNumeric: "tabular-nums" }}>${c.revenue.toLocaleString()}/mo</span>}
                      <select
                        defaultValue=""
                        onChange={async (e) => { const v = e.target.value; e.target.value = ""; if (v) await assignClient(c.id, v); }}
                        style={{ padding: "5px 8px", border: "1px solid " + C.border, borderRadius: 8, fontFamily: "inherit", fontSize: 11.5, background: C.bg, color: C.textSec, cursor: "pointer" }}
                      >
                        <option value="" disabled>Assign…</option>
                        {ams.map(m => <option key={m.user_id} value={m.user_id}>{shortName(m)}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}
    </div>
  );
}

// ── Agency activation (Jul 2026): creates the org row that lights up
// the seats spine. Owner needs no org_members row — useOrg resolves
// ownership from orgs.owner_user_id directly.
function AgencyActivationCard({ user, refetchOrg }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const createOrg = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true); setErr(null);
    const { error } = await supabase.from("orgs").insert({
      owner_user_id: user.id,
      name: trimmed,
      plan: "agency",
      seat_limit: 5,
    });
    if (error) { setErr(error.message || "Couldn't create your agency"); setBusy(false); return; }
    refetchOrg && refetchOrg();
  };
  return (
    <div style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 20px", marginBottom: 14, boxShadow: "var(--rt-sh-card)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#558B68" }}>Agency plan · active</div>
      <div style={{ fontSize: 16, fontWeight: 750, color: C.text, marginTop: 6 }}>Name your agency to unlock seats.</div>
      <div style={{ fontSize: 12.5, color: C.textSec, marginTop: 4, lineHeight: 1.5 }}>
        One step: your agency gets a name, you become its owner, and seat invites open up right here — 5 seats included.
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && createOrg()}
          placeholder="Your agency name"
          style={{ flex: "1 1 220px", padding: "9px 12px", borderRadius: 9, border: "1px solid " + C.border, fontFamily: "inherit", fontSize: 13.5, background: "#fff", color: C.text }}
        />
        <button
          onClick={createOrg}
          disabled={busy || !name.trim()}
          style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: C.primary, color: "#fff", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: busy || !name.trim() ? "default" : "pointer", opacity: busy || !name.trim() ? 0.6 : 1 }}
        >
          {busy ? "Creating…" : "Create agency"}
        </button>
      </div>
      {err && <div style={{ fontSize: 12, color: "#B91C1C", marginTop: 8 }}>{err}</div>}
    </div>
  );
}
