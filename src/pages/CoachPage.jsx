// AUTO-EXTRACTED from App.jsx (page === "coach" block) — body is
// verbatim; only the surrounding component shell + imports are generated.
import { Icon } from "../components/Icon";
import { RaiMarkdown } from "../components/RaiMarkdown";
import { C } from "../theme";

import { SpecialistGate } from "../components/Onboarding";
import RaiMessageActions from "../components/RaiMessageActions";

export default function CoachPage({ app }) {
  const {
    aiAttachments,
    clients,
    dataLoaded,
    setBrainDumpOpen,
    setOnboardingStep,
    aiEndRef,
    aiInput,
    aiMessages,
    aiStreaming,
    aiTyping,
    aiUserRef,
    handleFilePick,
    sendAi,
    setAiAttachments,
    setAiInput,
    user,
  } = app;
  // ─── Specialist's gate — Rai won't watch an empty roster. The gate
  // IS the personality: a retention specialist with standards. Opens
  // the roster builder or a Brain Dump; lifts the moment a client exists.
  if (dataLoaded && clients.length === 0) {
    return (
      <div className="r-rai-page r-rai-intro" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
        <SpecialistGate
          onAddBook={() => setOnboardingStep("book")}
          onBrainDump={() => setBrainDumpOpen(true)}
        />
      </div>
    );
  }
  return (<div className={"r-rai-page " + (aiMessages.length === 0 ? "r-rai-intro" : "r-rai-chat")} style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
            <div className="r-rai-scroll" style={{ flex: 1, overflow: "auto", WebkitOverflowScrolling: "touch", display: "flex", flexDirection: "column", minHeight: 0 }}>
              <div className="r-rai-inner" style={{ width: "100%", maxWidth: aiMessages.length === 0 ? 760 : 720, margin: "0 auto", padding: "24px 24px 0", flex: aiMessages.length === 0 ? 1 : "0 0 auto", display: aiMessages.length === 0 ? "flex" : "block", flexDirection: "column", justifyContent: aiMessages.length === 0 ? "center" : "flex-start", paddingBottom: aiMessages.length === 0 ? 80 : 0 }}>
                {aiMessages.length === 0 ? (() => {
                  const greeting = (() => {
                    const h = new Date().getHours();
                    if (h >= 5 && h < 12) return "Morning";
                    if (h >= 12 && h < 17) return "Afternoon";
                    return "Evening";
                  })();
                  const firstName = user?.user_metadata?.full_name?.split(" ")[0]
                    || (user?.email ? user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1) : "");
                  const starters = [
                    "Who needs me today?",
                    "Summarize this week",
                    "Find risk patterns",
                    "Draft a renewal note",
                  ];
                  return (
                    <div style={{ width: "100%", margin: "0 auto", textAlign: "center" }}>
                      <h1 style={{ fontSize: 34, fontWeight: 600, color: C.text, lineHeight: 1.15, letterSpacing: "-0.02em", margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                        {greeting}{firstName ? ", " + firstName : ""}.
                      </h1>
                      <p style={{ fontSize: 19, fontWeight: 400, color: C.textSec, lineHeight: 1.5, marginTop: 10, marginBottom: 36, letterSpacing: "-0.01em" }}>
                        What's on your mind today?
                      </p>
                      <div className="rt-composer" style={{ background: C.card, borderRadius: 16, padding: "20px 22px 14px", textAlign: "left", border: "1px solid rgba(20,30,22,0.10)", boxShadow: "0 1px 3px rgba(20,30,22,0.04), 0 8px 24px rgba(20,30,22,0.06)" }}>
                        {aiAttachments.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                            {aiAttachments.map(a => (
                              <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surfaceWarm, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
                                <Icon name={a.type === "image" ? "image" : "file"} size={12} color={C.textSec} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                                <button onClick={() => setAiAttachments(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: C.textMuted, display: "flex" }} aria-label={"Remove " + a.name}>
                                  <Icon name="x" size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <textarea
                          value={aiInput}
                          onChange={e => { setAiInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 240) + "px"; }}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAi(); } }}
                          placeholder="Ask about a client, draft a message, or talk shop…"
                          rows={3}
                          style={{ width: "100%", minHeight: 72, padding: "2px 0", border: "none", fontSize: 16, fontFamily: "inherit", background: "transparent", outline: "none", resize: "none", lineHeight: 1.55, color: C.text, overflowY: "auto" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                          <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 36, height: 36, borderRadius: 10, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s" }}>
                            <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => { handleFilePick(Array.from(e.target.files || [])); e.target.value = ""; }} style={{ display: "none" }} />
                            <Icon name="plus" size={16} />
                          </label>
                          <button
                            onClick={() => sendAi()}
                            disabled={!aiInput.trim() && aiAttachments.length === 0}
                            aria-label="Send message"
                            style={{ width: 36, height: 36, borderRadius: 999, border: "none", background: (aiInput.trim() || aiAttachments.length > 0) ? "#33543E" : C.borderLight, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: (aiInput.trim() || aiAttachments.length > 0) ? "pointer" : "default", transition: "background 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out)" }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ transform: (aiInput.trim() || aiAttachments.length > 0) ? "scale(1)" : "scale(0.7)", opacity: (aiInput.trim() || aiAttachments.length > 0) ? 1 : 0.55, transition: "transform 180ms var(--rt-ease-out), opacity 180ms var(--rt-ease-out)" }}><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 20 }}>
                        {starters.map(s => (
                          <button
                            key={s}
                            onClick={() => {
                              setAiInput(s);
                              setTimeout(() => {
                                const ta = document.querySelector('textarea[placeholder="Ask about a client, draft a message, or talk shop…"]');
                                if (ta) { ta.focus(); ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 240) + "px"; }
                              }, 0);
                            }}
                            style={{
                              padding: "8px 16px",
                              background: C.card,
                              border: "none",
                              borderRadius: 999,
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.textSec,
                              cursor: "pointer",
                              fontFamily: "inherit",
                              boxShadow: "var(--rt-sh-xs)",
                              transition: "all 180ms var(--rt-ease-out)",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--rt-sh-card)"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.color = C.text; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow = "var(--rt-sh-xs)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.color = C.textSec; }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                      <p style={{ fontSize: 11.5, color: C.textMuted, textAlign: "center", marginTop: 24 }}>Rai can make mistakes. Double-check anything you act on.</p>
                    </div>
                  );
                })() : (
                  <div style={{ paddingBottom: 200 }}>
                    {aiMessages.map((m, i) => {
                      const isLastUser = m.role === "user" && i === aiMessages.length - 1;
                      const messageRef = isLastUser ? aiUserRef : null;
                      return m.role === "user" ? (
                        <div key={i} ref={messageRef} className="r-chat-msg-user" style={{ marginBottom: 28, display: "flex", justifyContent: "flex-end" }}>
                          <div style={{ maxWidth: "75%", background: "#F4F6F4", borderRadius: 12, padding: "11px 16px" }}>
                            {m.text.split("\n").map((l, j) => l.trim() === "" ? <div key={j} style={{ height: 8 }} /> : <p key={j} style={{ fontSize: 16, color: C.text, lineHeight: 1.5, margin: 0 }}>{l}</p>)}
                          </div>
                        </div>
                      ) : (
                        <div key={i} style={{ marginBottom: 28 }}>
                          <RaiMarkdown text={m.text} size={16} lineHeight={1.55} />
                          {aiStreaming && i === aiMessages.length - 1 && (
                            <span className="rt-stream-caret" aria-hidden="true" style={{ display: "inline-block", width: 8, height: 17, marginLeft: 1, verticalAlign: "-3px", borderRadius: 1, background: C.primary }} />
                          )}
                          {!(aiStreaming && i === aiMessages.length - 1) && <RaiMessageActions text={m.text} />}
                        </div>
                      );
                    })}
                    {aiTyping && <div style={{ marginBottom: 28, display: "flex", gap: 4, padding: "4px 0" }}>{[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: C.textMuted, animation: `pulse 1.2s ease-in-out ${j*0.2}s infinite` }} />)}</div>}
                    <div ref={aiEndRef} />
                  </div>
                )}
              </div>
            </div>
            {/* Input bar — fixed bottom once conversation started */}
            {aiMessages.length > 0 && (
              <div className="r-rai-inputbar" style={{ background: C.bg, padding: "12px 24px 16px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <div className="rt-rai-inputbox" style={{ background: C.card, border: "1px solid rgba(20,30,22,0.10)", boxShadow: "0 1px 3px rgba(20,30,22,0.04), 0 8px 24px rgba(20,30,22,0.06)", borderRadius: 16, padding: "14px 16px 10px" }}>
                    {aiAttachments.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                        {aiAttachments.map(a => (
                          <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 8px 5px 10px", background: C.surface, borderRadius: 8, fontSize: 12, color: C.text, maxWidth: 240 }}>
                            <Icon name={a.type === "image" ? "image" : "file"} size={12} color={C.textSec} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                            <button onClick={() => setAiAttachments(prev => prev.filter(x => x.id !== a.id))} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", color: C.textMuted, display: "flex" }} aria-label={"Remove " + a.name}>
                              <Icon name="x" size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <textarea value={aiInput} onChange={e => { setAiInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"; }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAi(); } }} placeholder="Write a message…" rows={1} style={{ width: "100%", padding: "4px 0", border: "none", fontSize: 16, fontFamily: "inherit", background: "transparent", outline: "none", resize: "none", lineHeight: 1.5, color: C.text, overflowY: "auto" }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <label title="Attach a file (PDF or image, max 10MB)" style={{ width: 32, height: 32, borderRadius: 8, background: C.card, color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <input type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={e => { handleFilePick(Array.from(e.target.files || [])); e.target.value = ""; }} style={{ display: "none" }} />
                        <Icon name="plus" size={14} />
                      </label>
                      <button
                        onClick={() => sendAi()}
                        disabled={!aiInput.trim() && aiAttachments.length === 0}
                        aria-label="Send message"
                        style={{ width: 32, height: 32, borderRadius: 999, border: "none", background: (aiInput.trim() || aiAttachments.length > 0) ? "#33543E" : C.borderLight, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: (aiInput.trim() || aiAttachments.length > 0) ? "pointer" : "default", transition: "background 180ms var(--rt-ease-out), transform 180ms var(--rt-ease-out)" }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ transform: (aiInput.trim() || aiAttachments.length > 0) ? "scale(1)" : "scale(0.7)", opacity: (aiInput.trim() || aiAttachments.length > 0) ? 1 : 0.55, transition: "transform 180ms var(--rt-ease-out), opacity 180ms var(--rt-ease-out)" }}><path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: C.textMuted, textAlign: "center", marginTop: 10 }}>Rai can make mistakes. Double-check anything you act on.</p>
                </div>
              </div>
            )}
          </div>);
}
