import React from "react";
import { getTemp, pct, qualityBadge, timeAgo } from "../helpers";

export default function DealCard({ deal, currentUser, onVote, onOpen, isAdmin, onAdminUpdate, onAdminDelete }) {
  const temp     = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  const qBadge   = qualityBadge(deal.quality_score);
  const isHot    = (+deal.hot - +deal.cold) > 30;

  return (
    <div className={`deal-card deal-entrance${deal.is_featured ? " featured" : ""}${deal.is_expired ? " expired" : ""}${isHot ? " hot-deal" : ""}`}>

      {/* ── Body ──────────────────────────────────────── */}
      <div style={{ display:"flex", gap:0, padding:"14px 16px 12px", alignItems:"stretch" }}>

        {/* Vote column — leftmost in RTL (visual start for Hebrew readers) */}
        <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"center", flexShrink:0, marginLeft:14 }}>
          <button
            className="vote-btn vote-hot"
            onClick={() => onVote(deal.id, "hot")}
            title="חם!"
          >
            <span style={{ fontSize:16, lineHeight:1 }}>🔥</span>
            <span style={{ fontSize:11, lineHeight:1 }}>חם</span>
            <span style={{ fontSize:16, fontWeight:900, lineHeight:1 }}>{deal.hot}</span>
          </button>
          <button
            className="vote-btn vote-cold"
            onClick={() => onVote(deal.id, "cold")}
            title="קר"
          >
            <span style={{ fontSize:16, lineHeight:1 }}>🧊</span>
            <span style={{ fontSize:11, lineHeight:1 }}>קר</span>
            <span style={{ fontSize:16, fontWeight:900, lineHeight:1 }}>{deal.cold}</span>
          </button>
        </div>

        {/* Image */}
        <div
          className="card-img"
          onClick={onOpen}
          style={{ position:"relative", width:130, height:110, borderRadius:8, overflow:"hidden", flexShrink:0, cursor:"pointer", background:"var(--surface-3)", marginLeft:14 }}
        >
          <img
            src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"}
            alt=""
            style={{ width:"100%", height:"100%", objectFit:"cover" }}
          />
          {discount > 0 && (
            <span className="discount-badge">-{discount}%</span>
          )}
        </div>

        {/* Content */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", justifyContent:"space-between" }}>

          {/* Top: badges + title */}
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:6 }}>
              <span className="badge" style={{ background:temp.bg, color:temp.color, fontSize:11 }}>{temp.label}</span>
              {qBadge && (
                <span className="badge" style={{ background:qBadge.bg, color:qBadge.color, fontWeight:800, fontSize:11 }} title="ציון איכות">
                  {qBadge.label}
                </span>
              )}
              {deal.is_featured && <span className="badge" style={{ background:"#FFF8E1", color:"#D4920A", fontSize:11 }}>⭐ מוצגת</span>}
              {deal.is_expired  && <span className="badge" style={{ background:"#FEECEC", color:"var(--danger)", fontSize:11 }}>⏰ פג תוקף</span>}
              {!deal.is_approved && <span className="badge" style={{ background:"#FFF3EE", color:"var(--brand)", fontSize:11 }}>⏳ ממתין</span>}
              <span className="badge" style={{ background:"var(--surface-2)", color:"var(--text-3)", fontSize:11 }}>{deal.category}</span>
              <span style={{ marginRight:"auto", fontSize:11, color:"var(--text-3)", flexShrink:0 }}>{timeAgo(deal.created_at)}</span>
            </div>

            <h3
              onClick={onOpen}
              style={{ fontWeight:800, fontSize:16, marginBottom:5, cursor:"pointer", lineHeight:1.4, color:"var(--text)", letterSpacing:"-.01em", transition:"color .15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--brand)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text)"; }}
            >
              {deal.title}
            </h3>

            <p style={{ fontSize:13, color:"var(--text-3)", marginBottom:8, lineHeight:1.6, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>
              {deal.description}
            </p>
          </div>

          {/* Bottom: price + store + actions */}
          <div>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, flexWrap:"wrap", marginBottom:4 }}>
              <span style={{ fontWeight:900, fontSize:22, color:"var(--hot)", letterSpacing:"-.5px", lineHeight:1 }}>
                ₪{(+deal.deal_price).toLocaleString()}
              </span>
              {deal.original_price > deal.deal_price && (
                <span style={{ textDecoration:"line-through", color:"var(--text-3)", fontSize:13 }}>
                  ₪{(+deal.original_price).toLocaleString()}
                </span>
              )}
            </div>
            {deal.store && (
              <div style={{ fontSize:12, color:"var(--text-3)", display:"flex", alignItems:"center", gap:4, marginBottom:8 }}>
                <span>📦</span> {deal.store}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer strip ──────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 16px", borderTop:"1px solid var(--border)", background:"var(--surface-2)", flexWrap:"wrap" }}>
        <span style={{ fontSize:12, color:"var(--text-2)", display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:15 }}>{deal.avatar}</span>
          <span style={{ fontWeight:600 }}>{deal.username}</span>
        </span>

        <button
          onClick={onOpen}
          style={{ fontSize:12, color:"var(--text-2)", background:"none", border:"none", display:"flex", alignItems:"center", gap:4, fontWeight:600, cursor:"pointer", padding:0 }}
        >
          💬 {deal.comment_count}
        </button>

        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize:12, color:"var(--brand)", fontWeight:700, display:"flex", alignItems:"center", gap:4, textDecoration:"none" }}
          onClick={e => e.stopPropagation()}
        >
          🛒 לחנות ↗
        </a>

        {isAdmin && (
          <div style={{ marginRight:"auto", display:"flex", gap:4 }}>
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
