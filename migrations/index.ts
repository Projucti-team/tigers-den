import * as cricketSnapshots from "./20260523_120000_cricket_snapshots";

export const migrations = [
  {
    name: "20260523_120000_cricket_snapshots",
    up: cricketSnapshots.up,
    down: cricketSnapshots.down,
  },
];
