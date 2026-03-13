"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "choose" | "details" | "documents" | "verify" | "done";

interface FormData {
  accountType: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  address: string;
  postcode: string;
  niNumber: string;
  idDocument: File | null;
  addressDocument: File | null;
  idPreview: string;
  addressPreview: string;
}

const ACCOUNT_TYPES = [
  { id: "standard_current", name: "Standard Current", fee: "Free", rate: "", highlight: false, desc: "Everyday banking with Visa debit card and instant transfers." },
  { id: "premium_current",  name: "Premium Current",  fee: "£9.99/mo", rate: "", highlight: true,  desc: "Travel insurance, fee-free foreign spending, priority support." },
  { id: "easy_saver",       name: "Easy Access Saver",fee: "Free",    rate: "4.5% AER", highlight: false, desc: "Flexible savings with a competitive rate. Withdraw anytime." },
  { id: "cash_isa",         name: "Cash ISA",          fee: "Free",    rate: "4.6% AER", highlight: false, desc: "Save up to £20,000/year completely tax-free." },
];

const STEPS: { key: Step; label: string }[] = [
  { key: "choose",    label: "Choose" },
  { key: "details",   label: "Details" },
  { key: "documents", label: "Documents" },
  { key: "verify",    label: "Verify" },
];

function StepIndicator({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.key === current);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: done ? "var(--success-700)" : active ? "var(--brand-500)" : "var(--surface-border)",
                color: done || active ? "white" : "var(--text-muted)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.875rem", fontWeight: 600,
                transition: "background 0.3s",
              }}>
                {done ? "✓" : i + 1}
              </div>
              <span style={{ fontSize: "0.7rem", color: active ? "var(--brand-500)" : "var(--text-muted)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? "var(--success-700)" : "var(--surface-border)", marginBottom: 22, transition: "background 0.3s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FileUpload({
  label, hint, accept, preview, onChange,
}: {
  label: string; hint: string; accept: string;
  preview: string; onChange: (file: File, preview: string) => void;
}) {
  const [dragging, setDragging] = useState(false);

  function handle(file: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => onChange(file, e.target?.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <label style={{ display: "block", fontWeight: 500, fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: 8 }}>
        {label}
      </label>
      <div
        style={{
          border: `2px dashed ${dragging ? "var(--brand-500)" : "var(--surface-border)"}`,
          borderRadius: "var(--radius-md)",
          padding: preview ? 0 : "28px 20px",
          textAlign: "center",
          background: dragging ? "var(--brand-50)" : "var(--surface-subtle)",
          cursor: "pointer",
          transition: "all 0.15s",
          overflow: "hidden",
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
        onClick={() => document.getElementById(`upload-${label}`)?.click()}
      >
        {preview ? (
          <div style={{ position: "relative" }}>
            <img src={preview} alt="Preview" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
            <div style={{
              position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "white", fontSize: "0.8rem", fontWeight: 500,
            }}>
              ✓ Uploaded — click to change
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
            <p style={{ fontWeight: 500, fontSize: "0.875rem", marginBottom: 4 }}>Drop file here or click to upload</p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{hint}</p>
          </>
        )}
      </div>
      <input
        id={`upload-${label}`}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f); }}
      />
    </div>
  );
}

export default function OnboardPage() {
  const [step, setStep] = useState<Step>("choose");
  const [verifying, setVerifying] = useState(false);
  const [applicationId, setApplicationId] = useState("");
  const [form, setForm] = useState<FormData>({
    accountType: "", firstName: "", lastName: "",
    email: "", phone: "", dob: "", address: "", postcode: "", niNumber: "",
    idDocument: null, addressDocument: null, idPreview: "", addressPreview: "",
  });

  const set = (key: keyof FormData, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  async function submitApplication() {
    setVerifying(true);

    // Simulate AI verification (in real app: send to /api/onboard)
    await new Promise(r => setTimeout(r, 2500));

    const id = "APP-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setApplicationId(id);

    // In production: POST to /api/onboard with FormData including files
    setVerifying(false);
    setStep("done");
  }

  if (step === "done") {
    return (
      <div style={{
        maxWidth: 560, margin: "0 auto", padding: "80px 20px",
        textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "var(--success-50)", border: "2px solid var(--success-700)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, margin: "0 auto 24px",
        }}>✓</div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 12 }}>
          Account approved!
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.7 }}>
          Welcome to NovaBanк, <strong>{form.firstName}</strong>!
          Your {ACCOUNT_TYPES.find(a => a.id === form.accountType)?.name} has been opened successfully.
        </p>
        <div className="card" style={{ padding: "16px 20px", margin: "24px 0", textAlign: "left" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>Application reference</p>
          <p style={{ fontWeight: 700, fontFamily: "monospace", fontSize: "1.1rem" }}>{applicationId}</p>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: 32 }}>
          You'll receive your account number, sort code, and debit card details by email within 2 business days.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link href="/auth/signin" className="btn-primary">Sign in to your account →</Link>
          <Link href="/chat" className="btn-ghost">Ask AI a question</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Open your NovaBanк account
        </h1>
        <p style={{ color: "var(--text-secondary)" }}>Takes about 10 minutes. FCA regulated and FSCS protected.</p>
      </div>

      <StepIndicator current={step} />

      {/* Step 1: Choose account type */}
      {step === "choose" && (
        <div className="animate-fade-in">
          <h2 style={{ fontWeight: 600, marginBottom: 20 }}>Choose your account</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
            {ACCOUNT_TYPES.map(acc => (
              <div
                key={acc.id}
                onClick={() => set("accountType", acc.id)}
                style={{
                  padding: "18px", borderRadius: "var(--radius-lg)", cursor: "pointer",
                  border: `2px solid ${form.accountType === acc.id ? "var(--brand-500)" : acc.highlight ? "var(--brand-200, #b8d0ff)" : "var(--surface-border)"}`,
                  background: form.accountType === acc.id ? "var(--brand-50)" : "var(--surface-raised)",
                  transition: "all 0.15s",
                  position: "relative",
                }}
              >
                {acc.highlight && (
                  <div className="badge badge-blue" style={{ position: "absolute", top: -10, right: 12, fontSize: "0.65rem" }}>
                    Most popular
                  </div>
                )}
                <p style={{ fontWeight: 600, marginBottom: 4 }}>{acc.name}</p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: 8, lineHeight: 1.5 }}>{acc.desc}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span className="badge badge-gray">{acc.fee}</span>
                  {acc.rate && <span className="badge badge-green">{acc.rate}</span>}
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary" style={{ width: "100%", padding: 13 }}
            disabled={!form.accountType}
            onClick={() => setStep("details")}>
            Continue →
          </button>
        </div>
      )}

      {/* Step 2: Personal details */}
      {step === "details" && (
        <div className="animate-fade-in">
          <h2 style={{ fontWeight: 600, marginBottom: 20 }}>Your personal details</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>First name</label>
                <input className="input-field" value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="James" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Last name</label>
                <input className="input-field" value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Carter" />
              </div>
            </div>
            {[
              { label: "Email address", key: "email", type: "email", placeholder: "james@example.com" },
              { label: "Phone number", key: "phone", type: "tel", placeholder: "+44 7700 900000" },
              { label: "Date of birth", key: "dob", type: "date", placeholder: "" },
              { label: "Home address", key: "address", type: "text", placeholder: "12 Maple Street, London" },
              { label: "Postcode", key: "postcode", type: "text", placeholder: "EC1A 1BB" },
              { label: "National Insurance number", key: "niNumber", type: "text", placeholder: "AB 12 34 56 C" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</label>
                <input
                  className="input-field" type={type} placeholder={placeholder}
                  value={form[key as keyof FormData] as string}
                  onChange={e => set(key as keyof FormData, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep("choose")}>← Back</button>
            <button className="btn-primary" style={{ flex: 2, padding: 13 }}
              disabled={!form.firstName || !form.lastName || !form.email || !form.dob}
              onClick={() => setStep("documents")}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Documents */}
      {step === "documents" && (
        <div className="animate-fade-in">
          <h2 style={{ fontWeight: 600, marginBottom: 8 }}>Upload your documents</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 24 }}>
            We need to verify your identity. All documents are encrypted and processed securely.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 32 }}>
            <FileUpload
              label="Photo ID"
              hint="Passport, driving licence, or national ID card · JPG, PNG, PDF"
              accept="image/*,.pdf"
              preview={form.idPreview}
              onChange={(file, preview) => { set("idDocument", file); set("idPreview", preview); }}
            />
            <FileUpload
              label="Proof of address"
              hint="Utility bill or bank statement dated within 3 months · JPG, PNG, PDF"
              accept="image/*,.pdf"
              preview={form.addressPreview}
              onChange={(file, preview) => { set("addressDocument", file); set("addressPreview", preview); }}
            />
          </div>

          {/* Checklist */}
          <div className="card" style={{ padding: "16px", marginBottom: 24, background: "var(--surface-subtle)" }}>
            <p style={{ fontWeight: 500, fontSize: "0.875rem", marginBottom: 10 }}>Document requirements</p>
            {[
              "Must be clearly readable — no blurry or obscured areas",
              "Proof of address must be dated within 3 months",
              "We do not accept expired documents",
              "All 4 corners of the document must be visible",
            ].map(req => (
              <p key={req} style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 4 }}>✓ {req}</p>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep("details")}>← Back</button>
            <button className="btn-primary" style={{ flex: 2, padding: 13 }}
              disabled={!form.idDocument || !form.addressDocument}
              onClick={() => setStep("verify")}>
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & submit */}
      {step === "verify" && (
        <div className="animate-fade-in">
          <h2 style={{ fontWeight: 600, marginBottom: 20 }}>Review your application</h2>

          <div className="card" style={{ padding: "20px", marginBottom: 20 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Account</p>
            <p style={{ fontWeight: 500 }}>{ACCOUNT_TYPES.find(a => a.id === form.accountType)?.name}</p>
          </div>

          <div className="card" style={{ padding: "20px", marginBottom: 20 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Personal details</p>
            {[
              ["Name", `${form.firstName} ${form.lastName}`],
              ["Email", form.email],
              ["Phone", form.phone || "Not provided"],
              ["Date of birth", form.dob],
              ["Address", `${form.address}, ${form.postcode}`],
              ["NI number", form.niNumber || "Not provided"],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--surface-divider)", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: "20px", marginBottom: 24 }}>
            <p style={{ fontWeight: 600, marginBottom: 12, fontSize: "0.875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Documents</p>
            <div style={{ display: "flex", gap: 8 }}>
              <span className="badge badge-green">✓ Photo ID</span>
              <span className="badge badge-green">✓ Proof of address</span>
            </div>
          </div>

          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
            By submitting, you confirm that all information provided is accurate and you agree to NovaBanк's Terms & Conditions and Privacy Policy.
          </p>

          {verifying && (
            <div style={{ marginBottom: 20, padding: "16px", background: "var(--brand-50)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid var(--brand-500)", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
              <div>
                <p style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--text-brand)" }}>Verifying your identity...</p>
                <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Running automated KYC checks</p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep("documents")} disabled={verifying}>← Back</button>
            <button className="btn-primary" style={{ flex: 2, padding: 13 }}
              disabled={verifying}
              onClick={submitApplication}>
              {verifying ? "Processing..." : "Submit Application"}
            </button>
          </div>
        </div>
      )}

      <style>{`@media(max-width:480px){ .grid-2col { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
