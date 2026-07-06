import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { getPayload } from "payload";
import config from "@/payload.config";

describe("Feedback API", () => {
  let payload: any;

  beforeAll(async () => {
    payload = await getPayload({ config });
  });

  afterAll(async () => {
    if (payload && payload.db && payload.db.connection) {
      await payload.db.connection.close();
    }
  });

  describe("Feedback Collection Schema", () => {
    it("should have feedback collection registered", () => {
      const feedbackCollection = config.collections?.find(
        (c: any) => c.slug === "feedback",
      );
      expect(feedbackCollection).toBeDefined();
      expect(feedbackCollection?.slug).toBe("feedback");
    });

    it("should have required fields", () => {
      const feedbackCollection = config.collections?.find(
        (c: any) => c.slug === "feedback",
      );
      const fields = feedbackCollection?.fields || [];
      const fieldNames = fields.map((f: any) => f.name);

      expect(fieldNames).toContain("title");
      expect(fieldNames).toContain("description");
      expect(fieldNames).toContain("category");
      expect(fieldNames).toContain("email");
      expect(fieldNames).toContain("name");
      expect(fieldNames).toContain("pageUrl");
      expect(fieldNames).toContain("status");
      expect(fieldNames).toContain("statusTimeline");
    });

    it("should validate category enum", () => {
      const feedbackCollection = config.collections?.find(
        (c: any) => c.slug === "feedback",
      );
      const categoryField = feedbackCollection?.fields?.find(
        (f: any) => f.name === "category",
      );

      expect(categoryField?.type).toBe("select");
      const options = categoryField?.options?.map((o: any) => o.value);
      expect(options).toContain("bug");
      expect(options).toContain("feature");
      expect(options).toContain("other");
    });

    it("should validate status enum", () => {
      const feedbackCollection = config.collections?.find(
        (c: any) => c.slug === "feedback",
      );
      const statusField = feedbackCollection?.fields?.find(
        (f: any) => f.name === "status",
      );

      expect(statusField?.type).toBe("select");
      const options = statusField?.options?.map((o: any) => o.value);
      expect(options).toContain("new");
      expect(options).toContain("under_review");
      expect(options).toContain("ticket_raised");
      expect(options).toContain("in_progress");
      expect(options).toContain("resolved");
      expect(options).toContain("dismissed");
    });

    it("should have access control for read/update/delete", () => {
      const feedbackCollection = config.collections?.find(
        (c: any) => c.slug === "feedback",
      );
      const access = feedbackCollection?.access;

      expect(access?.read).toBeDefined();
      expect(access?.update).toBeDefined();
      expect(access?.delete).toBeDefined();
      expect(access?.create).toBeDefined();
    });
  });

  describe("Feedback API Endpoint", () => {
    it("should reject missing required fields", async () => {
      const response = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test",
          // missing description
          category: "bug",
          email: "test@example.com",
          name: "Test User",
          pageUrl: "http://localhost",
        }),
      });

      expect(response.status).toBe(400);
    });

    it("should accept valid feedback submission", async () => {
      const response = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Test Feedback",
          description: "This is a test feedback",
          category: "bug",
          email: "test@example.com",
          name: "Test User",
          pageUrl: "http://localhost/test",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.id).toBeDefined();
    });

    it("should create feedback with initial status timeline", async () => {
      const response = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Timeline Test",
          description: "Test timeline creation",
          category: "feature",
          email: "timeline@example.com",
          name: "Timeline User",
          pageUrl: "http://localhost/timeline",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      const feedback = await payload.findByID({
        collection: "feedback",
        id: data.id,
      });

      expect(feedback.statusTimeline).toBeDefined();
      expect(feedback.statusTimeline.length).toBeGreaterThan(0);
      expect(feedback.statusTimeline[0].status).toBe("new");
      expect(feedback.statusTimeline[0].note).toBe("Feedback submitted");
    });

    it("should handle user context if provided", async () => {
      const response = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "User Context Test",
          description: "Testing with user ID",
          category: "other",
          email: "user@example.com",
          name: "User Name",
          pageUrl: "http://localhost/user",
          userId: "1",
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();

      const feedback = await payload.findByID({
        collection: "feedback",
        id: data.id,
      });

      expect(feedback.user).toBeDefined();
    });
  });

  describe("Feedback Status Updates", () => {
    it("should update status timeline on status change", async () => {
      // Create initial feedback
      const createResponse = await fetch("http://localhost:3000/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Status Update Test",
          description: "Testing status timeline updates",
          category: "bug",
          email: "status@example.com",
          name: "Status User",
          pageUrl: "http://localhost/status",
        }),
      });

      const createData = await createResponse.json();
      const feedbackId = createData.id;

      // Update status
      const updateResponse = await payload.update({
        collection: "feedback",
        id: feedbackId,
        data: {
          status: "under_review",
          statusNote: "Started reviewing this issue",
        },
      });

      expect(updateResponse.statusTimeline.length).toBeGreaterThan(1);
      const lastEntry = updateResponse.statusTimeline[
        updateResponse.statusTimeline.length - 1
      ];
      expect(lastEntry.status).toBe("under_review");
      expect(lastEntry.note).toBe("Started reviewing this issue");
    });
  });
});
