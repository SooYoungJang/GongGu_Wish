import { Fragment, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuthGate } from "../../hooks/useAuthGate";
import { useTheme } from "../../context/ThemeContext";
import { borderRadius, spacing } from "../../design/tokens";
import { SText } from "../../components/ui/SText";
import type { ColorPalette } from "../../context/ThemeContext";
import {
  blockUserFromComment,
  createComment,
  listCommentChildren,
  listCommentRoots,
  reportComment,
  setCommentLike,
} from "./api";
import type { CommentSort, CommentView } from "./types";
import {
  commentPlaceholder,
  COMMENT_TERMS_VERSION,
  MAX_COMMENT_LENGTH,
  formatCommentAge,
  validateCommentBody,
  visualCommentIndent,
} from "./utils";

type CommentSheetProps = {
  groupBuyId: string;
  visible: boolean;
  onClose: () => void;
};

interface RenderCommentChildren {
  // eslint-disable-next-line no-unused-vars -- call-signature parameter documents the callback contract
  (comments: CommentView[]): ReactNode;
}

type CommentItemProps = {
  comment: CommentView;
  children: CommentView[];
  isReply: boolean;
  expanded: boolean;
  loadingChildren: boolean;
  showReplyToggle?: boolean;
  onLoadChildren: () => void;
  onReply: () => void;
  onLike: () => void;
  onMore: () => void;
  renderChildren: RenderCommentChildren;
  colors: ColorPalette;
};

