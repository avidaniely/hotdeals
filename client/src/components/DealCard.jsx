import React from "react";
import { pct, qualityBadge, timeAgo } from "../helpers";

export default function DealCard({ deal, currentUser, onVote, onOpen, isAdmin, onAdminUpdate, onAdminDelete }) {
  const discount = pct(+deal.deal_price, +deal.original_price);
  const qBadge   = qualityBadge(deal.quality_score);
  const score    = +deal.hot - +deal.cold;
  const isHot    = score > 30;
  const isCold   = score < -10;

  // Temperature color like hotukdeals
  const tempColor = score > 100 ? "#e8220a"
                  : score > 50  ? "#f7641b"
                  : score > 0   ? "#ff9500"
                  : "#0099ff";

  return (
    <div
      className={`deal-card deal-entrance${deal.is_featured ? " featured" : ""}${deal.is_expired ? " expired" : ""}${isHot ? " hot-deal" : ""}`}
      style={{ borderRight: isHot ? `4px solid ${tempColor}` : undefined }}
    >
      <div style={{ display:"flex", alignItems:"stretch", minHeight:120 }}>

        {/* ── Temperature column ───────────────────────── */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, width:72, flexShrink:0, borderLeft:"1px solid var(--border)", background:"var(--surface-2)", padding:"12px 0" }}>
          <button
            className="vote-btn vote-hot"
            onClick={() => onVote(deal.id, "hot")}
            title="חם!"
            style={{ border:"none", borderRadius:6, width:44, height:32, display:"flex", alignItems:"center", justifyContent:"center", gap:2, fontSize:13, fontWeight:700 }}
          >
            🔥
          </button>

          {/* Net temperature number — the hotukdeals style */}
          <div style={{ textAlign:"center", lineHeight:1 }}>
            <div style={{ fontWeight:900, fontSize:20, color:tempColor, letterSpacing:"-1px" }}>
              {score > 0 ? "+" : ""}{score}°
            </div>
          </div>

          <button
            className="vote-btn vote-cold"
            onClick={() => onVote(deal.id, "cold")}
            title="קר"
            style={{ border:"none", borderRadius:6, width:44, height:32, display:"flex", alignItems:"center", justifyContent:"center", gap:2, fontSize:13, fontWeight:700 }}
          >
            🧊
          </button>
        </div>

        {/* ── Image ────────────────────────────────────── */}
        <div
          className="card-img"
          onClick={onOpen}
          style={{ position:"relative", width:130, height:"auto", minHeight:120, flexShrink:0, cursor:"pointer", background:"var(--surface-3)", borderLeft:"1px solid var(--border)" }}
        >
          <img
            src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"}
            alt=""
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
          />
          {discount > 0 && (
            <span className="discount-badge">-{discount}%</span>
          )}
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <div style={{ flex:1, minWidth:0, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>

          {/* Badges row */}
          <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:5 }}>
            {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1", color:"#D4920A", fontSize:11 }}>⭐ מוצגת</span>}
            {deal.is_expired  && <span className="badge" style={{ background:"#FEECEC", color:"var(--danger)", fontSize:11 }}>פג תוקף</span>}
            {!deal.is_approved && <span className="badge" style={{ background:"var(--brand-lt)", color:"var(--brand)", fontSize:11 }}>ממתין לאישור</span>}
            {qBadge && <span className="badge" style={{ background:qBadge.bg, color:qBadge.color, fontSize:11 }}>{qBadge.label}</span>}
            <span className="badge" style={{ background:"var(--surface-2)", color:"var(--text-3)", fontSize:11 }}>{deal.category}</span>
            <span style={{ marginRight:"auto", fontSize:11, color:"var(--text-3)", flexShrink:0 }}>{timeAgo(deal.created_at)}</span>
          </div>

          {/* Title */}
          <h3
            onClick={onOpen}
            style={{ fontWeight:800, fontSize:15, marginBottom:4, cursor:"pointer", lineHeight:1.45, color:"var(--text)", transition:"color .15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "var(--brand)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "var(--text)"; }}
          >
            {deal.title}
          </h3>

          {/* Description */}
          {deal.description && (
            <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:8, lineHeight:1.55, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
              {deal.description}
            </p>
          )}

          {/* Price + store */}
          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
            <span style={{ fontWeight:900, fontSize:22, color:"var(--hot)", letterSpacing:"-.5px", lineHeight:1 }}>
              ₪{(+deal.deal_price).toLocaleString()}
            </span>
            {+deal.original_price > +deal.deal_price && (
              <span style={{ textDecoration:"line-through", color:"var(--text-3)", fontSize:13 }}>
                ₪{(+deal.original_price).toLocaleString()}
              </span>
            )}
            {deal.store && (
              <span style={{ fontSize:12, color:"var(--text-3)", marginRight:"auto" }}>
                📦 {deal.store}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 14px 7px 10px", borderTop:"1px solid var(--border)", background:"var(--surface-2)" }}>

        <span style={{ fontSize:12, color:"var(--text-2)", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:14 }}>{deal.avatar}</span>
          <span style={{ fontWeight:600 }}>{deal.username}</span>
        </span>

        <button onClick={onOpen} style={{ fontSize:12, color:"var(--text-2)", background:"none", border:"none", display:"flex", alignItems:"center", gap:3, fontWeight:600, cursor:"pointer", padding:0 }}>
          💬 {deal.comment_count}
        </button>

        <a href={deal.url} target="_blank" rel="noreferrer"
          style={{ fontSize:13, color:"var(--brand)", fontWeight:800, display:"flex", alignItems:"center", gap:3, textDecoration:"none", marginRight:"auto" }}
          onClick={e => e.stopPropagation()}>
          לחנות ↗
        </a>

        {isAdmin && (
          <div style={{ display:"flex", gap:4 }}>
            {!deal.is_approved && (
              <button className="btn btn-success" style={{ padding:"2px 7px", fontSize:10 }} onClick={() => onAdminUpdate(deal.id, { is_approved:1 })}>✅</button>
            )}
            <button className="btn btn-ghost" style={{ padding:"2px 7px", fontSize:10 }} onClick={() => onAdminUpdate(deal.id, { is_featured: deal.is_featured ? 0 : 1 })}>
              {deal.is_featured ? "⭐" : "☆"}
            </button>
            <button className="btn btn-ghost" style={{ padding:"2px 7px", fontSize:10 }} onClick={() => onAdminUpdate(deal.id, { is_expired: deal.is_expired ? 0 : 1 })}>
              {deal.is_expired ? "🔄" : "⏰"}
            </button>
            <button className="btn btn-danger" style={{ padding:"2px 7px", fontSize:10 }} onClick={() => onAdminDelete(deal.id)}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}
