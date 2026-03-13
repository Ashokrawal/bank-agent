"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";

const BankIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <rect width="28" height="28" rx="8" fill="var(--brand-500)" />
    <path d="M14 5L22 10H6L14 5Z" fill="white" opacity="0.95" />
    <rect x="8"  y="11" width="2.5" height="9" rx="1" fill="white" opacity="0.9" />
    <rect x="12.75" y="11" width="2.5" height="9" rx="1" fill="white" opacity="0.9" />
    <rect x="17.5" y="11" width="2.5" height="9" rx="1" fill="white" opacity="0.9" />
    <rect x="6" y="21" width="16" height="2" rx="1" fill="white" />
  </svg>
);

const MenuIcon = ({ open }: { open: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    {open ? (
      <><line x1="5" y1="5" x2="17" y2="17" /><line x1="17" y1="5" x2="5" y2="17" /></>
    ) : (
      <><line x1="3" y1="7" x2="19" y2="7" /><line x1="3" y1="11" x2="19" y2="11" /><line x1="3" y1="15" x2="19" y2="15" /></>
    )}
  </svg>
);

export function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { href: "/chat",    label: "AI Assistant" },
    { href: "/account", label: "My Account",  auth: true },
    { href: "/onboard", label: "Open Account" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "var(--surface-raised)",
      borderBottom: "1px solid var(--surface-border)",
      backdropFilter: "blur(12px)",
    }}>
      <nav style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "0 20px",
        height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <BankIcon />
          <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
            NovaBanк
          </span>
        </Link>

        {/* Desktop nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="hide-mobile">
          {navItems
            .filter(item => !item.auth || session)
            .map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
        </div>

        {/* Auth actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }} className="hide-mobile">
          {session ? (
            <>
              <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                {session.user?.name?.split(" ")[0]}
              </span>
              <button className="btn-ghost" style={{ padding: "7px 16px", fontSize: "0.875rem" }}
                onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="btn-ghost" style={{ padding: "7px 16px", fontSize: "0.875rem" }}>
                Sign in
              </Link>
              <Link href="/onboard" className="btn-primary" style={{ padding: "7px 16px", fontSize: "0.875rem" }}>
                Open Account
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-primary)", display: "none" }}
          className="show-mobile"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <MenuIcon open={menuOpen} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          borderTop: "1px solid var(--surface-border)",
          background: "var(--surface-raised)",
          padding: "12px 20px 20px",
        }}>
          {navItems
            .filter(item => !item.auth || session)
            .map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${pathname.startsWith(item.href) ? "active" : ""}`}
                style={{ display: "flex", marginBottom: 4 }}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--surface-divider)" }}>
            {session ? (
              <button className="btn-ghost" style={{ width: "100%" }}
                onClick={() => signOut({ callbackUrl: "/" })}>
                Sign out
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link href="/auth/signin" className="btn-ghost" style={{ textAlign: "center" }}
                  onClick={() => setMenuOpen(false)}>Sign in</Link>
                <Link href="/onboard" className="btn-primary" style={{ textAlign: "center" }}
                  onClick={() => setMenuOpen(false)}>Open Account</Link>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`.show-mobile { display: none; } @media(max-width:640px){ .show-mobile{display:flex!important} .hide-mobile{display:none!important} }`}</style>
    </header>
  );
}
