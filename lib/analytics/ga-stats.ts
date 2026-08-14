import { getAnalyticsDataClient } from "@/lib/analytics/ga-admin";
import { getGaPropertyId } from "@/lib/analytics/ga-config";

export type GaTopPage = { path: string; views: number };

export type GaStats24h = {
  activeUsers: number;
  pageViews: number;
  topPages: GaTopPage[];
};

/** Minimal shape of what we read from a runReport response — avoids depending on the full protobuf type in callers. */
type ReportRow = {
  dimensionValues?: { value?: string | null }[] | null;
  metricValues?: { value?: string | null }[] | null;
};
type ReportLike = { rows?: ReportRow[] | null } | null | undefined;

/** Pure parser, unit-testable without a real GA4 client — turns a per-page report's rows into a sorted top-pages list. */
export function parseTopPages(report: ReportLike, limit = 5): GaTopPage[] {
  const rows = report?.rows ?? [];
  return rows
    .map((row) => ({
      path: row.dimensionValues?.[0]?.value ?? "(unknown)",
      views: Number.parseInt(row.metricValues?.[0]?.value ?? "0", 10) || 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

/** Fetches the last 24h of traffic from GA4. Throws GA_REPORTING_NOT_CONFIGURED if no service account is set up. */
export async function getGaStats24h(): Promise<GaStats24h> {
  const propertyId = getGaPropertyId();
  if (!propertyId) throw new Error("GA_REPORTING_NOT_CONFIGURED");

  const client = getAnalyticsDataClient();
  const property = `properties/${propertyId}`;
  const dateRanges = [{ startDate: "1daysAgo", endDate: "today" }];

  const [totals] = await client.runReport({
    property,
    dateRanges,
    metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }],
  });

  const [byPage] = await client.runReport({
    property,
    dateRanges,
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 5,
  });

  const activeUsers = Number.parseInt(totals.rows?.[0]?.metricValues?.[0]?.value ?? "0", 10) || 0;
  const pageViews = Number.parseInt(totals.rows?.[0]?.metricValues?.[1]?.value ?? "0", 10) || 0;

  return {
    activeUsers,
    pageViews,
    topPages: parseTopPages(byPage, 5),
  };
}
