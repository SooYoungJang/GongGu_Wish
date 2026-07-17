import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  AppUser,
  ListResponse,
  PushNotificationInput,
  PushNotificationResult,
} from "@/types";
import { PushAudiencePicker } from "./PushAudiencePicker";
import { PushAudienceMode } from "./PushAudienceMode";
import { PushConfirmationDialog } from "./PushConfirmationDialog";
import { PushMessageFields } from "./PushMessageFields";

type PushNotificationPanelProps = {
  onSearchUsers: (params: {
    page?: number;
    limit?: number;
    q?: string;
  }) => Promise<ListResponse<AppUser>>;
  onSend: (input: PushNotificationInput) => Promise<PushNotificationResult>;
};

type AudienceMode = "all" | "selected";

const USER_PAGE_SIZE = 25;
const USER_SEARCH_DEBOUNCE_MS = 250;
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 1000;

function parseData(value: string): {
  data?: Record<string, unknown>;
  error?: string;
} {
  if (!value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("object");
    }
    return { data: parsed as Record<string, unknown> };
  } catch {
    return { error: "추가 데이터는 JSON 객체 형식이어야 합니다." };
  }
}

export function PushNotificationPanel({
  onSearchUsers,
  onSend,
}: PushNotificationPanelProps) {
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dataText, setDataText] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PushNotificationResult | null>(null);
  const [pendingInput, setPendingInput] =
    useState<PushNotificationInput | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const userRequestIdRef = useRef(0);
  const confirmationButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (audienceMode !== "selected") return;

    const requestId = ++userRequestIdRef.current;
    const timeoutId = window.setTimeout(() => {
      setUsersLoading(true);
      setAudienceError(null);
      void onSearchUsers({
        page: userPage,
        limit: USER_PAGE_SIZE,
        q: userQuery.trim(),
      })
        .then((response) => {
          if (requestId !== userRequestIdRef.current) return;
          setUsers(response.items);
          setUsersTotal(response.total);
        })
        .catch((searchError) => {
          if (requestId !== userRequestIdRef.current) return;
          setAudienceError(
            searchError instanceof Error
              ? searchError.message
              : "사용자 목록을 불러오지 못했습니다.",
          );
        })
        .finally(() => {
          if (requestId === userRequestIdRef.current) setUsersLoading(false);
        });
    }, USER_SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [audienceMode, onSearchUsers, userPage, userQuery]);

  useEffect(() => {
    if (confirmationOpen) confirmationButtonRef.current?.focus();
  }, [confirmationOpen]);

  function changeAudienceMode(nextMode: AudienceMode) {
    setAudienceMode(nextMode);
    setError(null);
    setAudienceError(null);
    if (nextMode === "all") {
      setSelectedUserIds(new Set());
      setUserQuery("");
      setUserPage(1);
    }
  }

  function toggleUser(user: AppUser, checked: boolean) {
    if (!user.hasPushToken) return;
    setSelectedUserIds((current) => {
      const next = new Set(current);
      if (checked) next.add(user.id);
      else next.delete(user.id);
      return next;
    });
  }

  function toggleVisibleUsers(checked: boolean) {
    setSelectedUserIds((current) => {
      const next = new Set(current);
      for (const user of users) {
        if (!user.hasPushToken) continue;
        if (checked) next.add(user.id);
        else next.delete(user.id);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("제목과 본문을 모두 입력해주세요.");
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setError(`제목은 ${MAX_TITLE_LENGTH}자 이하로 입력해주세요.`);
      return;
    }
    if (trimmedBody.length > MAX_BODY_LENGTH) {
      setError(`본문은 ${MAX_BODY_LENGTH}자 이하로 입력해주세요.`);
      return;
    }
    if (audienceMode === "selected" && selectedUserIds.size === 0) {
      setError("최소 한 명의 푸시 가능 사용자를 선택해주세요.");
      return;
    }

    const parsedData = parseData(dataText);
    if (parsedData.error) {
      setError(parsedData.error);
      return;
    }

    const input: PushNotificationInput = {
      title: trimmedTitle,
      body: trimmedBody,
      ...(parsedData.data ? { data: parsedData.data } : {}),
      ...(audienceMode === "selected" ? { userIds: [...selectedUserIds] } : {}),
    };
    setPendingInput(input);
    setConfirmationOpen(true);
  }

  async function sendPendingNotification() {
    if (!pendingInput) return;
    setIsSending(true);
    setError(null);
    setConfirmationOpen(false);
    try {
      const response = await onSend(pendingInput);
      setResult(response);
      setPendingInput(null);
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "푸시 발송에 실패했습니다.",
      );
    } finally {
      setIsSending(false);
    }
  }

  const userTotalPages = Math.max(1, Math.ceil(usersTotal / USER_PAGE_SIZE));
  const audienceLabel =
    audienceMode === "all"
      ? "푸시 토큰 등록 전체 사용자"
      : `선택한 사용자 ${selectedUserIds.size.toLocaleString()}명`;
  const submitLabel =
    audienceMode === "all" ? "전체 사용자에게 발송" : "선택 사용자에게 발송";

  return (
    <section
      className="panel push-notification-panel"
      aria-labelledby="push-notification-title"
    >
      <div className="section-header">
        <div>
          <p className="eyebrow">Messaging</p>
          <h2 id="push-notification-title">푸시 발송</h2>
          <p>
            대상을 확인한 뒤 Expo Push Token이 등록된 사용자에게 알림을
            보냅니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <PushAudienceMode mode={audienceMode} onChange={changeAudienceMode} />

        {audienceMode === "selected" ? (
          <PushAudiencePicker
            items={users}
            loading={usersLoading}
            onPageChange={setUserPage}
            onQueryChange={(query) => {
              setUserQuery(query);
              setUserPage(1);
            }}
            onToggleUser={toggleUser}
            onToggleVisible={toggleVisibleUsers}
            page={userPage}
            query={userQuery}
            selectedUserIds={selectedUserIds}
            total={usersTotal}
            totalPages={userTotalPages}
          />
        ) : null}

        <PushMessageFields
          body={body}
          dataText={dataText}
          maxBodyLength={MAX_BODY_LENGTH}
          maxTitleLength={MAX_TITLE_LENGTH}
          onBodyChange={setBody}
          onDataChange={setDataText}
          onTitleChange={setTitle}
          title={title}
        />

        <div className="push-notification-panel__summary" aria-live="polite">
          <span>현재 대상</span>
          <strong>{audienceLabel}</strong>
        </div>

        <p className="push-notification-panel__hint">
          발송 후 앱에서 알림 권한이 허용된 기기만 실제로 수신합니다. 전체
          발송도 확인 단계를 거칩니다.
        </p>

        {audienceError ? (
          <p className="notice notice--error" role="alert">
            {audienceError}
          </p>
        ) : null}
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}
        {result ? (
          <div
            className="push-notification-panel__result"
            role="status"
            aria-live="polite"
          >
            발송 완료 · 대상 {result.targeted.toLocaleString()}명 · 성공{" "}
            {result.sent.toLocaleString()}건 · 실패{" "}
            {result.failed.toLocaleString()}건
            {(result.preferenceFiltered ?? 0) > 0
              ? ` · 사용자 설정 제외 ${result.preferenceFiltered?.toLocaleString()}명`
              : ""}
            {result.invalidTokensRemoved > 0
              ? ` · 만료 토큰 정리 ${result.invalidTokensRemoved.toLocaleString()}개`
              : ""}
          </div>
        ) : null}

        <div className="action-row push-notification-panel__actions">
          <button
            className="button button--primary"
            disabled={isSending}
            type="submit"
          >
            {isSending ? "발송 중..." : submitLabel}
          </button>
        </div>
      </form>

      {confirmationOpen && pendingInput ? (
        <PushConfirmationDialog
          audienceLabel={audienceLabel}
          confirmButtonRef={confirmationButtonRef}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={() => void sendPendingNotification()}
          pendingInput={pendingInput}
        />
      ) : null}
    </section>
  );
}
