import { NextResponse } from "next/server";

import { socialApiError } from "@/lib/social/api-error";
import { getAbsoluteMediaUrl } from "@/lib/media";
import {
  prepareUploadImage,
  uploadImageErrorMessage,
} from "@/lib/social/prepare-upload-image";
import { requireMemberSession } from "@/lib/social/session";
import { getPayloadClient } from "@/lib/payload";
import type { Media } from "@/payload-types";

export async function POST(request: Request) {
  try {
    await requireMemberSession();

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file required" }, { status: 400 });
    }

    let prepared: Awaited<ReturnType<typeof prepareUploadImage>>;
    try {
      prepared = await prepareUploadImage(file);
    } catch (err) {
      const code = err instanceof Error ? err.message : "CONVERT_FAILED";
      return NextResponse.json(
        { error: uploadImageErrorMessage(code) },
        { status: 400 },
      );
    }

    const payload = await getPayloadClient();

    const media = (await payload.create({
      collection: "media",
      overrideAccess: true,
      data: {
        alt: prepared.name || "Member upload",
      },
      file: {
        data: prepared.buffer,
        mimetype: prepared.mimetype,
        name: prepared.name,
        size: prepared.buffer.length,
      },
    })) as Media;

    const url = getAbsoluteMediaUrl(media);

    return NextResponse.json({
      id: media.id,
      url,
    });
  } catch (err) {
    return socialApiError(err);
  }
}
