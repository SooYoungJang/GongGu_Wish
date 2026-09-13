import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import "./AppDiagnosticsPanel.css";

const labels: Record<string, string> = { js_error: "화면 오류", query_error: "조회 오류", search_results: "검색 결과", detail_open: "상세 화면 진입", bookmark_set: "북마크 저장", reminder_set: "알림 설정", purchase_link_open: "구매 링크 열기" };
const values: Record<string, string> = { zero: "결과 없음", some: "결과 1~20개", many: "결과 21개 이상", on: "켜짐", off: "꺼짐", success: "성공", failed: "실패" };
type Row = Awaited<ReturnType<typeof adminApi.getAppDiagnostics>>["items"][number];
export function AppDiagnosticsPanel() {
  const [days, setDays] = useState(7), [revision, setRevision] = useState(0);
  const [items, setItems] = useState<Row[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false);
    void adminApi.getAppDiagnostics(days).then(result => { if (!cancelled) setItems(result.items); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, revision]);
  return <section className="panel app-diagnostics" aria-labelledby="diagnostics-title">
    <h2 id="diagnostics-title">앱 진단</h2>
    <p className="muted">최근 14일 이내 앱 오류와 사용 동작을 집계합니다. 검색어·오류 원문·계정 정보는 수집하지 않습니다.</p>
    <div className="toolbar">
      <label className="field field--stack"><span>조회 기간</span><select value={days} onChange={event => setDays(Number(event.target.value))}>
        <option value={1}>최근 24시간</option><option value={7}>최근 7일</option><option value={14}>최근 14일</option>
      </select></label>
      <button className="button button--ghost" type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>새로고침</button>
    </div>
    <p className="muted">빈도가 높은 조합 최대 200개입니다. 세션은 앱 실행 단위이며 사용자 수가 아닙니다. 검색은 첫 페이지 요청 기준이고, 구매 링크 열기는 실제 구매 완료를 뜻하지 않습니다. 네이티브 크래시는 포함하지 않습니다.</p>
    {loading ? <p role="status">진단을 불러오는 중…</p> : error ? <div role="alert">진단을 불러오지 못했습니다. <button className="button button--ghost" type="button" onClick={() => setRevision(n => n + 1)}>다시 시도</button></div> : !items.length ? <p>이 기간에 수집된 진단이 없습니다.</p> :
      <ul className="diagnostic-list">{items.map((row, index) => <li key={index} className="diagnostic-card">
        <div><strong>{labels[row.eventName] ?? row.eventName}</strong><span>{row.count}건 · {row.sessions}세션</span></div>
        <dl><dt>화면</dt><dd>{row.screen}</dd><dt>앱 버전</dt><dd>{row.appVersion} · {row.platform}</dd><dt>배포</dt><dd>{row.releaseId}</dd>
          <dt>결과</dt><dd>{row.errorKind ?? (row.value ? values[row.value] ?? row.value : "—")}{row.httpStatus !== null ? ` · HTTP ${row.httpStatus}` : ""}</dd></dl>
      </li>)}</ul>}
  </section>;
}
