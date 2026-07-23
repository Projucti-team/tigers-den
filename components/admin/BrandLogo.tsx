/** Replaces the default Payload logo on the /admin login screen. */
export default function BrandLogo() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tigers-den-logo.png"
        alt="The Tigers' Den"
        width={140}
        height={140}
        style={{ display: "block", width: "140px", height: "140px" }}
      />
      <span
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: "var(--theme-text)",
          opacity: 0.85,
        }}
      >
        The Tigers&rsquo; Den
      </span>
    </div>
  );
}
