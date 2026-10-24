const formatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function UserAccessTime({ value }: { value?: string | null }) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return <>기록 없음</>;
  const text = formatter.format(date);
  return (
    <time dateTime={date.toISOString()} title="한국시간 (UTC+9)" aria-label={`한국시간 ${text}`}>
      {text}
    </time>
  );
}
