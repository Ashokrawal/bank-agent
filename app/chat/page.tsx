"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

const SUGGESTED = [
  "What are your opening hours?",
  "How do I open an account?",
  "What documents do I need?",
  "What savings rates do you offer?",
  "How do I report a lost card?",
  "Is my money protected?",
];

const ACCOUNT_SUGGESTED = [
  "Show me my balance",
  "Statement for last month",
  "What did I spend this month?",
  "Show my recent transactions",
];

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8h14M9 2l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BotAvatar() {
  return (
    <div style={{
      width: 30, height: 30, borderRadius: "50%", background: "var(--brand-500)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontSize: 14,
    }}>🏦</div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <BotAvatar />
      <div className="bubble-bot" style={{ display: "flex", gap: 5, alignItems: "center", padding: "12px 16px" }}>
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

function TransactionTable({ transactions }: { transactions: Record<string, unknown>[] }) {
  return (
    <div style={{ marginTop: 12, overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--surface-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
        <thead>
          <tr style={{ background: "var(--surface-subtle)" }}>
            {["Date", "Description", "Amount"].map(h => (
              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.slice(0, 8).map((t, i) => (
            <tr key={i} style={{ borderTop: "1px solid var(--surface-divider)" }}>
              <td style={{ padding: "8px 12px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{String(t.date)}</td>
              <td style={{ padding: "8px 12px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{String(t.description)}</td>
              <td style={{ padding: "8px 12px", whiteSpace: "nowrap", fontWeight: 500, color: Number(t.amount) < 0 ? "var(--error-700)" : "var(--success-700)" }}>
                {Number(t.amount) < 0 ? "-" : "+"}£{Math.abs(Number(t.amount)).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Hi! I'm NovaBanк's AI assistant. I can help you with opening hours, account information, how to open an account, and much more.\n\nIf you're signed in, I can also show you your balance and statements.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle ?q= param from homepage links
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: data.response || data.error || "Sorry, something went wrong.",
        timestamp: new Date(),
        metadata: data.metadata,
      };

      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: "Connection error. Please try again or call 0800 123 4567.",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const suggestions = session ? ACCOUNT_SUGGESTED : SUGGESTED;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 64px)",
      maxWidth: 800, margin: "0 auto",
    }}>
      {/* Session bar */}
      {session && (
        <div style={{
          padding: "10px 20px",
          background: "var(--brand-50)",
          borderBottom: "1px solid var(--brand-100, #e0eaff)",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: "0.8125rem", color: "var(--text-brand)",
        }}>
          <span>🔐</span>
          <span>Signed in as <strong>{session.user?.name}</strong> — I can access your account details.</span>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 20px 0" }}>
        {/* Suggested chips — show when only welcome message */}
        {messages.length <= 1 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Try asking
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    padding: "7px 14px",
                    background: "var(--surface-raised)",
                    border: "1px solid var(--surface-border)",
                    borderRadius: "var(--radius-full)",
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "var(--surface-subtle)"; (e.target as HTMLButtonElement).style.color = "var(--text-primary)"; }}
                  onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "var(--surface-raised)"; (e.target as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 20 }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-fade-in"
              style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start", gap: 4 }}
            >
              {msg.role === "bot" && (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", maxWidth: "100%" }}>
                  <BotAvatar />
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="bubble-bot" style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
                    {/* Transaction table if metadata has transactions */}
                    {(msg.metadata?.transactions as unknown[])?.length && Array.isArray(msg.metadata?.transactions) && (
                      <TransactionTable transactions={msg.metadata.transactions as Record<string, unknown>[]} />
                    )}
                  </div>
                </div>
              )}

              {msg.role === "user" && (
                <div className="bubble-user">{msg.content}</div>
              )}

              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginLeft: msg.role === "bot" ? 40 : 0 }}>
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 20px 20px",
        borderTop: "1px solid var(--surface-border)",
        background: "var(--surface-raised)",
      }}>
        <div style={{
          display: "flex", gap: 10, alignItems: "flex-end",
          background: "var(--surface-subtle)",
          border: "1px solid var(--surface-border)",
          borderRadius: "var(--radius-lg)",
          padding: "10px 14px",
          transition: "border-color 0.15s",
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything about NovaBanк..."
            rows={1}
            disabled={loading}
            style={{
              flex: 1, resize: "none", border: "none", background: "transparent",
              fontSize: "0.9375rem", color: "var(--text-primary)", outline: "none",
              fontFamily: "inherit", lineHeight: 1.5, maxHeight: 120, overflow: "auto",
            }}
          />
          <button
            className="btn-primary"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 36, height: 36, padding: 0, borderRadius: "50%",
              flexShrink: 0, marginBottom: 2,
            }}
            aria-label="Send message"
          >
            <SendIcon />
          </button>
        </div>
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
          NovaBanк AI may make mistakes. For urgent help call 0800 123 4567.
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
