export type PublicMember = {
  id: number;
  username: string;
  name: string;
  email?: string;
  bio?: string | null;
  /** Uploaded profile photo URL (not OAuth). */
  avatarUrl?: string | null;
  country?: string | null;
  favoritePlayer?: string | null;
};

export type SocialPost = {
  id: number;
  body: string;
  createdAt: string;
  author: PublicMember;
  imageUrls: string[];
};

export type MemberSearchResult = PublicMember & {
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
};
