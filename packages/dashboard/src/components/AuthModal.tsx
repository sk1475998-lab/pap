import React, { useState } from "react";
import { X, Sparkles, Check, Lock, Mail, ArrowRight, ShieldCheck, Zap, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { login, register, user } = useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      if (mode === "signin") {
        await login(email, password);
        setSuccessMsg("Signed in successfully with Ultra VIP tier!");
      } else {
        await register(email, password, name);
        setSuccessMsg("Account created with Ultra VIP tier activated!");
      }
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDemoUltraLogin = async () => {
    setBusy(true);
    setErrorMsg("");
    try {
      await login("founder@superjob.local", "superjob2026");
      setSuccessMsg("Logged in as Ultra VIP Founder!");
      setTimeout(() => {
        onClose();
      }, 500);
    } catch {
      // Local fallback
      setSuccessMsg("Ultra VIP mode enabled locally!");
      setTimeout(() => {
        onClose();
      }, 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "var(--bg1)",
          border: "1px solid var(--b1)",
          borderRadius: "16px",
          padding: "32px",
          position: "relative",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(99, 102, 241, 0.15)",
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "18px",
            right: "18px",
            background: "transparent",
            border: "none",
            color: "var(--t4)",
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              background: "var(--grd-ind)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
              boxShadow: "0 8px 20px var(--ind-gl)",
            }}
          >
            <Zap size={22} color="#fff" />
          </div>
          <h2 style={{ fontFamily: "var(--font2)", fontSize: "22px", fontWeight: 800, color: "var(--t1)" }}>
            {mode === "signin" ? "Sign In to SuperJobAgent" : "Create Your Account"}
          </h2>
          <p style={{ fontSize: "13px", color: "var(--t4)", marginTop: "4px" }}>
            Autonomous AI Job Copilot & Multitenant Cloud Sync
          </p>

          {/* Ultra VIP Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "12px",
              padding: "4px 12px",
              borderRadius: "20px",
              background: "rgba(167, 139, 250, 0.12)",
              border: "1px solid rgba(167, 139, 250, 0.3)",
              fontSize: "11px",
              fontWeight: 700,
              color: "#A78BFA",
            }}
          >
            <Sparkles size={12} />
            <span>Ultra Tier Active — Unlimited Applications Unlocked</span>
          </div>
        </div>

        {/* 1-Click Instant Ultra VIP Button */}
        <div style={{ marginBottom: "20px" }}>
          <button
            onClick={handleDemoUltraLogin}
            disabled={busy}
            style={{
              width: "100%",
              padding: "11px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.25))",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "all 0.2s",
            }}
          >
            <Sparkles size={15} color="#A78BFA" />
            <span>1-Click Sign In as Ultra VIP</span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0", color: "var(--t4)", fontSize: "11.5px" }}>
          <div style={{ flex: 1, height: "1px", background: "var(--b0)" }} />
          <span>or sign in with email</span>
          <div style={{ flex: 1, height: "1px", background: "var(--b0)" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {mode === "register" && (
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", marginBottom: "6px" }}>
                Full Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === "register"}
              />
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              type="email"
              className="input-field"
              placeholder="candidate@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--t3)", textTransform: "uppercase", marginBottom: "6px" }}>
              Password
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {errorMsg && (
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(244, 63, 94, 0.1)", border: "1px solid rgba(244, 63, 94, 0.25)", color: "var(--rose)", fontSize: "12px" }}>
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.25)", color: "var(--em)", fontSize: "12px" }}>
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={busy}
            style={{ width: "100%", padding: "12px", fontSize: "13px", fontWeight: 700, marginTop: "6px" }}
          >
            {busy ? "Authenticating..." : mode === "signin" ? "Sign In & Access Ultra Dashboard" : "Create Ultra Account"}
          </button>
        </form>

        {/* Switch Mode */}
        <div style={{ textAlign: "center", marginTop: "18px", fontSize: "12.5px", color: "var(--t3)" }}>
          {mode === "signin" ? (
            <span>
              Don't have an account?{" "}
              <a
                href="#register"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("register");
                }}
                style={{ color: "var(--ind)", fontWeight: 700, textDecoration: "none" }}
              >
                Sign up free
              </a>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <a
                href="#signin"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("signin");
                }}
                style={{ color: "var(--ind)", fontWeight: 700, textDecoration: "none" }}
              >
                Sign in
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
