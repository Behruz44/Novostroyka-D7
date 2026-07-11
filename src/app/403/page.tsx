export default function ForbiddenPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", color: "var(--color-danger)" }}>403</h1>
      <p style={{ color: "var(--color-navy)", opacity: 0.7 }}>
        У вас нет доступа к этой странице
      </p>
      <a
        href="/login"
        style={{
          color: "var(--color-teal)",
          textDecoration: "underline",
          fontSize: "0.875rem",
        }}
      >
        Вернуться на страницу входа
      </a>
    </main>
  );
}
