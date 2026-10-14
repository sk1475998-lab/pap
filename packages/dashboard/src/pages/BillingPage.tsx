import React, { useState } from "react";
import { Check, CreditCard, Zap, Shield, Sparkles, HelpCircle, ArrowRight } from "lucide-react";

export function BillingPage() {
  const [currentTier, setCurrentTier] = useState<"free" | "pro" | "ultra">("ultra");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "free",
      name: "Free Explorer",
      price: "$0",
      period: "forever",
      desc: "For engineers exploring the market casually.",
      features: [
        "20 automated applications / month",
        "Greenhouse & Lever support",
        "Basic keyword match scoring",
        "Community Discord support",
      ],
      cta: "Explorer Tier",
      disabled: currentTier === "free",
    },
    {
      id: "pro",
      name: "Pro JobSeeker",
      price: billingCycle === "monthly" ? "$29" : "$22",
      period: "per month",
      desc: "Maximum velocity for active job searches.",
      popular: false,
      features: [
        "Unlimited automated applications",
        "All 18+ ATS systems (Workday, Ashby, Taleo)",
        "LinkedIn Easy Apply autopilot engine",
        "AI Tailored resumes per submission",
        "STAR screening answer planner",
        "Local-first encrypted data sync",
      ],
      cta: currentTier === "pro" ? "Current Active Plan" : "Included in Ultra",
      disabled: currentTier === "pro" || currentTier === "ultra",
    },
    {
      id: "ultra",
      name: "Ultra Autonomous (Active VIP)",
      price: billingCycle === "monthly" ? "$99" : "$79",
      period: "per month",
      desc: "Dedicated cloud workers, proxy stealth & unlimited autonomous autopilot.",
      popular: true,
      features: [
        "All Pro features included",
        "Multi-worker Playwright browser cluster",
        "BullMQ distributed Redis queue",
        "Residential proxy rotation (stealth)",
        "Custom LLM API key bring-your-own (BYOK)",
        "Dedicated onboarding & recruiter outreach",
        "Priority 24/7 autonomous background pipelines",
      ],
      cta: "Current Active Plan (Ultra VIP)",
      disabled: true,
    },
  ];

  const handleCheckout = (planId: string) => {
    alert(`Redirecting to secure Stripe Checkout session for ${planId.toUpperCase()} tier...`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", maxWidth: "640px", margin: "0 auto" }}>
        <div className="label-xs" style={{ color: "var(--ind)", marginBottom: "6px" }}>
          TIERS & SUBSCRIPTIONS
        </div>
        <h1 className="section-title" style={{ fontSize: "32px", letterSpacing: "-0.03em" }}>
          Predictable Pricing. Exponential Velocity.
        </h1>
        <p className="section-sub">
          Accelerate your job search with automated application preparation, resume tailoring, and multi-agent AI.
        </p>

        {/* Billing cycle toggle */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--bg1)",
            border: "1px solid var(--b0)",
            borderRadius: "30px",
            padding: "5px 6px",
            marginTop: "12px",
            boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          <button
            onClick={() => setBillingCycle("monthly")}
            style={{
              padding: "7px 18px",
              borderRadius: "20px",
              fontSize: "12.5px",
              fontWeight: 700,
              background: billingCycle === "monthly" ? "var(--ind)" : "transparent",
              color: billingCycle === "monthly" ? "#fff" : "var(--t3)",
              boxShadow: billingCycle === "monthly" ? "0 2px 10px var(--ind-gl)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("annual")}
            style={{
              padding: "7px 18px",
              borderRadius: "20px",
              fontSize: "12.5px",
              fontWeight: 700,
              background: billingCycle === "annual" ? "var(--ind)" : "transparent",
              color: billingCycle === "annual" ? "#fff" : "var(--t3)",
              boxShadow: billingCycle === "annual" ? "0 2px 10px var(--ind-gl)" : "none",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            Annual <span className="badge badge-green" style={{ fontSize: "10px", padding: "1px 6px" }}>Save 25%</span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "24px", marginTop: "10px" }}>
        {plans.map((p) => (
          <div
            key={p.id}
            className="card card-spotlight"
            style={{
              padding: "32px 28px",
              display: "flex",
              flexDirection: "column",
              position: "relative",
              border: p.popular ? "2px solid var(--ind)" : "1px solid var(--b0)",
              boxShadow: p.popular
                ? "0 16px 48px var(--ind-gl), inset 0 1px 0 rgba(255,255,255,0.12)"
                : "none",
            }}
          >
            {p.popular && (
              <div
                style={{
                  position: "absolute",
                  top: "-13px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "var(--grd-ind)",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "4px 14px",
                  borderRadius: "14px",
                  boxShadow: "0 4px 16px var(--ind-gl)",
                }}
              >
                MOST POPULAR
              </div>
            )}

            <div style={{ fontSize: "19px", fontWeight: 800, color: "var(--t1)", marginBottom: "6px" }}>{p.name}</div>
            <div style={{ fontSize: "12.5px", color: "var(--t4)", minHeight: "36px" }}>{p.desc}</div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", margin: "24px 0" }}>
              <span style={{ fontFamily: "var(--font2)", fontSize: "42px", fontWeight: 900, color: "var(--t1)", letterSpacing: "-0.03em" }}>
                {p.price}
              </span>
              <span style={{ fontSize: "12.5px", color: "var(--t4)" }}>/{p.period}</span>
            </div>

            <button
              className={p.popular ? "btn-primary" : "btn-secondary"}
              onClick={() => handleCheckout(p.id)}
              disabled={p.disabled}
              style={{
                width: "100%",
                justifyContent: "center",
                marginBottom: "26px",
                padding: "11px",
                fontSize: "13.5px",
              }}
            >
              {p.cta}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
              <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--t4)" }}>
                KEY CAPABILITIES:
              </div>
              {p.features.map((feat) => (
                <div key={feat} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "13px", color: "var(--t2)" }}>
                  <div
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "rgba(16,185,129,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "1px",
                    }}
                  >
                    <Check size={11} color="var(--em)" />
                  </div>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trust & Guarantee Badges */}
      <div
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          padding: "24px",
          marginTop: "10px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Shield size={24} color="var(--em)" />
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--t1)" }}>14-Day Money Back</div>
            <div style={{ fontSize: "11.5px", color: "var(--t4)" }}>No questions asked refund guarantee.</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Zap size={24} color="var(--sky)" />
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--t1)" }}>Instant Stripe Provisioning</div>
            <div style={{ fontSize: "11.5px", color: "var(--t4)" }}>Quotas unlock immediately upon checkout.</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CreditCard size={24} color="#F59E0B" />
          <div>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--t1)" }}>No Lock-In Contracts</div>
            <div style={{ fontSize: "11.5px", color: "var(--t4)" }}>Cancel or downgrade anytime in 1 click.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
