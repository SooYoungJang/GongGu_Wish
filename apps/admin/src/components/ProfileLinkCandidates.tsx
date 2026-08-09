import { useId } from "react";

import type { CollectionProfileLinkCandidate } from "../types";

export function ProfileLinkCandidates(props: {
  candidates: CollectionProfileLinkCandidate[];
  disabled: boolean;
  onSelect: (url: string) => void;
  purchaseUrl: string;
}) {
  const titleId = useId();
  if (props.candidates.length === 0) return null;

  return (
    <section aria-labelledby={titleId} className="profile-link-candidates">
      <div className="profile-link-candidates__header">
        <strong id={titleId}>Playwright 프로필 링크 후보</strong>
        <small>
          {props.candidates.length === 1
            ? "단일 후보는 구매 URL에 자동 반영됩니다."
            : "여러 후보 중 실제 공구 구매 링크를 선택하세요."}
        </small>
      </div>
      <ul>
        {props.candidates.map((candidate) => {
          const selected = props.purchaseUrl === candidate.url;
          return (
            <li key={candidate.url}>
              <a
                aria-label={`${candidate.label ?? "프로필 링크"} 새 창에서 열기`}
                href={candidate.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                <span>{candidate.label ?? "프로필 외부 링크"}</span>
                <small>{new URL(candidate.url).hostname}</small>
              </a>
              <button
                className="button button--ghost"
                disabled={props.disabled || selected}
                onClick={() => props.onSelect(candidate.url)}
                type="button"
              >
                {selected ? "사용 중" : "구매 URL로 사용"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
