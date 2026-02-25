// ============================================================
//  App.jsx  –  HOTדילים  (connected to MySQL backend)
//  Place in:  client/src/App.jsx
// ============================================================
import { useState, useEffect, useCallback } from "react";
import {
  authAPI, dealsAPI, commentsAPI, categoriesAPI, adminAPI,
  saveToken, clearToken, getToken,
} from "./api";

const AVATARS = ['🐱','🦊','🐸','🦋','🐧','🦁','🐨','🦄','🐙','🦅'];

// ── Helpers ──────────────────────────────────────────────────
const getTemp = (hot, cold) => {
  const s = hot - cold;
  if (s > 150) return { label: "🔥 לוהט",    color: "#ff2d2d", bg: "#fff0f0" };
  if (s > 80)  return { label: "🔥 חם מאוד", color: "#ff6b00", bg: "#fff5f0" };
  if (s > 30)  return { label: "♨️ חם",       color: "#ff9500", bg: "#fffbf0" };
  if (s > 0)   return { label: "🌤 פושר",     color: "#ffcc00", bg: "#fffdf0" };
  return              { label: "🧊 קר",        color: "#4db6ff", bg: "#f0f8ff" };
};
const pct = (p, o) => o ? Math.round((1 - p / o) * 100) : 0;
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60)   return "עכשיו";
  if (diff < 3600) return `לפני ${Math.floor(diff/60)} דקות`;
  if (diff < 86400)return `לפני ${Math.floor(diff/3600)} שעות`;
  return `לפני ${Math.floor(diff/86400)} ימים`;
};

