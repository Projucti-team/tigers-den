import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "path";
import { buildConfig } from "payload";
import sharp from "sharp";
import { fileURLToPath } from "url";

import { Chants } from "./collections/Chants";
import { Countries } from "./collections/Countries";
import { CricketSnapshots } from "./collections/CricketSnapshots";
import { HeroSlides } from "./collections/HeroSlides";
import { MatchChatMessages } from "./collections/MatchChatMessages";
import { MatchChatRooms } from "./collections/MatchChatRooms";
import { Media } from "./collections/Media";
import { MemberFollows } from "./collections/MemberFollows";
import { MemberPosts } from "./collections/MemberPosts";
import { Members } from "./collections/Members";
import { Posts } from "./collections/Posts";
import { Players } from "./collections/Players";
import { StandComments } from "./collections/StandComments";
import { StandDiscussions } from "./collections/StandDiscussions";
import { StandReactions } from "./collections/StandReactions";
import { TrackedPlayerLeagues } from "./collections/TrackedPlayerLeagues";
import { Users } from "./collections/Users";
import { PrivacyPolicy } from "./globals/PrivacyPolicy";
import { TermsOfService } from "./globals/TermsOfService";
import { getPayloadDatabase } from "./lib/payload-db";
import { getPayloadPlugins } from "./lib/payload-plugins";
import { getPayloadServerURL, getPayloadTrustedOrigins } from "./lib/payload-url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  serverURL: getPayloadServerURL(),
  csrf: getPayloadTrustedOrigins(),
  admin: {
    user: Users.slug,
    suppressHydrationWarning: true,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      logout: {
        Button: "@/components/admin/AdminLogoutButton",
      },
      actions: ["@/components/admin/AdminLogoutButton"],
      graphics: {
        Icon: "@/components/admin/BrandIcon",
        Logo: "@/components/admin/BrandLogo",
      },
    },
    meta: {
      titleSuffix: "— The Tigers' Den",
    },
  },
  collections: [
    Users,
    Members,
    MemberPosts,
    MemberFollows,
    Media,
    Posts,
    StandDiscussions,
    Chants,
    StandReactions,
    StandComments,
    MatchChatRooms,
    MatchChatMessages,
    HeroSlides,
    Countries,
    Players,
    TrackedPlayerLeagues,
    CricketSnapshots,
  ],
  globals: [PrivacyPolicy, TermsOfService],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: getPayloadDatabase(),
  plugins: getPayloadPlugins(),
  sharp,
  upload: {
    limits: {
      fileSize: 5_000_000,
    },
  },
});
