import { useState, type FormEvent } from "react";
import type { PushNotificationInput, PushNotificationResult } from "@/types";

type PushNotificationPanelProps = {
  onSend: (input: PushNotificationInput) => Promise<PushNotificationResult>;
};

export function PushNotificationPanel({ onSend }: PushNotificationPanelProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dataText, setDataText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PushNotificationResult | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("제목과 본문을 모두 입력해주세요.");
      return;
    }

    let data: Record<string, unknown> | undefined;
    if (dataText.trim()) {
      try {
        const parsed = JSON.parse(dataText) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("object");
        }
        data = parsed as Record<string, unknown>;
      } catch {
        setError("추가 데이터는 JSON 객체 형식이어야 합니다.");
        return;
      }
    }

    if (!window.confirm("푸시 토큰이 등록된 전체 사용자에게 발송할까요?"))
      return;

    setIsSending(true);
    try {
      const response = await onSend({
        title: trimmedTitle,
        body: trimmedBody,
        ...(data ? { data } : {}),
      });
      setResult(response);
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

  return (
    <section
      className="panel push-notification-panel"
      aria-labelledby="push-notification-title"
    >
      <div className="section-header">
        <div>
          <h2 id="push-notification-title">푸시 발송</h2>
          <p>Expo Push Token이 등록된 사용자에게 공지 알림을 보냅니다.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="field field--stack" htmlFor="push-title">
            <span>제목</span>
            <input
              id="push-title"
              maxLength={100}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="새 공구가 시작됐어요"
              value={title}
            />
          </label>
          <label className="field field--stack" htmlFor="push-body">
            <span>본문</span>
            <input
              id="push-body"
              maxLength={1000}
              onChange={(event) => setBody(event.target.value)}
              placeholder="지금 앱에서 확인해보세요."
              value={body}
            />
          </label>
        </div>

        <label
          className="field field--stack push-notification-panel__data"
          htmlFor="push-data"
        >
          <span>추가 데이터 (선택, JSON object)</span>
          <textarea
            id="push-data"
            onChange={(event) => setDataText(event.target.value)}
            placeholder={'{"screen":"Home","groupBuyId":"..."}'}
            rows={4}
            value={dataText}
          />
        </label>

        <p className="push-notification-panel__hint">
          현재는 전체 발송만 지원합니다. 대상 선택 발송은 API의{" "}
          <code>userIds</code>로 확장할 수 있습니다.
        </p>

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
            {isSending ? "발송 중..." : "전체 사용자에게 발송"}
          </button>
        </div>
      </form>
    </section>
  );
}
