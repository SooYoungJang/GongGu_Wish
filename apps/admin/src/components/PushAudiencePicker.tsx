import type { AppUser } from "@/types";

type PushAudiencePickerProps = {
  items: AppUser[];
  loading: boolean;
  onPageChange: (page: number) => void;
  onQueryChange: (query: string) => void;
  onToggleUser: (user: AppUser, checked: boolean) => void;
  onToggleVisible: (checked: boolean) => void;
  page: number;
  query: string;
  selectedUserIds: Set<string>;
  total: number;
  totalPages: number;
};

function userLabel(user: AppUser) {
  return user.nickname?.trim() || user.email?.trim() || user.id;
}

export function PushAudiencePicker({
  items,
  loading,
  onPageChange,
  onQueryChange,
  onToggleUser,
  onToggleVisible,
  page,
  query,
  selectedUserIds,
  total,
  totalPages,
}: PushAudiencePickerProps) {
  const selectableItems = items.filter((item) => item.hasPushToken);
  const allVisibleSelected =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedUserIds.has(item.id));

  return (
    <div className="push-audience-picker">
      <div className="push-audience-picker__toolbar">
        <label className="field field--stack" htmlFor="push-user-search">
          <span>사용자 검색</span>
          <input
            id="push-user-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이메일 또는 닉네임"
            type="search"
            value={query}
          />
        </label>
        <div className="push-audience-picker__actions">
          <span className="push-audience-picker__count" aria-live="polite">
            검색 결과 {total.toLocaleString()}명 · 선택{" "}
            {selectedUserIds.size.toLocaleString()}명
          </span>
          <button
            className="button button--ghost"
            disabled={loading || selectableItems.length === 0}
            onClick={() => onToggleVisible(!allVisibleSelected)}
            type="button"
          >
            {allVisibleSelected ? "현재 결과 선택 해제" : "현재 결과 전체 선택"}
          </button>
        </div>
      </div>

      <div
        aria-busy={loading}
        aria-label="푸시 대상 사용자 목록"
        className="push-user-list"
        role="list"
      >
        {loading ? (
          <div className="push-user-list__empty" role="status">
            사용자 목록을 불러오는 중...
          </div>
        ) : items.length === 0 ? (
          <div className="push-user-list__empty" role="status">
            검색 결과가 없습니다.
          </div>
        ) : (
          items.map((user) => {
            const label = userLabel(user);
            const checked = selectedUserIds.has(user.id);
            return (
              <label
                className={`push-user-option${checked ? " selected" : ""}${!user.hasPushToken ? " disabled" : ""}`}
                key={user.id}
              >
                <input
                  aria-label={`${label} 선택`}
                  checked={checked}
                  disabled={!user.hasPushToken}
                  onChange={(event) => onToggleUser(user, event.target.checked)}
                  type="checkbox"
                />
                <span className="push-user-option__identity">
                  <strong>{label}</strong>
                  <span>{user.email ?? user.id}</span>
                </span>
                <span
                  className={`push-user-option__status${user.hasPushToken ? " ready" : ""}`}
                >
                  {user.hasPushToken ? "푸시 가능" : "토큰 없음"}
                </span>
              </label>
            );
          })
        )}
      </div>

      {totalPages > 1 ? (
        <nav aria-label="푸시 대상 페이지 이동" className="pagination">
          <button
            aria-label="푸시 대상 이전 페이지"
            className="button button--ghost"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            이전
          </button>
          <span className="pagination__status" aria-live="polite">
            {page} / {totalPages}
          </span>
          <button
            aria-label="푸시 대상 다음 페이지"
            className="button button--ghost"
            disabled={loading || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            다음
          </button>
        </nav>
      ) : null}

      <p className="push-audience-picker__hint">
        푸시 토큰이 등록된 사용자만 선택할 수 있습니다. 검색이나 페이지를 바꿔도
        이미 선택한 대상은 유지됩니다.
      </p>
    </div>
  );
}
