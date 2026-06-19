"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

import { cropImageToBlob } from "@/lib/avatar/crop-image";

type AvatarCropModalProps = {
  file: File | null;
  uploading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (file: File) => Promise<void>;
};

export function AvatarCropModal({
  file,
  uploading = false,
  error = null,
  onClose,
  onConfirm,
}: AvatarCropModalProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!file) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !uploading && !saving) {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [file, onClose, saving, uploading]);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  async function handleSave() {
    if (!imageSrc || !croppedArea || !file) return;

    setSaving(true);
    try {
      const blob = await cropImageToBlob(imageSrc, croppedArea);
      const baseName = file.name.replace(/\.[^.]+$/, "") || "avatar";
      const croppedFile = new File([blob], `${baseName}-avatar.jpg`, { type: "image/jpeg" });
      await onConfirm(croppedFile);
    } finally {
      setSaving(false);
    }
  }

  if (!file || !imageSrc) return null;

  const busy = saving || uploading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#061410] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <h2 id="avatar-crop-title" className="font-display text-lg font-bold text-white">
            Adjust profile photo
          </h2>
          <p className="mt-1 text-xs text-white/55">
            Drag to reposition. Use the slider to zoom in or out.
          </p>
        </div>

        <div className="relative h-72 w-full bg-black/40 sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={0.5}
            maxZoom={3}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-white/50">
              <span>Zoom</span>
              <span className="tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.02}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={busy}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/15 accent-emerald-glow disabled:opacity-50"
              aria-label="Zoom"
            />
          </div>

          {error ? (
            <p className="text-xs leading-snug text-crimson-glow">{error}</p>
          ) : null}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white/75 transition hover:bg-white/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || !croppedArea}
              className="fan-btn-green flex-1 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save photo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
