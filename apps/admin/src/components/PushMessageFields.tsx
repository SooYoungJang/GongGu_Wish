type PushMessageFieldsProps = {
  body: string;
  dataText: string;
  maxBodyLength: number;
  maxTitleLength: number;
  onBodyChange: (value: string) => void;
  onDataChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  title: string;
};

export function PushMessageFields({
  body,
  dataText,
  maxBodyLength,
  maxTitleLength,
  onBodyChange,
  onDataChange,
  onTitleChange,
  title,
}: PushMessageFieldsProps) {
  return (
    <>
      <div className="form-grid push-notification-panel__fields">
        <label className="field field--stack" htmlFor="push-title">
          <span>제목</span>
          <input
            aria-label="제목"
            id="push-title"
            maxLength={maxTitleLength}
            onChange={(event) => onTitleChange(event.target.value)}
            placeholder="새 공구가 시작됐어요"
            value={title}
          />
          <small className="field__counter">
            {title.length} / {maxTitleLength}
          </small>
        </label>
        <label className="field field--stack" htmlFor="push-body">
          <span>본문</span>
          <textarea
            aria-label="본문"
            id="push-body"
            maxLength={maxBodyLength}
            onChange={(event) => onBodyChange(event.target.value)}
            placeholder="지금 앱에서 확인해보세요."
            rows={4}
            value={body}
          />
          <small className="field__counter">
            {body.length} / {maxBodyLength}
          </small>
        </label>
      </div>

      <label
        className="field field--stack push-notification-panel__data"
        htmlFor="push-data"
      >
        <span>추가 데이터 (선택, JSON object)</span>
        <textarea
          id="push-data"
          onChange={(event) => onDataChange(event.target.value)}
          placeholder={'{"screen":"Home","groupBuyId":"..."}'}
          rows={4}
          value={dataText}
        />
      </label>
    </>
  );
}