// ════════════════════════════════════════════════════════════
export default function App() {
  const [user,          setUser]          = useState(null);
  const [deals,         setDeals]         = useState([]);
  const [categories,    setCategories]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [modal,         setModal]         = useState(null);
  const [selectedDeal,  setSelectedDeal]  = useState(null);
  const [activeTab,     setActiveTab]     = useState("hot");
  const [activeCategory,setActiveCategory]= useState("הכל");
  const [search,        setSearch]        = useState("");
  const [toast,         setToast]         = useState(null);
  const [page,          setPage]          = useState(1);
  const [totalPages,    setTotalPages]    = useState(1);

  // Admin state
  const [adminTab,      setAdminTab]      = useState("deals");
  const [adminDeals,    setAdminDeals]    = useState([]);
  const [adminUsers,    setAdminUsers]    = useState([]);
  const [adminStats,    setAdminStats]    = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── Load categories + restore session ─────────────────────
  useEffect(() => {
    categoriesAPI.list().then(cats => setCategories(cats)).catch(() => {});
    if (getToken()) {
      authAPI.me().then(u => setUser(u)).catch(() => clearToken());
    }
  }, []);

  // ── Fetch deals ────────────────────────────────────────────
  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params = { sort: activeTab === "hot" ? "hot" : "new", page };
      if (activeCategory !== "הכל") params.category = activeCategory;
      if (search) params.search = search;
      const data = await dealsAPI.list(params);
      setDeals(data.deals);
      setTotalPages(data.pages);
    } catch (e) {
      showToast("שגיאה בטעינת הדילים", "error");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory, search, page]);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  // ── Auth ───────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const { token, user: u } = await authAPI.login(username, password);
      saveToken(token);
      setUser(u);
      setModal(null);
      showToast(`ברוך הבא, ${u.username}! 🎉`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const register = async (username, email, password) => {
    try {
      const { token, user: u } = await authAPI.register(username, email, password);
      saveToken(token);
      setUser(u);
      setModal(null);
      showToast(`ברוך הבא לקהילה, ${u.username}! 🎊`);
    } catch (e) { showToast(e.message, "error"); }
  };

  const logout = () => { clearToken(); setUser(null); showToast("להתראות! 👋"); };

  // ── Vote ───────────────────────────────────────────────────
  const vote = async (dealId, voteType) => {
    if (!user) return showToast("יש להתחבר כדי להצביע", "error");
    try {
      await dealsAPI.vote(dealId, voteType);
      fetchDeals();
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Add comment ────────────────────────────────────────────
  const addComment = async (dealId, text) => {
    if (!user) return showToast("יש להתחבר כדי להגיב", "error");
    try {
      const comment = await commentsAPI.add(dealId, text);
      setSelectedDeal(prev => ({ ...prev, comments: [...(prev?.comments || []), comment] }));
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Submit new deal ────────────────────────────────────────
  const submitDeal = async (deal) => {
    try {
      await dealsAPI.create(deal);
      setModal(null);
      fetchDeals();
      showToast(user.role === "admin" ? "העסקה פורסמה!" : "העסקה נשלחה לאישור ✅");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Open deal modal ────────────────────────────────────────
  const openDeal = async (id) => {
    try {
      const deal = await dealsAPI.get(id);
      setSelectedDeal(deal);
      setModal("deal");
    } catch (e) { showToast(e.message, "error"); }
  };

  // ── Admin actions ──────────────────────────────────────────
  const loadAdmin = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    const [d, u, s] = await Promise.all([adminAPI.deals(), adminAPI.users(), adminAPI.stats()]);
    setAdminDeals(d); setAdminUsers(u); setAdminStats(s);
  }, [user]);

  const adminUpdateDeal = async (id, patch) => {
    await adminAPI.updateDeal(id, patch);
    await loadAdmin();
    fetchDeals();
    showToast("עודכן!");
  };

  const adminDeleteDeal = async (id) => {
    await dealsAPI.delete(id);
    await loadAdmin();
    fetchDeals();
    showToast("נמחק");
  };

  const adminBanUser = async (id) => {
    await adminAPI.banUser(id);
    await loadAdmin();
    showToast("סטטוס משתמש עודכן");
  };

  return (
    <div style={{ fontFamily: "'Assistant','Heebo',Arial,sans-serif", direction: "rtl", minHeight: "100vh", background: "#f4f5f7", color: "#1a1a2e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        :root{--orange:#ff6b00;--red:#e83030;--blue:#1a73e8;--ice:#4db6ff;--dark:#1a1a2e;--mid:#444466;--border:#e2e4ea;--radius:14px;--shadow:0 2px 12px rgba(0,0,0,.08);--shadow-lg:0 8px 32px rgba(0,0,0,.14)}
        button{cursor:pointer;font-family:inherit} input,textarea,select{font-family:inherit}
        .btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;border:none;font-size:14px;font-weight:700;transition:all .2s}
        .btn-primary{background:var(--orange);color:#fff} .btn-primary:hover{background:#ff8c38;transform:translateY(-1px);box-shadow:0 4px 12px rgba(255,107,0,.35)}
        .btn-ghost{background:transparent;color:var(--mid);border:1px solid var(--border)} .btn-ghost:hover{background:#f0f0f4}
        .btn-danger{background:#e83030;color:#fff} .btn-danger:hover{background:#c02020}
        .btn-success{background:#1aaa55;color:#fff}
        .btn-outline{background:transparent;border:2px solid var(--orange);color:var(--orange)} .btn-outline:hover{background:var(--orange);color:#fff}
        input[type=text],input[type=email],input[type=password],input[type=number],input[type=url],textarea,select{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;outline:none;background:#fafafa;transition:.2s;direction:rtl;color:var(--dark)}
        input:focus,textarea:focus,select:focus{border-color:var(--orange);background:#fff;box-shadow:0 0 0 3px rgba(255,107,0,.12)}
        label{display:block;font-size:13px;font-weight:700;margin-bottom:5px;color:var(--mid)}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
        .modal-box{background:#fff;border-radius:20px;padding:32px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);animation:slideUp .25s ease}
        @keyframes slideUp{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}}
        .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:14px 28px;border-radius:12px;font-weight:700;z-index:9999;animation:fadeIn .3s ease;box-shadow:var(--shadow-lg)}
        @keyframes fadeIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .vote-btn{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 14px;border:2px solid;border-radius:12px;font-weight:800;font-size:13px;transition:.2s;background:#fff}
        .vote-btn:hover{transform:scale(1.05)}
        .vote-hot{border-color:#ff6b00;color:#ff6b00} .vote-hot.active{background:#ff6b00;color:#fff}
        .vote-cold{border-color:#4db6ff;color:#4db6ff} .vote-cold.active{background:#4db6ff;color:#fff}
        .deal-card{background:#fff;border-radius:16px;border:1px solid var(--border);transition:.2s;overflow:hidden}
        .deal-card:hover{box-shadow:0 8px 28px rgba(0,0,0,.12);transform:translateY(-2px)}
        .deal-card.featured{border:2px solid #ff6b00} .deal-card.expired{opacity:.6}
        .badge{padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block}
        ::-webkit-scrollbar{width:6px} ::-webkit-scrollbar-track{background:#f1f1f1} ::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px}
        @media(max-width:768px){.desktop-only{display:none!important}.main-grid{grid-template-columns:1fr!important}.sidebar{display:none}}
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#1a1a2e", color: "#fff", position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,.3)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, height: 64, justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>🔥</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 22, color: "#fff" }}>HOT<span style={{ color: "var(--orange)" }}>דילים</span></div>
                <div style={{ fontSize: 11, color: "#aaa" }}>קהילת הדילים הטובה בישראל</div>
              </div>
            </div>

            <div style={{ flex: 1, maxWidth: 420, position: "relative" }} className="desktop-only">
              <input
                placeholder="🔍  חפש דילים..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                style={{ background: "rgba(255,255,255,.1)", border: "1.5px solid rgba(255,255,255,.2)", color: "#fff", borderRadius: 30, padding: "10px 20px" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user ? (
                <>
                  {user.role === "admin" && (
                    <button className="btn btn-outline" style={{ borderColor: "#ffcc00", color: "#ffcc00", padding: "8px 14px", fontSize: 13 }}
                      onClick={() => { setModal("admin"); loadAdmin(); }}>
                      ⚙️ ניהול
                      {adminStats?.pending > 0 && <span style={{ background: "#e83030", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>{adminStats.pending}</span>}
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => setModal("newdeal")} style={{ padding: "8px 16px", fontSize: 13 }}>➕ שתף דיל</button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "rgba(255,255,255,.1)", borderRadius: 10 }}>
                    <span style={{ fontSize: 20 }}>{user.avatar}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{user.username}</div>
                      {user.role === "admin" && <div style={{ fontSize: 10, color: "#ffcc00" }}>מנהל</div>}
                    </div>
                    <button onClick={logout} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 11 }}>יציאה</button>
                  </div>
                </>
              ) : (
                <>
                  <button className="btn btn-ghost" style={{ color: "#fff", borderColor: "rgba(255,255,255,.3)", padding: "8px 16px", fontSize: 13 }} onClick={() => setModal("login")}>כניסה</button>
                  <button className="btn btn-primary" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setModal("register")}>הצטרף</button>
                </>
              )}
            </div>
          </div>

          {/* Category bar */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0", scrollbarWidth: "none" }}>
            {["הכל", ...categories.map(c => c.name)].map(c => (
              <button key={c} onClick={() => { setActiveCategory(c); setPage(1); }}
                style={{ border: "none", borderRadius: 20, padding: "5px 14px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap",
                  background: activeCategory === c ? "var(--orange)" : "rgba(255,255,255,.1)",
                  color: activeCategory === c ? "#fff" : "rgba(255,255,255,.7)", transition: ".2s" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }} className="main-grid">
          {/* Feed */}
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, background: "#fff", borderRadius: 12, padding: 4, marginBottom: 20, boxShadow: "var(--shadow)", border: "1px solid var(--border)", width: "fit-content" }}>
              {[["hot","🔥 הכי חמים"],["new","🆕 חדשים"]].map(([id, label]) => (
                <button key={id} onClick={() => { setActiveTab(id); setPage(1); }}
                  style={{ border: "none", borderRadius: 10, padding: "8px 18px", fontWeight: 700, fontSize: 14,
                    background: activeTab === id ? "var(--orange)" : "transparent",
                    color: activeTab === id ? "#fff" : "var(--mid)" }}>
                  {label}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--mid)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
                <div style={{ fontWeight: 700 }}>טוען דילים...</div>
              </div>
            ) : deals.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--mid)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>לא נמצאו דילים</div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {deals.map(deal => (
                    <DealCard key={deal.id} deal={deal} currentUser={user}
                      onVote={vote} onOpen={() => openDeal(deal.id)}
                      isAdmin={user?.role === "admin"}
                      onAdminUpdate={adminUpdateDeal}
                      onAdminDelete={adminDeleteDeal}
                    />
                  ))}
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        style={{ width: 36, height: 36, borderRadius: 8, border: "1.5px solid var(--border)",
                          background: p === page ? "var(--orange)" : "#fff",
                          color: p === page ? "#fff" : "var(--mid)", fontWeight: 700, fontSize: 14 }}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="sidebar" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {adminStats && user?.role === "admin" && (
              <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>📊 סטטיסטיקות</div>
                {[["🔥 סה״כ דילים",adminStats.total_deals],["⏳ ממתינים",adminStats.pending],["👥 משתמשים",adminStats.total_users],["💬 תגובות",adminStats.total_comments],["⭐ מוצגות",adminStats.featured]].map(([l,v])=>(
                  <div key={l} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--mid)",fontSize:14 }}>{l}</span>
                    <span style={{ fontWeight:800,fontSize:18,color:"var(--orange)" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Top deals */}
            <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 20, boxShadow: "var(--shadow)", border: "1px solid var(--border)" }}>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 16 }}>🏆 הכי חמים</div>
              {[...deals].sort((a,b)=>(b.hot-b.cold)-(a.hot-a.cold)).slice(0,5).map((d,i)=>(
                <div key={d.id} onClick={() => openDeal(d.id)}
                  style={{ display:"flex",gap:10,alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)",cursor:"pointer" }}>
                  <span style={{ fontWeight:900,fontSize:18,color:i===0?"#ffcc00":"var(--mid)",minWidth:24 }}>#{i+1}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,fontWeight:600,lineHeight:1.3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:180 }}>{d.title}</div>
                    <div style={{ fontSize:12,color:"var(--orange)",fontWeight:800 }}>₪{(+d.deal_price).toLocaleString()}</div>
                  </div>
                  <div style={{ fontSize:11,fontWeight:700,color:"#ff6b00" }}>🔥{d.hot-d.cold}</div>
                </div>
              ))}
            </div>

            {!user && (
              <div style={{ background: "linear-gradient(135deg,#ff6b00,#ff2d2d)", borderRadius: 16, padding: 20, color: "#fff", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔥</div>
                <div style={{ fontWeight: 800, fontSize: 17, marginBottom: 8 }}>הצטרף לקהילה!</div>
                <div style={{ fontSize: 13, marginBottom: 16, opacity: 0.9 }}>שתף דילים, הצבע, וחסוך כסף</div>
                <button className="btn" onClick={() => setModal("register")} style={{ background: "#fff", color: "var(--orange)", width: "100%", justifyContent: "center", fontWeight: 800 }}>הצטרף בחינם</button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODALS */}
      {modal === "login"    && <LoginModal onLogin={login} onClose={() => setModal(null)} onRegister={() => setModal("register")} />}
      {modal === "register" && <RegisterModal onRegister={register} onClose={() => setModal(null)} onLogin={() => setModal("login")} />}
      {modal === "newdeal"  && <NewDealModal categories={categories} onSubmit={submitDeal} onClose={() => setModal(null)} />}
      {modal === "deal"     && selectedDeal && (
        <DealModal deal={selectedDeal} currentUser={user} onVote={vote} onComment={addComment} onClose={() => setModal(null)} />
      )}
      {modal === "admin" && user?.role === "admin" && (
        <AdminPanel
          tab={adminTab} onTab={setAdminTab}
          deals={adminDeals} users={adminUsers} stats={adminStats}
          onClose={() => setModal(null)}
          onUpdate={adminUpdateDeal}
          onDelete={adminDeleteDeal}
          onBanUser={adminBanUser}
        />
      )}

      {toast && (
        <div className="toast" style={{ background: toast.type === "error" ? "#e83030" : "#1aaa55", color: "#fff" }}>
          {toast.type === "error" ? "❌" : "✅"} {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, currentUser, onVote, onOpen, isAdmin, onAdminUpdate, onAdminDelete }) {
  const temp = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  return (
    <div className={`deal-card${deal.is_featured ? " featured" : ""}${deal.is_expired ? " expired" : ""}`}>
      <div style={{ display:"flex",gap:6,padding:"12px 16px 0",flexWrap:"wrap" }}>
        <span className="badge" style={{ background: temp.bg, color: temp.color }}>{temp.label}</span>
        {deal.is_featured && <span className="badge" style={{ background:"#fff8e1",color:"#f59c00" }}>⭐ מוצגת</span>}
        {deal.is_expired && <span className="badge" style={{ background:"#fee",color:"#e83030" }}>⏰ פג תוקף</span>}
        {!deal.is_approved && <span className="badge" style={{ background:"#e3f2fd",color:"#1a73e8" }}>⏳ ממתין</span>}
        <span className="badge" style={{ background:"#f0f4ff",color:"var(--mid)" }}>{deal.category}</span>
        <span style={{ marginRight:"auto",fontSize:12,color:"#aaa",alignSelf:"center" }}>{timeAgo(deal.created_at)}</span>
      </div>
      <div style={{ display:"flex",gap:0,padding:16 }}>
        <div onClick={onOpen} style={{ width:120,height:100,borderRadius:12,overflow:"hidden",flexShrink:0,cursor:"pointer",marginLeft:16 }}>
          <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"} alt="" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div onClick={onOpen} style={{ fontWeight:800,fontSize:16,marginBottom:6,cursor:"pointer",lineHeight:1.3 }}>{deal.title}</div>
          <div style={{ fontSize:13,color:"var(--mid)",marginBottom:10,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical" }}>{deal.description}</div>
          <div style={{ display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
            <span style={{ fontWeight:900,fontSize:22,color:"var(--orange)" }}>₪{(+deal.deal_price).toLocaleString()}</span>
            {deal.original_price > deal.deal_price && <span style={{ textDecoration:"line-through",color:"#aaa",fontSize:15 }}>₪{(+deal.original_price).toLocaleString()}</span>}
            {discount > 0 && <span style={{ background:"var(--orange)",color:"#fff",borderRadius:8,padding:"2px 10px",fontSize:13,fontWeight:800 }}>-{discount}%</span>}
            <span style={{ color:"var(--mid)",fontSize:13,fontWeight:600 }}>📦 {deal.store}</span>
          </div>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8,alignItems:"center",justifyContent:"center",paddingRight:8 }}>
          <button className="vote-btn vote-hot" onClick={() => onVote(deal.id, "hot")}>🔥<span>{deal.hot}</span></button>
          <button className="vote-btn vote-cold" onClick={() => onVote(deal.id, "cold")}>🧊<span>{deal.cold}</span></button>
        </div>
      </div>
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderTop:"1px solid var(--border)",background:"#fafafa",borderRadius:"0 0 16px 16px",flexWrap:"wrap" }}>
        <span style={{ fontSize:13,color:"var(--mid)",display:"flex",alignItems:"center",gap:5 }}>{deal.avatar} {deal.username}</span>
        <button onClick={onOpen} style={{ fontSize:13,color:"var(--mid)",background:"none",border:"none",display:"flex",alignItems:"center",gap:4 }}>💬 {deal.comment_count} תגובות</button>
        <a href={deal.url} target="_blank" rel="noreferrer" style={{ fontSize:13,color:"var(--blue)",fontWeight:700 }}>🛒 לחנות</a>
        {isAdmin && (
          <div style={{ marginRight:"auto",display:"flex",gap:6 }}>
            {!deal.is_approved && <button className="btn btn-success" style={{ padding:"4px 10px",fontSize:11 }} onClick={() => onAdminUpdate(deal.id,{is_approved:1})}>✅ אשר</button>}
            <button className="btn btn-ghost" style={{ padding:"4px 10px",fontSize:11 }} onClick={() => onAdminUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐ הסר":"⭐ הצג"}</button>
            <button className="btn btn-ghost" style={{ padding:"4px 10px",fontSize:11 }} onClick={() => onAdminUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄":"⏰ פג"}</button>
            <button className="btn btn-danger" style={{ padding:"4px 10px",fontSize:11 }} onClick={() => onAdminDelete(deal.id)}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deal Modal ───────────────────────────────────────────────────────────────
function DealModal({ deal, currentUser, onVote, onComment, onClose }) {
  const [comment, setComment] = useState("");
  const temp = getTemp(+deal.hot, +deal.cold);
  const discount = pct(+deal.deal_price, +deal.original_price);
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 680 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
          <div style={{ display:"flex",gap:8 }}>
            <span className="badge" style={{ background:temp.bg,color:temp.color }}>{temp.label}</span>
            <span className="badge" style={{ background:"#f0f4ff",color:"var(--mid)" }}>{deal.category}</span>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,color:"var(--mid)",lineHeight:1,cursor:"pointer" }}>×</button>
        </div>
        <img src={deal.image_url || "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80"} alt="" style={{ width:"100%",height:220,objectFit:"cover",borderRadius:14,marginBottom:16 }} />
        <h2 style={{ fontWeight:900,fontSize:22,marginBottom:10,lineHeight:1.3 }}>{deal.title}</h2>
        <p style={{ color:"var(--mid)",fontSize:15,lineHeight:1.7,marginBottom:16 }}>{deal.description}</p>
        <div style={{ display:"flex",alignItems:"center",gap:16,marginBottom:20,flexWrap:"wrap" }}>
          <div>
            <div style={{ fontSize:12,color:"var(--mid)",marginBottom:2 }}>מחיר עסקה</div>
            <div style={{ fontWeight:900,fontSize:32,color:"var(--orange)" }}>₪{(+deal.deal_price).toLocaleString()}</div>
          </div>
          {deal.original_price > deal.deal_price && (
            <div>
              <div style={{ fontSize:12,color:"var(--mid)",marginBottom:2 }}>מחיר מקורי</div>
              <div style={{ textDecoration:"line-through",fontSize:20,color:"#aaa" }}>₪{(+deal.original_price).toLocaleString()}</div>
            </div>
          )}
          {discount > 0 && <div style={{ background:"var(--orange)",color:"#fff",borderRadius:12,padding:"8px 16px",fontSize:18,fontWeight:900 }}>חיסכון {discount}%</div>}
        </div>
        <div style={{ display:"flex",gap:12,marginBottom:20,padding:16,background:"#fafafa",borderRadius:14 }}>
          <button className="vote-btn vote-hot" style={{ flex:1 }} onClick={() => onVote(deal.id,"hot")}>🔥 חם! <span style={{ fontSize:18,fontWeight:900 }}>{deal.hot}</span></button>
          <button className="vote-btn vote-cold" style={{ flex:1 }} onClick={() => onVote(deal.id,"cold")}>🧊 קר <span style={{ fontSize:18,fontWeight:900 }}>{deal.cold}</span></button>
          <a href={deal.url} target="_blank" rel="noreferrer">
            <button className="btn btn-primary">🛒 לחנות</button>
          </a>
        </div>
        {/* Progress bar */}
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--mid)",marginBottom:4 }}>
            <span>🔥 חם ({deal.hot})</span><span>🧊 קר ({deal.cold})</span>
          </div>
          <div style={{ height:6,borderRadius:3,background:"#eee",overflow:"hidden" }}>
            <div style={{ height:"100%",borderRadius:3,transition:".5s",width:`${Math.round(+deal.hot/Math.max(+deal.hot+ +deal.cold,1)*100)}%`,background:"linear-gradient(to right,#ff6b00,#ff2d2d)" }} />
          </div>
        </div>
        {/* Comments */}
        <div>
          <div style={{ fontWeight:800,fontSize:16,marginBottom:14 }}>💬 תגובות ({deal.comments?.length || 0})</div>
          <div style={{ maxHeight:220,overflowY:"auto",marginBottom:14 }}>
            {!deal.comments?.length && <div style={{ color:"var(--mid)",textAlign:"center",padding:24,fontSize:14 }}>היה הראשון להגיב! 🎤</div>}
            {deal.comments?.map(c => (
              <div key={c.id} style={{ display:"flex",gap:10,marginBottom:14 }}>
                <span style={{ fontSize:24,flexShrink:0 }}>{c.avatar}</span>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:4 }}>
                    <span style={{ fontWeight:700,fontSize:13 }}>{c.username}</span>
                    <span style={{ color:"#aaa",fontSize:11 }}>{timeAgo(c.created_at)}</span>
                  </div>
                  <div style={{ background:"#f4f5f7",borderRadius:10,padding:"8px 12px",fontSize:14 }}>{c.text}</div>
                </div>
              </div>
            ))}
          </div>
          {currentUser ? (
            <div style={{ display:"flex",gap:10 }}>
              <span style={{ fontSize:24,flexShrink:0 }}>{currentUser.avatar}</span>
              <div style={{ flex:1,display:"flex",gap:8 }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => e.key==="Enter" && (onComment(deal.id,comment),setComment(""))} placeholder="כתוב תגובה..." style={{ flex:1 }} />
                <button className="btn btn-primary" onClick={() => { onComment(deal.id,comment); setComment(""); }} style={{ padding:"10px 16px" }}>שלח</button>
              </div>
            </div>
          ) : (
            <div style={{ background:"#fff8f0",border:"1px dashed var(--orange)",borderRadius:12,padding:14,textAlign:"center",fontSize:14,color:"var(--mid)" }}>
              🔐 התחבר כדי להוסיף תגובה
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Auth Modals ──────────────────────────────────────────────────────────────
function LoginModal({ onLogin, onClose, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:400 }}>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:48,marginBottom:8 }}>🔥</div>
          <h2 style={{ fontWeight:900,fontSize:24 }}>ברוך הבא!</h2>
          <p style={{ color:"var(--mid)",fontSize:14,marginTop:4 }}>התחבר כדי להצביע ולשתף דילים</p>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div><label>שם משתמש</label><input placeholder="הכנס שם משתמש" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <div><label>סיסמה</label><input type="password" placeholder="הכנס סיסמה" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && onLogin(username,password)} /></div>
          <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:14,fontSize:16 }} onClick={() => onLogin(username,password)}>כניסה</button>
          <div style={{ textAlign:"center",fontSize:14,color:"var(--mid)" }}>
            אין לך חשבון?{" "}
            <button onClick={onRegister} style={{ background:"none",border:"none",color:"var(--orange)",fontWeight:700,fontSize:14,cursor:"pointer" }}>הירשם עכשיו</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegisterModal({ onRegister, onClose, onLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:400 }}>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ fontSize:48,marginBottom:8 }}>🎉</div>
          <h2 style={{ fontWeight:900,fontSize:24 }}>הצטרף לקהילה</h2>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div><label>שם משתמש</label><input placeholder="בחר שם ייחודי" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <div><label>אימייל</label><input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label>סיסמה</label><input type="password" placeholder="לפחות 6 תווים" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:14,fontSize:16 }} onClick={() => onRegister(username,email,password)}>🚀 יצירת חשבון</button>
          <div style={{ textAlign:"center",fontSize:14,color:"var(--mid)" }}>
            כבר יש לך חשבון?{" "}
            <button onClick={onLogin} style={{ background:"none",border:"none",color:"var(--orange)",fontWeight:700,fontSize:14,cursor:"pointer" }}>כניסה</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── New Deal Modal ───────────────────────────────────────────────────────────
function NewDealModal({ categories, onSubmit, onClose }) {
  const [form, setForm] = useState({ title:"",description:"",url:"",image_url:"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=400&q=80",store:"",original_price:"",deal_price:"",category_id:"" });
  const set = (k,v) => setForm(p => ({...p,[k]:v}));
  const discount = form.original_price && form.deal_price ? pct(+form.deal_price,+form.original_price) : 0;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:580 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24 }}>
          <h2 style={{ fontWeight:900,fontSize:22 }}>🛍️ שתף דיל חדש</h2>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,color:"var(--mid)",cursor:"pointer" }}>×</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
          <div><label>כותרת *</label><input placeholder="תאר את הדיל..." value={form.title} onChange={e => set("title",e.target.value)} /></div>
          <div><label>תיאור</label><textarea rows={3} placeholder="פרטים נוספים..." value={form.description} onChange={e => set("description",e.target.value)} style={{ resize:"vertical" }} /></div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label>מחיר מקורי (₪)</label><input type="number" placeholder="999" value={form.original_price} onChange={e => set("original_price",e.target.value)} /></div>
            <div><label>מחיר עסקה (₪) {discount>0 && <span style={{ color:"var(--orange)" }}>-{discount}%</span>}</label><input type="number" placeholder="599" value={form.deal_price} onChange={e => set("deal_price",e.target.value)} /></div>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <div><label>חנות *</label><input placeholder="Amazon, KSP..." value={form.store} onChange={e => set("store",e.target.value)} /></div>
            <div><label>קטגוריה *</label>
              <select value={form.category_id} onChange={e => set("category_id",e.target.value)}>
                <option value="">בחר קטגוריה...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div><label>קישור לעסקה</label><input placeholder="https://..." value={form.url} onChange={e => set("url",e.target.value)} /></div>
          <div><label>תמונה (URL)</label><input placeholder="https://..." value={form.image_url} onChange={e => set("image_url",e.target.value)} /></div>
          {form.image_url && <img src={form.image_url} alt="" onError={e => e.target.style.display="none"} style={{ width:"100%",height:120,objectFit:"cover",borderRadius:10 }} />}
          <button className="btn btn-primary" style={{ width:"100%",justifyContent:"center",padding:14,fontSize:16 }}
            onClick={() => { if(!form.title||!form.deal_price||!form.category_id||!form.store) return alert("מלא שדות חובה"); onSubmit(form); }}>
            🚀 פרסם דיל
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel({ tab, onTab, deals, users, stats, onClose, onUpdate, onDelete, onBanUser }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:780,maxHeight:"90vh" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20 }}>
          <div><h2 style={{ fontWeight:900,fontSize:22 }}>⚙️ פאנל ניהול</h2></div>
          <button onClick={onClose} style={{ background:"none",border:"none",fontSize:24,cursor:"pointer" }}>×</button>
        </div>

        {stats && (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20 }}>
            {[["📋 דילים",stats.total_deals,"#fff5f0","var(--orange)"],["⏳ ממתינים",stats.pending,"#fff0f0","var(--red)"],["👥 משתמשים",stats.total_users,"#f0f8ff","var(--blue)"],["⭐ מוצגים",stats.featured,"#fffdf0","#f59c00"]].map(([l,v,bg,c])=>(
              <div key={l} style={{ background:bg,borderRadius:12,padding:14,textAlign:"center" }}>
                <div style={{ fontSize:22,fontWeight:900,color:c }}>{v}</div>
                <div style={{ fontSize:12,color:"var(--mid)",marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:"flex",gap:4,background:"#f4f5f7",borderRadius:10,padding:4,marginBottom:20 }}>
          {[["deals","📋 דילים"],["pending","⏳ ממתינים"],["users","👥 משתמשים"]].map(([id,label])=>(
            <button key={id} onClick={() => onTab(id)} style={{ flex:1,border:"none",borderRadius:8,padding:"8px 12px",fontWeight:700,fontSize:13,
              background:tab===id?"#fff":"transparent",color:tab===id?"var(--orange)":"var(--mid)",boxShadow:tab===id?"var(--shadow)":"none" }}>
              {label}{id==="pending"&&stats?.pending>0?` (${stats.pending})`:""}
            </button>
          ))}
        </div>

        <div style={{ maxHeight:440,overflowY:"auto" }}>
          {(tab==="deals"?deals:tab==="pending"?deals.filter(d=>!d.is_approved):null)?.map(deal => (
            <div key={deal.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
              <img src={deal.image_url||"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&q=60"} alt="" style={{ width:56,height:44,objectFit:"cover",borderRadius:8,flexShrink:0 }} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{deal.title}</div>
                <div style={{ fontSize:11,color:"var(--mid)",marginTop:2 }}>
                  {deal.store} · {deal.category} · {deal.avatar}{deal.username}
                  {!deal.is_approved && <span style={{ color:"var(--blue)",marginRight:6 }}>· ממתין</span>}
                  {deal.is_featured && <span style={{ color:"#f59c00",marginRight:6 }}>· מוצג</span>}
                </div>
              </div>
              <div style={{ display:"flex",gap:5,flexShrink:0 }}>
                {!deal.is_approved && <button className="btn btn-success" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_approved:1})}>✅</button>}
                <button className="btn btn-ghost" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐":"☆"}</button>
                <button className="btn btn-ghost" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄":"⏰"}</button>
                <button className="btn btn-danger" style={{ padding:"4px 8px",fontSize:11 }} onClick={() => onDelete(deal.id)}>🗑️</button>
              </div>
            </div>
          ))}

          {tab==="users" && users.map(u => (
            <div key={u.id} style={{ display:"flex",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid var(--border)" }}>
              <span style={{ fontSize:32 }}>{u.avatar}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700,fontSize:14 }}>
                  {u.username} {u.role==="admin" && <span style={{ background:"#ffcc00",color:"#333",borderRadius:4,padding:"1px 6px",fontSize:11 }}>מנהל</span>}
                  {u.is_banned && <span style={{ background:"#fee",color:"var(--red)",borderRadius:4,padding:"1px 6px",fontSize:11,marginRight:4 }}>חסום</span>}
                </div>
                <div style={{ fontSize:12,color:"var(--mid)" }}>{u.email} · נרשם: {u.created_at?.split("T")[0]}</div>
              </div>
              {u.role !== "admin" && (
                <button className={`btn ${u.is_banned?"btn-success":"btn-danger"}`} style={{ padding:"4px 12px",fontSize:11 }} onClick={() => onBanUser(u.id)}>
                  {u.is_banned?"🔓 שחרר":"🚫 חסום"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
