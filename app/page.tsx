import Link from "next/link";

const features = [
  { icon: "💬", title: "AI Assistant", desc: "Ask anything — opening hours, rates, how to apply." },
  { icon: "🏦", title: "Open an Account", desc: "10-minute online application with instant KYC verification." },
  { icon: "📊", title: "Manage Money", desc: "View statements, track spending, and transfer funds." },
  { icon: "🔒", title: "Bank-grade Security", desc: "FSCS protected up to £85,000. FCA regulated." },
];

const faqs = [
  "What are your opening hours?",
  "How do I open an account?",
  "What documents do I need?",
  "What are your savings rates?",
];

export default function HomePage() {
  return (
    <div>
      <section style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "72px 24px 64px",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 64,
        alignItems: "center",
      }}>
        <div className="animate-fade-in">
          <div className="badge badge-blue" style={{ marginBottom: 20 }}>AI-powered banking</div>
          <h1 style={{
            fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 700, lineHeight: 1.15,
            letterSpacing: "-0.03em", color: "var(--text-primary)", marginBottom: 20,
          }}>
            Banking that<br />
            <span style={{ color: "var(--brand-500)" }}>actually helps you.</span>
          </h1>
          <p style={{ fontSize: "1.125rem", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 32, maxWidth: 420 }}>
            Ask our AI assistant anything. Open an account in minutes.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/chat" className="btn-primary" style={{ padding: "12px 28px", fontSize: "1rem" }}>Chat with AI →</Link>
            <Link href="/onboard" className="btn-ghost" style={{ padding: "12px 28px", fontSize: "1rem" }}>Open Account</Link>
          </div>
          <div style={{ marginTop: 40 }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>Common questions</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {faqs.map((q) => (
                <Link key={q} href={`/chat?q=${encodeURIComponent(q)}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.875rem", color: "var(--text-brand)", textDecoration: "none" }}>
                  <span>↗</span> {q}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--surface-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--brand-500)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏦</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9375rem" }}>NovaBank AI</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Always online</div>
              </div>
              <div style={{ marginLeft: "auto" }}><span className="badge badge-green">● Live</span></div>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { role: "bot", text: "Hi! I'm NovaBank's AI assistant. How can I help you today?" },
                { role: "user", text: "What documents do I need to open an account?" },
                { role: "bot", text: "You'll need: a valid photo ID (passport or driving licence), proof of address (utility bill dated within 3 months), and your NI number. Takes about 10 minutes!" },
              ].map((msg, i) => (
                <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                  <div className={msg.role === "user" ? "bubble-user" : "bubble-bot"} style={{ fontSize: "0.875rem", maxWidth: "82%" }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ background: "var(--surface-subtle)", borderTop: "1px solid var(--surface-border)", borderBottom: "1px solid var(--surface-border)", padding: "64px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, textAlign: "center", marginBottom: 8, letterSpacing: "-0.02em" }}>Everything you need to bank better</h2>
          <p style={{ textAlign: "center", color: "var(--text-secondary)", marginBottom: 48 }}>Modern banking, instantly available.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {features.map((f) => (
              <div key={f.title} className="card" style={{ padding: "24px 20px" }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 600, marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "40px 24px", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: 16 }}>Trusted and regulated</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
          {["FCA Regulated", "FSCS Protected £85k", "256-bit Encryption", "ISO 27001"].map(t => (
            <span key={t} style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontWeight: 500 }}>✓ {t}</span>
          ))}
        </div>
      </section>

      <style>{`@media(max-width:768px){ section:first-of-type { grid-template-columns: 1fr !important; gap: 40px !important; padding: 48px 20px 40px !important; } }`}</style>
    </div>
  );
}
