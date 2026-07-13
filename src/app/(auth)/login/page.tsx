"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPhone, normalizePhone } from "@/lib/phone";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app/owner";

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      phone: normalizePhone(phone),
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Неверный телефон или пароль");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "1.5rem",
        background: "var(--color-bg-alt)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "360px",
          background: "var(--color-bg)",
          borderRadius: "12px",
          padding: "2rem 1.5rem",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            color: "var(--color-teal)",
            marginBottom: "0.25rem",
            textAlign: "center",
          }}
        >
          Стройконтроль
        </h1>
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-navy)",
            opacity: 0.6,
            marginBottom: "1.5rem",
            textAlign: "center",
          }}
        >
          Вход в систему
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label
              htmlFor="phone"
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-navy)",
                marginBottom: "0.375rem",
              }}
            >
              Телефон
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="+998 12 345 67 89"
              required
              autoComplete="tel"
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--color-navy)",
                marginBottom: "0.375rem",
              }}
            >
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "0.625rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--color-danger)",
                textAlign: "center",
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "0.625rem 1rem",
              fontSize: "1rem",
              fontWeight: 500,
              color: "#fff",
              background: "var(--color-teal)",
              border: "none",
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Вход..." : "Войти"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh" }} />}>
      <LoginForm />
    </Suspense>
  );
}
