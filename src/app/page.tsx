export default function HomePage() {
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
      <h1 style={{ color: "var(--color-teal)", fontSize: "2rem" }}>Стройконтроль</h1>
      <p style={{ color: "var(--color-navy)", opacity: 0.7 }}>
        Платформа контроля строительства
      </p>
    </main>
  );
}
