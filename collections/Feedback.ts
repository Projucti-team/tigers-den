import type { CollectionConfig } from "payload";

const addStatusTimelineEntry = async ({
  data,
  originalDoc,
}: {
  data: any;
  originalDoc: any;
}) => {
  // Only update timeline if status changed
  if (
    data.status &&
    originalDoc &&
    originalDoc.status !== data.status
  ) {
    const timeline = originalDoc.statusTimeline || [];
    timeline.push({
      status: data.status,
      changedAt: new Date().toISOString(),
      note: data.statusNote || "",
    });
    data.statusTimeline = timeline;
    // Clear the temp note field if it exists
    if (data.statusNote) delete data.statusNote;
  }
  return data;
};

export const Feedback: CollectionConfig = {
  slug: "feedback",
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "category", "submittedAt", "updatedAt"],
    description: "User feedback, bug reports, and feature requests with status tracking.",
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => true,
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [addStatusTimelineEntry],
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      admin: { description: "Brief title of the issue or request" },
    },
    {
      name: "description",
      type: "textarea",
      required: true,
      maxLength: 5000,
      admin: { description: "Detailed description of the feedback" },
    },
    {
      name: "category",
      type: "select",
      required: true,
      defaultValue: "bug",
      options: [
        { label: "Bug report", value: "bug" },
        { label: "Feature request", value: "feature" },
        { label: "Other feedback", value: "other" },
      ],
    },
    {
      name: "image",
      type: "relationship",
      relationTo: "media",
      admin: { description: "Screenshot or image (optional)" },
    },
    {
      name: "pageUrl",
      type: "text",
      required: true,
      admin: { description: "Page where feedback was submitted" },
    },
    {
      name: "user",
      type: "relationship",
      relationTo: "users",
      admin: { description: "Logged-in user who submitted feedback" },
    },
    {
      name: "email",
      type: "email",
      admin: { description: "Contact email (auto-filled from user or provided)" },
    },
    {
      name: "name",
      type: "text",
      admin: { description: "Submitter name (auto-filled from user or provided)" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "new",
      options: [
        { label: "New", value: "new" },
        { label: "Under review", value: "under_review" },
        { label: "Ticket raised", value: "ticket_raised" },
        { label: "In progress", value: "in_progress" },
        { label: "Resolved", value: "resolved" },
        { label: "Dismissed", value: "dismissed" },
      ],
      index: true,
    },
    {
      name: "statusNote",
      type: "textarea",
      maxLength: 1000,
      admin: {
        description: "Optional note to add when updating status (added to timeline automatically)",
      },
    },
    {
      name: "statusTimeline",
      type: "array",
      fields: [
        {
          name: "status",
          type: "select",
          required: true,
          options: [
            { label: "New", value: "new" },
            { label: "Under review", value: "under_review" },
            { label: "Ticket raised", value: "ticket_raised" },
            { label: "In progress", value: "in_progress" },
            { label: "Resolved", value: "resolved" },
            { label: "Dismissed", value: "dismissed" },
          ],
        },
        {
          name: "note",
          type: "textarea",
          maxLength: 1000,
          admin: { description: "Optional note about this status change" },
        },
        {
          name: "changedAt",
          type: "date",
          required: true,
          admin: { date: { pickerAppearance: "dayAndTime" } },
        },
      ],
      admin: { description: "Timeline of status changes" },
    },
  ],
};
