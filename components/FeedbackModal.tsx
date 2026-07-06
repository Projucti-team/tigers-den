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

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState<FeedbackFormData>({
    title: "",
    description: "",
    category: "bug",
    email: session?.user?.email || "",
    name: session?.user?.name || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

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
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            category: formData.category,
            email: formData.email,
            name: formData.name,
            pageUrl,
            ...(session?.user?.id && { userId: session.user.id }),
          }),
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
    [formData, pageUrl, session?.user?.id],
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
            <select
              value={formData.category}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  category: e.target.value as typeof formData.category,
                }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="bug">🐛 Bug Report</option>
              <option value="feature">✨ Feature Request</option>
              <option value="other">💬 Other Feedback</option>
            </select>
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
