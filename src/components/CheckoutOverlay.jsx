// ── CheckoutOverlay (Jul 2026) ────────────────────────────────────────
// Retayned-branded checkout. Stripe's EMBEDDED Checkout component mounts
// inside this overlay — the user never leaves the app or sees
// checkout.stripe.com. Flow: stripe-checkout edge function returns a
// client_secret + publishable key -> Stripe.js (loaded on demand from
// js.stripe.com, zero npm deps) renders the payment form into our node.
// On completion Stripe navigates to /?billing=success, which App.jsx
// already handles (toast + billing refetch).
//
// Lifecycle care: Stripe's embedded checkout throws if mounted twice and
// leaks iframes if not destroyed — the effect below guards both, and
// ignores late async arrivals after unmount (the close-during-loading
// race).

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { C } from "../theme";

// Load js.stripe.com/v3 exactly once, no matter how many times checkout
// opens. Resolves with the window.Stripe constructor.
let stripeJsPromise = null;
function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = "https://js.stripe.com/v3/";
    el.async = true;
    el.onload = () => (window.Stripe ? resolve(window.Stripe) : reject(new Error("Stripe.js loaded but unavailable")));
    el.onerror = () => { stripeJsPromise = null; reject(new Error("Couldn't load the payment form — check your connection.")); };
    document.head.appendChild(el);
  });
  return stripeJsPromise;
}

const PLAN_COPY = {
  solo: {
    name: "Solo",
    price: "$29",
    blurb: "Your daily operating system for client retention.",
    features: [
      "Up to 25 active clients (unlimited advisory clients)",
      "Rai's daily brief, every morning",
      "Tasks, touchpoints, docs & billing hours",
      "Unlimited history — your book, remembered",
    ],
  },
  agency: {
    name: "Agency",
    price: "$99",
    blurb: "Retayned for agencies.",
    features: [
      "5 seats, unlimited clients",
      "Owner's brief across the whole book",
      "Client handoffs & team coverage",
      "Everything in Solo, for everyone",
    ],
  },
};

export default function CheckoutOverlay({ plan, onClose, trialing = false }) {
  const mountRef = useRef(null);
  const checkoutRef = useRef(null);
  // Back button closes checkout instead of ejecting the user from the
  // app (Jul 2026). The app has no router — every in-app move is state —
  // so browser Back's previous entry is the marketing site or wherever
  // they came from. Opening checkout pushes a history entry; popstate
  // closes the overlay; closing via ✕ consumes the entry so history
  // stays balanced.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const poppedRef = useRef(false);
  useEffect(() => {
    const onPop = () => { poppedRef.current = true; onCloseRef.current(); };
    try { window.history.pushState({ rtCheckout: 1 }, ""); } catch (_) { /* history unavailable */ }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!poppedRef.current) { try { window.history.back(); } catch (_) { /* fine */ } }
    };
  }, []);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const copy = PLAN_COPY[plan] || PLAN_COPY.solo;

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not signed in");
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ plan }),
        });
        const body = await resp.json().catch(() => ({}));
        if (!resp.ok || !body.client_secret || !body.publishable_key) {
          throw new Error(body.error || `Checkout failed (${resp.status})`);
        }
        const StripeCtor = await loadStripeJs();
        if (dead) return;
        const stripe = StripeCtor(body.publishable_key);
        const checkout = await stripe.initEmbeddedCheckout({ clientSecret: body.client_secret });
        if (dead) { checkout.destroy(); return; }
        checkoutRef.current = checkout;
        checkout.mount(mountRef.current);
        setLoading(false);
      } catch (e) {
        if (!dead) { setError(e.message || "Couldn't start checkout"); setLoading(false); }
      }
    })();
    return () => {
      dead = true;
      if (checkoutRef.current) { try { checkoutRef.current.destroy(); } catch (_) { /* already gone */ } checkoutRef.current = null; }
    };
  }, [plan]);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: C.bg || "#FAFAF7", overflowY: "auto" }}>
      {/* Header: wordmark + close. The user is still in Retayned. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", maxWidth: 1020, margin: "0 auto" }}>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.04em", color: C.primary || "#33543E", fontFamily: "system-ui, -apple-system, sans-serif" }}>Retayned.</div>
        <button
          onClick={onClose}
          aria-label="Close checkout"
          style={{ border: "1px solid rgba(28,50,36,0.15)", background: "#fff", color: C.text || "#1E261F", borderRadius: 999, width: 34, height: 34, fontSize: 16, fontWeight: 600, cursor: "pointer", lineHeight: 1 }}>
          ×
        </button>
      </div>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "6px 22px 48px", display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        {/* ── Plan summary — the Retayned half of the page ── */}
        <div style={{ flex: "1 1 300px", minWidth: 280, maxWidth: 400 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(28,50,36,0.10)", borderRadius: 16, padding: "22px 22px 20px", boxShadow: "0 1px 4px rgba(28,50,36,0.04)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: C.primaryLight || "#558B68" }}>{copy.name} plan</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", color: C.text || "#1E261F" }}>{copy.price}</div>
              <div style={{ fontSize: 14, color: "#5A665C", fontWeight: 600 }}>/ month</div>
            </div>
            <div style={{ fontSize: 13.5, color: "#5A665C", marginTop: 6, lineHeight: 1.5 }}>{copy.blurb}</div>
            <div style={{ height: 1, background: "rgba(28,50,36,0.08)", margin: "16px 0" }} />
            {copy.features.map((f) => (
              <div key={f} style={{ display: "flex", gap: 9, alignItems: "flex-start", marginBottom: 9 }}>
                <span style={{ color: C.primary || "#33543E", fontWeight: 800, fontSize: 13, lineHeight: "19px" }}>✓</span>
                <span style={{ fontSize: 13.5, color: C.text || "#1E261F", lineHeight: 1.45 }}>{f}</span>
              </div>
            ))}
            <div style={{ marginTop: 14, fontSize: 12, color: "#7A857C", lineHeight: 1.5 }}>
              {trialing ? "You won't be billed until your trial ends — your card is saved today, your first charge lands when the trial does. " : ""}Cancel anytime from Settings. Your clients and history stay yours either way.
            </div>
          </div>
        </div>

        {/* ── Payment — Stripe's embedded component in a Retayned card ── */}
        <div style={{ flex: "1 1 420px", minWidth: 300 }}>
          <div style={{ background: "#fff", border: "1px solid rgba(28,50,36,0.10)", borderRadius: 16, padding: 10, boxShadow: "0 1px 4px rgba(28,50,36,0.04)", minHeight: 320 }}>
            {loading && !error && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 300, color: "#7A857C", fontSize: 13.5, fontWeight: 600 }}>
                Preparing secure checkout…
              </div>
            )}
            {error && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 300, gap: 12, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 13.5, color: "#B91C1C", fontWeight: 600, lineHeight: 1.5 }}>{error}</div>
                <button onClick={onClose} style={{ border: "1px solid rgba(28,50,36,0.2)", background: "transparent", color: C.text || "#1E261F", borderRadius: 999, padding: "8px 18px", fontFamily: "inherit", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Back to Retayned
                </button>
              </div>
            )}
            <div ref={mountRef} />
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: "#8A948C", textAlign: "center" }}>
            Payments handled by Stripe. Retayned never sees your card.
          </div>
        </div>
      </div>
    </div>
  );
}
