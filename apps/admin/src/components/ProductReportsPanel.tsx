import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import type { ProductInformationReport } from "@/types";
import "./ProductReportsPanel.css";

const REASONS = { PRICE: "가격 다름", SOLD_OUT: "품절", ENDED: "공구 종료", LINK: "구매 링크 오류" };
const STATUSES = { OPEN: "접수", RESOLVED: "수정 완료", DISMISSED: "수정 불필요" };
const LIMIT = 25;

export function ProductReportsPanel() {
  const [items, setItems] = useState<ProductInformationReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("OPEN");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    void adminApi.listProductReports({ page, limit: LIMIT, status }).then(result => {
      if (cancelled) return;
      setItems(result.items); setTotal(result.total);
    }).catch(failure => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "신고 목록을 불러오지 못했습니다.");
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, status, revision]);

  async function review(item: ProductInformationReport, next: "RESOLVED" | "DISMISSED") {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(item.id); setError(null); setNotice(null);
    try {
      await adminApi.reviewProductReport(item.id, { status: next, reviewNote: notes[item.id] ?? "" });
      if (!mounted.current) return;
      setNotice("신고 처리 상태를 저장했습니다.");
      setRevision(value => value + 1);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : "처리 상태를 저장하지 못했습니다.");
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  return <section className="panel" aria-labelledby="product-reports-title">
    <div className="section-header"><div>
      <h2 id="product-reports-title">상품 정보 신고</h2>
      <p className="muted">공구 관리에서 정보를 확인·수정한 뒤 처리 결과를 기록하세요. 신고 처리만으로 상품 정보가 바뀌지는 않습니다.</p>
    </div><span>총 {total}건</span></div>
    <div className="toolbar">
      <label className="field field--stack"><span>처리 상태</span><select aria-label="처리 상태" value={status} disabled={Boolean(busy)} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="ALL">전체</option>{Object.entries(STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <button type="button" className="button button--secondary" disabled={loading || Boolean(busy)} onClick={() => setRevision(value => value + 1)}>새로고침</button>
    </div>
    {error ? <p role="alert" className="notice notice--error">{error}</p> : null}
    {notice ? <p role="status" className="notice notice--success">{notice}</p> : null}
    {loading ? <p role="status">신고 목록을 불러오는 중…</p> : null}
    {!loading && !error && items.length === 0 ? <p className="empty-state">조건에 맞는 신고가 없습니다.</p> : null}
    {!loading ? <div className="table-wrap product-reports-wrap"><table className="admin-table product-reports-table">
      <thead><tr><th>상품</th><th>사유 / 접수일</th><th>처리 상태</th><th>검수 메모 및 처리</th></tr></thead>
      <tbody>{items.map(item => <tr key={item.id}>
        <td data-label="상품"><strong>{item.productName ?? "상품 정보 없음"}</strong><p className="table-subtext">{item.groupBuyId}</p></td>
        <td data-label="사유 / 접수일">{REASONS[item.reason]}<p className="table-subtext">{new Date(item.createdAt).toLocaleString("ko-KR")}</p></td>
        <td data-label="처리 상태">{STATUSES[item.status]}{item.reviewedAt ? <p className="table-subtext">{new Date(item.reviewedAt).toLocaleString("ko-KR")}</p> : null}</td>
        <td data-label="검수 및 처리">{item.status === "OPEN" ? <>
          <label className="field field--stack"><span>검수 메모</span><textarea maxLength={500} value={notes[item.id] ?? ""} disabled={Boolean(busy)} onChange={event => setNotes(value => ({ ...value, [item.id]: event.target.value }))} /></label>
          <button type="button" className="button button--secondary" disabled={Boolean(busy)} onClick={() => { void review(item, "RESOLVED"); }}>{busy === item.id ? "처리 중…" : "수정 완료"}</button>
          <button type="button" className="button button--ghost" disabled={Boolean(busy)} onClick={() => { void review(item, "DISMISSED"); }}>수정 불필요</button>
        </> : item.reviewNote ?? "메모 없음"}</td>
      </tr>)}</tbody>
    </table></div> : null}
    <nav aria-label="신고 페이지 이동" className="pagination">
      <button type="button" className="button button--ghost" disabled={loading || Boolean(busy) || page <= 1} onClick={() => setPage(value => value - 1)}>이전</button>
      <span>{page} / {Math.max(1, Math.ceil(total / LIMIT))}</span>
      <button type="button" className="button button--ghost" disabled={loading || Boolean(busy) || page * LIMIT >= total} onClick={() => setPage(value => value + 1)}>다음</button>
    </nav>
  </section>;
}
