import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import type { GroupBuy, GroupBuyRequest } from "@/types";
import "./RequestFulfillmentDialog.css";

export function RequestFulfillmentDialog({ request, onClose, onComplete }: { request: GroupBuyRequest; onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState(request.productName);
  const [search, setSearch] = useState({ query: request.productName, revision: 0 });
  const [items, setItems] = useState<GroupBuy[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    dialog.current?.showModal();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSelected(""); setItems([]);
    void adminApi.listGroupBuys({ page: 1, limit: 20, status: "APPROVED", q: search.query }).then(result => {
      if (!cancelled) setItems(result.items);
    }).catch(() => { if (!cancelled) setError("공구를 찾지 못했습니다. 다시 검색해주세요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);
  async function fulfill() {
    if (!selected || busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try {
      await adminApi.fulfillGroupBuyRequest(request.id, selected);
      if (mounted.current) onComplete();
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "연결하지 못했습니다. 다시 시도해주세요.");
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  }
  return <dialog ref={dialog} className="request-fulfillment-dialog" aria-labelledby="fulfillment-title" onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}>
    <h2 id="fulfillment-title">요청에 등록된 공구 연결</h2>
    <p>{request.productName}</p>
    <p>연결하면 요청이 완료됩니다. 완료 알림을 선택한 사용자에게만 발송됩니다.</p>
    <form className="request-fulfillment-search" onSubmit={event => { event.preventDefault(); if (!saving) setSearch({ query: query.trim(), revision: search.revision + 1 }); }}>
      <label>승인된 상품 검색<input value={query} onChange={event => setQuery(event.target.value)} disabled={saving} /></label>
      <button className="button" type="submit" disabled={saving}>검색</button>
    </form>
    {error ? <p role="alert">{error}</p> : null}
    {loading ? <p role="status">검색 중...</p> : <fieldset disabled={saving}>
      <legend>연결할 공구 선택</legend>
      {items.map(item => <label className="request-fulfillment-option" key={item.id}>
        <input type="radio" name="fulfilled-product" checked={selected === item.id} onChange={() => setSelected(item.id)} />
        <span>{item.productName || "상품명 없음"}<small>{item.startDate?.slice(0, 10) || "시작일 미정"} · {item.id}</small></span>
      </label>)}
      {!items.length && !error ? <p>일치하는 승인 공구가 없습니다.</p> : null}
      {items.length === 20 ? <p>최대 20개를 표시합니다. 검색어를 구체적으로 입력해주세요.</p> : null}
    </fieldset>}
    <div className="action-row action-row--end">
      <button className="button button--ghost" disabled={saving} onClick={onClose} type="button">취소</button>
      <button className="button button--primary" disabled={loading || saving || !selected} onClick={() => void fulfill()} type="button">{saving ? "연결 중..." : "공구 연결하고 요청 완료"}</button>
    </div>
  </dialog>;
}
