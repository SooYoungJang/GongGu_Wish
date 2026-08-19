export type CommentSort = "latest" | "popular";

export type CommentState = "visible" | "hidden" | "deleted" | "account_anonymized";

export type CommentView = {
  id: string;
  groupBuyId: string;
  parentId: string | null;
  rootId: string;
  depth: number;
  state: CommentState;
  body: string | null;
  authorDisplayName: string | null;
  replyToDisplayName: string | null;
  createdAt: string;
  editedAt: string | null;
  contentVersion: number;
  likeCount: number;
  likedByMe: boolean;
  directReplyCount: number;
  canEdit: boolean;
  canDelete: boolean;
  canLike: boolean;
  canReport: boolean;
};

export type CommentPage = {
  items: CommentView[];
  nextCursor: string | null;
  liveRanking: boolean;
};
