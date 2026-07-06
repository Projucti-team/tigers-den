import { getPayload } from "payload";
import config from "@/payload.config";

export async function POST(request: Request) {
  try {
    const payload = await getPayload({ config });
    const formData = await request.formData();

    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const category = formData.get("category") as "bug" | "feature" | "other";
    const email = formData.get("email") as string;
    const name = formData.get("name") as string;
    const pageUrl = formData.get("pageUrl") as string;
    const userId = formData.get("userId") as string | null;
    const imageFile = formData.get("image") as File | null;

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

    // Handle image upload if provided
    let imageId: number | null = null;
    if (imageFile && imageFile.size > 0) {
      try {
        const buffer = await imageFile.arrayBuffer();
        const mediaPayload = await payload.create({
          collection: "media",
          data: {
            alt: `Feedback image for: ${title}`,
          },
          file: {
            data: Buffer.from(buffer),
            mimetype: imageFile.type,
            name: imageFile.name,
          },
        });
        imageId = mediaPayload.id as number;
      } catch (error) {
        console.error("Failed to upload image:", error);
        // Continue without image if upload fails
      }
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
        ...(imageId && { image: imageId }),
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
