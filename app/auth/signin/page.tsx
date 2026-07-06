"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function SignInContent() {
  const [email, setEmail] = useState("demo@novabank.com");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const raw = searchParams.get("callbackUrl") || "/chat";
  // Only allow same-origin redirects to prevent open-redirect attacks.
  // NextAuth middleware passes full URLs (http://localhost:3000/path), so allow those too.
  const callbackUrl = (() => {
    if (raw.startsWith("/")) return raw;
    try {
      const url = new URL(raw);
      if (url.origin === window.location.origin)
        return url.pathname + url.search;
    } catch {}
    return "/chat";
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password. Try: demo@novabank.com / demo123");
      } else {
        const isAdmin = email.trim().toLowerCase() === "admin@novabank.com";
        router.push(isAdmin ? "/admin" : callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "var(--surface-subtle)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo mark */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "var(--brand-500)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
            }}
          >
            🏦
          </div>
          <h1
            style={{
              fontSize: "1.375rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            Sign in to NovaBank
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              marginTop: 6,
              fontSize: "0.9rem",
            }}
          >
            Access your accounts and AI assistant
          </p>
        </div>

        <div className="card" style={{ padding: "32px" }}>
          {/* Demo credentials hint */}
          {/* Demo credentials hint */}
          <div
            style={{
              background: "var(--brand-50)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: 12,
              border: "1px solid var(--brand-100, #e0eaff)",
            }}
          >
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-brand)",
                fontWeight: 500,
                marginBottom: 2,
              }}
            >
              Demo account pre-filled
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              Email: demo@novabank.com · Password: demo123
            </p>
          </div>

          {/* Admin credentials hint */}
          <div
            onClick={() => {
              setEmail("admin@novabank.com");
              setPassword("NovaBank@Admin2025");
            }}
            style={{
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              marginBottom: 24,
              border: "1px solid var(--surface-border)",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--gray-100)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--surface-subtle)")
            }
          >
            <p
              style={{
                fontSize: "0.8125rem",
                color: "var(--text-secondary)",
                fontWeight: 500,
                marginBottom: 2,
              }}
            >
              Staff portal - click to fill
            </p>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              admin@novabank.com · NovaBank@Admin2025
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  marginBottom: 6,
                  color: "var(--text-secondary)",
                }}
              >
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <label
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                  }}
                >
                  Password
                </label>
                <a
                  href="#"
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-brand)",
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--error-50)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  color: "var(--error-700)",
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "1rem",
                marginTop: 4,
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p
          style={{
            textAlign: "center",
            marginTop: 24,
            fontSize: "0.875rem",
            color: "var(--text-secondary)",
          }}
        >
          Don&apos;t have an account?{" "}
          <Link
            href="/onboard"
            style={{
              color: "var(--text-brand)",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Open one in 10 minutes →
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
