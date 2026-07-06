import { getPayload } from "payload";
import config from "@/payload.config";

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const body = await request.json();

    const title = body.title as string;
    const description = body.description as string;
    const category = body.category as "bug" | "feature" | "other";
    const email = body.email as string;
    const name = body.name as string;
    const pageUrl = body.pageUrl as string;
    const userId = body.userId as string | null;

    // Validate required fields
    if (!title?.trim() || !description?.trim()) {
      return Response.json(
        { message: "Title and description are required" },
        { status: 400 },
      );
    }

    if (!email?.trim() || !name?.trim()) {
      return Response.json(
        { message: "Email and name are required" },
        { status: 400 },
      );
    }

    // Create status timeline entry
    const now = new Date().toISOString();
    const statusTimeline = [
      {
        status: "new",
        changedAt: now,
        note: "Feedback submitted",
      },
    ];

    // Create feedback record
    const feedback = await payload.create({
      collection: "feedback",
      data: {
        title,
        description,
        category,
        email,
        name,
        pageUrl,
        status: "new",
        statusTimeline,
        ...(userId && { user: userId }),
      },
    });

    return Response.json(
      {
        success: true,
        message: "Feedback submitted successfully",
        id: feedback.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return Response.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to submit feedback",
      },
      { status: 500 },
    );
  }
}
