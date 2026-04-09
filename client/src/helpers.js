// ── Helpers ───────────────────────────────────────────────────
export const getTemp = (hot, cold) => {
  const s = hot - cold;
  if (s > 150) return { label: "🔥 לוהט",    color: "#ff2d2d", bg: "#fff0f0" };
  if (s > 80)  return { label: "🔥 חם מאוד", color: "#ff6b00", bg: "#fff5f0" };
  if (s > 30)  return { label: "♨️ חם",       color: "#ff9500", bg: "#fffbf0" };
  if (s > 0)   return { label: "🌤 פושר",     color: "#ffcc00", bg: "#fffdf0" };
  return              { label: "🧊 קר",        color: "#4db6ff", bg: "#f0f8ff" };
};

export const pct = (p, o) => o ? Math.round((1 - p / o) * 100) : 0;

export const qualityBadge = (score) => {
  if (!score) return null;
  if (score >= 90) return { label: `💎 ${score}`, color: '#7C3AED', bg: '#F5F3FF' };
  if (score >= 75) return { label: `🔥 ${score}`, color: '#DC2626', bg: '#FFF0F0' };
  if (score >= 60) return { label: `⭐ ${score}`, color: '#D97706', bg: '#FFFBF0' };
  if (score >= 45) return { label: `👍 ${score}`, color: '#059669', bg: '#F0FFF7' };
  if (score >= 30) return { label: `💰 ${score}`, color: '#6B7280', bg: '#F3F4F6' };
  return null;
};

export const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)    return "עכשיו";
  if (diff < 3600)  return `לפני ${Math.floor(diff / 60)} דקות`;
  if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
  return `לפני ${Math.floor(diff / 86400)} ימים`;
};