function CommentItem({
  comment,
  children,
  isReply,
  expanded,
  loadingChildren,
  showReplyToggle = true,
  onLoadChildren,
  onReply,
  onLike,
  onMore,
  renderChildren,
  colors,
}: CommentItemProps) {
  const deleted = comment.state !== "visible";
  return (
    <View
      style={[
        styles.commentCard,
        { borderBottomColor: colors.border, marginLeft: isReply ? 0 : visualCommentIndent(comment.depth) },
      ]}
    >
      <View style={styles.commentHeader}>
        <View style={styles.authorCluster}>
          <View style={[styles.avatar, { backgroundColor: colors.primaryBg }]}>
            <Ionicons name="person" size={16} color={colors.primary} />
          </View>
          <View style={styles.authorMeta}>
            <SText variant="label" style={{ color: colors.textPrimary }}>
              {comment.authorDisplayName ?? "공구 사용자"}
            </SText>
            <SText variant="caption" style={{ color: colors.textTertiary }}>
              {comment.editedAt ? `수정됨 · ${formatCommentAge(comment.createdAt)}` : formatCommentAge(comment.createdAt)}
            </SText>
          </View>
        </View>
        {!deleted && comment.canReport ? (
          <Pressable
            accessibilityLabel="댓글 더보기"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onMore}
            style={styles.moreButton}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {comment.replyToDisplayName && comment.depth > 0 ? (
        <SText variant="caption" style={{ color: colors.primary, marginBottom: 4 }}>
          @{comment.replyToDisplayName}에게 답글
        </SText>
      ) : null}
      <SText
        variant="body"
        style={{ color: deleted ? colors.textTertiary : colors.textPrimary }}
      >
        {comment.body ?? commentPlaceholder(comment.state)}
      </SText>
      {!deleted ? (
        <View style={styles.commentActions}>
          <Pressable
            accessibilityLabel={comment.likedByMe ? "좋아요 취소" : "댓글 좋아요"}
            accessibilityRole="button"
            disabled={!comment.canLike}
            onPress={onLike}
            style={styles.commentAction}
          >
            <Ionicons
              name={comment.likedByMe ? "heart" : "heart-outline"}
              size={17}
              color={comment.likedByMe ? colors.primary : colors.textTertiary}
            />
            <SText variant="caption" style={{ color: colors.textTertiary }}>
              {comment.likeCount}
            </SText>
          </Pressable>
          <Pressable accessibilityLabel="답글 작성" accessibilityRole="button" onPress={onReply} style={styles.commentAction}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
            <SText variant="caption" style={{ color: colors.textTertiary }}>
              답글
            </SText>
          </Pressable>
        </View>
      ) : null}
      {showReplyToggle && comment.directReplyCount > 0 ? (
        <Pressable
          accessibilityLabel={expanded ? "답글 접기" : `답글 ${comment.directReplyCount}개 보기`}
          accessibilityRole="button"
          onPress={onLoadChildren}
          style={styles.replyToggle}
        >
          {loadingChildren ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={15}
            color={colors.primary}
          />
          <SText variant="caption" style={{ color: colors.primary }}>
            {expanded ? "답글 숨기기" : `답글 ${comment.directReplyCount}개 보기`}
          </SText>
        </Pressable>
      ) : null}
      {!isReply && expanded ? (
        <View accessibilityLabel="댓글 답글 목록" style={[styles.replyThread, { borderLeftColor: colors.border }]}>
          {loadingChildren ? <ActivityIndicator color={colors.primary} style={styles.threadLoader} /> : null}
          {renderChildren(children)}
        </View>
      ) : null}
    </View>
  );
}

export function CommentSheet({ groupBuyId, visible, onClose }: CommentSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, requireAuth } = useAuthGate();
  const [sort, setSort] = useState<CommentSort>("latest");
  const [body, setBody] = useState("");
  const [replyTarget, setReplyTarget] = useState<CommentView | null>(null);
  const [childrenByParent, setChildrenByParent] = useState<Record<string, CommentView[]>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeThreadRoot, setActiveThreadRoot] = useState<CommentView | null>(null);
  const [loadingChildren, setLoadingChildren] = useState<Set<string>>(new Set());
  const [additionalRoots, setAdditionalRoots] = useState<CommentView[]>([]);
  const [rootCursor, setRootCursor] = useState<string | null>(null);
  const [loadingMoreRoots, setLoadingMoreRoots] = useState(false);

  const rootsQuery = useQuery({
    queryKey: ["comments", groupBuyId, sort, "roots"],
    queryFn: () => listCommentRoots(groupBuyId, sort),
    enabled: visible,
    staleTime: 15_000,
  });
  const { refetch: refetchRoots } = rootsQuery;

  useEffect(() => {
    setAdditionalRoots([]);
    setRootCursor(rootsQuery.data?.nextCursor ?? null);
  }, [groupBuyId, rootsQuery.data, sort]);

  useEffect(() => {
    if (!visible) {
      setActiveThreadRoot(null);
      setReplyTarget(null);
      setExpandedIds(new Set());
    }
  }, [visible]);

  const refreshComments = useCallback(async () => {
    setAdditionalRoots([]);
    setRootCursor(null);
    setChildrenByParent({});
    setExpandedIds(new Set());
    setActiveThreadRoot(null);
    await refetchRoots();
  }, [refetchRoots]);

  const loadMoreRoots = useCallback(async () => {
    if (!rootCursor || loadingMoreRoots) return;
    setLoadingMoreRoots(true);
    try {
      const page = await listCommentRoots(groupBuyId, sort, rootCursor);
      setAdditionalRoots((current) => [...current, ...page.items]);
      setRootCursor(page.nextCursor);
    } catch (error) {
      Alert.alert(
        "댓글을 더 불러오지 못했어요",
        error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoadingMoreRoots(false);
    }
  }, [groupBuyId, loadingMoreRoots, rootCursor, sort]);

  const fetchAllChildrenForParent = useCallback(
    async (parentId: string) => {
      const items: CommentView[] = [];
      let cursor: string | null = null;
      do {
        const page = await listCommentChildren(groupBuyId, parentId, cursor);
        items.push(...page.items);
        if (!page.nextCursor || page.nextCursor === cursor) {
          cursor = null;
        } else {
          cursor = page.nextCursor;
        }
      } while (cursor);
      return items;
    },
    [groupBuyId],
  );

  const fetchAllThreadChildren = useCallback(
    async (rootId: string) => {
      const loaded: Record<string, CommentView[]> = {};
      const pending = [rootId];
      const visited = new Set<string>();

      while (pending.length > 0) {
        const parentId = pending.shift();
        if (!parentId || visited.has(parentId)) continue;
        visited.add(parentId);

        const children = await fetchAllChildrenForParent(parentId);
        loaded[parentId] = children;
        for (const child of children) {
          if (child.directReplyCount > 0 && !visited.has(child.id)) {
            pending.push(child.id);
          }
        }
      }

      return loaded;
    },
    [fetchAllChildrenForParent],
  );

  const loadChildren = useCallback(
    async (comment: CommentView) => {
      if (expandedIds.has(comment.id)) {
        setExpandedIds((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
        return;
      }
      setLoadingChildren((current) => new Set(current).add(comment.id));
      try {
        const children = await fetchAllChildrenForParent(comment.id);
        setChildrenByParent((current) => ({ ...current, [comment.id]: children }));
        setExpandedIds((current) => new Set(current).add(comment.id));
      } catch (error) {
        Alert.alert("답글을 불러오지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
      } finally {
        setLoadingChildren((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
      }
    },
    [expandedIds, fetchAllChildrenForParent],
  );

  const openThread = useCallback(
    async (comment: CommentView) => {
      setActiveThreadRoot(comment);
      setExpandedIds((current) => new Set(current).add(comment.id));

      setLoadingChildren((current) => new Set(current).add(comment.id));
      try {
        const loaded = await fetchAllThreadChildren(comment.id);
        setChildrenByParent((current) => ({ ...current, ...loaded }));
        setExpandedIds((current) => {
          const next = new Set(current);
          Object.keys(loaded).forEach((parentId) => next.add(parentId));
          return next;
        });
      } catch (error) {
        setActiveThreadRoot(null);
        setExpandedIds((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
        Alert.alert("답글을 불러오지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
      } finally {
        setLoadingChildren((current) => {
          const next = new Set(current);
          next.delete(comment.id);
          return next;
        });
      }
    },
    [fetchAllThreadChildren],
  );

  const closeThread = useCallback(() => {
    if (activeThreadRoot) {
      setExpandedIds((expanded) => {
        const next = new Set(expanded);
        next.delete(activeThreadRoot.id);
        return next;
      });
    }
    setActiveThreadRoot(null);
  }, [activeThreadRoot]);

  const handleLike = useCallback(
    async (comment: CommentView) => {
      if (!requireAuth()) return;
      try {
        await setCommentLike(comment.id, !comment.likedByMe);
        await refreshComments();
      } catch (error) {
        Alert.alert("좋아요를 처리하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
      }
    },
    [refreshComments, requireAuth],
  );

  const handleReport = useCallback(
    async (comment: CommentView) => {
      if (!requireAuth()) return;
      const submitReport = async (reason: string) => {
        try {
          await reportComment(comment.id, reason);
          await refreshComments();
          Alert.alert("신고가 접수됐어요", "운영팀이 내용을 확인할게요.");
        } catch (error) {
          Alert.alert(
            "신고하지 못했어요",
            error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.",
          );
        }
      };
      Alert.alert("댓글 신고", "신고 사유를 선택해 주세요.", [
        { text: "취소", style: "cancel" },
        { text: "스팸/광고", onPress: () => void submitReport("SPAM") },
        { text: "욕설/혐오", onPress: () => void submitReport("ABUSE") },
        { text: "기타", onPress: () => void submitReport("OTHER") },
      ]);
    },
    [refreshComments, requireAuth],
  );

  const handleBlock = useCallback(
    (comment: CommentView) => {
      if (!requireAuth()) return;
      Alert.alert("사용자 차단", "이 사용자의 댓글을 앞으로 숨길까요?", [
        { text: "취소", style: "cancel" },
        {
          text: "차단",
          style: "destructive",
          onPress: async () => {
            try {
              await blockUserFromComment(comment.id);
              await refreshComments();
            } catch (error) {
              Alert.alert("차단하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
            }
          },
        },
      ]);
    },
    [refreshComments, requireAuth],
  );

  const handleMore = useCallback(
    (comment: CommentView) => {
      if (!requireAuth()) return;
      const actions = [
        { text: "취소", style: "cancel" as const },
        ...(comment.canReport
          ? [{ text: "신고", onPress: () => void handleReport(comment) }]
          : []),
        {
          text: "사용자 차단",
          style: "destructive" as const,
          onPress: () => handleBlock(comment),
        },
      ];
      Alert.alert("댓글 더보기", "댓글 운영 옵션을 선택해 주세요.", actions);
    },
    [handleBlock, handleReport, requireAuth],
  );

  const submitComment = useCallback(async () => {
    if (!requireAuth()) return;
    const validationError = validateCommentBody(body);
    if (validationError) {
      Alert.alert("댓글을 확인해 주세요", validationError);
      return;
    }
    try {
      await createComment({
        groupBuyId,
        parentId: replyTarget?.id,
        body,
        termsVersion: COMMENT_TERMS_VERSION,
      });
      setBody("");
      setReplyTarget(null);
      await refreshComments();
    } catch (error) {
      Alert.alert("댓글을 등록하지 못했어요", error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요.");
    }
  }, [body, groupBuyId, refreshComments, replyTarget, requireAuth]);

  const renderChildren = useCallback(
    (items: CommentView[]): ReactNode => {
      const renderNested = (nestedItems: CommentView[]): ReactNode =>
        nestedItems.map((item) => (
          <Fragment key={item.id}>
            <CommentItem
              comment={item}
              children={childrenByParent[item.id] ?? []}
              colors={colors}
              expanded={expandedIds.has(item.id)}
              isReply
              loadingChildren={loadingChildren.has(item.id)}
              onLike={() => void handleLike(item)}
              onLoadChildren={() => void loadChildren(item)}
              onMore={() => handleMore(item)}
              onReply={() => setReplyTarget(item)}
              renderChildren={renderChildren}
              showReplyToggle={!activeThreadRoot}
            />
            {(activeThreadRoot || expandedIds.has(item.id))
              ? renderNested(childrenByParent[item.id] ?? [])
              : null}
          </Fragment>
        ));
      return renderNested(items);
    },
    [
      activeThreadRoot,
      childrenByParent,
      colors,
      expandedIds,
      handleLike,
      handleMore,
      loadChildren,
      loadingChildren,
    ],
  );

  const roots = useMemo(
    () => [...(rootsQuery.data?.items ?? []), ...additionalRoots],
    [additionalRoots, rootsQuery.data?.items],
  );

  if (!visible) return null;

  return (
    <View style={styles.modalLayer}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalRoot}
      >
        <Pressable accessibilityLabel="댓글 닫기" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              {activeThreadRoot ? (
                <Pressable
                  accessibilityLabel="댓글 스레드 닫기"
                  accessibilityRole="button"
                  onPress={closeThread}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={23} color={colors.textPrimary} />
                </Pressable>
              ) : null}
              <View>
                <SText variant="cardTitle" style={{ color: colors.textPrimary }}>
                  {activeThreadRoot ? "답글" : "댓글"}
                </SText>
                {!activeThreadRoot ? (
                  <SText variant="caption" style={{ color: colors.textTertiary }}>
                    상품에 대한 의견을 나눠보세요.
                  </SText>
                ) : null}
              </View>
            </View>
            <Pressable accessibilityLabel="댓글 창 닫기" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          {!activeThreadRoot ? (
            <View style={styles.sortTabs}>
              {(["latest", "popular"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  onPress={() => {
                    setSort(value);
                    setChildrenByParent({});
                    setExpandedIds(new Set());
                    setActiveThreadRoot(null);
                    setReplyTarget(null);
                  }}
                  style={[styles.sortTab, sort === value && { backgroundColor: colors.primary }]}
                >
                  <SText variant="caption" style={{ color: sort === value ? colors.textInverse : colors.textSecondary }}>
                    {value === "latest" ? "최신순" : "인기순"}
                  </SText>
                </Pressable>
              ))}
            </View>
          ) : null}
          {rootsQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          {rootsQuery.isError ? (
            <View style={styles.emptyState}>
              <SText variant="body" style={{ color: colors.textSecondary }}>댓글을 불러오지 못했어요.</SText>
              <Pressable onPress={() => void rootsQuery.refetch()} style={styles.retryButton}><SText variant="label" style={{ color: colors.primary }}>다시 시도</SText></Pressable>
            </View>
          ) : (
            <FlatList
              data={activeThreadRoot ? [activeThreadRoot] : roots}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<View style={styles.emptyState}><SText variant="body" style={{ color: colors.textSecondary }}>아직 댓글이 없어요. 첫 의견을 남겨보세요.</SText></View>}
              ListFooterComponent={
                !activeThreadRoot && rootCursor ? (
                  <Pressable
                    accessibilityRole="button"
                    disabled={loadingMoreRoots}
                    onPress={() => void loadMoreRoots()}
                    style={styles.loadMoreButton}
                  >
                    {loadingMoreRoots ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <SText variant="label" style={{ color: colors.primary }}>
                        댓글 더 보기
                      </SText>
                    )}
                  </Pressable>
                ) : null
              }
              renderItem={({ item }) => (
                <CommentItem
                  comment={item}
                  children={childrenByParent[item.id] ?? []}
                  colors={colors}
                  expanded={activeThreadRoot ? true : expandedIds.has(item.id)}
                  isReply={false}
                  loadingChildren={loadingChildren.has(item.id)}
                  onLoadChildren={() => {
                    if (!activeThreadRoot) void openThread(item);
                  }}
                  onLike={() => void handleLike(item)}
                  onMore={() => handleMore(item)}
                  onReply={() => setReplyTarget(item)}
                  renderChildren={renderChildren}
                  showReplyToggle={!activeThreadRoot}
                />
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}
          {isAuthenticated ? (
            <KeyboardStickyView enabled={Platform.OS === "android"}>
              <View
                testID="comment-composer"
                style={[
                  styles.composer,
                  {
                    backgroundColor: colors.bg,
                    borderTopColor: colors.border,
                    paddingBottom: spacing.md + insets.bottom,
                  },
                ]}
              >
                {replyTarget ? (
                  <View style={styles.replyingRow}>
                    <SText variant="caption" style={{ color: colors.primary }}>@{replyTarget.authorDisplayName ?? "공구 사용자"}에게 답글</SText>
                    <Pressable accessibilityLabel="답글 대상 취소" onPress={() => setReplyTarget(null)}><Ionicons name="close-circle" size={18} color={colors.textTertiary} /></Pressable>
                  </View>
                ) : null}
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel="댓글 입력"
                    maxLength={MAX_COMMENT_LENGTH}
                    multiline
                    onChangeText={setBody}
                    placeholder={replyTarget ? "답글을 입력하세요" : "댓글을 입력하세요"}
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                    value={body}
                  />
                  <Pressable accessibilityLabel="댓글 등록" accessibilityRole="button" disabled={!body.trim()} onPress={() => void submitComment()} style={[styles.sendButton, { backgroundColor: colors.primary }, !body.trim() && styles.disabledButton]}>
                    <Ionicons name="arrow-up" size={20} color={colors.textInverse} />
                  </Pressable>
                </View>
              </View>
            </KeyboardStickyView>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => requireAuth()}
              style={[
                styles.loginPrompt,
                {
                  borderTopColor: colors.border,
                  minHeight: 58 + insets.bottom,
                  paddingBottom: insets.bottom,
                },
              ]}
            >
              <SText variant="label" style={{ color: colors.primary }}>로그인하고 댓글 쓰기</SText>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  modalLayer: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "86%", minHeight: 420, paddingTop: spacing.sm },
  handle: { alignSelf: "center", backgroundColor: "rgba(127,127,127,0.5)", borderRadius: 999, height: 5, marginBottom: spacing.sm, width: 52 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg },
  headerTitleRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.xs },
  backButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  closeButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  sortTabs: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  sortTab: { alignItems: "center", borderRadius: borderRadius.full, minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.md },
  loader: { marginVertical: spacing.xl },
  list: { flex: 1, paddingHorizontal: spacing.lg },
  emptyState: { alignItems: "center", minHeight: 150, justifyContent: "center", padding: spacing.xl },
  retryButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  loadMoreButton: { alignItems: "center", minHeight: 48, justifyContent: "center" },
  commentCard: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.md },
  commentHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  authorCluster: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.sm },
  authorMeta: { flex: 1, gap: 2 },
  avatar: { alignItems: "center", borderCurve: "continuous", borderRadius: borderRadius.full, height: 32, justifyContent: "center", width: 32 },
  moreButton: { alignItems: "center", height: 44, justifyContent: "center", width: 44 },
  commentActions: { alignItems: "center", flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  commentAction: { alignItems: "center", flexDirection: "row", gap: 4, minHeight: 36, minWidth: 36 },
  replyToggle: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 40, paddingTop: spacing.xs },
  replyThread: { borderLeftWidth: 2, marginLeft: spacing.lg, marginTop: spacing.sm, paddingLeft: spacing.sm },
  threadLoader: { alignSelf: "flex-start", marginVertical: spacing.sm },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  replyingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  inputRow: { alignItems: "flex-end", flexDirection: "row", gap: spacing.sm },
  input: { borderRadius: 20, borderWidth: 1, flex: 1, maxHeight: 90, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButton: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  disabledButton: { opacity: 0.4 },
  loginPrompt: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, minHeight: 58, justifyContent: "center" },
});
