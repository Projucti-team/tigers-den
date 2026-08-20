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
          Paste the player&apos;s{" "}
          <a href="https://www.espncricinfo.com" target="_blank" rel="noreferrer">
            ESPNcricinfo
          </a>{" "}
          profile link, e.g. <code>espncricinfo.com/cricketers/hasan-mahmud-926629</code>.
        </li>
        <li>
          Paste the team&apos;s ESPNcricinfo profile link, e.g.{" "}
          <code>espncricinfo.com/team/kent-1098</code>.
        </li>
        <li>Save. That&apos;s it — no ESPN ids or league names to look up by hand.</li>
      </ol>
      <p style={{ margin: "0.75rem 0 0", opacity: 0.85 }}>
        The next &quot;Bangladesh schedule&quot; sync resolves the player &amp; team names and their
        current competition automatically, and fills in the read-only fields below (player name,
        team name, league, and IDs) so you can confirm it found the right people.
      </p>
      <p style={{ margin: "0.75rem 0 0", opacity: 0.85 }}>
        Match Centre only shows a live or completed match when the tracked player is actually named
        in that match&apos;s playing XI — not just whenever their team happens to be playing.
      </p>
    </div>
  );
}
