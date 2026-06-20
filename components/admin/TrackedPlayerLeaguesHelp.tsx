"use client";

export default function TrackedPlayerLeaguesHelp() {
  return (
    <div
      style={{
        marginBottom: "1.25rem",
        padding: "1rem 1.25rem",
        borderRadius: "8px",
        border: "1px solid var(--theme-elevation-150)",
        background: "var(--theme-elevation-50)",
        lineHeight: 1.5,
        fontSize: "0.875rem",
      }}
    >
      <p style={{ margin: 0, fontWeight: 700 }}>How to add a tracked player</p>
      <ol style={{ margin: "0.75rem 0 0", paddingLeft: "1.25rem" }}>
        <li>Click <strong>Create New</strong> (top right).</li>
        <li>
          Fill in player, team, and league name — e.g. Hasan Mahmud, Kent, County Championship.
        </li>
        <li>
          Open the series on{" "}
          <a href="https://www.espncricinfo.com" target="_blank" rel="noreferrer">
            ESPNcricinfo
          </a>{" "}
          and copy the number from the URL:{" "}
          <code>/series/county-championship-division-one-2026-1234567</code> → use{" "}
          <strong>1234567</strong> as ESPN league id.
        </li>
        <li>Set season year (e.g. 2026) and keep &quot;Use season events&quot; checked for long leagues.</li>
      </ol>
      <p style={{ margin: "0.75rem 0 0", opacity: 0.85 }}>
        When that team is live, Match Centre shows their score with a banner: &quot;Hasan Mahmud is
        playing for Kent&quot;.
      </p>
    </div>
  );
}
