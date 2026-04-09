import React, { useState } from "react";

export default function LoginModal({ onLogin, onClose, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth:420, padding:0, overflow:"hidden", borderRadius:16, boxShadow:"0 24px 64px rgba(0,0,0,.22)" }}>

        {/* Header */}
        <div style={{ background:"linear-gradient(135deg,#c9430e,#f7641b,#ff8c42)", padding:"32px 36px 28px", textAlign:"center", position:"relative" }}>
          <div style={{ position:"absolute", inset:0, background:"radial-gradient(circle at top right,rgba(255,255,255,.12),transparent 40%)" }} />
          <button onClick={onClose} style={{ position:"absolute", top:14, left:14, background:"rgba(255,255,255,.18)", border:"1px solid rgba(255,255,255,.18)", color:"#fff", borderRadius:8, width:32, height:32, fontSize:18, cursor:"pointer", lineHeight:"32px", backdropFilter:"blur(6px)" }}>×</button>
          <div style={{ fontSize:42, marginBottom:8, position:"relative" }}>🇮🇱</div>
          <h2 style={{ fontWeight:900, fontSize:22, color:"#fff", marginBottom:4, position:"relative" }}>ברוך הבא!</h2>
          <p style={{ color:"rgba(255,255,255,.8)", fontSize:13, position:"relative" }}>התחבר כדי להצביע ולשתף דילים</p>
        </div>

        {/* Form */}
        <div style={{ padding:"26px 32px 30px" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label>שם משתמש</label>
              <input placeholder="הכנס שם משתמש" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div>
              <label>סיסמה</label>
              <input type="password" placeholder="הכנס סיסמה" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onLogin(username, password)} />
            </div>
            <button className="btn btn-primary" style={{ width:"100%", padding:13, fontSize:15, marginTop:2, borderRadius:10 }} onClick={() => onLogin(username, password)}>
              כניסה
            </button>
            <div style={{ textAlign:"center", fontSize:13, color:"var(--text-2)" }}>
              אין לך חשבון?{" "}
              <button onClick={onRegister} style={{ background:"none", border:"none", color:"var(--brand)", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                הירשם עכשיו
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
