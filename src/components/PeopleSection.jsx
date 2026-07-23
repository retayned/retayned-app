// ─── PeopleSection (Jul 2026, multi-stakeholder v1) ─────────────────────
// Owner-approved architecture: clients.contact stays THE profiled person
// every surface reads (sweep, chat, prep, MCP brief) — this section adds
// the other humans at the client WITHOUT moving that field. The primary
// card mirrors clients.contact/role; "Make primary" rewrites the mirror
// through clientsDb.update so downstream readers never change. Dimensions
// stay through the primary only (per-person profiles are deliberately out
// of scope — that's a parallel-scoring product decision, not a schema add).
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { clients as clientsDb } from "../lib/db";
import { C } from "../theme";

export default function PeopleSection({ user, client, editing, onPrimaryChange }) {
  const [people, setPeople] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", role: "", note: "" });
  const [confirmFor, setConfirmFor] = useState(null); // person pending make-primary
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;
    (async () => {
      setLoaded(false);
      const { data, error } = await supabase
        .from("client_stakeholders")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true });
      if (!live) return;
      if (error) { console.error("stakeholders load failed:", error); setErr("Couldn't load people."); }
      setPeople(data || []);
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [client.id]);

  // Authority derivation (specialist watch, Jul 2026): primaryhood's one
  // home is clients.contact. The is_primary flag is write-only
  // bookkeeping here — deriving the list from the NAME alone means a
  // drifted flag can never mislead this surface.
  const others = people.filter(p => p.name !== client.contact);

  async function addPerson() {
    const name = draft.name.trim();
    if (!name || busy) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase
      .from("client_stakeholders")
      .insert({ user_id: user.id, client_id: client.id, name, role: draft.role.trim() || null, note: draft.note.trim() || null, is_primary: false })
      .select().single();
    setBusy(false);
    if (error || !data) { console.error("stakeholder add failed:", error); setErr("Couldn't save. Try again."); return; }
    setPeople(p => [...p, data]);
    setDraft({ name: "", role: "", note: "" });
    setAdding(false);
  }

  async function removePerson(person) {
    const prev = people;
    setPeople(p => p.filter(x => x.id !== person.id));
    const { error } = await supabase.from("client_stakeholders").delete().eq("id", person.id);
    if (error) { console.error("stakeholder remove failed:", error); setPeople(prev); setErr("Couldn't remove. Try again."); }
  }

  async function makePrimary(person) {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      // 1. Preserve the outgoing primary as a stakeholder row so nobody
      //    is lost in the swap (only if they exist and have no row yet).
      const oldName = client.contact;
      if (oldName && !people.some(p => p.name === oldName)) {
        const { data: kept, error: keepErr } = await supabase
          .from("client_stakeholders")
          .insert({ user_id: user.id, client_id: client.id, name: oldName, role: client.role || null, is_primary: false })
          .select().single();
        if (keepErr || !kept) {
          // Specialist finding (Jul 2026): continuing past this failure
          // silently loses the outgoing contact from the people list the
          // moment the mirror overwrites them. Ruling taken: ABORT loud —
          // a failed swap that changed nothing beats a quiet data loss.
          console.error("old primary preserve failed — swap aborted:", keepErr);
          setErr(`Couldn't keep ${oldName} on the list, so nothing was changed. Try again.`);
          setBusy(false);
          setConfirmFor(null);
          return;
        }
        setPeople(p => [...p, kept]);
      }
      // 2. Flag flip on stakeholder rows (best-effort bookkeeping; the
      //    mirror below is the load-bearing write).
      const { error: demoteErr } = await supabase.from("client_stakeholders").update({ is_primary: false }).eq("client_id", client.id);
      if (demoteErr) console.warn("is_primary demote flip failed (bookkeeping only; display derives from clients.contact):", demoteErr);
      const { error: promoteErr } = await supabase.from("client_stakeholders").update({ is_primary: true }).eq("id", person.id);
      if (promoteErr) console.warn("is_primary promote flip failed (bookkeeping only; display derives from clients.contact):", promoteErr);
      // 3. THE MIRROR — the write every surface actually reads.
      const { data: updated, error } = await clientsDb.update(client.id, { contact: person.name, role: person.role || null });
      if (error || !updated) throw error || new Error("no row");
      setPeople(p => p.filter(x => x.id !== person.id).map(x => ({ ...x, is_primary: false })));
      if (onPrimaryChange) onPrimaryChange({ contact: person.name, role: person.role || null });
    } catch (e) {
      console.error("make primary failed:", e);
      setErr("Couldn't switch the primary. Nothing changed downstream.");
    }
    setBusy(false);
    setConfirmFor(null);
  }

  const rowStyle = { display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", border: "1px solid " + C.borderLight, borderRadius: 10, marginBottom: 6 };
  const initials = (n) => (n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid " + C.borderLight }}>
      {/* Mutations live inside the client's Edit Details mode (owner UI
          ruling, Jul 2026): view mode is read-only — the standalone
          always-on "+ Add person" link was off-style and bypassed the
          modal's single editing entry point. */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: C.textSec }}>People</span>
        {editing && (
          <button onClick={() => { setAdding(a => !a); setErr(null); }} style={{ fontSize: 12, fontWeight: 700, color: adding ? C.textSec : C.primary, background: "none", border: "1px solid " + (adding ? C.border : C.btnLight), borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
            {adding ? "Cancel" : "Add person"}
          </button>
        )}
      </div>

      {/* The primary — mirrors clients.contact; the one profiled person. */}
      <div style={{ ...rowStyle, border: "1px solid " + C.btnLight, background: C.primaryGhost }}>
        <div style={{ width: 30, height: 30, borderRadius: 999, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: C.btn }}>{initials(client.contact)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{client.contact || "No contact set"}</div>
          <div style={{ fontSize: 12, color: C.textSec }}>{client.role || "Role not set"}</div>
        </div>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.btn, background: "#fff", border: "1px solid " + C.btnLight, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap" }}>Primary · Rai reads through {client.contact ? client.contact.split(" ")[0] : "them"}</span>
      </div>

      {loaded && others.map(p => (
        <div key={p.id} style={rowStyle}>
          <div style={{ width: 30, height: 30, borderRadius: 999, background: C.surfaceWarm, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, color: C.textSec }}>{initials(p.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{p.name}</div>
            <div style={{ fontSize: 12, color: C.textSec }}>{[p.role, p.note].filter(Boolean).join(" · ") || "—"}</div>
          </div>
          <button onClick={() => setConfirmFor(p)} style={{ fontSize: 11.5, fontWeight: 700, color: C.textSec, background: "none", border: "1px solid " + C.border, borderRadius: 8, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit" }}>Make primary</button>
          {editing && <button onClick={() => removePerson(p)} aria-label={"Remove " + p.name} style={{ fontSize: 12, color: C.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>✕</button>}
        </div>
      ))}

      {editing && adding && (
        <div style={{ border: "1px dashed " + C.border, borderRadius: 10, padding: 10, marginBottom: 6 }}>
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Name" style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none", marginBottom: 6, boxSizing: "border-box" }} />
          <input value={draft.role} onChange={e => setDraft({ ...draft, role: e.target.value })} placeholder="Role (optional)" style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none", marginBottom: 6, boxSizing: "border-box" }} />
          <input value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} placeholder="Note (optional) — e.g. signs off on spend" style={{ width: "100%", padding: "8px 10px", border: "1px solid " + C.border, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
          <button onClick={addPerson} disabled={busy || !draft.name.trim()} style={{ width: "100%", padding: "9px 0", background: draft.name.trim() ? C.primary : C.border, color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: draft.name.trim() ? "pointer" : "default", fontFamily: "inherit" }}>Add person</button>
        </div>
      )}

      {confirmFor && (
        <div style={{ border: "1px solid " + C.warning, background: "#FBF6EA", borderRadius: 10, padding: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>
            Rai's read follows the primary contact. Switching to <b>{confirmFor.name}</b> means she starts learning this relationship through them — expect her briefs to lean toward new-relationship caution for a while. {client.contact ? client.contact + " stays on the list." : ""}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => makePrimary(confirmFor)} disabled={busy} style={{ flex: 1, padding: "8px 0", background: C.primary, color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{busy ? "Switching…" : "Make " + confirmFor.name.split(" ")[0] + " primary"}</button>
            <button onClick={() => setConfirmFor(null)} style={{ flex: 1, padding: "8px 0", background: "none", color: C.textSec, border: "1px solid " + C.border, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        </div>
      )}

      {err && <div style={{ fontSize: 12.5, color: C.danger, padding: "4px 2px" }}>{err}</div>}
      <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>Rai profiles the relationship through the primary. Others are context she can name, never people she guesses about.</div>
    </div>
  );
}
