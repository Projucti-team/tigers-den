/**
 * @deprecated No longer used. Match/squad/venue details come from ESPNcricinfo only —
 * call `refreshEspnTourSquads` from "@/lib/cricket/providers/espn-squads" directly.
 * CricAPI's own series records don't reliably line up with ESPNcricinfo's ids, so the
 * CricAPI squad fallback this file used to provide produced wrong/no data more often than
 * it helped. Kept as a thin re-export only so nothing breaks if something still imports it;
 * safe to delete.
 */
export { refreshEspnTourSquads as refreshTourSquads } from "@/lib/cricket/providers/espn-squads";
