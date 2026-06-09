/** Quick-pick emojis for The Roar — cricket & Bangladesh fan themed. */
export const CHAT_EMOJI_GROUPS = [
  {
    label: "Fans",
    emojis: ["🐯", "🔥", "❤️", "💚", "❤️‍🔥", "👏", "🙌", "💯", "⚡", "🎉", "😍", "🤩"],
  },
  {
    label: "Cricket",
    emojis: ["🏏", "🏆", "🎯", "🧤", "⭐", "🇧🇩", "📣", "🦁"],
  },
  {
    label: "Smileys",
    emojis: ["😀", "😂", "😅", "😎", "🥳", "😤", "😢", "😱", "🤔", "👍", "👎", "💪"],
  },
] as const;

export const CHAT_EMOJIS = CHAT_EMOJI_GROUPS.flatMap((g) => g.emojis);
