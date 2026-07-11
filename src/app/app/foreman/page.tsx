export default function ForemanDashboardPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "0.5rem",
      }}
    >
      <h1 style={{ color: "var(--color-teal)", fontSize: "1.5rem" }}>
        Кабинет прораба
      </h1>
      <p style={{ color: "var(--color-navy)", opacity: 0.7 }}>
        Доступ: FOREMAN, ADMIN
      </p>
    </main>
  );
}
