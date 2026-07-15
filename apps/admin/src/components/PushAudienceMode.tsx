type AudienceMode = "all" | "selected";

type PushAudienceModeProps = {
  mode: AudienceMode;
  onChange: (mode: AudienceMode) => void;
};

export function PushAudienceMode({ mode, onChange }: PushAudienceModeProps) {
  return (
    <fieldset className="push-audience-mode">
      <legend>발송 대상</legend>
      <label className="push-audience-mode__option">
        <input
          checked={mode === "all"}
          name="push-audience-mode"
          onChange={() => onChange("all")}
          type="radio"
          value="all"
        />
        <span>
          <strong>전체 사용자</strong>
          <small>푸시 토큰이 등록된 사용자 전체에게 발송</small>
        </span>
      </label>
      <label className="push-audience-mode__option">
        <input
          checked={mode === "selected"}
          name="push-audience-mode"
          onChange={() => onChange("selected")}
          type="radio"
          value="selected"
        />
        <span>
          <strong>선택 사용자</strong>
          <small>검색 결과에서 원하는 사용자만 선택</small>
        </span>
      </label>
    </fieldset>
  );
}
