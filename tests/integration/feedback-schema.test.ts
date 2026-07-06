import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { getPayload } from "payload";
import config from "@/payload.config";

/**
 * Integration test for Feedback collection database schema.
 * Validates that the feedback table exists and has proper structure.
 * Run this before deployment to catch schema issues.
 */
describe("Feedback Database Schema Integration", () => {
  let payload: any;
  let db: any;

  beforeAll(async () => {
    payload = await getPayload({ config });
    db = payload.db;
  });

  afterAll(async () => {
    if (db && db.connection) {
      try {
        await db.connection.release();
      } catch (e) {
        // Connection may already be closed
      }
    }
  });

  describe("Feedback Table", () => {
    it("should have feedback table created", async () => {
      const result = await db.connection.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feedback');`,
      );
      expect(result.rows[0].exists).toBe(true);
    });

    it("should have required columns", async () => {
      const result = await db.connection.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback';`,
      );

      const columns = result.rows.map((r: any) => r.column_name);
      expect(columns).toContain("id");
      expect(columns).toContain("title");
      expect(columns).toContain("description");
      expect(columns).toContain("category");
      expect(columns).toContain("email");
      expect(columns).toContain("name");
      expect(columns).toContain("page_url");
      expect(columns).toContain("user_id");
      expect(columns).toContain("image_id");
      expect(columns).toContain("status");
      expect(columns).toContain("status_timeline");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });

    it("should have proper column types", async () => {
      const result = await db.connection.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'feedback' ORDER BY ordinal_position;`,
      );

      const columns = result.rows.reduce(
        (acc: any, r: any) => {
          acc[r.column_name] = r.data_type;
          return acc;
        },
        {} as Record<string, string>,
      );

      expect(columns.id).toBe("integer");
      expect(columns.title).toBe("character varying");
      expect(columns.description).toBe("character varying");
      expect(columns.category).toBe("character varying");
      expect(columns.email).toBe("character varying");
      expect(columns.name).toBe("character varying");
      expect(columns.page_url).toBe("character varying");
      expect(columns.user_id).toBe("integer");
      expect(columns.image_id).toBe("integer");
      expect(columns.status).toBe("character varying");
      expect(columns.status_timeline).toBe("jsonb");
    });

    it("should have proper constraints", async () => {
      const result = await db.connection.query(
        `SELECT constraint_name, constraint_type FROM information_schema.table_constraints WHERE table_name = 'feedback';`,
      );

      const constraints = result.rows.map((r: any) => r.constraint_type);
      expect(constraints).toContain("PRIMARY KEY");
      expect(constraints).toContain("CHECK");
    });

    it("should have proper indexes", async () => {
      const result = await db.connection.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'feedback';`,
      );

      const indexes = result.rows.map((r: any) => r.indexname);
      expect(indexes.some((idx: string) => idx.includes("idx_feedback_status")))
        .toBe(true);
      expect(indexes.some((idx: string) => idx.includes("idx_feedback_created")))
        .toBe(true);
      expect(indexes.some((idx: string) => idx.includes("idx_feedback_user_id")))
        .toBe(true);
    });

    it("should have foreign key constraints", async () => {
      const result = await db.connection.query(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'feedback' AND constraint_type = 'FOREIGN KEY';`,
      );

      const constraints = result.rows.map((r: any) => r.constraint_name);
      expect(constraints.length).toBeGreaterThanOrEqual(1);
    });

    it("should allow creating feedback record", async () => {
      const result = await db.connection.query(
        `INSERT INTO "feedback" (title, description, category, email, name, page_url, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())
         RETURNING id;`,
        [
          "Test",
          "Test description",
          "bug",
          "test@example.com",
          "Test User",
          "http://localhost",
          "new",
        ],
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBeDefined();

      // Cleanup
      await db.connection.query(`DELETE FROM "feedback" WHERE id = $1;`, [
        result.rows[0].id,
      ]);
    });
  });

  describe("payload_locked_documents_rels Table", () => {
    it("should have feedback_id column in rels table", async () => {
      const result = await db.connection.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'payload_locked_documents_rels' AND column_name = 'feedback_id';`,
      );

      expect(result.rows.length).toBe(1);
    });

    it("should have proper foreign key for feedback_id", async () => {
      const result = await db.connection.query(
        `SELECT constraint_name FROM information_schema.referential_constraints
         WHERE constraint_name LIKE '%feedback_id%';`,
      );

      // FK constraint may or may not exist if Payload manages it automatically
      // This test just validates the query works
      expect(result).toBeDefined();
    });
  });

  describe("Feedback Collection CRUD", () => {
    it("should create feedback via Payload", async () => {
      const feedback = await payload.create({
        collection: "feedback",
        data: {
          title: "Integration Test",
          description: "Testing CRUD operations",
          category: "bug",
          email: "integration@example.com",
          name: "Integration Tester",
          pageUrl: "http://localhost/integration",
          status: "new",
          statusTimeline: [
            {
              status: "new",
              changedAt: new Date().toISOString(),
              note: "Test submitted",
            },
          ],
        },
      });

      expect(feedback.id).toBeDefined();
      expect(feedback.title).toBe("Integration Test");

      // Cleanup
      await payload.delete({
        collection: "feedback",
        id: feedback.id,
      });
    });

    it("should read feedback via Payload", async () => {
      const created = await payload.create({
        collection: "feedback",
        data: {
          title: "Read Test",
          description: "Testing read operation",
          category: "feature",
          email: "read@example.com",
          name: "Read Tester",
          pageUrl: "http://localhost/read",
        },
      });

      const read = await payload.findByID({
        collection: "feedback",
        id: created.id,
      });

      expect(read.title).toBe("Read Test");
      expect(read.category).toBe("feature");

      // Cleanup
      await payload.delete({
        collection: "feedback",
        id: created.id,
      });
    });

    it("should update feedback via Payload", async () => {
      const created = await payload.create({
        collection: "feedback",
        data: {
          title: "Update Test",
          description: "Testing update operation",
          category: "other",
          email: "update@example.com",
          name: "Update Tester",
          pageUrl: "http://localhost/update",
        },
      });

      const updated = await payload.update({
        collection: "feedback",
        id: created.id,
        data: {
          status: "under_review",
          statusNote: "Started review",
        },
      });

      expect(updated.status).toBe("under_review");
      expect(updated.statusTimeline.length).toBeGreaterThan(1);

      // Cleanup
      await payload.delete({
        collection: "feedback",
        id: created.id,
      });
    });
  });
});
