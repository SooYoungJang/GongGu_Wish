import type { RefObject } from "react";
import type { PushNotificationInput } from "@/types";

type PushConfirmationDialogProps = {
  audienceLabel: string;
  confirmButtonRef: RefObject<HTMLButtonElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
  pendingInput: PushNotificationInput;
};

export function PushConfirmationDialog({
  audienceLabel,
  confirmButtonRef,
  onCancel,
  onConfirm,
  pendingInput,
}: PushConfirmationDialogProps) {
  return (
    <div className="push-confirmation-backdrop">
      <div
        aria-labelledby="push-confirmation-title"
        aria-modal="true"
        className="push-confirmation"
        role="dialog"
      >
        <p className="eyebrow">Final check</p>
        <h3 id="push-confirmation-title">푸시를 발송할까요?</h3>
        <p>
          <strong>{audienceLabel}</strong>에게 아래 메시지를 발송합니다.
        </p>
        <div className="push-confirmation__preview">
          <strong>{pendingInput.title}</strong>
          <span>{pendingInput.body}</span>
        </div>
        <div className="action-row action-row--end">
          <button
            className="button button--ghost"
            onClick={onCancel}
            type="button"
          >
            취소
          </button>
          <button
            ref={confirmButtonRef}
            className="button button--primary"
            onClick={onConfirm}
            type="button"
          >
            확인하고 발송
          </button>
        </div>
      </div>
    </div>
  );
}
