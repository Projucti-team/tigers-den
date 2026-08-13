"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

interface FeedbackFormData {
  title: string;
  description: string;
  category: "bug" | "feature" | "other";
  email: string;
  name: string;
}

const MAX_IMAGE_BYTES = 5_000_000;
const MAX_IMAGE_LABEL = "5MB";

const CATEGORY_OPTIONS: { value: FeedbackFormData["category"]; label: string; emoji: string }[] = [
  { value: "bug", label: "Bug Report", emoji: "🐛" },
  { value: "feature", label: "Feature Request", emoji: "✨" },
  { value: "other", label: "Other Feedback", emoji: "💬" },
];

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<FeedbackFormData>({
    title: "",
    description: "",
    category: "bug",
    email: session?.user?.email || "",
    name: session?.user?.name || "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Revoke the object URL when it's replaced or the modal unmounts, so we don't leak memory.
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const handleImageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] ?? null;
      setImageError(null);

      if (!file) {
        setImage(null);
        setImagePreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        return;
      }

      if (!file.type.startsWith("image/")) {
        setImageError("Please choose an image file.");
        e.target.value = "";
        return;
      }

      if (file.size > MAX_IMAGE_BYTES) {
        setImageError(`That image is too large — please attach a file under ${MAX_IMAGE_LABEL}.`);
        e.target.value = "";
        return;
      }

      setImage(file);
      setImagePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    },
    [],
  );

  const clearImage = useCallback(() => {
    setImage(null);
    setImageError(null);
    setImagePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.title.trim() || !formData.description.trim()) {
        setSubmitStatus({
          type: "error",
          message: "Please fill in title and description",
        });
        return;
      }

      if (!formData.email.trim() || !formData.name.trim()) {
        setSubmitStatus({
          type: "error",
          message: "Please provide email and name",
        });
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus(null);

      try {
        const body = new FormData();
        body.set("title", formData.title);
        body.set("description", formData.description);
        body.set("category", formData.category);
        body.set("email", formData.email);
        body.set("name", formData.name);
        body.set("pageUrl", pageUrl);
        if (session?.user?.id) body.set("userId", session.user.id);
        if (image) body.set("image", image);

        const response = await fetch("/api/feedback", {
          method: "POST",
          body,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || "Failed to submit feedback");
        }

        setSubmitStatus({
          type: "success",
          message: "Thank you! Your feedback has been received.",
        });
        setTimeout(() => onClose(), 2000);
      } catch (error) {
        setSubmitStatus({
          type: "error",
          message:
            error instanceof Error ? error.message : "Failed to submit feedback",
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData, image, pageUrl, session?.user?.id, onClose],
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <h2 className="text-xl font-bold">Send Feedback</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Feedback type">
              {CATEGORY_OPTIONS.map((option) => {
                const isSelected = formData.category === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, category: option.value }))
                    }
                    className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-amber-600 bg-amber-50 text-amber-800"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span aria-hidden>{option.emoji}</span>
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              required
              placeholder="Brief summary of your feedback"
              value={formData.title}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, title: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              required
              placeholder="Please provide as much detail as possible"
              rows={4}
              maxLength={5000}
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500 resize-vertical"
            />
            <p className="text-xs text-gray-500 mt-1">
              {formData.description.length}/5000
            </p>
          </div>

          {/* Screenshot */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshot (optional)
            </label>
            {imagePreviewUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Attached screenshot preview"
                  className="h-20 w-20 rounded-md border border-gray-300 object-cover"
                />
                <div className="flex-1 text-sm text-gray-600">
                  <p className="truncate font-medium text-gray-800">{image?.name}</p>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="mt-1 text-xs font-semibold text-crimson hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-amber-600 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-amber-700"
              />
            )}
            <p className="mt-1 text-xs text-gray-500">Attach a screenshot, under {MAX_IMAGE_LABEL}.</p>
            {imageError ? (
              <p className="mt-1 text-xs font-semibold text-crimson">{imageError}</p>
            ) : null}
          </div>

          {/* Contact Info */}
          {!session?.user && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                  />
                </div>
              </div>
            </>
          )}

          {session?.user && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
              Submitting as {session.user.name} ({session.user.email})
            </div>
          )}

          {/* Page URL Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-600">
            Submitted from: <code className="text-gray-800">{pageUrl}</code>
          </div>

          {/* Status Messages */}
          {submitStatus && (
            <div
              className={`p-3 rounded-md text-sm ${
                submitStatus.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {submitStatus.message}
            </div>
          )}

          {/* Footer */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
