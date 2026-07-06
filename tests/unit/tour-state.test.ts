import { describe, it, expect, beforeEach } from "@jest/globals";

/**
 * Unit tests for tour state management
 * Critical: Determines which tours are active and need squad refresh
 */
describe("Tour State Management", () => {
  const ACTIVE_TOUR_WINDOW_DAYS = 30;

  describe("Tour Active Status", () => {
    it("should mark tour as active if startDate is within 30 days", () => {
      const now = new Date();
      const futureDate = new Date(
        now.getTime() + 15 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const isTourActive = (startDate: string): boolean => {
        const tourStart = new Date(startDate);
        const activeWindowEnd = new Date(
          now.getTime() + ACTIVE_TOUR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        );
        return tourStart >= now && tourStart <= activeWindowEnd;
      };

      expect(isTourActive(futureDate)).toBe(true);
    });

    it("should mark tour as active if endDate is in future", () => {
      const now = new Date();
      const futureDate = new Date(
        now.getTime() + 15 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const isTourActive = (endDate: string): boolean => {
        const tourEnd = new Date(endDate);
        return tourEnd >= now;
      };

      expect(isTourActive(futureDate)).toBe(true);
    });

    it("should not mark tour as active if endDate is in past", () => {
      const now = new Date();
      const pastDate = new Date(
        now.getTime() - 15 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const isTourActive = (endDate: string): boolean => {
        const tourEnd = new Date(endDate);
        return tourEnd >= now;
      };

      expect(isTourActive(pastDate)).toBe(false);
    });

    it("should not mark tour as active if start is beyond 30 days", () => {
      const now = new Date();
      const farFutureDate = new Date(
        now.getTime() + 60 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const isTourActive = (startDate: string): boolean => {
        const tourStart = new Date(startDate);
        const activeWindowEnd = new Date(
          now.getTime() + ACTIVE_TOUR_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        );
        return tourStart >= now && tourStart <= activeWindowEnd;
      };

      expect(isTourActive(farFutureDate)).toBe(false);
    });
  });

  describe("Format Status Determination", () => {
    it("should set status to 'upcoming' if matches not started", () => {
      const now = new Date();
      const futureDate = new Date(
        now.getTime() + 7 * 24 * 60 * 60 * 1000,
      );

      const determineStatus = (startDate: Date): string => {
        if (startDate > now) return "upcoming";
        if (startDate < now) return "finished";
        return "active";
      };

      expect(determineStatus(futureDate)).toBe("upcoming");
    });

    it("should set status to 'active' if matches are ongoing", () => {
      const now = new Date();
      const startedDate = new Date(
        now.getTime() - 2 * 24 * 60 * 60 * 1000,
      );
      const endDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const determineStatus = (start: Date, end: Date): string => {
        if (start > now) return "upcoming";
        if (end < now) return "finished";
        return "active";
      };

      expect(determineStatus(startedDate, endDate)).toBe("active");
    });

    it("should set status to 'finished' if matches ended", () => {
      const now = new Date();
      const pastDate = new Date(
        now.getTime() - 10 * 24 * 60 * 60 * 1000,
      );

      const determineStatus = (endDate: Date): string => {
        if (endDate < now) return "finished";
        if (endDate > now) return "active";
        return "ongoing";
      };

      expect(determineStatus(pastDate)).toBe("finished");
    });
  });

  describe("Format Date Extraction", () => {
    it("should extract earliest start date for format", () => {
      const matches = [
        { matchType: "ODI", date: "2026-07-15" },
        { matchType: "ODI", date: "2026-07-10" },
        { matchType: "Test", date: "2026-08-01" },
      ];

      const getFormatDates = (matchType: string) => {
        const formatMatches = matches
          .filter((m) => m.matchType === matchType)
          .map((m) => new Date(m.date));

        return {
          startDate: new Date(Math.min(...formatMatches.map((d) => d.getTime())))
            .toISOString()
            .split("T")[0],
        };
      };

      expect(getFormatDates("ODI").startDate).toBe("2026-07-10");
      expect(getFormatDates("Test").startDate).toBe("2026-08-01");
    });

    it("should extract latest end date for format", () => {
      const matches = [
        { matchType: "T20", date: "2026-07-20" },
        { matchType: "T20", date: "2026-07-25" },
        { matchType: "Test", date: "2026-08-01" },
      ];

      const getFormatDates = (matchType: string) => {
        const formatMatches = matches
          .filter((m) => m.matchType === matchType)
          .map((m) => new Date(m.date));

        return {
          endDate: new Date(Math.max(...formatMatches.map((d) => d.getTime())))
            .toISOString()
            .split("T")[0],
        };
      };

      expect(getFormatDates("T20").endDate).toBe("2026-07-25");
      expect(getFormatDates("Test").endDate).toBe("2026-08-01");
    });

    it("should handle missing format dates", () => {
      const matches = [
        { matchType: "Test", date: "2026-07-15" },
        { matchType: "Test", date: "2026-07-20" },
      ];

      const getFormatDates = (matchType: string) => {
        const formatMatches = matches.filter((m) => m.matchType === matchType);
        if (formatMatches.length === 0) return null;

        const dates = formatMatches.map((m) => new Date(m.date));
        return {
          startDate: new Date(Math.min(...dates.map((d) => d.getTime()))),
          endDate: new Date(Math.max(...dates.map((d) => d.getTime()))),
        };
      };

      expect(getFormatDates("Test")).toBeDefined();
      expect(getFormatDates("ODI")).toBeNull();
    });
  });

  describe("Multi-Format Tours", () => {
    it("should track separate status for each format", () => {
      const tourState = {
        test_series_status: "upcoming",
        odi_series_status: "active",
        t20_series_status: "finished",
      };

      expect(tourState.test_series_status).toBe("upcoming");
      expect(tourState.odi_series_status).toBe("active");
      expect(tourState.t20_series_status).toBe("finished");
    });

    it("should update only affected format status", () => {
      const tourState = {
        test_series_status: "upcoming",
        odi_series_status: "active",
        t20_series_status: "finished",
      };

      // Update only ODI status
      const updated = {
        ...tourState,
        odi_series_status: "finished",
      };

      expect(updated.test_series_status).toBe("upcoming"); // Unchanged
      expect(updated.odi_series_status).toBe("finished"); // Changed
      expect(updated.t20_series_status).toBe("finished"); // Unchanged
    });
  });

  describe("Squad Import Tracking", () => {
    it("should track squad import completion per format", () => {
      const tourState = {
        squad_import_complete_test: true,
        squad_import_complete_odi: false,
        squad_import_complete_t20: false,
      };

      expect(tourState.squad_import_complete_test).toBe(true);
      expect(tourState.squad_import_complete_odi).toBe(false);
      expect(tourState.squad_import_complete_t20).toBe(false);
    });

    it("should only refresh incomplete format squads", () => {
      const tourState = {
        odi_series_status: "upcoming",
        squad_import_complete_odi: false,
        t20_series_status: "upcoming",
        squad_import_complete_t20: true,
      };

      const formatsNeedingRefresh = [];

      if (tourState.odi_series_status && !tourState.squad_import_complete_odi) {
        formatsNeedingRefresh.push("odi");
      }

      if (tourState.t20_series_status && !tourState.squad_import_complete_t20) {
        formatsNeedingRefresh.push("t20");
      }

      expect(formatsNeedingRefresh).toContain("odi");
      expect(formatsNeedingRefresh).not.toContain("t20");
    });
  });

  describe("Sync Timestamp Tracking", () => {
    it("should track last sync time per format", () => {
      const now = new Date().toISOString();
      const tourState = {
        last_squad_sync_test: now,
        last_squad_sync_odi: null,
        last_squad_sync_t20: now,
      };

      expect(tourState.last_squad_sync_test).toBe(now);
      expect(tourState.last_squad_sync_odi).toBeNull();
      expect(tourState.last_squad_sync_t20).toBe(now);
    });

    it("should determine freshness of sync data", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

      const isFresh = (lastSync: string | null, hours: number): boolean => {
        if (!lastSync) return false;
        const lastSyncTime = new Date(lastSync);
        const freshThreshold = new Date(now.getTime() - hours * 60 * 60 * 1000);
        return lastSyncTime > freshThreshold;
      };

      expect(isFresh(oneHourAgo, 2)).toBe(true); // 1 hour < 2 hour threshold
      expect(isFresh(twoHoursAgo, 1)).toBe(false); // 2 hours > 1 hour threshold
      expect(isFresh(null, 24)).toBe(false); // Never synced
    });
  });
});
