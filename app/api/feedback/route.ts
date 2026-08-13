import { createFeedback, type FeedbackCategory } from "@/lib/feedback-db";
import { getPayloadClient } from "@/lib/payload";
import {
  prepareUploadImage,
  uploadImageErrorMessage,
} from "@/lib/social/prepare-upload-image";
import type { Media } from "@/payload-types";

// Matches Payload's own global upload.limits.fileSize in payload.config.ts — keeping this in
// sync means a file that passes this check never gets silently rejected one layer down.
const MAX_IMAGE_BYTES = 5_000_000;

function parseCategory(raw: unknown): FeedbackCategory {
  return raw === "bug" || raw === "feature" || raw === "other" ? raw : "other";
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();

    const title = String(form.get("title") ?? "");
    const description = String(form.get("description") ?? "");
    const category = parseCategory(form.get("category"));
    const email = String(form.get("email") ?? "");
    const name = String(form.get("name") ?? "");
    const pageUrl = String(form.get("pageUrl") ?? "");
    const userIdRaw = form.get("userId");
    const image = form.get("image");

    if (!title.trim() || !description.trim()) {
      return Response.json(
        { message: "Title and description are required" },
        { status: 400 },
      );
    }

    if (!email.trim() || !name.trim()) {
      return Response.json(
        { message: "Email and name are required" },
        { status: 400 },
      );
    }

    let imageId: number | null = null;
    if (image instanceof File && image.size > 0) {
      if (image.size > MAX_IMAGE_BYTES) {
        return Response.json(
          { message: "Image is too large — please attach a file under 5MB." },
          { status: 400 },
        );
      }

      let prepared: Awaited<ReturnType<typeof prepareUploadImage>>;
      try {
        prepared = await prepareUploadImage(image);
      } catch (err) {
        const code = err instanceof Error ? err.message : "CONVERT_FAILED";
        return Response.json(
          { message: uploadImageErrorMessage(code) },
          { status: 400 },
        );
      }

      // Media is a real Payload collection (unlike feedback), but its access.create requires a
      // logged-in Payload admin user -- feedback is submitted by anonymous site visitors too, so
      // this needs overrideAccess:true the same way /api/social/upload does for member uploads.
      const payload = await getPayloadClient();
      const media = (await payload.create({
        collection: "media",
        overrideAccess: true,
        data: {
          alt: `Feedback image: ${title}`.slice(0, 200),
        },
        file: {
          data: prepared.buffer,
          mimetype: prepared.mimetype,
          name: prepared.name,
          size: prepared.buffer.length,
        },
      })) as Media;

      imageId = typeof media.id === "number" ? media.id : Number(media.id);
    }

    const userId = userIdRaw ? Number(userIdRaw) : null;

    const feedback = await createFeedback({
      title,
      description,
      category,
      email,
      name,
      pageUrl,
      userId: Number.isFinite(userId) ? userId : null,
      imageId,
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
