import * as initialSchema from "./20260524_000000_initial_schema";

export const migrations = [
  {
    name: "20260524_000000_initial_schema",
    up: initialSchema.up,
    down: initialSchema.down,
  },
];
