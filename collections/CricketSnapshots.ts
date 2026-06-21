import type { CollectionConfig } from "payload";
import { headersWithCors } from "payload";

import { syncCricketSnapshots } from "@/lib/cricket/services/sync-cricket-snapshots";
import { parseCricketSyncJobs } from "@/lib/cricket/sync-jobs";

/** Nightly cricket data (rankings, tours, squads, venues) — written by cron, read on page load. */
export const CricketSnapshots: CollectionConfig = {
  slug: "cricket-snapshots",
  endpoints: [
    {
      path: "/sync",
      method: "post",
      handler: async (req) => {
        // req.user is often unset on custom endpoints behind reverse proxies — resolve from cookies explicitly.
        const { user } = req.user
          ? { user: req.user }
          : await req.payload.auth({ headers: req.headers });

        if (!user) {
          return Response.json(
            { error: "Unauthorized — sign in to Payload admin first." },
            {
              status: 401,
              headers: headersWithCors({ headers: new Headers(), req }),
            },
          );
        }

        try {
          const url = req.url ? new URL(req.url) : null;
          const forceParam = url?.searchParams.get("force");
          const force = forceParam !== "0";
          const jobsParam =
            url?.searchParams.get("jobs") ?? url?.searchParams.get("job") ?? undefined;
          const jobs = parseCricketSyncJobs(jobsParam);
          const result = await syncCricketSnapshots({ force, jobs });
          return Response.json(result, {
            status: result.ok ? 200 : 207,
            headers: headersWithCors({ headers: new Headers(), req }),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Sync failed";
          return Response.json(
            { error: message },
            {
              status: 500,
              headers: headersWithCors({ headers: new Headers(), req }),
            },
          );
        }
      },
    },
  ],
  admin: {
    useAsTitle: "key",
    defaultColumns: ["key", "label", "fetchedAt", "updatedAt"],
    description:
      "Pre-built cricket pages data (tours, rankings, venue guides). Refreshed nightly 3:00–4:00 AM Bangladesh time, or use Run cricket sync on the dashboard.",
    components: {
      beforeList: ["@/components/admin/CricketSyncPanel"],
    },
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      admin: {
        description: "e.g. rankings-showcase, tours-index, tour-detail:slug, venue-guides",
      },
    },
    {
      name: "label",
      type: "text",
      required: true,
    },
    {
      name: "fetchedAt",
      type: "date",
      required: true,
    },
    {
      name: "data",
      type: "json",
      required: true,
    },
  ],
};
