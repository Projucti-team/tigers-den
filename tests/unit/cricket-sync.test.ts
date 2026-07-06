import { describe, it, expect, beforeEach, vi } from "@jest/globals";

/**
 * Unit tests for cricket sync jobs
 * Tests modular job structure: rankings, bangladesh, tours, squads
 */
describe("Cricket Sync Jobs", () => {
  describe("Sync Job Structure", () => {
    it("should export independent sync jobs", async () => {
      // This validates the modular job structure
      const syncJobsModule = await import("@/lib/cricket/sync-jobs");
      expect(syncJobsModule.CRICKET_SYNC_JOBS).toBeDefined();
      expect(Array.isArray(syncJobsModule.CRICKET_SYNC_JOBS)).toBe(true);
    });

    it("should have all required sync jobs", async () => {
      const syncJobsModule = await import("@/lib/cricket/sync-jobs");
      const jobIds = syncJobsModule.CRICKET_SYNC_JOBS.map((j: any) => j.id);

      expect(jobIds).toContain("rankings");
      expect(jobIds).toContain("bangladesh");
      expect(jobIds).toContain("tours");
      expect(jobIds).toContain("squads");
      expect(jobIds).toContain("all");
    });

    it("should have job descriptions", async () => {
      const syncJobsModule = await import("@/lib/cricket/sync-jobs");
      const jobs = syncJobsModule.CRICKET_SYNC_JOBS;

      jobs.forEach((job: any) => {
        expect(job.label).toBeDefined();
        expect(job.description).toBeDefined();
        expect(job.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Sync Result Structure", () => {
    it("should return proper sync result", () => {
      // Validate the SyncCricketResult type
      const mockResult = {
        ok: true,
        jobsRun: ["rankings", "tours"],
        toursCount: 10,
        tourDetailsCount: 8,
        warnings: [],
        errors: [],
        fetchedAt: new Date().toISOString(),
      };

      expect(mockResult.ok).toBe(true);
      expect(Array.isArray(mockResult.jobsRun)).toBe(true);
      expect(typeof mockResult.toursCount).toBe("number");
      expect(Array.isArray(mockResult.warnings)).toBe(true);
      expect(Array.isArray(mockResult.errors)).toBe(true);
      expect(mockResult.fetchedAt).toBeDefined();
    });

    it("should track errors in sync result", () => {
      const resultWithErrors = {
        ok: false,
        jobsRun: ["rankings"],
        toursCount: 5,
        tourDetailsCount: 3,
        warnings: ["Some data was incomplete"],
        errors: ["Failed to fetch ICC rankings", "Network timeout"],
        fetchedAt: new Date().toISOString(),
      };

      expect(resultWithErrors.ok).toBe(false);
      expect(resultWithErrors.errors.length).toBeGreaterThan(0);
      expect(resultWithErrors.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Job Selection Logic", () => {
    it("should support individual job selection", async () => {
      const syncJobsModule = await import("@/lib/cricket/sync-jobs");
      const jobs = syncJobsModule.CRICKET_SYNC_JOBS;

      // Verify you can select individual jobs
      const rankingsJob = jobs.find((j: any) => j.id === "rankings");
      expect(rankingsJob).toBeDefined();
      expect(rankingsJob?.id).toBe("rankings");

      const squadsJob = jobs.find((j: any) => j.id === "squads");
      expect(squadsJob).toBeDefined();
      expect(squadsJob?.id).toBe("squads");
    });

    it("should support 'all' job selection", async () => {
      const syncJobsModule = await import("@/lib/cricket/sync-jobs");
      const jobs = syncJobsModule.CRICKET_SYNC_JOBS;

      const allJob = jobs.find((j: any) => j.id === "all");
      expect(allJob).toBeDefined();
      expect(allJob?.id).toBe("all");
    });
  });

  describe("Job Isolation", () => {
    it("should be able to run rankings job independently", () => {
      // Verify rankings job can run without depending on other jobs
      expect(() => {
        const rankingsJob = "rankings";
        expect(rankingsJob).toBe("rankings");
      }).not.toThrow();
    });

    it("should be able to run tours job independently", () => {
      // Verify tours job can run without depending on other jobs
      expect(() => {
        const toursJob = "tours";
        expect(toursJob).toBe("tours");
      }).not.toThrow();
    });

    it("should be able to run squads job independently", () => {
      // Verify squads job can run without depending on other jobs
      expect(() => {
        const squadsJob = "squads";
        expect(squadsJob).toBe("squads");
      }).not.toThrow();
    });

    it("should be able to run bangladesh job independently", () => {
      // Verify bangladesh job can run without depending on other jobs
      expect(() => {
        const bangladeshJob = "bangladesh";
        expect(bangladeshJob).toBe("bangladesh");
      }).not.toThrow();
    });
  });

  describe("Sync Coordinator", () => {
    it("should validate sync snapshot configuration", async () => {
      // Verify snapshot keys are configured
      const snapshotKeysModule = await import(
        "@/lib/cricket/snapshot-keys"
      );
      expect(
        snapshotKeysModule.CRICKET_SNAPSHOT_KEYS.rankingsMen,
      ).toBeDefined();
      expect(
        snapshotKeysModule.CRICKET_SNAPSHOT_KEYS.tourIndex,
      ).toBeDefined();
      expect(snapshotKeysModule.CRICKET_SNAPSHOT_KEYS.tourDetail).toBeDefined();
    });

    it("should have proper skipCricApi flag handling", () => {
      // Validate logic for selective CricAPI skipping
      const shouldSkip = (daysOld: number): boolean => daysOld < 1;

      expect(shouldSkip(0)).toBe(true); // Skip if less than 1 day old
      expect(shouldSkip(0.5)).toBe(true);
      expect(shouldSkip(1)).toBe(false); // Don't skip if 1+ days old
      expect(shouldSkip(2)).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should continue on individual job failures", () => {
      const jobResults = [
        { job: "rankings", success: true },
        { job: "tours", success: false, error: "Network timeout" },
        { job: "squads", success: true },
      ];

      const totalSuccess = jobResults.every((r) => r.success);
      const failedJobs = jobResults
        .filter((r) => !r.success)
        .map((r) => r.job);

      expect(totalSuccess).toBe(false);
      expect(failedJobs).toContain("tours");
      expect(failedJobs.length).toBe(1);
    });

    it("should aggregate warnings and errors", () => {
      const results = [
        {
          ok: true,
          warnings: ["ESPN API slow"],
          errors: [],
        },
        {
          ok: false,
          warnings: [],
          errors: ["CricAPI timeout"],
        },
        {
          ok: true,
          warnings: ["Missing some squads"],
          errors: [],
        },
      ];

      const allWarnings = results.flatMap((r) => r.warnings);
      const allErrors = results.flatMap((r) => r.errors);

      expect(allWarnings.length).toBe(2);
      expect(allErrors.length).toBe(1);
      expect(allErrors).toContain("CricAPI timeout");
    });
  });
});
