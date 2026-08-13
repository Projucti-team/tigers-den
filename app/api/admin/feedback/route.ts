import { NextResponse } from "next/server";

import { getPayloadClient } from "@/lib/payload";
import { getRelativeMediaUrl } from "@/lib/media";
import {
  countFeedbackByStatus,
  readAllFeedback,
  updateFeedbackStatus,
  type FeedbackStatus,
} from "@/lib/feedback-db";
import type { Media } from "@/payload-types";

export const runtime = "nodejs";

const VALID_STATUSES: FeedbackStatus[] = [
  "new",
  "under_review",
  "ticket_raised",
  "in_progress",
  "resolved",
  "dismissed",
];

async function requireAdmin(request: Request) {
  const payload = await getPayloadClient();
  const { user } = await payload.auth({ headers: request.headers });
  return user;
}

/** List feedback (optionally filtered by status), with image_id resolved to a viewable URL. */
export async function GET(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const statusParam = new URL(request.url).searchParams.get("status");
    const status =
      statusParam && (VALID_STATUSES as string[]).includes(statusParam)
        ? (statusParam as FeedbackStatus)
        : undefined;

    const rows = await readAllFeedback(status);

    const imageIds = [...new Set(rows.map((r) => r.image_id).filter((id): id is number => id != null))];
    const imageUrlById = new Map<number, string | null>();
    if (imageIds.length) {
      const payload = await getPayloadClient();
      const media = await payload.find({
        collection: "media",
        overrideAccess: true,
        limit: imageIds.length,
        where: { id: { in: imageIds } },
      });
      for (const doc of media.docs as Media[]) {
        imageUrlById.set(Number(doc.id), getRelativeMediaUrl(doc));
      }
    }

    const counts: Record<string, number> = {};
    for (const s of VALID_STATUSES) {
      counts[s] = await countFeedbackByStatus(s);
    }

    return NextResponse.json({
      rows: rows.map((r) => ({
        ...r,
        image_url: r.image_id != null ? (imageUrlById.get(r.image_id) ?? null) : null,
      })),
      counts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load feedback" },
      { status: 500 },
    );
  }
}

/** Change a feedback item's status, appending to its status timeline. */
export async function PATCH(request: Request) {
  const user = await requireAdmin(request);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized — sign in to Payload admin first." },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as { id?: number; status?: string; note?: string };
    const id = Number(body.id);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!body.status || !(VALID_STATUSES as string[]).includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }

    const updated = await updateFeedbackStatus(id, body.status as FeedbackStatus, body.note ?? null);
    if (!updated) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, row: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update feedback" },
      { status: 500 },
    );
  }
}
