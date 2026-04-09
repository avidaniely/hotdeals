import React, { useState, useEffect } from "react";
import { hunterAPI } from "../api";

export default function AdminPage({ tab, onTab, deals, users, stats, categories, onClose, onUpdate, onDelete, onBanUser }) {
  // Hunter state
  const [hunting,       setHunting]       = useState(false);
  const [huntResult,    setHuntResult]    = useState(null);
  const [huntingSource, setHuntingSource] = useState(null);
  const [sources,       setSources]       = useState([]);
  const [srcLoaded,     setSrcLoaded]     = useState(false);
  const [newSrc,        setNewSrc]        = useState({ name:'', url:'', store:'', category_name:'אלקטרוניקה' });
  const [addingSrc,     setAddingSrc]     = useState(false);
  const [editingSrc,    setEditingSrc]    = useState(null);
  const [editSrcData,   setEditSrcData]   = useState({});
  // AI config
  const [aiConfig,      setAiConfig]      = useState(null);
  const [aiSaving,      setAiSaving]      = useState(false);
  const [aiSaved,       setAiSaved]       = useState(false);
  // Logs
  const [logs,          setLogs]          = useState([]);
  const [logsLoaded,    setLogsLoaded]    = useState(false);
  // Prompts
  const [prompts,       setPrompts]       = useState([]);
  const [promptsLoaded, setPromptsLoaded] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [promptDraft,   setPromptDraft]   = useState({ name:'', description:'', prompt_text:'' });
  const [promptSaving,  setPromptSaving]  = useState(false);
  // OpenAI
  const [oaiCfg,        setOaiCfg]        = useState(null);
  const [oaiLoaded,     setOaiLoaded]     = useState(false);
  const [oaiSaving,     setOaiSaving]     = useState(false);
  const [oaiSaved,      setOaiSaved]      = useState(false);
  const [oaiRunning,    setOaiRunning]    = useState(false);
  const [oaiRunResult,  setOaiRunResult]  = useState(null);
  // Import
  const [importJson,    setImportJson]    = useState('');
  const [importing,     setImporting]     = useState(false);
  const [importResult,  setImportResult]  = useState(null);

  useEffect(() => {
    if ((tab === 'sources' || tab === 'ai') && !srcLoaded) {
      hunterAPI.getSources().then(r => { setSources(r); setSrcLoaded(true); }).catch(() => {});
    }
    if (tab === 'ai' && !aiConfig) {
      hunterAPI.getConfig().then(cfg => setAiConfig(cfg)).catch(() => {});
    }
    if (tab === 'logs' && !logsLoaded) {
      hunterAPI.getLogs().then(r => { setLogs(r); setLogsLoaded(true); }).catch(() => {});
    }
    if ((tab === 'prompts' || tab === 'sources') && !promptsLoaded) {
      hunterAPI.getPrompts().then(r => { setPrompts(r); setPromptsLoaded(true); }).catch(() => {});
    }
    if (tab === 'openai' && !oaiLoaded) {
      hunterAPI.getOpenAIConfig().then(cfg => { setOaiCfg(cfg); setOaiLoaded(true); }).catch(() => {});
    }
  }, [tab, srcLoaded, aiConfig, logsLoaded, promptsLoaded, oaiLoaded]);

  const runHunterNow = async () => {
    setHunting(true); setHuntResult(null);
    try { const r = await hunterAPI.run(); setHuntResult(r); setLogsLoaded(false); }
    catch (e) { setHuntResult({ error: e.message }); }
    finally { setHunting(false); }
  };
  const runSourceNow = async (id) => {
    setHuntingSource(id); setHuntResult(null);
    try {
      const r = await hunterAPI.runSource(id);
      if (r.started) {
        setHuntResult({ info: 'הסריקה הופעלה ברקע. עבור ללשונית לוגים לאחר ~30 שניות.' });
        setTimeout(() => setLogsLoaded(false), 30000);
      } else { setHuntResult(r); setLogsLoaded(false); }
    }
    catch (e) { setHuntResult({ error: e.message }); }
    finally { setHuntingSource(null); }
  };
  const toggleSource  = async (id, cur) => { await hunterAPI.toggleSource(id, cur ? 0 : 1); setSources(s => s.map(x => x.id===id ? {...x,is_active:cur?0:1} : x)); };
  const toggleProxy   = async (id, cur) => { await hunterAPI.toggleProxy(id, cur ? 0 : 1);  setSources(s => s.map(x => x.id===id ? {...x,use_proxy:cur?0:1} : x)); };
  const toggleSearch  = async (id, cur) => { await hunterAPI.updateSource(id,{use_search:cur?0:1}); setSources(s => s.map(x => x.id===id ? {...x,use_search:cur?0:1} : x)); };
  const saveEditSrc   = async (id) => { await hunterAPI.updateSource(id, editSrcData); setSources(s => s.map(x => x.id===id ? {...x,...editSrcData} : x)); setEditingSrc(null); };
  const deleteSource  = async (id) => { await hunterAPI.deleteSource(id); setSources(s => s.filter(x => x.id!==id)); };
  const addSource     = async () => {
    if (!newSrc.name || !newSrc.url || !newSrc.store) return;
    setAddingSrc(true);
    try { const created = await hunterAPI.addSource(newSrc); setSources(s => [created,...s]); setNewSrc({ name:'',url:'',store:'',category_name:'אלקטרוניקה' }); }
    finally { setAddingSrc(false); }
  };
  const saveAiConfig  = async () => {
    setAiSaving(true);
    try { await hunterAPI.saveConfig(aiConfig); setAiSaved(true); setTimeout(() => setAiSaved(false), 2500); }
    finally { setAiSaving(false); }
  };

  const TABS = [
    { id:'overview', icon:'📊', label:'סקירה' },
    { id:'deals',    icon:'📋', label:'דילים' },
    { id:'pending',  icon:'⏳', label:'ממתינים', badge: stats?.pending > 0 ? stats.pending : null },
    { id:'users',    icon:'👥', label:'משתמשים' },
    { id:'sources',  icon:'🌐', label:'מקורות' },
    { id:'ai',       icon:'🤖', label:'AI הגדרות' },
    { id:'prompts',  icon:'📝', label:'פרומפטים' },
    { id:'openai',   icon:'✨', label:'OpenAI' },
    { id:'logs',     icon:'📋', label:'לוג' },
  ];

  const inputStyle = { padding:"9px 12px", borderRadius:8, border:"1.5px solid var(--border)", fontSize:13, background:"var(--surface)", color:"var(--text)", width:"100%", boxSizing:"border-box" };
  const fieldLabel = { display:"block", fontSize:12, fontWeight:700, color:"var(--text-2)", marginBottom:5 };

  return (
    <div style={{ minHeight:"calc(100vh - 72px)", background:"var(--bg)", display:"flex", flexDirection:"column" }}>

      {/* Page Header */}
      <div style={{ background:"linear-gradient(135deg,var(--brand-dk),var(--brand))", padding:"16px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <span style={{ fontSize:24 }}>⚙️</span>
          <div>
            <div style={{ fontWeight:900, fontSize:17, color:"#fff" }}>פאנל ניהול</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.6)" }}>hotILdeals admin</div>
          </div>
        </div>
        <button onClick={() => { onClose(); window.scrollTo(0,0); }}
          style={{ background:"rgba(255,255,255,.16)", border:"1.5px solid rgba(255,255,255,.3)", color:"#fff", borderRadius:10, padding:"7px 16px", fontSize:13, fontWeight:700, cursor:"pointer" }}>
          ← חזור לאתר
        </button>
      </div>

      {/* Body */}
      <div style={{ display:"flex", flex:1, maxWidth:1300, width:"100%", margin:"0 auto", padding:"20px", gap:18, alignItems:"flex-start" }}>

        {/* Sidebar */}
        <div style={{ width:172, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", padding:"10px 6px", display:"flex", flexDirection:"column", gap:2, flexShrink:0, boxShadow:"var(--sh-sm)", position:"sticky", top:20 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => onTab(t.id)}
              style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 12px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700, fontSize:13, transition:"var(--tr)", textAlign:"right", width:"100%", position:"relative",
                background: tab===t.id ? "var(--brand)" : "transparent",
                color: tab===t.id ? "#fff" : "var(--text-2)" }}>
              <span style={{ fontSize:15, flexShrink:0 }}>{t.icon}</span>
              <span style={{ flex:1 }}>{t.label}</span>
              {t.badge && <span style={{ background:"var(--danger)", color:"#fff", borderRadius:10, padding:"1px 5px", fontSize:10, fontWeight:900 }}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Content panel */}
        <div style={{ flex:1, background:"var(--surface)", borderRadius:12, border:"1px solid var(--border)", padding:24, boxShadow:"var(--sh-sm)", minHeight:480 }}>

          {/* ── OVERVIEW ── */}
          {tab==="overview" && (
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--text)", marginBottom:18 }}>סקירה כללית</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:12, marginBottom:22 }}>
                {[["📋","דילים סה״כ",stats?.total_deals,"var(--brand)","var(--brand-lt)"],
                  ["⏳","ממתינים",stats?.pending,"var(--danger)","#FFF0F0"],
                  ["👥","משתמשים",stats?.total_users,"var(--brand)","var(--brand-lt)"],
                  ["💬","תגובות",stats?.total_comments,"var(--success)","#F0FFF7"],
                  ["⭐","מוצגים",stats?.featured,"var(--warn)","#FFFBF0"],
                ].map(([icon,label,val,color,bg]) => (
                  <div key={label} style={{ background:bg, borderRadius:12, padding:"16px 14px", border:`1px solid ${color}22`, textAlign:"center" }}>
                    <div style={{ fontSize:26, marginBottom:5 }}>{icon}</div>
                    <div style={{ fontSize:26, fontWeight:900, color, lineHeight:1 }}>{val ?? '—'}</div>
                    <div style={{ fontSize:12, color:"var(--text-2)", marginTop:3 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"linear-gradient(135deg,var(--brand-dk),var(--brand))", borderRadius:12, padding:22 }}>
                <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:"#fff", marginBottom:3 }}>🤖 Deal Hunter</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,.7)" }}>סורק חנויות ישראליות עם AI · רץ אוטומטית לפי הגדרות</div>
                  </div>
                  <button className="btn" onClick={runHunterNow} disabled={hunting}
                    style={{ background:"rgba(255,255,255,.18)", color:"#fff", border:"1.5px solid rgba(255,255,255,.35)", padding:"9px 22px", fontSize:13, flexShrink:0 }}>
                    {hunting ? "🔍 סורק..." : "▶ הרץ עכשיו"}
                  </button>
                </div>
                {huntResult && !huntResult.error && (
                  <div style={{ marginTop:12, background:"rgba(255,255,255,.1)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#fff", display:"flex", gap:16, flexWrap:"wrap" }}>
                    <span>✅ נמצאו: <strong>{huntResult.found}</strong></span>
                    <span>⏭ כפולים: <strong>{huntResult.skipped}</strong></span>
                    <span>⏱ זמן: <strong>{huntResult.duration}s</strong></span>
                    {huntResult.errors?.length > 0 && <span style={{ color:"#ffaaaa" }}>⚠️ {huntResult.errors.length} שגיאות</span>}
                  </div>
                )}
                {huntResult?.info  && <div style={{ marginTop:12, background:"rgba(255,255,255,.1)", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#ffffaa" }}>⏳ {huntResult.info}</div>}
                {huntResult?.error && <div style={{ marginTop:12, background:"rgba(255,0,0,.25)", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#ffcccc" }}>❌ {huntResult.error}</div>}
              </div>
            </div>
          )}

          {/* ── DEALS / PENDING ── */}
          {(tab==="deals"||tab==="pending") && (
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--text)", marginBottom:18 }}>
                {tab==="deals" ? `📋 כל הדילים (${deals.length})` : `⏳ ממתינים לאישור (${deals.filter(d=>!d.is_approved).length})`}
              </div>
              {(tab==="deals" ? deals : deals.filter(d=>!d.is_approved)).map(deal => (
                <div key={deal.id} style={{ display:"flex", gap:12, alignItems:"center", padding:"11px 0", borderBottom:"1px solid var(--border)" }}>
                  <img src={deal.image_url||"https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=100&q=60"} alt=""
                    style={{ width:56, height:44, objectFit:"cover", borderRadius:8, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:13, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>{deal.title}</div>
                    <div style={{ fontSize:11, color:"var(--text-2)", marginTop:3, display:"flex", gap:6, flexWrap:"wrap" }}>
                      <span>₪{(+deal.deal_price).toLocaleString()}</span>
                      <span>·</span><span>{deal.store}</span>
                      <span>·</span><span>{deal.category}</span>
                      <span>·</span><span>{deal.avatar}{deal.username}</span>
                      {!deal.is_approved && <span style={{ color:"var(--brand)", fontWeight:700 }}>ממתין</span>}
                      {deal.is_featured  && <span style={{ color:"var(--warn)", fontWeight:700 }}>מוצג</span>}
                      {deal.is_expired   && <span style={{ color:"var(--danger)", fontWeight:700 }}>פג תוקף</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                    {!deal.is_approved && <button className="btn btn-success" style={{ padding:"4px 9px", fontSize:11 }} onClick={() => onUpdate(deal.id,{is_approved:1})}>✅ אשר</button>}
                    <button className="btn btn-ghost" style={{ padding:"4px 7px", fontSize:11 }} onClick={() => onUpdate(deal.id,{is_featured:deal.is_featured?0:1})}>{deal.is_featured?"⭐":"☆"}</button>
                    <button className="btn btn-ghost" style={{ padding:"4px 7px", fontSize:11 }} onClick={() => onUpdate(deal.id,{is_expired:deal.is_expired?0:1})}>{deal.is_expired?"🔄":"⏰"}</button>
                    <button className="btn btn-danger" style={{ padding:"4px 7px", fontSize:11 }} onClick={() => onDelete(deal.id)}>🗑️</button>
                  </div>
                </div>
              ))}
              {tab==="pending" && deals.filter(d=>!d.is_approved).length===0 && (
                <div style={{ textAlign:"center", padding:"40px 24px", color:"var(--text-2)" }}>
                  <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
                  <div style={{ fontWeight:700, fontSize:15 }}>אין דילים ממתינים</div>
                </div>
              )}
            </div>
          )}

          {/* ── USERS ── */}
          {tab==="users" && (
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--text)", marginBottom:18 }}>👥 משתמשים ({users.length})</div>
              {users.map(u => (
                <div key={u.id} style={{ display:"flex", gap:14, alignItems:"center", padding:"11px 0", borderBottom:"1px solid var(--border)" }}>
                  <span style={{ fontSize:32, flexShrink:0 }}>{u.avatar}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:14, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      {u.username}
                      {u.role==="admin"  && <span style={{ background:"linear-gradient(135deg,#FFD700,#FFA500)", color:"#333", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:800 }}>מנהל</span>}
                      {u.is_banned       && <span style={{ background:"#fee", color:"var(--danger)", borderRadius:6, padding:"1px 7px", fontSize:11, fontWeight:800 }}>חסום</span>}
                    </div>
                    <div style={{ fontSize:12, color:"var(--text-2)", marginTop:2 }}>{u.email} · נרשם: {u.created_at?.split("T")[0]}</div>
                  </div>
                  {u.role !== "admin" && (
                    <button className={`btn ${u.is_banned?"btn-success":"btn-danger"}`} style={{ padding:"5px 12px", fontSize:12 }} onClick={() => onBanUser(u.id)}>
                      {u.is_banned ? "🔓 שחרר" : "🚫 חסום"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── SOURCES ── */}
          {tab==="sources" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:5 }}>
                <div style={{ fontWeight:900, fontSize:18, color:"var(--text)" }}>🌐 מקורות סריקה</div>
                <button className="btn btn-primary" onClick={runHunterNow} disabled={hunting||!!huntingSource} style={{ fontSize:13 }}>
                  {hunting ? "🔍 סורק הכל..." : "▶ הרץ הכל"}
                </button>
              </div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginBottom:12 }}>הגדר אילו אתרים ה-AI יסרוק לדילים חדשים</div>
              {huntResult && !huntResult.error && (
                <div style={{ marginBottom:12, padding:"9px 14px", borderRadius:8, background:"rgba(0,200,100,.1)", fontSize:13, color:"var(--success)", fontWeight:700 }}>
                  ✅ נמצאו {huntResult.found} דילים · {huntResult.skipped} כפולים · {huntResult.duration}s
                  {huntResult.errors?.length>0 && <span style={{ color:"var(--danger)", marginRight:8 }}> · ⚠️ {huntResult.errors.length} שגיאות</span>}
                </div>
              )}
              {huntResult?.error && <div style={{ marginBottom:12, padding:"9px 14px", borderRadius:8, background:"rgba(255,0,0,.08)", fontSize:13, color:"var(--danger)", fontWeight:700 }}>❌ {huntResult.error}</div>}

              {/* Add form */}
              <div style={{ background:"var(--surface-2)", borderRadius:12, padding:16, marginBottom:18, border:"1px solid var(--border)" }}>
                <div style={{ fontWeight:700, fontSize:13, marginBottom:12, color:"var(--text)" }}>+ הוסף מקור חדש</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                  <div><label style={fieldLabel}>שם מקור</label><input placeholder="KSP, Bug..." value={newSrc.name} onChange={e=>setNewSrc(s=>({...s,name:e.target.value}))} style={inputStyle} /></div>
                  <div><label style={fieldLabel}>שם חנות</label><input placeholder="KSP" value={newSrc.store} onChange={e=>setNewSrc(s=>({...s,store:e.target.value}))} style={inputStyle} /></div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:12 }}>
                  <div><label style={fieldLabel}>URL</label><input placeholder="https://ksp.co.il/..." value={newSrc.url} onChange={e=>setNewSrc(s=>({...s,url:e.target.value}))} style={inputStyle} /></div>
                  <div><label style={fieldLabel}>קטגוריה</label>
                    <select value={newSrc.category_name} onChange={e=>setNewSrc(s=>({...s,category_name:e.target.value}))} style={inputStyle}>
                      {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ padding:"8px 20px", fontSize:13 }} onClick={addSource} disabled={addingSrc}>
                  {addingSrc ? "שומר..." : "+ הוסף"}
                </button>
              </div>

              {!srcLoaded && <div style={{ textAlign:"center", padding:32, color:"var(--text-2)" }}>טוען...</div>}
              {srcLoaded && sources.length===0 && (
                <div style={{ textAlign:"center", padding:40, color:"var(--text-2)" }}>
                  <div style={{ fontSize:36, marginBottom:8 }}>🌐</div>
                  <div style={{ fontWeight:700 }}>אין מקורות — הוסף את הראשון</div>
                </div>
              )}
              {sources.map(src => (
                <div key={src.id} style={{ borderBottom:"1px solid var(--border)" }}>
                  <div style={{ display:"flex", gap:12, alignItems:"center", padding:"12px 0" }}>
                    <div style={{ width:38, height:38, borderRadius:8, background:"var(--brand-lt)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>🌐</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:"var(--text)" }}>
                        {src.name}
                        <span style={{ fontWeight:400, color:"var(--text-2)", fontSize:11, marginRight:8 }}>{src.store} · {src.category_name}</span>
                      </div>
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{src.url}</div>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0, alignItems:"center", flexWrap:"wrap" }}>
                      <select value={src.prompt_id||''} onChange={async e => {
                        const pid = e.target.value ? +e.target.value : null;
                        await hunterAPI.assignPrompt(src.id, pid);
                        setSources(s => s.map(x => x.id===src.id ? {...x,prompt_id:pid,prompt_name:prompts.find(p=>p.id===pid)?.name||null} : x));
                      }} style={{ padding:"4px 8px", fontSize:11, borderRadius:6, border:"1.5px solid var(--border)", background:"var(--surface)", color:"var(--text)", cursor:"pointer" }}>
                        <option value="">🌐 גלובלי</option>
                        {prompts.map(p=><option key={p.id} value={p.id}>📝 {p.name}</option>)}
                      </select>
                      <button onClick={() => toggleSource(src.id,src.is_active)} style={{ padding:"4px 12px", fontSize:11, borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, background:src.is_active?"#e8f5e9":"#fce4e4", color:src.is_active?"#2e7d32":"#c62828" }}>
                        {src.is_active ? "● פעיל" : "○ מושהה"}
                      </button>
                      <button onClick={() => toggleProxy(src.id,src.use_proxy)} style={{ padding:"4px 10px", fontSize:11, borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, background:src.use_proxy?"#fff3ee":"var(--surface-3)", color:src.use_proxy?"var(--brand)":"var(--text-3)" }}>
                        {src.use_proxy ? "🔒 VPN" : "🌍 ישיר"}
                      </button>
                      <button onClick={async () => {
                        const next = (src.adapter_mode||'http')==='http' ? 'browser' : 'http';
                        await hunterAPI.updateSource(src.id,{adapter_mode:next});
                        setSources(s => s.map(x => x.id===src.id ? {...x,adapter_mode:next} : x));
                      }} style={{ padding:"4px 10px", fontSize:11, borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, background:(src.adapter_mode||'http')==='browser'?"#f3e8ff":"var(--surface-3)", color:(src.adapter_mode||'http')==='browser'?"#6b21a8":"var(--text-3)" }}>
                        {(src.adapter_mode||'http')==='browser' ? "🖥️ דפדפן" : "⚡ HTTP"}
                      </button>
                      <button onClick={() => toggleSearch(src.id,src.use_search)} style={{ padding:"4px 10px", fontSize:11, borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, background:src.use_search?"#fff8e1":"var(--surface-3)", color:src.use_search?"#e65100":"var(--text-3)" }}>
                        {src.use_search ? "🔎 חיפוש" : "📄 סריקה"}
                      </button>
                      <button onClick={() => runSourceNow(src.id)} disabled={huntingSource===src.id||hunting}
                        style={{ padding:"4px 12px", fontSize:11, borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, background:"var(--brand)", color:"#fff", opacity:(huntingSource===src.id||hunting)?0.6:1 }}>
                        {huntingSource===src.id ? "🔍..." : "▶ הרץ"}
                      </button>
                      <button className="btn btn-ghost" style={{ padding:"4px 8px", fontSize:11 }}
                        onClick={() => { setEditingSrc(editingSrc===src.id?null:src.id); setEditSrcData({name:src.name,url:src.url,store:src.store,category_name:src.category_name,search_query:src.search_query||''}); }}>
                        ✏️
                      </button>
                      <button className="btn btn-danger" style={{ padding:"4px 8px", fontSize:11 }} onClick={() => deleteSource(src.id)}>🗑️</button>
                    </div>
                  </div>
                  {editingSrc===src.id && (
                    <div style={{ background:"var(--surface-2)", borderRadius:10, padding:14, marginBottom:12, border:"1px solid var(--border)" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
                        <div><label style={fieldLabel}>שם מקור</label><input value={editSrcData.name||''} onChange={e=>setEditSrcData(d=>({...d,name:e.target.value}))} style={inputStyle} /></div>
                        <div><label style={fieldLabel}>שם חנות</label><input value={editSrcData.store||''} onChange={e=>setEditSrcData(d=>({...d,store:e.target.value}))} style={inputStyle} /></div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 }}>
                        <div><label style={fieldLabel}>URL</label><input value={editSrcData.url||''} onChange={e=>setEditSrcData(d=>({...d,url:e.target.value}))} style={{...inputStyle,direction:"ltr"}} /></div>
                        <div><label style={fieldLabel}>קטגוריה</label>
                          <select value={editSrcData.category_name||''} onChange={e=>setEditSrcData(d=>({...d,category_name:e.target.value}))} style={inputStyle}>
                            {categories.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      {src.use_search && (
                        <div style={{ marginBottom:10 }}>
                          <label style={fieldLabel}>שאילתת חיפוש (DuckDuckGo)</label>
                          <input value={editSrcData.search_query||''} onChange={e=>setEditSrcData(d=>({...d,search_query:e.target.value}))} placeholder={`${src.store} מבצע deals`} style={{...inputStyle,direction:"ltr"}} />
                        </div>
                      )}
                      <div style={{ display:"flex", gap:8 }}>
                        <button className="btn btn-primary" style={{ padding:"6px 18px", fontSize:12 }} onClick={() => saveEditSrc(src.id)}>💾 שמור</button>
                        <button className="btn btn-ghost" style={{ padding:"6px 12px", fontSize:12 }} onClick={() => setEditingSrc(null)}>ביטול</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── AI SETTINGS ── */}
          {tab==="ai" && (
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--text)", marginBottom:5 }}>🤖 הגדרות AI</div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginBottom:22 }}>הגדר ספק AI, מודל, טוקן, פרומפט ותזמון אוטומטי</div>
              {!aiConfig ? (
                <div style={{ textAlign:"center", padding:40, color:"var(--text-2)" }}>טוען הגדרות...</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                  <div style={{ background:"var(--surface-2)", borderRadius:12, padding:18, border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:14 }}>🔌 ספק AI</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                      <div><label style={fieldLabel}>ספק</label>
                        <select value={aiConfig.ai_provider||'anthropic'} onChange={e=>setAiConfig(c=>({...c,ai_provider:e.target.value}))} style={inputStyle}>
                          <option value="anthropic">Anthropic (Claude)</option>
                          <option value="openai">OpenAI (GPT)</option>
                        </select>
                      </div>
                      <div><label style={fieldLabel}>מודל</label><input value={aiConfig.ai_model||''} onChange={e=>setAiConfig(c=>({...c,ai_model:e.target.value}))} placeholder="claude-haiku-4-5-20251001" style={inputStyle} /></div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div><label style={fieldLabel}>API Key</label><input type="password" value={aiConfig.ai_api_key||''} onChange={e=>setAiConfig(c=>({...c,ai_api_key:e.target.value}))} placeholder="sk-ant-..." style={inputStyle} /></div>
                      <div><label style={fieldLabel}>מקסימום טוקנים</label><input type="number" value={aiConfig.ai_max_tokens||1800} onChange={e=>setAiConfig(c=>({...c,ai_max_tokens:e.target.value}))} min={500} max={4000} style={inputStyle} /></div>
                    </div>
                  </div>
                  <div style={{ background:"var(--surface-2)", borderRadius:12, padding:18, border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:14 }}>⏰ תזמון</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, alignItems:"end" }}>
                      <div>
                        <label style={fieldLabel}>Cron Expression</label>
                        <input value={aiConfig.schedule||'0 */6 * * *'} onChange={e=>setAiConfig(c=>({...c,schedule:e.target.value}))} placeholder="0 */6 * * *" style={inputStyle} />
                        <div style={{ fontSize:11, color:"var(--text-3)", marginTop:4 }}>כל 6 שעות: <code>0 */6 * * *</code> · כל יום: <code>0 0 * * *</code></div>
                      </div>
                      <div style={{ paddingBottom:20 }}>
                        <button onClick={()=>setAiConfig(c=>({...c,enabled:c.enabled==='1'?'0':'1'}))}
                          style={{ padding:"8px 16px", borderRadius:20, border:"none", cursor:"pointer", fontWeight:700, fontSize:12,
                            background:aiConfig.enabled==='1'?"#e8f5e9":"#fce4e4", color:aiConfig.enabled==='1'?"#2e7d32":"#c62828" }}>
                          {aiConfig.enabled==='1' ? "● מופעל" : "○ מושהה"}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div style={{ background:"var(--surface-2)", borderRadius:12, padding:18, border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:5 }}>🔒 VPN פרוקסי</div>
                    <div style={{ fontSize:12, color:"var(--text-2)", marginBottom:12 }}>מקורות עם 🔒 VPN יסרקו דרך פרוקסי זה</div>
                    <label style={fieldLabel}>כתובת פרוקסי</label>
                    <input value={aiConfig.vpn_proxy||''} onChange={e=>setAiConfig(c=>({...c,vpn_proxy:e.target.value}))} placeholder="socks5://user:pass@192.168.50.116:1080" style={inputStyle} dir="ltr" />
                  </div>
                  <div style={{ background:"var(--surface-2)", borderRadius:12, padding:18, border:"1px solid var(--border)" }}>
                    <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:5 }}>📈 סף פופולריות</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div><label style={fieldLabel}>מינימום הצבעות 🔥</label><input type="number" min={0} max={1000} value={aiConfig.min_votes??5} onChange={e=>setAiConfig(c=>({...c,min_votes:e.target.value}))} style={inputStyle} /></div>
                      <div><label style={fieldLabel}>מינימום תגובות 💬</label><input type="number" min={0} max={500} value={aiConfig.min_comments??2} onChange={e=>setAiConfig(c=>({...c,min_comments:e.target.value}))} style={inputStyle} /></div>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                    <button className="btn btn-primary" style={{ padding:"11px 28px", fontSize:14 }} onClick={saveAiConfig} disabled={aiSaving}>
                      {aiSaving ? "שומר..." : "💾 שמור הגדרות"}
                    </button>
                    <button className="btn" onClick={runHunterNow} disabled={hunting} style={{ background:"var(--brand-dk)", color:"#fff", padding:"11px 24px", fontSize:14, border:"none" }}>
                      {hunting ? "🔍 סורק..." : "▶ הרץ עכשיו"}
                    </button>
                    {aiSaved && <span style={{ color:"var(--success)", fontWeight:700, fontSize:13 }}>✅ נשמר בהצלחה!</span>}
                    {huntResult&&!huntResult.error && <span style={{ color:"var(--success)", fontWeight:700, fontSize:12 }}>✅ נמצאו {huntResult.found} דילים</span>}
                    {huntResult?.error && <span style={{ color:"var(--danger)", fontWeight:700, fontSize:12 }}>❌ {huntResult.error}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── PROMPTS ── */}
          {tab==="prompts" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:18, color:"var(--text)" }}>📝 מאגר פרומפטים</div>
                  <div style={{ fontSize:13, color:"var(--text-2)", marginTop:3 }}>הגדר תבניות פרומפט והקצה לכל מקור את המתאימה</div>
                </div>
                {editingPrompt===null && (
                  <button className="btn btn-primary" style={{ fontSize:13 }} onClick={() => { setPromptDraft({name:'',description:'',prompt_text:''}); setEditingPrompt('new'); }}>+ פרומפט חדש</button>
                )}
              </div>
              {editingPrompt!==null && (
                <div style={{ background:"var(--surface-2)", borderRadius:12, padding:18, marginBottom:22, border:"1.5px solid var(--brand)" }}>
                  <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:14 }}>
                    {editingPrompt==='new' ? '+ פרומפט חדש' : `✏️ עריכה: ${editingPrompt.name}`}
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
                    <div><label style={fieldLabel}>שם הפרומפט</label><input value={promptDraft.name} onChange={e=>setPromptDraft(d=>({...d,name:e.target.value}))} placeholder="מרצ'נט כללי..." style={inputStyle} /></div>
                    <div><label style={fieldLabel}>תיאור קצר</label><input value={promptDraft.description} onChange={e=>setPromptDraft(d=>({...d,description:e.target.value}))} placeholder="לאתרי חנויות..." style={inputStyle} /></div>
                  </div>
                  <div style={{ marginBottom:5 }}>
                    <label style={fieldLabel}>טקסט הפרומפט <span style={{ fontWeight:400, marginRight:8, color:"var(--text-3)" }}>משתנים: <code style={{ background:"var(--surface-3)", padding:"1px 5px", borderRadius:4 }}>{'{store}'}</code></span></label>
                    <textarea value={promptDraft.prompt_text} onChange={e=>setPromptDraft(d=>({...d,prompt_text:e.target.value}))} rows={10} style={{ ...inputStyle,resize:"vertical",fontFamily:"monospace",fontSize:12,lineHeight:1.6 }} />
                  </div>
                  <div style={{ display:"flex", gap:10, marginTop:12 }}>
                    <button className="btn btn-primary" disabled={promptSaving||!promptDraft.name||!promptDraft.prompt_text}
                      onClick={async () => {
                        setPromptSaving(true);
                        try {
                          if (editingPrompt==='new') { const c = await hunterAPI.addPrompt(promptDraft); setPrompts(p=>[...p,c]); }
                          else { await hunterAPI.updatePrompt(editingPrompt.id,promptDraft); setPrompts(p=>p.map(x=>x.id===editingPrompt.id?{...x,...promptDraft}:x)); }
                          setEditingPrompt(null);
                        } finally { setPromptSaving(false); }
                      }}>
                      {promptSaving ? "שומר..." : "💾 שמור"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditingPrompt(null)}>ביטול</button>
                  </div>
                </div>
              )}
              {!promptsLoaded && <div style={{ textAlign:"center", padding:40, color:"var(--text-2)" }}>טוען...</div>}
              {promptsLoaded && prompts.length===0 && <div style={{ textAlign:"center", padding:60, color:"var(--text-2)" }}><div style={{ fontSize:44, marginBottom:10 }}>📝</div><div style={{ fontWeight:700 }}>אין פרומפטים — צור את הראשון</div></div>}
              {prompts.map(p => (
                <div key={p.id} style={{ borderBottom:"1px solid var(--border)", padding:"14px 0" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                        <span style={{ fontWeight:800, fontSize:14, color:"var(--text)" }}>{p.name}</span>
                        {p.description && <span style={{ fontSize:12, color:"var(--text-2)" }}>{p.description}</span>}
                        <span style={{ fontSize:11, color:"var(--text-3)", marginRight:"auto" }}>מוקצה ל-{sources.filter(s=>s.prompt_id===p.id).length} מקורות</span>
                      </div>
                      <pre style={{ fontSize:11, color:"var(--text-2)", background:"var(--surface-2)", borderRadius:8, padding:"7px 10px", whiteSpace:"pre-wrap", wordBreak:"break-all", maxHeight:72, overflow:"hidden", fontFamily:"monospace", lineHeight:1.5 }}>{p.prompt_text}</pre>
                    </div>
                    <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                      <button className="btn btn-ghost" style={{ padding:"4px 10px", fontSize:12 }} onClick={() => { setPromptDraft({name:p.name,description:p.description||'',prompt_text:p.prompt_text}); setEditingPrompt(p); }}>✏️ ערוך</button>
                      <button className="btn btn-danger" style={{ padding:"4px 8px", fontSize:12 }}
                        onClick={async () => { await hunterAPI.deletePrompt(p.id); setPrompts(ps=>ps.filter(x=>x.id!==p.id)); setSources(ss=>ss.map(s=>s.prompt_id===p.id?{...s,prompt_id:null,prompt_name:null}:s)); }}>🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── LOGS ── */}
          {tab==="logs" && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div>
                  <div style={{ fontWeight:900, fontSize:18, color:"var(--text)" }}>📋 לוג הרצות Deal Hunter</div>
                  <div style={{ fontSize:13, color:"var(--text-2)", marginTop:3 }}>היסטוריה של כל הרצות — אוטומטיות וידניות</div>
                </div>
                <button className="btn btn-ghost" style={{ fontSize:12 }} onClick={() => setLogsLoaded(false)}>🔄 רענן</button>
              </div>
              {!logsLoaded && <div style={{ textAlign:"center", padding:48, color:"var(--text-2)" }}>טוען לוג...</div>}
              {logsLoaded && logs.length===0 && <div style={{ textAlign:"center", padding:60, color:"var(--text-2)" }}><div style={{ fontSize:44, marginBottom:10 }}>📋</div><div style={{ fontWeight:700, fontSize:15 }}>אין הרצות עדיין</div></div>}
              {logsLoaded && logs.length>0 && (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                    <thead>
                      <tr style={{ background:"var(--surface-2)", borderBottom:"2px solid var(--border)" }}>
                        {["תאריך ושעה","מופעל ע״י","מקור","נמצאו","כפולים","שגיאות","זמן"].map(h => (
                          <th key={h} style={{ padding:"9px 12px", textAlign:"right", fontWeight:700, color:"var(--text-2)", fontSize:11, whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(log => {
                        const errs = log.errors ? (() => { try { return JSON.parse(log.errors); } catch(e) { return [log.errors]; } })() : [];
                        return (
                          <React.Fragment key={log.id}>
                            <tr style={{ borderBottom: errs.length>0?"none":"1px solid var(--border)" }}>
                              <td style={{ padding:"9px 12px", color:"var(--text)", whiteSpace:"nowrap" }}>{new Date(log.run_at).toLocaleString('he-IL',{dateStyle:'short',timeStyle:'short'})}</td>
                              <td style={{ padding:"9px 12px" }}><span style={{ padding:"2px 9px", borderRadius:20, fontSize:11, fontWeight:700, background:log.triggered_by==='manual'?"var(--brand-lt)":"#F0FFF7", color:log.triggered_by==='manual'?"var(--brand)":"var(--success)" }}>{log.triggered_by==='manual'?'👤 ידני':'🤖 אוטומטי'}</span></td>
                              <td style={{ padding:"9px 12px", color:"var(--text)", fontSize:12 }}>{log.source_name?<span style={{ padding:"2px 7px", borderRadius:5, background:"var(--surface-2)", border:"1px solid var(--border)", fontWeight:600 }}>🌐 {log.source_name}</span>:<span style={{ color:"var(--text-3)" }}>הכל</span>}</td>
                              <td style={{ padding:"9px 12px", fontWeight:700, color:"var(--success)" }}>{log.total_found}</td>
                              <td style={{ padding:"9px 12px", color:"var(--text-2)" }}>{log.total_skipped}</td>
                              <td style={{ padding:"9px 12px" }}>{errs.length>0?<span style={{ color:"var(--danger)", fontWeight:700 }}>⚠️ {errs.length}</span>:<span style={{ color:"var(--success)" }}>✅ 0</span>}</td>
                              <td style={{ padding:"9px 12px", color:"var(--text-2)" }}>{log.duration_seconds}s</td>
                            </tr>
                            {errs.length>0 && (
                              <tr style={{ borderBottom:"1px solid var(--border)" }}>
                                <td colSpan={7} style={{ padding:"0 12px 10px" }}>
                                  <div style={{ background:"#FFF5F5", border:"1px solid #FFCCCC", borderRadius:8, padding:"9px 12px" }}>
                                    <div style={{ fontSize:11, fontWeight:800, color:"var(--danger)", marginBottom:5 }}>שגיאות:</div>
                                    {errs.map((err,i) => <div key={i} style={{ fontSize:12, color:"#c62828", fontFamily:"monospace", lineHeight:1.7, wordBreak:"break-all" }}>• {err}</div>)}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── OPENAI ── */}
          {tab==="openai" && (
            <div>
              <div style={{ fontWeight:900, fontSize:18, color:"var(--text)", marginBottom:3 }}>✨ OpenAI Deals Scheduler</div>
              <div style={{ fontSize:13, color:"var(--text-2)", marginBottom:22 }}>מופעל פעם ביום — שולח דילים לתור האישור</div>
              {!oaiLoaded && <div style={{ textAlign:"center", padding:48, color:"var(--text-2)" }}>טוען...</div>}
              {oaiLoaded && oaiCfg && (() => {
                const set  = (k,v) => setOaiCfg(c=>({...c,[k]:v}));
                const save = async () => {
                  setOaiSaving(true); setOaiSaved(false);
                  try {
                    await hunterAPI.saveOpenAIConfig({openai_enabled:oaiCfg.openai_enabled,openai_model:oaiCfg.openai_model,openai_schedule:oaiCfg.openai_schedule,openai_timeout:oaiCfg.openai_timeout,openai_max_retries:oaiCfg.openai_max_retries,openai_prompt:oaiCfg.openai_prompt,openai_scoring_prompt:oaiCfg.openai_scoring_prompt,openai_candidate_limit:oaiCfg.openai_candidate_limit});
                    setOaiSaved(true); setTimeout(()=>setOaiSaved(false),3000);
                  } catch(e) { alert('שגיאה בשמירה: '+e.message); }
                  finally { setOaiSaving(false); }
                };
                const runNow = async () => {
                  setOaiRunning(true); setOaiRunResult(null);
                  try { const r = await hunterAPI.runOpenAI(); setOaiRunResult(r); setOaiLoaded(false); }
                  catch(e) { setOaiRunResult({error:e.message}); }
                  finally { setOaiRunning(false); }
                };
                const doImport = async () => {
                  setImporting(true); setImportResult(null);
                  try { const r = await hunterAPI.importDeals(JSON.parse(importJson)); setImportResult(r); }
                  catch(e) { setImportResult({error:e.message}); }
                  finally { setImporting(false); }
                };
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"14px 18px", background:"var(--surface-2)", borderRadius:10, border:"1px solid var(--border)" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", flex:1 }}>
                        <input type="checkbox" checked={oaiCfg.openai_enabled==='1'} onChange={e=>set('openai_enabled',e.target.checked?'1':'0')} style={{ width:16, height:16, cursor:"pointer" }} />
                        <span style={{ fontWeight:700, fontSize:14, color:"var(--text)" }}>{oaiCfg.openai_enabled==='1'?'✅ מופעל — ירוץ לפי לוח הזמנים':'⏸️ מושבת'}</span>
                      </label>
                      <button onClick={runNow} disabled={oaiRunning} className="btn btn-primary" style={{ fontSize:13, padding:"7px 16px" }}>{oaiRunning?'⏳ מריץ...':'▶ הרץ עכשיו'}</button>
                    </div>
                    {oaiRunResult && <div style={{ padding:"12px 16px", borderRadius:8, border:"1px solid", borderColor:oaiRunResult.error?"var(--danger)":"var(--success)", background:oaiRunResult.error?"#fff5f5":"#f0fff7", color:oaiRunResult.error?"var(--danger)":"var(--success)", fontSize:13, fontWeight:700 }}>{oaiRunResult.error?`❌ ${oaiRunResult.error}`:`✅ יובאו ${oaiRunResult.imported} דילים, דולגו ${oaiRunResult.skipped}`}</div>}
                    {(oaiCfg.openai_last_run||oaiCfg.openai_last_status) && (
                      <div style={{ padding:"12px 16px", borderRadius:8, background:"var(--surface-2)", border:"1px solid var(--border)", fontSize:12, display:"flex", flexDirection:"column", gap:5 }}>
                        <div style={{ fontWeight:700, color:"var(--text-2)" }}>סטטוס אחרון</div>
                        {oaiCfg.openai_last_run && <div>⏱️ הרצה אחרונה: {new Date(oaiCfg.openai_last_run).toLocaleString('he-IL')}</div>}
                        {oaiCfg.openai_last_status && <div>{oaiCfg.openai_last_status==='success'?'✅ הצליח':'❌ נכשל'}</div>}
                        {oaiCfg.openai_last_error && <div style={{ color:"var(--danger)", fontFamily:"monospace", wordBreak:"break-all" }}>שגיאה: {oaiCfg.openai_last_error}</div>}
                        {oaiCfg.openai_last_response && <details style={{ marginTop:3 }}><summary style={{ cursor:"pointer", fontWeight:700, color:"var(--text-2)" }}>תגובה אחרונה</summary><pre style={{ fontSize:11, marginTop:5, padding:8, background:"#fff", borderRadius:5, border:"1px solid var(--border)", overflowX:"auto", maxHeight:400, whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{oaiCfg.openai_last_response}</pre></details>}
                      </div>
                    )}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      <div><label style={fieldLabel}>מודל OpenAI</label><input style={inputStyle} value={oaiCfg.openai_model||''} onChange={e=>set('openai_model',e.target.value)} placeholder="gpt-4o-mini" /></div>
                      <div><label style={fieldLabel}>לוח זמנים (cron)</label><input style={inputStyle} value={oaiCfg.openai_schedule||''} onChange={e=>set('openai_schedule',e.target.value)} placeholder="0 8 * * *" /></div>
                      <div><label style={fieldLabel}>Timeout (ms)</label><input style={inputStyle} type="number" value={oaiCfg.openai_timeout||''} onChange={e=>set('openai_timeout',e.target.value)} /></div>
                      <div><label style={fieldLabel}>מקסימום ניסיונות</label><input style={inputStyle} type="number" value={oaiCfg.openai_max_retries||''} onChange={e=>set('openai_max_retries',e.target.value)} /></div>
                    </div>
                    <div>
                      <label style={fieldLabel}>🎯 פרומפט דירוג מועמדים — {'{{site_candidates_json}}'}</label>
                      <textarea style={{...inputStyle,height:200,resize:"vertical",fontFamily:"monospace",fontSize:12}} value={oaiCfg.openai_scoring_prompt||''} onChange={e=>set('openai_scoring_prompt',e.target.value)} placeholder={'You are a deals scoring AI...\nCandidates: {{site_candidates_json}}'} />
                    </div>
                    <div style={{ maxWidth:280 }}>
                      <label style={fieldLabel}>מקסימום מועמדים לאתר</label>
                      <input style={inputStyle} type="number" min="5" max="100" value={oaiCfg.openai_candidate_limit||'20'} onChange={e=>set('openai_candidate_limit',e.target.value)} />
                    </div>
                    <details><summary style={{ cursor:"pointer", fontSize:13, fontWeight:700, color:"var(--text-2)", padding:"7px 0" }}>📜 פרומפט ישן — {'{{sites}}'}</summary><textarea style={{...inputStyle,height:140,resize:"vertical",fontFamily:"monospace",fontSize:12,marginTop:7}} value={oaiCfg.openai_prompt||''} onChange={e=>set('openai_prompt',e.target.value)} /></details>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <button onClick={save} disabled={oaiSaving} className="btn btn-primary" style={{ fontSize:13, padding:"10px 26px" }}>{oaiSaving?'⏳ שומר...':'💾 שמור הגדרות'}</button>
                      {oaiSaved && <span style={{ color:"var(--success)", fontWeight:700, fontSize:13 }}>✅ נשמר בהצלחה</span>}
                    </div>
                    <div style={{ borderTop:"2px solid var(--border)", paddingTop:22 }}>
                      <div style={{ fontWeight:800, fontSize:14, color:"var(--text)", marginBottom:5 }}>📥 ייבוא ידני</div>
                      <div style={{ fontSize:12, color:"var(--text-2)", marginBottom:10 }}>הדבק JSON שקיבלת מסוכן AI חיצוני</div>
                      <textarea style={{...inputStyle,height:280,resize:"vertical",fontFamily:"monospace",fontSize:11,direction:"ltr"}} value={importJson} onChange={e=>setImportJson(e.target.value)} placeholder={'{"d":"2026-03-31","k":["r","n","p","o","dp","s","u","i"],"sites":{"ksp.co.il":[...]}}'} />
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:8 }}>
                        <button onClick={doImport} disabled={importing||!importJson.trim()} className="btn btn-outline" style={{ fontSize:13, padding:"7px 18px" }}>{importing?'⏳ מייבא...':'📥 ייבא דילים'}</button>
                        {importResult && <span style={{ fontSize:13, fontWeight:700, color:importResult.error?"var(--danger)":"var(--success)" }}>{importResult.error?`❌ ${importResult.error}`:`✅ יובאו ${importResult.imported}, דולגו ${importResult.skipped}`}</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>{/* /content */}
      </div>{/* /body */}
    </div>
  );
}
