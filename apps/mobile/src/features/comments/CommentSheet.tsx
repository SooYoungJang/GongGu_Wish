import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
  validateCommentBody,
  visualCommentIndent,
} from "./utils";

type CommentSheetProps = {
  groupBuyId: string;
  visible: boolean;
  onClose: () => void;
};

type CommentItemProps = {
  comment: CommentView;
  children: CommentView[];
  expanded: boolean;
  loadingChildren: boolean;
  onLoadChildren: () => void;
  onReply: () => void;
  onLike: () => void;
  onReport: () => void;
  onBlock: () => void;
  renderChildren: (items: CommentView[]) => ReactNode;
  colors: ColorPalette;
};

function CommentItem({
  comment,
  children,
  expanded,
  loadingChildren,
  onLoadChildren,
  onReply,
  onLike,
  onReport,
  onBlock,
  renderChildren,
  colors,
}: CommentItemProps) {
  const deleted = comment.state !== "visible";
  return (
    <View
      style={[
        styles.commentCard,
        { borderBottomColor: colors.border, marginLeft: visualCommentIndent(comment.depth) },
      ]}
    >
      <View style={styles.commentHeader}>
        <SText variant="label" style={{ color: colors.textPrimary }}>
          {comment.authorDisplayName ?? "공구 사용자"}
        </SText>
        <SText variant="caption" style={{ color: colors.textTertiary }}>
          {comment.editedAt ? "수정됨" : new Date(comment.createdAt).toLocaleDateString("ko-KR")}
        </SText>
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
          <Pressable accessibilityRole="button" onPress={onReply} style={styles.commentAction}>
            <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
            <SText variant="caption" style={{ color: colors.textTertiary }}>
              답글 {comment.directReplyCount > 0 ? comment.directReplyCount : ""}
            </SText>
          </Pressable>
          <Pressable accessibilityLabel="댓글 신고" accessibilityRole="button" onPress={onReport} style={styles.commentAction}>
            <Ionicons name="flag-outline" size={16} color={colors.textTertiary} />
          </Pressable>
          <Pressable accessibilityLabel="사용자 차단" accessibilityRole="button" onPress={onBlock} style={styles.commentAction}>
            <Ionicons name="person-remove-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      ) : null}
      {comment.directReplyCount > 0 ? (
        <Pressable accessibilityRole="button" onPress={onLoadChildren} style={styles.replyToggle}>
          {loadingChildren ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          <SText variant="caption" style={{ color: colors.primary }}>
            {expanded ? "답글 숨기기" : `답글 ${comment.directReplyCount}개 보기`}
          </SText>
        </Pressable>
      ) : null}
      {expanded ? renderChildren(children) : null}
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

  const refreshComments = useCallback(async () => {
    setAdditionalRoots([]);
    setRootCursor(null);
    setChildrenByParent({});
    setExpandedIds(new Set());
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
        const page = await listCommentChildren(groupBuyId, comment.id);
        setChildrenByParent((current) => ({ ...current, [comment.id]: page.items }));
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
    [expandedIds, groupBuyId],
  );

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
    (items: CommentView[]): ReactNode =>
      items.map((item) => (
        <CommentItem
          key={item.id}
          comment={item}
          children={childrenByParent[item.id] ?? []}
          colors={colors}
          expanded={expandedIds.has(item.id)}
          loadingChildren={loadingChildren.has(item.id)}
          onBlock={() => handleBlock(item)}
          onLike={() => void handleLike(item)}
          onLoadChildren={() => void loadChildren(item)}
          onReply={() => setReplyTarget(item)}
          onReport={() => void handleReport(item)}
          renderChildren={renderChildren}
        />
      )),
    [childrenByParent, colors, expandedIds, handleBlock, handleLike, handleReport, loadChildren, loadingChildren],
  );

  const roots = useMemo(
    () => [...(rootsQuery.data?.items ?? []), ...additionalRoots],
    [additionalRoots, rootsQuery.data?.items],
  );

  if (!visible) return null;

  return (
    <View style={styles.modalLayer}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalRoot}>
        <Pressable accessibilityLabel="댓글 닫기" accessibilityRole="button" onPress={onClose} style={styles.backdrop} />
        <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <SText variant="cardTitle" style={{ color: colors.textPrimary }}>댓글</SText>
              <SText variant="caption" style={{ color: colors.textTertiary }}>상품에 대한 의견을 나눠보세요.</SText>
            </View>
            <Pressable accessibilityLabel="댓글 창 닫기" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.sortTabs}>
            {(["latest", "popular"] as const).map((value) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                onPress={() => {
                  setSort(value);
                  setChildrenByParent({});
                  setExpandedIds(new Set());
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
          {rootsQuery.isLoading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          {rootsQuery.isError ? (
            <View style={styles.emptyState}>
              <SText variant="body" style={{ color: colors.textSecondary }}>댓글을 불러오지 못했어요.</SText>
              <Pressable onPress={() => void rootsQuery.refetch()} style={styles.retryButton}><SText variant="label" style={{ color: colors.primary }}>다시 시도</SText></Pressable>
            </View>
          ) : (
            <FlatList
              data={roots}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<View style={styles.emptyState}><SText variant="body" style={{ color: colors.textSecondary }}>아직 댓글이 없어요. 첫 의견을 남겨보세요.</SText></View>}
              ListFooterComponent={
                rootCursor ? (
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
                  expanded={expandedIds.has(item.id)}
                  loadingChildren={loadingChildren.has(item.id)}
                  onBlock={() => handleBlock(item)}
                  onLike={() => void handleLike(item)}
                  onLoadChildren={() => void loadChildren(item)}
                  onReply={() => setReplyTarget(item)}
                  onReport={() => void handleReport(item)}
                  renderChildren={renderChildren}
                />
              )}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}
          {isAuthenticated ? (
            <View
              style={[
                styles.composer,
                {
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
  commentActions: { alignItems: "center", flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  commentAction: { alignItems: "center", flexDirection: "row", gap: 4, minHeight: 36, minWidth: 36 },
  replyToggle: { alignItems: "center", flexDirection: "row", gap: spacing.xs, minHeight: 40, paddingTop: spacing.xs },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  replyingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  inputRow: { alignItems: "flex-end", flexDirection: "row", gap: spacing.sm },
  input: { borderRadius: 20, borderWidth: 1, flex: 1, maxHeight: 90, minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sendButton: { alignItems: "center", borderRadius: 22, height: 44, justifyContent: "center", width: 44 },
  disabledButton: { opacity: 0.4 },
  loginPrompt: { alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, minHeight: 58, justifyContent: "center" },
});
