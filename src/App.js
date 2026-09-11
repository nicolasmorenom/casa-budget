import React, { useState, useEffect, createContext, useContext } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { createHousehold, joinHouseholdByCode, getUserHouseholdId, getHousehold } from "./households";
import Dashboard from "./pages/Dashboard";
import "./App.css";

export const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const SESSION_KEY = "casaBudget_lastActive";
const SESSION_MAX = 24 * 60 * 60 * 1000;

function LoginScreen({ onLogin, error }) {
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="login-logo">
          <svg width="44" height="44" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="12" fill="#c9931a" fillOpacity="0.15"/>
            <path d="M10 20 Q20 10 30 20 Q20 30 10 20Z" fill="#c9931a" opacity="0.9"/>
            <circle cx="20" cy="20" r="4" fill="#c9931a"/>
          </svg>
        </div>
        <h1 className="login-title">Casa Budget</h1>
        <p className="login-sub">Household finances, together</p>
        {error && <p className="login-error">{error}</p>}
        <button className="google-btn" onClick={onLogin}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Continue with Google
        </button>
        <p className="login-note">Sign in to set up or join a household</p>
      </div>
    </div>
  );
}

function HouseholdOnboarding({ user, onDone }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const householdId = mode === "create"
        ? await createHousehold(user, name)
        : await joinHouseholdByCode(user, code);
      const household = await getHousehold(householdId);
      onDone(household);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="login-card" style={{ textAlign: "left" }}>
        <h1 className="login-title" style={{ fontSize: 20 }}>Set up your household</h1>
        <p className="login-sub" style={{ marginBottom: 20 }}>
          A household is the shared budget — accounts, categories, and transactions everyone in it can see.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={mode === "create" ? "btn btn-primary" : "btn btn-ghost"}
            style={{ flex: 1 }}
            onClick={() => setMode("create")}
          >
            Create new
          </button>
          <button
            type="button"
            className={mode === "join" ? "btn btn-primary" : "btn btn-ghost"}
            style={{ flex: 1 }}
            onClick={() => setMode("join")}
          >
            Join existing
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === "create" ? (
            <div className="form-group">
              <label>Household name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. The Morenos" />
            </div>
          ) : (
            <div className="form-group">
              <label>Invite code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-character code"
                style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
              />
            </div>
          )}
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ width: "100%", marginTop: 8 }}>
            {mode === "create" ? "Create household" : "Join household"}
          </button>
        </form>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div className="login-bg">
        <div className="login-card" style={{textAlign:"left"}}>
          <h1 className="login-title" style={{fontSize:18,marginBottom:12}}>Something went wrong</h1>
          <pre style={{fontSize:11,background:"#f0f1f7",padding:12,borderRadius:8,overflowX:"auto",color:"#d94f4f",whiteSpace:"pre-wrap",wordBreak:"break-all"}}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
          <button className="google-btn" style={{marginTop:16}} onClick={()=>window.location.reload()}>
            Reload app
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [household, setHousehold] = useState(undefined);
  const [error, setError]       = useState("");

  useEffect(() => {
    const stamp = () => localStorage.setItem(SESSION_KEY, Date.now().toString());
    ["click","keydown","touchstart","scroll"].forEach(e => window.addEventListener(e, stamp, {passive:true}));
    return () => ["click","keydown","touchstart","scroll"].forEach(e => window.removeEventListener(e, stamp));
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      try {
        if (u) {
          const lastActive = parseInt(localStorage.getItem(SESSION_KEY) || "0");
          if (lastActive > 0 && Date.now() - lastActive > SESSION_MAX) {
            localStorage.removeItem(SESSION_KEY);
            await signOut(auth);
            setError("Session expired. Please sign in again.");
            setUser(null); setHousehold(undefined); setLoading(false); return;
          }
          localStorage.setItem(SESSION_KEY, Date.now().toString());
          try {
            await setDoc(doc(db, "users", u.uid), {
              name: u.displayName, email: u.email, photo: u.photoURL,
              lastLogin: new Date().toISOString()
            }, { merge: true });
          } catch(e) { console.warn("User doc:", e.message); }
          setUser(u);

          const householdId = await getUserHouseholdId(u.uid);
          if (householdId) {
            const hh = await getHousehold(householdId);
            setHousehold(hh);
          } else {
            setHousehold(null);
          }
        } else {
          setUser(null);
          setHousehold(undefined);
        }
      } catch(e) {
        setError("Auth error: " + e.message);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const login = async () => {
    setError("");
    try { await signInWithPopup(auth, googleProvider); }
    catch(e) {
      if (e.code === "auth/popup-closed-by-user") return;
      setError(e.code === "auth/unauthorized-domain"
        ? "Add this domain in Firebase Auth → Authorized domains."
        : "Sign-in failed: " + e.message);
    }
  };

  if (loading) return (
    <div className="login-bg">
      <div style={{color:"var(--text2)",fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
        <div style={{width:28,height:28,border:"2px solid var(--border2)",borderTopColor:"var(--gold)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
        Loading…
      </div>
    </div>
  );

  if (!user) return <LoginScreen onLogin={login} error={error} />;

  if (household === null) {
    return <HouseholdOnboarding user={user} onDone={setHousehold} />;
  }

  if (household === undefined) {
    return (
      <div className="login-bg">
        <div style={{color:"var(--text2)",fontSize:14}}>Loading your household…</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{
        user,
        household,
        signOut: () => signOut(auth)
      }}>
        <Dashboard householdId={household.id} />
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}
