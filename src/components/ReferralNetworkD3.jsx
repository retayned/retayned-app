import { useEffect, useMemo, useRef, useState } from "react";
import { forceX as d3forceX, forceY as d3forceY, forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from "d3-force";
import { select as d3select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity } from "d3-zoom";

function ReferralNetworkD3({
  referrers,
  predictedReferrers = [],
  asOfDate = null,
  recentReferralWindowMs = 60_000,
  onNodeClick,
  onEdgeClick,
  C,
  getAvatarColor,
  getInitials,
  isMobile = false,
}) {
  // SVG viewport — landscape on desktop, portrait on mobile.
  // Mobile uses a taller/narrower viewBox so the network has vertical room
  // to spread out at typical phone widths (~380px). Without this, the 820w
  // landscape viewBox scales down to ~232h on a phone — nodes become tiny.
  // Mobile (May 2026): viewBox tightened to 340w so the SVG scales up
  // to fill typical 390-430px phone viewports, making nodes visibly
  // larger. H reduced to 420 so the SVG doesn't reserve dead vertical
  // space below the nodes (was 560 — left a half-screen of whitespace).
  const W = isMobile ? 340 : 820;
  const H = isMobile ? 420 : 500;
  const cx = W / 2, cy = H / 2;

  // Filter to as-of date for time-travel slider. Each child carries an
  // `on` (date string). We compare loosely — if no asOfDate, show all.
  const visibleReferrers = useMemo(() => {
    if (!asOfDate) return referrers;
    const cutoff = new Date(asOfDate).getTime();
    return referrers
      .map(r => ({
        ...r,
        children: r.children.filter(ch => {
          if (!ch.on) return true;
          const d = new Date(ch.on).getTime();
          return Number.isFinite(d) ? d <= cutoff : true;
        }),
      }))
      .filter(r => r.children.length > 0);
  }, [referrers, asOfDate]);

  // Build node list + edges for the simulation.
  //   • hub node (id='__hub__', fixed at center)
  //   • referrer nodes (one per visible referrer)
  //   • predicted-referrer nodes (ghost; if no predicted ones, skipped)
  //   • child nodes (referred contacts/leads)
  // Edges: hub → referrer, referrer → child, hub → ghost referrer (dotted)
  const { nodes, links } = useMemo(() => {
    const ns = [];
    const ls = [];

    // Hub — anchored. fx/fy = fixed position d3-force respects.
    ns.push({ id: "__hub__", kind: "hub", fx: cx, fy: cy });

    // Predicted-referrer NAME set for fast lookup. Anyone in this set who
    // ALREADY appears as a referrer or as a referrer's child gets a
    // canRefer flag instead of a separate ghost node. Eliminates the
    // "same person rendered twice" bug — one node per person, period.
    // Match by NAME because child nodes use referral row IDs (r.id), not
    // client IDs, so ID-based matching never worked for children.
    const predictedNameSet = new Set(predictedReferrers.map(p => (p.name || "").trim().toLowerCase()).filter(Boolean));
    // Track which predicted referrers got placed via an existing node
    // (by name) so we know which ones still need a standalone slot.
    const placedPredictedNames = new Set();

    visibleReferrers.forEach(r => {
      const rNameKey = (r.name || "").trim().toLowerCase();
      const refCanRefer = predictedNameSet.has(rNameKey);
      ns.push({
        id: "ref:" + r.id,
        kind: "referrer",
        data: r,
        radius: 22 + Math.min(8, Math.log(1 + r.revenue / 1000)),
        canRefer: refCanRefer,
      });
      if (refCanRefer) placedPredictedNames.add(rNameKey);
      ls.push({ source: "__hub__", target: "ref:" + r.id, kind: "hub-ref" });

      r.children.forEach((ch, i) => {
        const chId = ch.id || i;
        const chNameKey = (ch.name || "").trim().toLowerCase();
        const childCanRefer = chNameKey ? predictedNameSet.has(chNameKey) : false;
        if (childCanRefer) placedPredictedNames.add(chNameKey);
        ns.push({
          id: "child:" + r.id + ":" + chId,
          kind: "child",
          data: ch,
          parentId: r.id,
          radius: 11,
          canRefer: childCanRefer,
        });
        ls.push({
          source: "ref:" + r.id,
          target: "child:" + r.id + ":" + chId,
          kind: "ref-child",
          status: ch.status,
        });
      });
    });

    // Predicted referrers not already placed in the visible-referrer tree.
    // Filter by name match so anyone already in the chain (as referrer or
    // child) doesn't get a duplicate ghost slot.
    predictedReferrers.slice(0, 4)
      .filter(p => !placedPredictedNames.has((p.name || "").trim().toLowerCase()))
      .forEach(p => {
        ns.push({
          id: "askchild:" + p.id,
          kind: "child",
          // hasName: true — predicted referrers come from `predicted` which
          // already filtered to clients with a real name. Without this flag
          // the child render falls back to "? add name" placeholder.
          data: { ...p, status: "ask", hasName: true },
          parentId: "__hub__",
          radius: 14,
          canRefer: true,
        });
        ls.push({ source: "__hub__", target: "askchild:" + p.id, kind: "hub-ask" });
      });

    return { nodes: ns, links: ls };
  }, [visibleReferrers, predictedReferrers, cx, cy]);

  // Mutable refs to the simulation + nodes (d3 mutates node objects).
  const simRef = useRef(null);
  const nodesRef = useRef([]);
  const [tickVersion, setTickVersion] = useState(0);
  const [hoverId, setHoverId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState(null);

  // Build / rebuild simulation when topology changes.
  useEffect(() => {
    // Stop any existing simulation.
    if (simRef.current) simRef.current.stop();

    // Clone node objects so d3 can mutate x/y/vx/vy without polluting
    // upstream memo'd data. Carry forward old positions where possible
    // (smooth transition when a node is added).
    const oldById = new Map(nodesRef.current.map(n => [n.id, n]));
    const simNodes = nodes.map(n => {
      const old = oldById.get(n.id);
      return {
        ...n,
        x: old?.x ?? cx + (Math.random() - 0.5) * 40,
        y: old?.y ?? cy + (Math.random() - 0.5) * 40,
        vx: old?.vx ?? 0,
        vy: old?.vy ?? 0,
        fx: n.fx ?? null,
        fy: n.fy ?? null,
      };
    });
    nodesRef.current = simNodes;

    const sim = forceSimulation(simNodes)
      .force("link", forceLink(links.map(l => ({ ...l })))
        .id(d => d.id)
        .distance(link => {
          // Mobile uses ~65% link distance — bumped slightly from 60%
          // (original) to give nodes a touch more room within the
          // tightened 340w viewBox, but not so much that they push
          // outside the canvas.
          if (link.kind === "hub-ref") return isMobile ? 85 : 130;
          if (link.kind === "hub-ask") return isMobile ? 100 : 150;
          return isMobile ? 44 : 60; // ref-child
        })
        .strength(link => link.kind === "ref-child" ? 0.9 : 0.4))
      .force("charge", forceManyBody().strength(d => {
        // Mobile repulsion bumped slightly from 60% to ~65% of desktop,
        // matching the toned-down link distances above.
        if (d.kind === "hub") return isMobile ? -540 : -800;
        if (d.kind === "referrer") return isMobile ? -240 : -350;
        return isMobile ? -110 : -160; // child
      }))
      .force("center", forceCenter(cx, cy).strength(0.05))
      // Collision radius bumped well past the circle: labels render
      // 14-28px outside the node. Mobile uses tighter collision so labels
      // overlap less aggressively when nodes are crowded.
      .force("collide", forceCollide().radius(d => d.radius + (isMobile ? 19 : 28)).strength(0.95))
      .force("x", d3forceX(cx).strength(0.04))
      .force("y", d3forceY(cy).strength(0.04))
      .alpha(1)
      .alphaDecay(0.02)      // slow decay so the graph stays "alive"
      .alphaMin(0.005)       // keeps it gently breathing even when "settled"
      .velocityDecay(0.4);

    sim.on("tick", () => {
      // Bump version so React re-renders. We don't put nodes in state
      // (would be huge re-renders) — instead store in ref and trigger
      // a lightweight version increment.
      setTickVersion(v => v + 1);
    });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [nodes, links, cx, cy]);

  // Pause simulation when tab is hidden to save CPU.
  useEffect(() => {
    const onVis = () => {
      if (!simRef.current) return;
      if (document.hidden) simRef.current.stop();
      else simRef.current.alpha(0.1).restart();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // ─── Pan + pinch-zoom (mobile only) ──────────────────────────────
  // Mobile users can't reach nodes that get pushed to the canvas edges
  // by the force layout. d3-zoom adds finger-drag panning and two-finger
  // pinch-zoom so any node is reachable. Desktop unchanged — nodes there
  // fit on screen without panning.
  //
  // Implementation: attach d3-zoom to the SVG; on every zoom event,
  // store the transform in React state; apply it to the inner <g> via
  // a transform="translate(...) scale(...)" string. Scale clamped to
  // [0.5, 2.5]. Pan extent gives the user 1 viewBox-worth of slack
  // beyond the canvas in every direction so they can drag edge nodes
  // toward center.
  const svgRef = useRef(null);
  const zoomGroupTransform = useRef("");
  const [, forceZoomRender] = useState(0);
  useEffect(() => {
    if (!isMobile || !svgRef.current) return;
    const svg = d3select(svgRef.current);
    const zoomBehavior = d3zoom()
      .scaleExtent([0.5, 2.5])
      .translateExtent([[-W, -H], [W * 2, H * 2]])
      .on("zoom", (event) => {
        const { x, y, k } = event.transform;
        zoomGroupTransform.current = `translate(${x},${y}) scale(${k})`;
        forceZoomRender(v => v + 1);
      });
    svg.call(zoomBehavior);
    // Reset to identity on mount so nothing's offset on first paint.
    svg.call(zoomBehavior.transform, zoomIdentity);
    return () => { svg.on(".zoom", null); };
  }, [isMobile, W, H]);

  // Hover handler: bump alpha when hovering to "settle" the network.
  const handleEnter = (id, evt) => {
    setHoverId(id);
    if (simRef.current) simRef.current.alphaTarget(0.05).restart();
    if (evt && evt.currentTarget) {
      const svgRect = evt.currentTarget.ownerSVGElement.getBoundingClientRect();
      setTooltipPos({
        x: evt.clientX - svgRect.left,
        y: evt.clientY - svgRect.top,
      });
    }
  };
  const handleLeave = () => {
    setHoverId(null);
    setTooltipPos(null);
    if (simRef.current) simRef.current.alphaTarget(0);
  };

  // Helper to look up a node by id (positions live in nodesRef).
  const findNode = (id) => nodesRef.current.find(n => n.id === id);

  // Helpers for child colors / edge styles by status.
  const statusColor = (status) => {
    if (status === "converted" || status === "active" || status === "closed") return C.retGood;
    if (status === "pending") return "#D17A1B"; // amber
    if (status === "ask") return C.btn; // predicted referrer placed as direct child of hub
    return C.textMuted; // lost / rejected / other
  };
  const edgeStrokeDash = (status) => {
    if (status === "pending") return "4 4";
    if (status === "lost" || status === "rejected") return "1 5";
    return null;
  };

  // Recency check for pulse animation.
  const now = Date.now();
  const isRecent = (ch) => {
    if (!ch?.on) return false;
    const d = new Date(ch.on).getTime();
    return Number.isFinite(d) && (now - d) < recentReferralWindowMs;
  };

  // Force a position read each render via the tickVersion trigger.
  void tickVersion;

  // Render
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", maxHeight: isMobile ? 460 : 520, display: "block", touchAction: isMobile ? "none" : "auto" }}
        onMouseLeave={handleLeave}
        onClick={(e) => {
          // Tap-outside-to-close on mobile: if the user taps an empty
          // area of the SVG (not on a node <g>), clear the tooltip.
          // Node clicks bubble up here too but we only act when the
          // direct event target is the svg element itself.
          if (e.target === e.currentTarget) handleLeave();
        }}
      >
        <defs>
          <radialGradient id="hubGlowD3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.primary} stopOpacity="0.25" />
            <stop offset="100%" stopColor={C.primary} stopOpacity="0" />
          </radialGradient>
          <filter id="softShadowD3" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#1E261F" floodOpacity="0.15" />
          </filter>
          <filter id="purpleHaloD3" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#7c5cf3" floodOpacity="0.30" />
          </filter>
          <linearGradient id="ghostGradD3" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8f72f5" />
            <stop offset="55%" stopColor="#7c5cf3" />
            <stop offset="100%" stopColor="#6a4ce8" />
          </linearGradient>
        </defs>

        {/* Pan/zoom transform group — mobile only. Desktop renders with
            empty transform string (no-op). All visual content lives
            inside this group so panning/zooming moves everything in sync. */}
        <g transform={isMobile ? zoomGroupTransform.current : ""}>

        {/* Hub glow */}
        {(() => {
          const hub = findNode("__hub__");
          if (!hub) return null;
          return <circle cx={hub.x} cy={hub.y} r="90" fill="url(#hubGlowD3)" />;
        })()}

        {/* Edges */}
        {links.map((link, idx) => {
          const s = findNode(typeof link.source === "object" ? link.source.id : link.source);
          const t = findNode(typeof link.target === "object" ? link.target.id : link.target);
          if (!s || !t) return null;
          const dim = hoverId && hoverId !== s.id && hoverId !== t.id ? 0.15 : 1;
          if (link.kind === "hub-ask") {
            // Predicted referrer who hasn't been placed in the chain
            // anywhere — they hang off YOU as a child with a purple
            // dashed connector to signal "no relationship yet, but
            // they could refer."
            return (
              <line
                key={"ln-" + idx}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={C.btn}
                strokeWidth="1.5"
                strokeDasharray="2 5"
                opacity={dim * 0.5}
                strokeLinecap="round"
              />
            );
          }
          if (link.kind === "hub-ref") {
            // Direct referrer (level 1 of the chain) — solid green,
            // thicker stroke. The chain's main trunk.
            return (
              <line
                key={"ln-" + idx}
                x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                stroke={C.retGood}
                strokeWidth="2.5"
                opacity={dim * 0.6}
                strokeLinecap="round"
                onClick={() => onEdgeClick && onEdgeClick(link)}
                style={{ cursor: onEdgeClick ? "pointer" : "default" }}
              />
            );
          }
          // ref-child edge — downstream in the chain (level 2+).
          // Thinner stroke than the trunk so the eye can follow
          // the chain structure visually.
          return (
            <line
              key={"ln-" + idx}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={statusColor(link.status)}
              strokeWidth="1.25"
              strokeDasharray={edgeStrokeDash(link.status)}
              opacity={dim * 0.5}
              strokeLinecap="round"
            />
          );
        })}

        {/* Ghost nodes removed — predicted referrers now render as
            child nodes with canRefer:true. Same person never gets
            two circles. */}

        {/* Referrer nodes */}
        {nodesRef.current.filter(n => n.kind === "referrer").map(n => {
          const dim = hoverId && hoverId !== n.id ? 0.4 : 1;
          const highlighted = hoverId === n.id;
          const name = n.data?.name || "Unknown";
          const displayName = name.length > 18 ? name.slice(0, 17) + "…" : name;
          // ─── Radial label placement away from hub ─────────────────
          // Name + revenue stack OUTWARD from hub (in the direction
          // away from center). Keeps referrer labels from colliding
          // with the hub label and other referrers nearby.
          const hub = findNode("__hub__");
          const dx = hub ? (n.x - hub.x) : 0;
          const dy = hub ? (n.y - hub.y) : -1;
          const mag = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / mag;
          const uy = dy / mag;
          const nameOffset = n.radius + 16;
          const askOffset = n.radius + 16; // ASK sits on the OPPOSITE side (toward hub)
          const nameX = n.x + ux * nameOffset;
          const nameY = n.y + uy * nameOffset;
          // Revenue stacks BELOW the name line on the Y axis, not further
          // out radially. Prevents 'Matte Collection $4.5k/mo' running
          // together horizontally when the node sits left/right of hub.
          const revX = nameX;
          const revY = nameY + 14;
          const askX = n.x - ux * askOffset;
          const askY = n.y - uy * askOffset;
          const textAnchor = ux > 0.4 ? "start" : ux < -0.4 ? "end" : "middle";
          const askAnchor = -ux > 0.4 ? "start" : -ux < -0.4 ? "end" : "middle";
          return (
            <g
              key={n.id}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleEnter(n.id, e)}
              onClick={() => onNodeClick && onNodeClick({ kind: "referrer", data: n.data, canRefer: n.canRefer })}
            >
              <circle cx={n.x} cy={n.y} r={highlighted ? n.radius + 4 : n.radius} fill={getAvatarColor(n.id)} stroke="#fff" strokeWidth="3" filter="url(#softShadowD3)" style={{ transition: "r 180ms" }} />
              <text x={n.x} y={n.y + 4} fontSize="11" fill="#fff" textAnchor="middle" fontWeight="700">{getInitials(name)}</text>
              <text x={nameX} y={nameY} fontSize="12" fill={C.text} textAnchor={textAnchor} fontWeight="600">{displayName}</text>
              {n.data?.revenue > 0 && (
                <text x={revX} y={revY} fontSize="10" fill={C.retGood} textAnchor={textAnchor} fontWeight="700">${(n.data.revenue / 1000).toFixed(n.data.revenue >= 10000 ? 0 : 1)}k/mo</text>
              )}
              {n.canRefer && (
                <text x={askX} y={askY} fontSize="10" fill={C.btn} textAnchor={askAnchor} fontWeight="700" letterSpacing="0.5">ASK?</text>
              )}
            </g>
          );
        })}

        {/* Child nodes */}
        {nodesRef.current.filter(n => n.kind === "child").map(n => {
          const ch = n.data;
          const color = statusColor(ch.status);
          const parentHovered = hoverId === ("ref:" + n.parentId);
          const meHovered = hoverId === n.id;
          const dim = hoverId && !parentHovered && !meHovered ? 0.15 : 1;
          const recent = isRecent(ch);
          const hasName = ch.hasName;
          const rawName = ch.name || "Untitled";
          const displayName = rawName.length > 16 ? rawName.slice(0, 15) + "…" : rawName;
          // ─── Radial label placement ─────────────────────────────
          // Place labels in the direction AWAY from the parent node.
          // For a child below its referrer, this puts the label BELOW
          // the child (away from referrer). For a child to the right,
          // labels go further right. Prevents the common collision
          // where child labels overlap referrer labels above.
          const parent = findNode("ref:" + n.parentId) || findNode("__hub__");
          const dx = parent ? (n.x - parent.x) : 0;
          const dy = parent ? (n.y - parent.y) : 1;
          const mag = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / mag;
          const uy = dy / mag;
          const labelOffset = n.radius + 14;
          const labelX = n.x + ux * labelOffset;
          const labelY = n.y + uy * labelOffset;
          // Secondary line stacks BELOW the name line on the Y axis,
          // not further out radially. Prevents horizontal run-together
          // ("Matte Collection $4.5k/mo" on the same line) when nodes
          // sit to the left/right of their parent.
          const secondaryX = labelX;
          const secondaryY = labelY + 13;
          // Text anchor by the dominant axis of the offset direction
          const textAnchor = ux > 0.4 ? "start" : ux < -0.4 ? "end" : "middle";
          return (
            <g
              key={n.id}
              opacity={dim}
              style={{ cursor: "pointer" }}
              onMouseEnter={(e) => handleEnter(n.id, e)}
              onClick={() => onNodeClick && onNodeClick({ kind: "child", data: ch })}
            >
              {recent && (
                <circle cx={n.x} cy={n.y} r="14">
                  <animate attributeName="r" values="7;18;7" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="fill" values={color + ";" + color + ";" + color} dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={n.x} cy={n.y} r={meHovered ? n.radius + 2 : n.radius} fill={color} filter="url(#softShadowD3)" style={{ transition: "r 180ms" }} />
              <circle cx={n.x} cy={n.y} r="3" fill="#fff" opacity="0.9" />
              {hasName ? (
                <text x={labelX} y={labelY} fontSize="11" fill={C.text} textAnchor={textAnchor} fontWeight="500">{displayName}</text>
              ) : (
                <text x={labelX} y={labelY} fontSize="10.5" fill={C.textMuted} textAnchor={textAnchor} fontStyle="italic" fontWeight="500">? add name</text>
              )}
              {ch.mrr > 0 ? (
                <text x={secondaryX} y={secondaryY} fontSize="9.5" fill={C.textMuted} textAnchor={textAnchor} fontWeight="500">${(ch.mrr / 1000).toFixed(ch.mrr >= 10000 ? 0 : 1)}k/mo</text>
              ) : n.canRefer ? (
                <text x={secondaryX} y={secondaryY} fontSize="9.5" fill={C.btn} textAnchor={textAnchor} fontWeight="700" letterSpacing="0.5">ASK?</text>
              ) : null}
            </g>
          );
        })}

        {/* Hub (you) */}
        {(() => {
          const hub = findNode("__hub__");
          if (!hub) return null;
          return (
            <g>
              <circle cx={hub.x} cy={hub.y} r="42" fill={C.primary} stroke="#fff" strokeWidth="4" filter="url(#softShadowD3)" />
              <text x={hub.x} y={hub.y + 4} fontSize="12" fill="#fff" textAnchor="middle" fontWeight="700" letterSpacing="0.8">YOU</text>
            </g>
          );
        })()}
        </g>
      </svg>

      {/* Tooltip — appears next to hovered node */}
      {hoverId && tooltipPos && (() => {
        const n = findNode(hoverId);
        if (!n) return null;
        if (n.kind === "referrer") {
          const r = n.data;
          const conv = r.children.filter(c => c.status === "converted" || c.status === "active" || c.status === "closed").length;
          const pending = r.children.filter(c => c.status === "pending").length;
          const lost = r.children.length - conv - pending;
          return (
            <div style={{
              position: "absolute",
              left: Math.min(tooltipPos.x + 14, W - 240),
              top: Math.max(8, tooltipPos.y - 10),
              background: C.card,
              borderRadius: 10,
              padding: "10px 12px",
              boxShadow: "0 8px 20px rgba(10,10,10,0.10), 0 2px 4px rgba(10,10,10,0.06)",
              minWidth: 220,
              maxWidth: 260,
              pointerEvents: "none",
              zIndex: 50,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{r.name}</div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
                <div>{r.children.length} {r.children.length === 1 ? "referral" : "referrals"} sent</div>
                {(conv > 0 || pending > 0 || lost > 0) && (
                  <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                    {conv > 0 && <span style={{ color: C.retGood }}>● {conv} converted</span>}
                    {pending > 0 && <span style={{ color: "#D17A1B" }}>● {pending} pending</span>}
                    {lost > 0 && <span style={{ color: C.textMuted }}>● {lost} lost</span>}
                  </div>
                )}
                {r.revenue > 0 && <div style={{ marginTop: 4, color: C.text, fontWeight: 600 }}>${r.revenue.toLocaleString()}/mo total</div>}
              </div>
            </div>
          );
        }
        if (n.kind === "child") {
          const ch = n.data;
          const clickable = n.canRefer && !!onNodeClick;
          return (
            <div
              onClick={clickable ? () => onNodeClick({ kind: "child", data: ch }) : undefined}
              style={{
                position: "absolute",
                left: Math.min(tooltipPos.x + 14, W - 240),
                top: Math.max(8, tooltipPos.y - 10),
                background: C.card,
                borderRadius: 10,
                padding: "10px 12px",
                boxShadow: n.canRefer ? "var(--rt-sh-purple)" : "0 8px 20px rgba(10,10,10,0.10), 0 2px 4px rgba(10,10,10,0.06)",
                minWidth: 200,
                maxWidth: 260,
                // Clickable when canRefer — tooltip fires the same action
                // as clicking the node so the "Click to draft an ask →"
                // hint at the bottom is actually live. Otherwise
                // pointer-events stays off so tooltip doesn't intercept
                // hover or block underlying clicks.
                pointerEvents: clickable ? "auto" : "none",
                cursor: clickable ? "pointer" : "default",
                zIndex: 50,
              }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: ch.hasName ? C.text : C.textMuted, fontStyle: ch.hasName ? "normal" : "italic", marginBottom: 4 }}>
                {ch.hasName ? ch.name : "Name not set — click to edit"}
              </div>
              <div style={{ fontSize: 11.5, color: C.textMuted, lineHeight: 1.6 }}>
                {ch.status !== "ask" && <div>Status: <span style={{ color: statusColor(ch.status), fontWeight: 600 }}>{ch.status}</span></div>}
                {ch.mrr > 0 && <div>${ch.mrr.toLocaleString()}/mo</div>}
                {ch.totalRevenue > 0 && <div>${ch.totalRevenue.toLocaleString()} total</div>}
                {n.canRefer && (
                  <>
                    <div style={{ color: C.btn, fontWeight: 600, marginTop: 4 }}>Likely to refer</div>
                    {ch.reason && <div style={{ marginTop: 2 }}>{ch.reason}</div>}
                  </>
                )}
              </div>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
}

export { ReferralNetworkD3 };
