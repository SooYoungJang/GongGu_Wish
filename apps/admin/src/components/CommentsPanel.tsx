import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import type { CommentModerationItem } from "@/types";

const PAGE_SIZE = 25;
const STATE_OPTIONS = [
  { value: "ALL", label: "전체 상태" },
  { value: "VISIBLE", label: "노출" },
  { value: "HIDDEN", label: "숨김" },
  { value: "DELETED", label: "삭제" },
  { value: "ACCOUNT_ANONYMIZED", label: "탈퇴 정리" },
] as const;

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function stateLabel(state: CommentModerationItem["state"]) {
  return {
    VISIBLE: "노출",
    HIDDEN: "숨김",
    DELETED: "삭제",
    ACCOUNT_ANONYMIZED: "탈퇴 정리",
  }[state];
}

export function CommentsPanel() {
  const [items, setItems] = useState<CommentModerationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [state, setState] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void adminApi
        .listComments({
          page,
          limit: PAGE_SIZE,
          state,
          q: query.trim() || undefined,
        })
        .then((response) => {
          if (cancelled) return;
          setItems(response.items);
          setTotal(response.total);
        })
        .catch((requestError) => {
          if (cancelled) return;
          setError(
            requestError instanceof Error
              ? requestError.message
              : "댓글을 불러오지 못했습니다.",
          );
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, query, state]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function moderate(item: CommentModerationItem) {
    const nextState = item.state === "VISIBLE" ? "HIDDEN" : "VISIBLE";
    if (item.state !== "VISIBLE" && item.state !== "HIDDEN") return;
    const action = nextState === "HIDDEN" ? "숨김" : "복원";
    if (!window.confirm(`이 댓글을 ${action} 처리할까요?`)) return;
    const reason = window.prompt(
      "운영 메모(선택, 최대 500자)",
      nextState === "HIDDEN" ? "커뮤니티 운영 정책 위반" : "검토 후 복원",
    );
    if (reason === null) return;
    setActionId(item.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await adminApi.updateCommentModeration(item.id, {
        state: nextState,
        reason,
        expectedVersion: item.contentVersion,
      });
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? updated : candidate,
        ),
      );
      setNotice(`댓글을 ${action} 처리했습니다.`);
    } catch (moderationError) {
      setError(
        moderationError instanceof Error
          ? moderationError.message
          : "댓글 상태 변경에 실패했습니다.",
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="panel" aria-labelledby="comments-panel-title">
      <div className="section-header">
        <div>
          <p className="eyebrow">Community safety</p>
          <h2 id="comments-panel-title">상품 댓글 모더레이션</h2>
          <p className="muted">
            신고가 누적된 댓글을 숨기거나 검토 후 복원합니다. 삭제·탈퇴 정리 댓글은
            원문을 복원할 수 없습니다.
          </p>
        </div>
        <span className="muted">총 {total.toLocaleString("ko-KR")}건</span>
      </div>

      <div className="toolbar" role="search">
        <label className="field field--stack">
          <span>검색</span>
          <input
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="댓글 또는 작성자"
            value={query}
          />
        </label>
        <label className="field field--stack">
          <span>상태</span>
          <select
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
            value={state}
          >
            {STATE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? <p className="notice notice--success">{notice}</p> : null}
      {error ? <p className="notice notice--error">{error}</p> : null}
      {loading ? <div className="loading-rows" aria-label="조회 중" /> : null}
      {!loading && items.length === 0 ? (
        <div className="empty-state">조건에 맞는 댓글이 없습니다.</div>
      ) : null}
      {!loading && items.length > 0 ? (
        <div className="table-wrap desktop-table">
          <table className="admin-table">
            <thead>
              <tr>
                <th>상품 / 댓글</th>
                <th>작성자</th>
                <th>상태</th>
                <th>신고·좋아요</th>
                <th>작성일</th>
                <th aria-label="관리" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.productName ?? "상품 정보 없음"}</strong>
                    <p className="table-subtext">
                      {item.parentId ? "↳ 답글 · " : ""}
                      {item.body ?? "삭제된 댓글입니다."}
                    </p>
                  </td>
                  <td>{item.authorDisplayName ?? "탈퇴한 사용자"}</td>
                  <td>
                    <span
                      className={`status-badge status-badge--${item.state.toLowerCase()}`}
                    >
                      {stateLabel(item.state)}
                    </span>
                  </td>
                  <td>
                    {item.reportCount}건 · {item.likeCount}개
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    {item.state === "VISIBLE" || item.state === "HIDDEN" ? (
                      <button
                        className="button button--secondary"
                        disabled={actionId === item.id}
                        onClick={() => void moderate(item)}
                        type="button"
                      >
                        {actionId === item.id
                          ? "처리 중..."
                          : item.state === "VISIBLE"
                            ? "숨김"
                            : "복원"}
                      </button>
                    ) : (
                      <span className="muted">보호됨</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {totalPages > 1 ? (
        <nav aria-label="댓글 페이지 이동" className="pagination">
          <button
            className="button button--ghost"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            이전
          </button>
          <span className="pagination__status">
            {page} / {totalPages}
          </span>
          <button
            className="button button--ghost"
            disabled={page >= totalPages}
            onClick={() =>
              setPage((current) => Math.min(totalPages, current + 1))
            }
            type="button"
          >
            다음
          </button>
        </nav>
      ) : null}
    </section>
  );
}
