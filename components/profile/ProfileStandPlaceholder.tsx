import Link from "next/link";

type ProfileStandPlaceholderProps = {
  kind: "discussions" | "chants";
  isOwnProfile: boolean;
  username: string;
};

const EMPTY_COPY = {
  discussions: {
    own: "You haven't started a discussion yet.",
    ownHint: "When threads go live, they'll show up here and on The Stand.",
    other: (name: string) => `${name} hasn't started a discussion yet.`,
  },
  chants: {
    own: "You haven't raised a chant yet.",
    ownHint: "Submit lyrics for the terrace — approved chants can be featured on the homepage.",
    other: (name: string) => `${name} hasn't submitted a chant yet.`,
  },
} as const;

export function ProfileStandPlaceholder({
  kind,
  isOwnProfile,
  username,
}: ProfileStandPlaceholderProps) {
  const copy = EMPTY_COPY[kind];

  return (
    <div className="rounded-2xl border border-dashed border-white/15 py-10 text-center">
      <p className="text-sm text-white/60">
        {isOwnProfile ? copy.own : copy.other(username)}
      </p>
      {isOwnProfile ? (
        <p className="mx-auto mt-2 max-w-sm text-xs text-white/40">{copy.ownHint}</p>
      ) : null}
      <Link
        href={kind === "chants" ? "/#chants" : "/the-stand"}
        className="mt-4 inline-block text-xs font-bold uppercase text-emerald-glow hover:underline"
      >
        {kind === "chants" ? "See Chant of the Week" : "Visit The Stand"}
      </Link>
    </div>
  );
}
