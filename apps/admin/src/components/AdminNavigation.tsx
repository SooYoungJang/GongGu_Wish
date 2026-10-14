import { useId, useRef, useState } from "react";

export type AdminTabKey =
  | "dashboard"
  | "submissions"
  | "autoCollection"
  | "groupBuys"
  | "groupBuyRequests"
  | "users"
  | "notifications"
  | "comments"
  | "productReports"
  | "appDiagnostics"
  | "cdnRefresh";

const navigation: {
  key: AdminTabKey;
  label: string;
  group: "상품" | "운영";
}[] = [
  { key: "dashboard", label: "대시보드", group: "상품" },
  { key: "groupBuys", label: "공구 관리", group: "상품" },
  { key: "autoCollection", label: "자동 수집 검수", group: "상품" },
  { key: "submissions", label: "위시 검수", group: "상품" },
  { key: "groupBuyRequests", label: "공구 요청", group: "상품" },
  { key: "users", label: "가입자 관리", group: "운영" },
  { key: "notifications", label: "푸시 발송", group: "운영" },
  { key: "productReports", label: "정보 신고", group: "운영" },
  { key: "comments", label: "댓글 관리", group: "운영" },
  { key: "appDiagnostics", label: "앱 진단", group: "운영" },
  { key: "cdnRefresh", label: "CDN 갱신", group: "운영" },
];

export function AdminNavigation({
  activeTab,
  onSelect,
}: {
  activeTab: AdminTabKey;
  onSelect: (tab: AdminTabKey) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const activeLabel = navigation.find((item) => item.key === activeTab)?.label;

  return (
    <div
      className="admin-navigation-container"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        aria-controls={id}
        aria-expanded={open}
        className="admin-navigation-toggle"
        onClick={() => setOpen((value) => !value)}
        ref={toggle}
        type="button"
      >
        <strong>{activeLabel}</strong>
        <span>
          {open ? "메뉴 닫기" : "전체 메뉴"}{" "}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </span>
      </button>
      <nav
        className={`nav-tabs admin-navigation${open ? " admin-navigation--open" : ""}`}
        aria-label="관리자 메뉴"
        id={id}
      >
        {navigation.map((item) => (
          <button
            aria-current={activeTab === item.key ? "page" : undefined}
            className={activeTab === item.key ? "active" : ""}
            data-nav-group={item.group}
            key={item.key}
            onClick={() => {
              onSelect(item.key);
              setOpen(false);
              if (toggle.current?.getClientRects().length)
                toggle.current.focus();
            }}
            type="button"
          >
            <strong>{item.label}</strong>
          </button>
        ))}
      </nav>
    </div>
  );
}
