import { useCallback, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { adminApi } from "@/lib/adminApi";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/supabase/client";
import type {
  DashboardResponse,
  GongguSubmission,
  GroupBuy,
  GroupBuyStatus,
  HikerLookupResult,
  MediaAsset,
  AppUser,
  SubmissionStatus,
} from "@/types";
import "./App.css";

type Notice = { tone: "success" | "error" | "info"; message: string } | null;

type TabKey = "dashboard" | "submissions" | "groupBuys" | "users";

type SubmissionForm = {
  productName: string;
  brandName: string;
  category: string;
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  instagramUrl: string;
  summary: string;
  adminMemo: string;
  thumbnailUrl: string;
  videoUrl: string;
  mediaUrlsText: string;
  mediaItemsText: string;
  mediaType: "" | "IMAGE" | "VIDEO";
  isAllDay: boolean;
  isMonthlyFeatured: boolean;
  monthlyFeaturedRank: string;
};

type GroupBuyForm = {
  productName: string;
  brandName: string;
  category: string;
  startDate: string;
  endDate: string;
  purchaseUrl: string;
  discountInfo: string;
  summary: string;
  thumbnailUrl: string;
  videoUrl: string;
  mediaUrlsText: string;
  mediaItemsText: string;
  mediaType: "" | "IMAGE" | "VIDEO";
  status: GroupBuyStatus;
  isAllDay: boolean;
  isMonthlyFeatured: boolean;
  monthlyFeaturedRank: string;
};

type UserForm = {
  nickname: string;
  fcmToken: string;
  status: string;
};

const PAGE_SIZE = 25;
const CATEGORY_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "food", label: "식품" },
  { value: "living", label: "생활용품" },
  { value: "beauty", label: "뷰티" },
  { value: "fashion", label: "패션" },
  { value: "home", label: "홈인테리어" },
  { value: "kitchen", label: "주방용품" },
  { value: "electronics", label: "전자제품" },
  { value: "pet", label: "반려동물" },
  { value: "auto", label: "자동차용품" },
  { value: "hobby", label: "취미" },
  { value: "baby", label: "출산-육아" },
  { value: "sports", label: "스포츠" },
  { value: "stationery", label: "문구" },
  { value: "books", label: "도서" },
  { value: "media", label: "음반-DVD" },
  { value: "travel", label: "여행" },
];

const SUBMISSION_STATUS_OPTIONS: Array<{ value: "ALL" | SubmissionStatus; label: string }> = [
  { value: "PENDING", label: "검수 대기" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "반려" },
  { value: "DUPLICATE", label: "중복" },
  { value: "CANCELLED", label: "취소" },
  { value: "ALL", label: "전체" },
];

const GROUP_BUY_STATUS_OPTIONS: Array<{ value: "ALL" | GroupBuyStatus; label: string }> = [
  { value: "APPROVED", label: "노출중" },
  { value: "REVIEW_REQUIRED", label: "검수 필요" },
  { value: "REJECTED", label: "반려" },
  { value: "EXPIRED", label: "마감" },
  { value: "ALL", label: "전체" },
];

function isAdminUser(user: User | null | undefined) {
  const role = user?.app_metadata?.role;
  const roles = user?.app_metadata?.roles;
  return role === "admin" || (Array.isArray(roles) && roles.includes("admin"));
}

function translateAuthError(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다.";
  }
  if (normalized.includes("too many requests") || normalized.includes("rate limit")) {
    return "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.";
  }
  if (normalized.includes("network")) {
    return "네트워크 연결을 확인해주세요.";
  }
  return "로그인에 실패했습니다. 입력 정보를 확인해주세요.";
}

function text(value: string | number | boolean | null | undefined) {
  return value == null ? "" : String(value);
}

function dateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function parseMediaItems(value: string): MediaAsset[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("미디어 JSON은 배열이어야 합니다.");
  }

  const mediaItems: MediaAsset[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const url = typeof record.url === "string" ? record.url.trim() : "";
    const mediaType = record.mediaType === "VIDEO" ? "VIDEO" : record.mediaType === "IMAGE" ? "IMAGE" : null;
    const thumbnailUrl = typeof record.thumbnailUrl === "string" && record.thumbnailUrl.trim()
      ? record.thumbnailUrl.trim()
      : null;
    if (!url || !mediaType) continue;
    mediaItems.push({ url, mediaType, thumbnailUrl });
  }
  return mediaItems;
}

function stringifyMediaItems(items: MediaAsset[] | null | undefined) {
  return JSON.stringify(items ?? [], null, 2);
}

function deriveImageUrls(mediaItems: MediaAsset[], fallbackThumbnail: string, mediaUrls: string[]) {
  const images = mediaItems
    .map((item) => (item.mediaType === "IMAGE" ? item.url : item.thumbnailUrl ?? ""))
    .filter(Boolean);
  if (fallbackThumbnail) images.unshift(fallbackThumbnail);
  if (images.length === 0) images.push(...mediaUrls.slice(0, 5));
  return Array.from(new Set(images)).slice(0, 5);
}

function firstMediaThumbnail(mediaItems: MediaAsset[], imageUrls: string[]) {
  return mediaItems.find((item) => item.thumbnailUrl)?.thumbnailUrl
    ?? mediaItems.find((item) => item.mediaType === "IMAGE")?.url
    ?? imageUrls[0]
    ?? "";
}

function firstVideoUrl(mediaItems: MediaAsset[]) {
  return mediaItems.find((item) => item.mediaType === "VIDEO")?.url ?? "";
}

function guessProductName(result: HikerLookupResult, currentValue: string) {
  const current = currentValue.trim();
  const shouldReplace = !current || current === "검수 대기 위시템";
  if (!shouldReplace) return currentValue;

  const line = result.caption
    ?.split(/\r?\n/)
    .map((item) => item.replace(/#[^\s#]+/g, "").trim())
    .find((item) => item.length >= 2);
  return line ? line.slice(0, 60) : currentValue;
}

function submissionToForm(item: GongguSubmission): SubmissionForm {
  const mediaItems = item.mediaItems ?? [];
  const mediaUrls = mediaItems.map((media) => media.url);
  const thumbnailUrl = firstMediaThumbnail(mediaItems, item.imageUrls ?? []);
  const videoUrl = firstVideoUrl(mediaItems);
  const mediaType = mediaItems.some((media) => media.mediaType === "VIDEO")
    ? "VIDEO"
    : mediaItems.length > 0 || item.imageUrls.length > 0
      ? "IMAGE"
      : "";

  return {
    productName: text(item.productName),
    brandName: text(item.brandName),
    category: text(item.category),
    startDate: dateInput(item.startDate),
    endDate: dateInput(item.endDate),
    purchaseUrl: text(item.purchaseUrl),
    discountInfo: text(item.discountInfo),
    instagramUrl: text(item.instagramUrl),
    summary: text(item.summary),
    adminMemo: text(item.adminMemo),
    thumbnailUrl,
    videoUrl,
    mediaUrlsText: mediaUrls.length > 0 ? mediaUrls.join("\n") : (item.imageUrls ?? []).join("\n"),
    mediaItemsText: stringifyMediaItems(mediaItems),
    mediaType,
    isAllDay: false,
    isMonthlyFeatured: false,
    monthlyFeaturedRank: "",
  };
}

function groupBuyToForm(item: GroupBuy): GroupBuyForm {
  return {
    productName: text(item.productName),
    brandName: text(item.brandName),
    category: text(item.category),
    startDate: dateInput(item.startDate),
    endDate: dateInput(item.endDate),
    purchaseUrl: text(item.purchaseUrl),
    discountInfo: text(item.discountInfo),
    summary: text(item.summary),
    thumbnailUrl: text(item.thumbnailUrl),
    videoUrl: text(item.videoUrl),
    mediaUrlsText: (item.mediaUrls ?? []).join("\n"),
    mediaItemsText: stringifyMediaItems(item.mediaItems),
    mediaType: item.mediaType ?? "",
    status: item.status,
    isAllDay: Boolean(item.isAllDay),
    isMonthlyFeatured: Boolean(item.isMonthlyFeatured),
    monthlyFeaturedRank: item.monthlyFeaturedRank == null ? "" : String(item.monthlyFeaturedRank),
  };
}

function submissionPayload(form: SubmissionForm) {
  const mediaItems = parseMediaItems(form.mediaItemsText);
  const mediaUrls = splitLines(form.mediaUrlsText);
  return {
    productName: form.productName,
    brandName: form.brandName,
    category: form.category,
    startDate: form.startDate,
    endDate: form.endDate,
    purchaseUrl: form.purchaseUrl,
    discountInfo: form.discountInfo,
    instagramUrl: form.instagramUrl,
    summary: form.summary,
    adminMemo: form.adminMemo,
    imageUrls: deriveImageUrls(mediaItems, form.thumbnailUrl.trim(), mediaUrls),
    thumbnailUrl: form.thumbnailUrl,
    videoUrl: form.videoUrl,
    mediaUrls,
    mediaItems,
    mediaType: form.mediaType || null,
    isAllDay: form.isAllDay,
    isMonthlyFeatured: form.isMonthlyFeatured,
    monthlyFeaturedRank: form.monthlyFeaturedRank ? Number(form.monthlyFeaturedRank) : null,
  };
}

function groupBuyPayload(form: GroupBuyForm) {
  return {
    productName: form.productName,
    brandName: form.brandName,
    category: form.category,
    startDate: form.startDate,
    endDate: form.endDate,
    purchaseUrl: form.purchaseUrl,
    discountInfo: form.discountInfo,
    summary: form.summary,
    thumbnailUrl: form.thumbnailUrl,
    videoUrl: form.videoUrl,
    mediaUrls: splitLines(form.mediaUrlsText),
    mediaItems: parseMediaItems(form.mediaItemsText),
    mediaType: form.mediaType || null,
    status: form.status,
    isAllDay: form.isAllDay,
    isMonthlyFeatured: form.isMonthlyFeatured,
    monthlyFeaturedRank: form.monthlyFeaturedRank ? Number(form.monthlyFeaturedRank) : null,
  };
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return <div className="boot-screen">관리자 세션 확인 중</div>;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!isAdminUser(session.user)) {
    return <UnauthorizedScreen email={session.user.email ?? session.user.id} />;
  }

  return <AdminShell session={session} />;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError(translateAuthError(signInError.message));
    }
    setLoading(false);
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <p className="eyebrow">GongGu Admin</p>
          <h1>관리자 로그인</h1>
        </div>
        <label className="field field--stack">
          <span>이메일</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" />
        </label>
        <label className="field field--stack">
          <span>비밀번호</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="notice notice--error">{error}</div> : null}
        <button className="button button--primary" disabled={loading} type="submit">
          {loading ? "로그인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}

function UnauthorizedScreen({ email }: { email: string }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">접근 차단</p>
        <h1>관리자 권한이 없습니다</h1>
        <p className="muted">{email}</p>
        <button className="button button--secondary" onClick={() => void supabase.auth.signOut()} type="button">
          로그아웃
        </button>
      </section>
    </main>
  );
}

function AdminShell({ session }: { session: Session }) {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [notice, setNotice] = useState<Notice>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const [submissionStatus, setSubmissionStatus] = useState<"ALL" | SubmissionStatus>("PENDING");
  const [submissionQuery, setSubmissionQuery] = useState("");
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissions, setSubmissions] = useState<GongguSubmission[]>([]);
  const [submissionsTotal, setSubmissionsTotal] = useState(0);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<GongguSubmission | null>(null);
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<string>>(new Set());
  const [submissionForm, setSubmissionForm] = useState<SubmissionForm | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [bulkRejectReason, setBulkRejectReason] = useState("");
  const [submissionActionLoading, setSubmissionActionLoading] = useState(false);

  const [groupBuyStatus, setGroupBuyStatus] = useState<"ALL" | GroupBuyStatus>("APPROVED");
  const [groupBuyQuery, setGroupBuyQuery] = useState("");
  const [groupBuyPage, setGroupBuyPage] = useState(1);
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([]);
  const [groupBuysTotal, setGroupBuysTotal] = useState(0);
  const [groupBuysLoading, setGroupBuysLoading] = useState(false);
  const [selectedGroupBuy, setSelectedGroupBuy] = useState<GroupBuy | null>(null);
  const [groupBuyForm, setGroupBuyForm] = useState<GroupBuyForm | null>(null);
  const [groupBuyActionLoading, setGroupBuyActionLoading] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState<UserForm | null>(null);
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [detailType, setDetailType] = useState<"submission" | "groupBuy" | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const switchTab = useCallback((next: TabKey) => {
    setDetailType(null);
    setSelectedSubmission(null);
    setSubmissionForm(null);
    setSelectedGroupBuy(null);
    setGroupBuyForm(null);
    setExpandedUserId(null);
    setSelectedUser(null);
    setUserForm(null);
    setTab(next);
  }, []);

  const selectSubmission = useCallback((item: GongguSubmission | null) => {
    setSelectedSubmission(item);
    setSubmissionForm(item ? submissionToForm(item) : null);
    setRejectReason(item?.adminMemo ?? "");
    setDetailType(item ? "submission" : null);
    if (item) window.history.pushState({ detail: "submission", id: item.id }, "");
  }, []);

  const selectGroupBuy = useCallback((item: GroupBuy | null) => {
    setSelectedGroupBuy(item);
    setGroupBuyForm(item ? groupBuyToForm(item) : null);
    setDetailType(item ? "groupBuy" : null);
    if (item) window.history.pushState({ detail: "groupBuy", id: item.id }, "");
  }, []);

  const selectUser = useCallback((item: AppUser | null) => {
    setSelectedUser(item);
    setUserForm(item ? { nickname: item.nickname ?? "", fcmToken: item.fcmToken ?? "", status: item.status ?? "ACTIVE" } : null);
    setExpandedUserId(item ? item.id : null);
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const data = await adminApi.dashboard();
      setDashboard(data);
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "대시보드 조회 실패" });
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    try {
      const data = await adminApi.listSubmissions({
        page: submissionPage,
        limit: PAGE_SIZE,
        status: submissionStatus,
        q: submissionQuery,
      });
      setSubmissions(data.items);
      setSubmissionsTotal(data.total);
      setSelectedSubmissionIds((current) => {
        const pageIds = new Set(data.items.map((item) => item.id));
        return new Set([...current].filter((id) => pageIds.has(id)));
      });
      setSelectedSubmission((current) => {
        const next = current ? data.items.find((item) => item.id === current.id) ?? null : null;
        setSubmissionForm(next ? submissionToForm(next) : null);
        setRejectReason(next?.adminMemo ?? "");
        return next;
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "위시 목록 조회 실패" });
    } finally {
      setSubmissionsLoading(false);
    }
  }, [submissionPage, submissionQuery, submissionStatus]);

  const loadGroupBuys = useCallback(async () => {
    setGroupBuysLoading(true);
    try {
      const data = await adminApi.listGroupBuys({
        page: groupBuyPage,
        limit: PAGE_SIZE,
        status: groupBuyStatus,
        q: groupBuyQuery,
      });
      setGroupBuys(data.items);
      setGroupBuysTotal(data.total);
      setSelectedGroupBuy((current) => {
        const next = current ? data.items.find((item) => item.id === current.id) ?? null : null;
        setGroupBuyForm(next ? groupBuyToForm(next) : null);
        return next;
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "공구 목록 조회 실패" });
    } finally {
      setGroupBuysLoading(false);
    }
  }, [groupBuyPage, groupBuyQuery, groupBuyStatus]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const data = await adminApi.listUsers({
        page: userPage,
        limit: PAGE_SIZE,
        q: userQuery,
      });
      setUsers(data.items);
      setUsersTotal(data.total);
      setSelectedUser((current) => {
        const next = current ? data.items.find((item) => item.id === current.id) ?? null : null;
        setUserForm(next ? { nickname: next.nickname ?? "", fcmToken: next.fcmToken ?? "", status: next.status ?? "ACTIVE" } : null);
        return next;
      });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "가입자 목록 조회 실패" });
    } finally {
      setUsersLoading(false);
    }
  }, [userPage, userQuery]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (tab === "submissions") void loadSubmissions();
  }, [loadSubmissions, tab]);

  useEffect(() => {
    if (tab === "groupBuys") void loadGroupBuys();
  }, [loadGroupBuys, tab]);

  useEffect(() => {
    if (tab === "users") void loadUsers();
  }, [loadUsers, tab]);

  const refreshActive = useCallback(async () => {
    await loadDashboard();
    if (tab === "submissions") await loadSubmissions();
    if (tab === "groupBuys") await loadGroupBuys();
    if (tab === "users") await loadUsers();
  }, [loadDashboard, loadGroupBuys, loadSubmissions, loadUsers, tab]);

  const toggleSubmissionSelection = useCallback((id: string, checked: boolean) => {
    setSelectedSubmissionIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const togglePageSubmissionSelection = useCallback((checked: boolean) => {
    setSelectedSubmissionIds((current) => {
      if (!checked) return new Set();
      const next = new Set(current);
      for (const item of submissions) {
        if (item.status === "PENDING") next.add(item.id);
      }
      return next;
    });
  }, [submissions]);

  const clearSubmissionSelection = useCallback(() => {
    setSelectedSubmissionIds(new Set());
  }, []);

  async function saveSubmission() {
    if (!selectedSubmission || !submissionForm) return;
    setSubmissionActionLoading(true);
    try {
      const next = await adminApi.updateSubmission(selectedSubmission.id, submissionPayload(submissionForm));
      setNotice({ tone: "success", message: "위시 정보를 저장했습니다." });
      selectSubmission(next);
      await loadSubmissions();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "저장 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function approveSubmission() {
    if (!selectedSubmission || !submissionForm) return;
    if (submissionForm.productName.trim().length < 2) {
      setNotice({ tone: "error", message: "제품명을 입력해주세요." });
      return;
    }
    setSubmissionActionLoading(true);
    try {
      await adminApi.approveSubmission(selectedSubmission.id, submissionPayload(submissionForm));
      setNotice({ tone: "success", message: "위시를 공구로 등록했습니다." });
      await loadSubmissions();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "승인 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function rejectSubmission() {
    if (!selectedSubmission) return;
    setSubmissionActionLoading(true);
    try {
      const next = await adminApi.rejectSubmission(selectedSubmission.id, rejectReason.trim() || "관리자 반려");
      setNotice({ tone: "success", message: "위시를 반려했습니다." });
      selectSubmission(next);
      await loadSubmissions();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "반려 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function bulkApproveSubmissions() {
    const selected = submissions.filter((item) => selectedSubmissionIds.has(item.id) && item.status === "PENDING");
    if (selected.length === 0) {
      setNotice({ tone: "info", message: "검수 대기 상태인 선택 항목이 없습니다." });
      return;
    }

    const invalid = selected.find((item) => text(item.productName).trim().length < 2);
    if (invalid) {
      setNotice({ tone: "error", message: "제품명이 비어 있는 위시는 상세 검수 후 승인해주세요." });
      selectSubmission(invalid);
      return;
    }

    setSubmissionActionLoading(true);
    try {
      for (const item of selected) {
        await adminApi.approveSubmission(item.id, submissionPayload(submissionToForm(item)));
      }
      setNotice({ tone: "success", message: `${selected.length.toLocaleString()}개 위시를 공구로 등록했습니다.` });
      setSelectedSubmissionIds(new Set());
      await loadSubmissions();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "일괄 승인 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function bulkRejectSubmissions() {
    const selected = submissions.filter((item) => selectedSubmissionIds.has(item.id) && item.status === "PENDING");
    if (selected.length === 0) {
      setNotice({ tone: "info", message: "검수 대기 상태인 선택 항목이 없습니다." });
      return;
    }

    const reason = bulkRejectReason.trim();
    if (!reason) {
      setNotice({ tone: "error", message: "일괄 반려 사유를 입력해주세요." });
      return;
    }

    setSubmissionActionLoading(true);
    try {
      for (const item of selected) {
        await adminApi.rejectSubmission(item.id, reason);
      }
      setNotice({ tone: "success", message: `${selected.length.toLocaleString()}개 위시를 반려했습니다.` });
      setBulkRejectReason("");
      setSelectedSubmissionIds(new Set());
      await loadSubmissions();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "일괄 반려 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function lookupHiker() {
    if (!submissionForm) return;
    const url = submissionForm.instagramUrl.trim();
    if (!url) {
      setNotice({ tone: "error", message: "인스타그램 URL이 없습니다." });
      return;
    }

    setSubmissionActionLoading(true);
    try {
      const result = await adminApi.lookupHiker(url);
      setSubmissionForm((current) => current ? applyHikerResult(current, result) : current);
      setNotice({ tone: "success", message: "Hiker 데이터로 승인 폼을 채웠습니다." });
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "Hiker 조회 실패" });
    } finally {
      setSubmissionActionLoading(false);
    }
  }

  async function saveGroupBuy() {
    if (!selectedGroupBuy || !groupBuyForm) return;
    setGroupBuyActionLoading(true);
    try {
      const next = await adminApi.updateGroupBuy(selectedGroupBuy.id, groupBuyPayload(groupBuyForm));
      setNotice({ tone: "success", message: "공구 정보를 저장했습니다." });
      selectGroupBuy(next);
      await loadGroupBuys();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "공구 저장 실패" });
    } finally {
      setGroupBuyActionLoading(false);
    }
  }

  const submissionTotalPages = Math.max(1, Math.ceil(submissionsTotal / PAGE_SIZE));
  const groupBuyTotalPages = Math.max(1, Math.ceil(groupBuysTotal / PAGE_SIZE));
  const userTotalPages = Math.max(1, Math.ceil(usersTotal / PAGE_SIZE));

  function closeDetail() {
    setDetailType(null);
    setSelectedSubmission(null);
    setSubmissionForm(null);
    setSelectedGroupBuy(null);
    setGroupBuyForm(null);
    window.history.back();
  }

  useEffect(() => {
    function handlePopState() {
      setDetailType(null);
      setSelectedSubmission(null);
      setSubmissionForm(null);
      setSelectedGroupBuy(null);
      setGroupBuyForm(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  async function toggleGroupBuyVisibility(hide: boolean) {
    if (!selectedGroupBuy) return;
    setGroupBuyActionLoading(true);
    try {
      const next = await adminApi.updateGroupBuy(selectedGroupBuy.id, { status: hide ? "REJECTED" : "APPROVED" });
      setNotice({ tone: "success", message: hide ? "\uB178\uCD9C\uC744 \uC911\uC9C0\uD588\uC2B5\uB2C8\uB2E4." : "\uB2E4\uC2DC \uB178\uCD9C\uD588\uC2B5\uB2C8\uB2E4." });
      selectGroupBuy(next);
      await loadGroupBuys();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "\uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328" });
    } finally {
      setGroupBuyActionLoading(false);
    }
  }

  async function saveUser() {
    if (!selectedUser || !userForm) return;
    setUserActionLoading(true);
    try {
      const next = await adminApi.updateUser(selectedUser.id, {
        nickname: userForm.nickname,
        fcmToken: userForm.fcmToken,
        status: userForm.status,
      });
      setNotice({ tone: "success", message: "가입자 정보를 저장했습니다." });
      selectUser(next);
      await loadUsers();
      await loadDashboard();
    } catch (error) {
      setNotice({ tone: "error", message: error instanceof Error ? error.message : "가입자 저장 실패" });
    } finally {
      setUserActionLoading(false);
    }
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">G</span>
          <div>
            <strong>GongGu</strong>
            <span>Operations Console</span>
          </div>
        </div>
        <div className="sidebar-summary">
          <span className="summary-dot" />
          <div>
            <strong>{dashboard?.totals.pending.toLocaleString() ?? "-"}</strong>
            <span>검수 대기</span>
          </div>
        </div>
        <nav className="nav-tabs" aria-label="관리자 메뉴">
          <button className={tab === "dashboard" ? "active" : ""} onClick={() => switchTab("dashboard")} type="button">
            <span>Overview</span>
            <strong>대시보드</strong>
          </button>
          <button className={tab === "submissions" ? "active" : ""} onClick={() => switchTab("submissions")} type="button">
            <span>Review queue</span>
            <strong>위시 검수</strong>
          </button>
          <button className={tab === "groupBuys" ? "active" : ""} onClick={() => switchTab("groupBuys")} type="button">
            <span>Catalog</span>
            <strong>공구 관리</strong>
          </button>
          <button className={tab === "users" ? "active" : ""} onClick={() => switchTab("users")} type="button">
            <span>Audience</span>
            <strong>가입자 관리</strong>
          </button>
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{formatDateTime(new Date().toISOString())}</p>
            <h1>{tabTitle(tab)}</h1>
            <p className="topbar-copy">오늘의 운영 상태와 처리 우선순위를 확인합니다.</p>
          </div>
          <div className="topbar-actions">
            <span className="operator">{session.user.email ?? session.user.id}</span>
            <button className="button button--secondary" onClick={() => void refreshActive()} type="button">
              새로고침
            </button>
            <button className="button button--ghost" onClick={() => void supabase.auth.signOut()} type="button">
              로그아웃
            </button>
          </div>
        </header>

        {notice ? <div className={`notice notice--${notice.tone}`}>{notice.message}</div> : null}

        {detailType === "submission" && selectedSubmission && submissionForm ? (
          <SubmissionEditor
            actionLoading={submissionActionLoading}
            form={submissionForm}
            onApprove={() => void approveSubmission()}
            onChange={setSubmissionForm}
            onClose={closeDetail}
            onLookupHiker={() => void lookupHiker()}
            onReject={() => void rejectSubmission()}
            onRejectReasonChange={setRejectReason}
            onSave={() => void saveSubmission()}
            rejectReason={rejectReason}
            selected={selectedSubmission}
          />
        ) : null}

        {detailType === "groupBuy" && selectedGroupBuy && groupBuyForm ? (
          <GroupBuyEditor
            actionLoading={groupBuyActionLoading}
            form={groupBuyForm}
            onChange={setGroupBuyForm}
            onClose={closeDetail}
            onSave={() => void saveGroupBuy()}
            onToggleVisibility={toggleGroupBuyVisibility}
            selected={selectedGroupBuy}
          />
        ) : null}

        {!detailType && (
          <>
        {tab === "dashboard" ? (
          <DashboardPanel
            dashboard={dashboard}
            loading={dashboardLoading}
            onOpenSubmissions={() => switchTab("submissions")}
          />
        ) : null}

        {tab === "submissions" ? (
          <SubmissionPanel
            actionLoading={submissionActionLoading}
            bulkRejectReason={bulkRejectReason}
            form={submissionForm}
            items={submissions}
            loading={submissionsLoading}
            onApprove={() => void approveSubmission()}
            onBulkApprove={() => void bulkApproveSubmissions()}
            onBulkReject={() => void bulkRejectSubmissions()}
            onBulkRejectReasonChange={setBulkRejectReason}
            onClearSelection={clearSubmissionSelection}
            onFormChange={setSubmissionForm}
            onLookupHiker={() => void lookupHiker()}
            onReject={() => void rejectSubmission()}
            onRejectReasonChange={setRejectReason}
            onSave={() => void saveSubmission()}
            onSelect={selectSubmission}
            onToggleAllSelected={togglePageSubmissionSelection}
            onToggleSelected={toggleSubmissionSelection}
            onStatusChange={(value) => {
              setSubmissionStatus(value);
              setSubmissionPage(1);
            }}
            onQueryChange={(value) => {
              setSubmissionQuery(value);
              setSubmissionPage(1);
            }}
            onPageChange={setSubmissionPage}
            page={submissionPage}
            rejectReason={rejectReason}
            selected={selectedSubmission}
            selectedIds={selectedSubmissionIds}
            status={submissionStatus}
            query={submissionQuery}
            total={submissionsTotal}
            totalPages={submissionTotalPages}
          />
        ) : null}

        {tab === "groupBuys" ? (
          <GroupBuyPanel
            actionLoading={groupBuyActionLoading}
            form={groupBuyForm}
            items={groupBuys}
            loading={groupBuysLoading}
            onFormChange={setGroupBuyForm}
            onPageChange={setGroupBuyPage}
            onQueryChange={(value) => {
              setGroupBuyQuery(value);
              setGroupBuyPage(1);
            }}
            onSave={() => void saveGroupBuy()}
            onSelect={selectGroupBuy}
            onStatusChange={(value) => {
              setGroupBuyStatus(value);
              setGroupBuyPage(1);
            }}
            page={groupBuyPage}
            query={groupBuyQuery}
            selected={selectedGroupBuy}
            status={groupBuyStatus}
            total={groupBuysTotal}
           totalPages={groupBuyTotalPages}
         />
       ) : null}
        {tab === "users" ? (
          <UserPanel
            actionLoading={userActionLoading}
            form={userForm}
            items={users}
            loading={usersLoading}
            onFormChange={setUserForm}
            onPageChange={setUserPage}
            onQueryChange={(value) => {
              setUserQuery(value);
              setUserPage(1);
            }}
           onSave={() => void saveUser()}
            onSelect={selectUser}
            page={userPage}
            query={userQuery}
            selected={selectedUser}
            total={usersTotal}
            totalPages={userTotalPages}
            expandedUserId={expandedUserId}
          />
      ) : null}
        </>
        )}
      </main>
      <nav className="bottom-tab-bar" aria-label="모바일 하단 탭">
        <button className={tab === "dashboard" ? "active" : ""} onClick={() => switchTab("dashboard")} type="button">
          <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M3 12L12 3l9 9v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z" fill="currentColor"/></svg>
          <span>대시보드</span>
        </button>
        <button className={tab === "submissions" ? "active" : ""} onClick={() => switchTab("submissions")} type="button">
          <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          <span>검수</span>
        </button>
        <button className={tab === "groupBuys" ? "active" : ""} onClick={() => switchTab("groupBuys")} type="button">
          <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          <span>공구</span>
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => switchTab("users")} type="button">
          <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m6-1.13a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm6 0a4 4 0 0 0 0-8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/></svg>
          <span>사용자</span>
        </button>
      </nav>
    </div>
  );
}

function applyHikerResult(form: SubmissionForm, result: HikerLookupResult): SubmissionForm {
  const mediaItems = result.mediaItems ?? [];
  const mediaUrls = result.mediaUrls ?? [];
  const thumbnailUrl = result.thumbnailUrl ?? result.imageUrl ?? form.thumbnailUrl;
  const videoUrl = result.videoUrl ?? form.videoUrl;

  return {
    ...form,
    productName: guessProductName(result, form.productName),
    brandName: form.brandName || result.username || "",
    purchaseUrl: form.purchaseUrl || form.instagramUrl,
    summary: result.caption ? result.caption.slice(0, 500) : form.summary,
    thumbnailUrl,
    videoUrl,
    mediaUrlsText: mediaUrls.join("\n"),
    mediaItemsText: stringifyMediaItems(mediaItems),
    mediaType: result.mediaType ?? form.mediaType,
  };
}

function tabTitle(tab: TabKey) {
  if (tab === "submissions") return "위시 검수";
  if (tab === "groupBuys") return "공구 관리";
  if (tab === "users") return "가입자 관리";
  return "대시보드";
}

function DashboardPanel({
  dashboard,
  loading,
  onOpenSubmissions,
}: {
  dashboard: DashboardResponse | null;
  loading: boolean;
  onOpenSubmissions: () => void;
}) {
  const totals = dashboard?.totals;
  const pending = totals?.pending ?? 0;
  const submissions = totals?.submissions ?? 0;
  const approved = totals?.approved ?? 0;
  const rejected = totals?.rejected ?? 0;
  const approvalRate = submissions > 0 ? Math.round((approved / submissions) * 100) : 0;
  const rejectionRate = submissions > 0 ? Math.round((rejected / submissions) * 100) : 0;
  return (
    <section className="panel">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">Ops command center</p>
          <h2>오늘 처리해야 할 승인 큐를 먼저 보여줍니다.</h2>
          <p>검수 대기 항목, 승인율, 반려율을 기준으로 운영 우선순위를 정리했습니다.</p>
        </div>
        <button className="button button--primary" onClick={onOpenSubmissions} type="button">
          검수 큐 열기
        </button>
      </div>

      <div className="stat-grid">
        <StatCard label="검수 대기" value={pending} icon={<span>Q</span>} color="#b45309" />
        <StatCard label="승인율" value={approvalRate} suffix="%" icon={<span>A</span>} color="#047857" />
        <StatCard label="등록 공구" value={totals?.groupBuys ?? 0} icon={<span>G</span>} color="#1d4ed8" />
        <StatCard label="가입자" value={totals?.users ?? 0} icon={<span>U</span>} color="#7c3aed" />
      </div>

      <div className="ops-grid">
        <div className="ops-card">
          <span>승인</span>
          <strong>{approved.toLocaleString()}</strong>
          <p>모바일 캘린더와 알림에 노출 가능한 공구 후보입니다.</p>
        </div>
        <div className="ops-card">
          <span>반려</span>
          <strong>{rejected.toLocaleString()}</strong>
          <p>정보 부족, 링크 오류, 중복 등 품질 관리 이력입니다.</p>
        </div>
        <div className="ops-card">
          <span>반려율</span>
          <strong>{rejectionRate}%</strong>
          <p>제보 품질을 판단하는 운영 지표로 추적합니다.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-col">
          <div className="section-header">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>검수 대기 위시</h2>
            </div>
            <button className="button button--secondary" onClick={onOpenSubmissions} type="button">
              큐로 이동
            </button>
          </div>
          {loading ? <LoadingRows /> : null}
          {!loading && dashboard?.pendingQueue.length === 0 ? <div className="empty-state">검수 대기 항목이 없습니다.</div> : null}
          {!loading && dashboard?.pendingQueue.length ? (
            <>
            <div className="table-wrap desktop-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>상품</th>
                    <th>URL</th>
                    <th>접수</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.pendingQueue.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.productName || "검수 대기 위시템"}</strong>
                        <span>{item.brandName || item.reporterName || "제보자 정보 없음"}</span>
                      </td>
                      <td className="truncate">{item.instagramUrl}</td>
                      <td>{formatDateTime(item.createdAt)}</td>
                      <td><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
               </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {dashboard.pendingQueue.map((item) => (
                <article className="mobile-record-card mobile-record-card--static" key={item.id}>
                  <div className="mobile-record-card__top">
                    <span className="mobile-record-kicker">{item.brandName ?? "브랜드 미확정"}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <strong>{item.productName ?? "검수 대기 위시템"}</strong>
                  <p>{item.instagramUrl ?? "URL 없음"}</p>
                  <div className="mobile-record-meta">
                    <span>일시</span>
                    <strong>{formatDateTime(item.createdAt)}</strong>
                  </div>
                </article>
              ))}
            </div>
            </>
          ) : null}
        </div>

        <div className="dashboard-col">
          <div className="section-header">
            <div>
              <p className="eyebrow">Recent</p>
              <h2>최근 승인 공구</h2>
            </div>
          </div>
          {loading ? <LoadingRows /> : null}
          {!loading && dashboard?.recentGroupBuys.length === 0 ? <div className="empty-state">승인된 공구가 없습니다.</div> : null}
          {!loading && dashboard?.recentGroupBuys.length ? (
            <>
            <div className="table-wrap desktop-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>상품</th>
                    <th>카테고리</th>
                    <th>마감</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentGroupBuys.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.productName || "상품명 없음"}</strong>
                        <span>{item.brandName || "브랜드 미지정"}</span>
                      </td>
                      <td>{item.category ?? "-"}</td>
                      <td>{item.endDate ? dateInput(item.endDate) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-card-list">
              {dashboard.recentGroupBuys.map((item) => (
                <article className="mobile-record-card mobile-record-card--static" key={item.id}>
                  <div className="mobile-record-card__top">
                    <span className="mobile-record-kicker">{item.category ?? "카테고리 미정"}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <strong>{item.productName ?? "상품명 없음"}</strong>
                  <p>{item.brandName ?? "브랜드 미확정"}</p>
                  <div className="mobile-record-meta">
                    <span>종료일</span>
                    <strong>{item.endDate ? dateInput(item.endDate) : "미정"}</strong>
                  </div>
                </article>
              ))}
            </div>
            </>
          ) : null}
        </div>
      </div>

      <div className="section-header">
        <div>
          <p className="eyebrow">Distribution</p>
          <h2>카테고리별 공구 분포</h2>
        </div>
      </div>
      {loading ? <div className="empty-state">조회 중</div> : null}
      {!loading && dashboard && Object.keys(dashboard.categoryDistribution).length === 0 ? (
        <div className="empty-state">승인된 공구 없음</div>
      ) : null}
      {!loading && dashboard && Object.keys(dashboard.categoryDistribution).length > 0 ? (
        <div className="category-bars">
          {Object.entries(dashboard.categoryDistribution)
            .sort(([, a], [, b]) => b - a)
            .map(([category, count]) => {
              const max = Math.max(...Object.values(dashboard.categoryDistribution));
              const pct = max > 0 ? Math.round((count / max) * 100) : 0;
              return (
                <div key={category} className="category-bar">
                  <span className="category-bar__label">{category}</span>
                  <div className="category-bar__track">
                    <div className="category-bar__fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="category-bar__count">{count}</span>
                </div>
              );
            })}
        </div>
      ) : null}
    </section>
  );
}

function SubmissionPanel(props: {
  actionLoading: boolean;
  bulkRejectReason: string;
  form: SubmissionForm | null;
  items: GongguSubmission[];
  loading: boolean;
  onApprove: () => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onBulkRejectReasonChange: (value: string) => void;
  onClearSelection: () => void;
  onFormChange: (form: SubmissionForm | null) => void;
  onLookupHiker: () => void;
  onReject: () => void;
  onRejectReasonChange: (value: string) => void;
  onSave: () => void;
  onSelect: (item: GongguSubmission | null) => void;
  onStatusChange: (value: "ALL" | SubmissionStatus) => void;
  onQueryChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onToggleAllSelected: (checked: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  page: number;
  rejectReason: string;
  selected: GongguSubmission | null;
  selectedIds: Set<string>;
  status: "ALL" | SubmissionStatus;
  query: string;
  total: number;
  totalPages: number;
}) {
  const selectableItems = props.items.filter((item) => item.status === "PENDING");
  const selectedCount = selectableItems.filter((item) => props.selectedIds.has(item.id)).length;
  const allPageSelected = selectableItems.length > 0 && selectedCount === selectableItems.length;

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Wish Review</p>
          <h2>모바일 위시 등록 큐</h2>
          <p>검색, 상태 필터, 원본 조회, Hiker 보강, 승인/반려 사유 기록을 한 흐름으로 처리합니다.</p>
        </div>
        <Filters
          query={props.query}
          status={props.status}
          statusOptions={SUBMISSION_STATUS_OPTIONS}
          onQueryChange={props.onQueryChange}
          onStatusChange={props.onStatusChange}
        />
      </div>
      <div className="bulk-bar">
        <div>
          <strong>{selectedCount.toLocaleString()}개 선택됨</strong>
          <span>현재 페이지의 검수 대기 항목만 일괄 처리합니다.</span>
        </div>
        <input
          aria-label="일괄 반려 사유"
          className="bulk-reason"
          onChange={(event) => props.onBulkRejectReasonChange(event.target.value)}
          placeholder="일괄 반려 사유"
          value={props.bulkRejectReason}
        />
        <button className="button button--secondary" disabled={selectedCount === 0 || props.actionLoading} onClick={props.onClearSelection} type="button">
          선택 해제
        </button>
        <button className="button button--danger" disabled={selectedCount === 0 || props.actionLoading} onClick={props.onBulkReject} type="button">
          선택 반려
        </button>
        <button className="button button--primary" disabled={selectedCount === 0 || props.actionLoading} onClick={props.onBulkApprove} type="button">
          선택 승인
        </button>
      </div>
      <div className="split-view">
        <div className="table-panel">
          <ListMeta loading={props.loading} page={props.page} total={props.total} totalPages={props.totalPages} />
          <div className="table-wrap desktop-table">
            <table className="admin-table admin-table--clickable">
              <thead>
                <tr>
                  <th className="checkbox-cell">
                    <input
                      aria-label="현재 페이지 선택"
                      checked={allPageSelected}
                      disabled={selectableItems.length === 0}
                      onChange={(event) => props.onToggleAllSelected(event.target.checked)}
                      type="checkbox"
                    />
                  </th>
                  <th>상품</th>
                  <th>제보자</th>
                  <th>원본</th>
                  <th>접수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((item) => (
                  <tr
                    className={props.selected?.id === item.id ? "selected" : ""}
                    key={item.id}
                    onClick={() => props.onSelect(item)}
                  >
                    <td className="checkbox-cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        aria-label={`${item.productName ?? "위시"} 선택`}
                        checked={props.selectedIds.has(item.id)}
                        disabled={item.status !== "PENDING"}
                        onChange={(event) => props.onToggleSelected(item.id, event.target.checked)}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <strong>{item.productName || "검수 대기 위시템"}</strong>
                      <span>{item.brandName || item.category || "분류 전"}</span>
                    </td>
                    <td>
                      <strong>{item.isAnonymous ? "익명 제보" : item.reporterName || "제보자 미입력"}</strong>
                      <span>{item.reporterContact || "연락처 없음"}</span>
                    </td>
                    <td className="truncate">{item.instagramUrl}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MobileSubmissionCards
            items={props.items}
            loading={props.loading}
            onSelect={props.onSelect}
            onToggleSelected={props.onToggleSelected}
            selected={props.selected}
            selectedIds={props.selectedIds}
          />
          {props.items.length === 0 && !props.loading ? <div className="empty-state">항목 없음</div> : null}
          <Pagination page={props.page} totalPages={props.totalPages} onPageChange={props.onPageChange} />
        </div>

        <SubmissionEditor
          actionLoading={props.actionLoading}
          form={props.form}
          onApprove={props.onApprove}
          onChange={props.onFormChange}
          onLookupHiker={props.onLookupHiker}
          onReject={props.onReject}
          onRejectReasonChange={props.onRejectReasonChange}
          onSave={props.onSave}
          rejectReason={props.rejectReason}
          selected={props.selected}
          onClose={() => props.onSelect(null)}
        />
      </div>
    </section>
  );
}

function MobileSubmissionCards({
  items,
  loading,
  onSelect,
  onToggleSelected,
  selected,
  selectedIds,
}: {
  items: GongguSubmission[];
  loading: boolean;
  onSelect: (item: GongguSubmission | null) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  selected: GongguSubmission | null;
  selectedIds: Set<string>;
}) {
  if (loading) {
    return (
      <div className="mobile-card-list">
        <LoadingRows />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mobile-card-list" aria-label="모바일 위시 검수 목록">
      {items.map((item) => {
        const checked = selectedIds.has(item.id);
        const isPending = item.status === "PENDING";
        const isSelected = selected?.id === item.id;
        return (
          <article
            className={`mobile-record-card${isSelected ? " selected" : ""}`}
            key={item.id}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(item);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-record-card__top">
              <label className="mobile-check" onClick={(event) => event.stopPropagation()}>
                <input
                  aria-label={`${item.productName ?? "위시"} 선택`}
                  checked={checked}
                  disabled={!isPending}
                  onChange={(event) => onToggleSelected(item.id, event.target.checked)}
                  type="checkbox"
                />
                <span>{checked ? "선택됨" : isPending ? "선택" : "완료"}</span>
              </label>
              <StatusBadge status={item.status} />
            </div>
            <strong>{item.productName || "검수 대기 위시템"}</strong>
            <p>{item.brandName || item.category || "분류 전"}</p>
            <div className="mobile-record-meta">
              <span>제보자</span>
              <strong>{item.isAnonymous ? "익명 제보" : item.reporterName || "제보자 미입력"}</strong>
              <span>접수</span>
              <strong>{formatDateTime(item.createdAt)}</strong>
              <span>원본</span>
              <strong>{item.instagramUrl || "-"}</strong>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function SubmissionEditor(props: {
  actionLoading: boolean;
  form: SubmissionForm | null;
  onApprove: () => void;
  onChange: (form: SubmissionForm | null) => void;
  onLookupHiker: () => void;
  onReject: () => void;
  onRejectReasonChange: (value: string) => void;
  onSave: () => void;
  rejectReason: string;
  selected: GongguSubmission | null;
  onClose: () => void;
}) {
  const form = props.form;
  if (!props.selected || !form) {
    return <aside className="detail-panel empty-state">선택된 위시 없음</aside>;
  }

  const setField = <K extends keyof SubmissionForm>(key: K, value: SubmissionForm[K]) => {
    props.onChange({ ...form, [key]: value });
  };

  const canApprove = props.selected.status === "PENDING";
  return (
    <aside className="detail-panel">
      <div className="detail-back-bar">
        <button className="detail-back" onClick={props.onClose} type="button">← 목록으로</button>
      </div>
      <div className="detail-title">
        <div>
          <p className="eyebrow">Review</p>
          <h3>{form.productName || "검수 대기 위시템"}</h3>
          <p>접수 {formatDateTime(props.selected.createdAt)} · 수정 {formatDateTime(props.selected.updatedAt)}</p>
        </div>
        <StatusBadge status={props.selected.status} />
      </div>

      <div className="review-preview">
        {form.thumbnailUrl ? (
          <img alt="" src={form.thumbnailUrl} />
        ) : (
          <div className="preview-empty">No image</div>
        )}
        <div>
          <strong>{form.brandName || "브랜드 미지정"}</strong>
          <span>{form.category || "카테고리 미지정"}</span>
          <p>{form.summary || "요약이 없습니다. Hiker 조회 또는 수동 입력으로 승인 품질을 높여주세요."}</p>
        </div>
      </div>

      <div className="action-row">
        <a className="button button--ghost" href={form.instagramUrl} rel="noreferrer" target="_blank">
          원본 열기
        </a>
        <button className="button button--secondary" disabled={props.actionLoading} onClick={props.onLookupHiker} type="button">
          Hiker 조회
        </button>
      </div>

      <div className="form-grid">
        <TextField label="제품명" value={form.productName} onChange={(value) => setField("productName", value)} required />
        <SelectField label="카테고리" value={form.category} options={CATEGORY_OPTIONS} onChange={(value) => setField("category", value)} />
        <TextField label="브랜드/계정" value={form.brandName} onChange={(value) => setField("brandName", value)} />
        <TextField label="구매 URL" value={form.purchaseUrl} onChange={(value) => setField("purchaseUrl", value)} />
        <TextField label="시작일" value={form.startDate} onChange={(value) => setField("startDate", value)} type="date" />
        <TextField label="마감일" value={form.endDate} onChange={(value) => setField("endDate", value)} type="date" />
        <TextField label="할인 정보" value={form.discountInfo} onChange={(value) => setField("discountInfo", value)} />
        <TextField label="썸네일 URL" value={form.thumbnailUrl} onChange={(value) => setField("thumbnailUrl", value)} />
        <TextField label="비디오 URL" value={form.videoUrl} onChange={(value) => setField("videoUrl", value)} />
        <SelectField
          label="미디어 타입"
          value={form.mediaType}
          options={[
            { value: "", label: "미지정" },
            { value: "IMAGE", label: "이미지" },
            { value: "VIDEO", label: "비디오" },
          ]}
          onChange={(value) => setField("mediaType", value as SubmissionForm["mediaType"])}
        />
        <TextField label="이달의 순위" value={form.monthlyFeaturedRank} onChange={(value) => setField("monthlyFeaturedRank", value)} type="number" />
      </div>

      <CheckboxField label="종일 공구" checked={form.isAllDay} onChange={(value) => setField("isAllDay", value)} />
      <CheckboxField label="이달의 공구 노출" checked={form.isMonthlyFeatured} onChange={(value) => setField("isMonthlyFeatured", value)} />
      <TextareaField label="요약" value={form.summary} onChange={(value) => setField("summary", value)} rows={5} />
      <TextareaField label="미디어 URL 목록" value={form.mediaUrlsText} onChange={(value) => setField("mediaUrlsText", value)} rows={4} />
      <TextareaField label="미디어 JSON" value={form.mediaItemsText} onChange={(value) => setField("mediaItemsText", value)} rows={7} monospace />
      <TextareaField label="관리 메모" value={form.adminMemo} onChange={(value) => setField("adminMemo", value)} rows={3} />
      <TextareaField label="반려 사유" value={props.rejectReason} onChange={props.onRejectReasonChange} rows={3} />

      <div className="audit-card">
        <div>
          <span>검수자</span>
          <strong>{props.selected.reviewedBy || "아직 없음"}</strong>
        </div>
        <div>
          <span>검수 시각</span>
          <strong>{formatDateTime(props.selected.reviewedAt)}</strong>
        </div>
        <div>
          <span>연결 공구</span>
          <strong>{props.selected.groupBuyId || "-"}</strong>
        </div>
        <div>
          <span>콘텐츠 해시</span>
          <strong>{props.selected.contentHash || "-"}</strong>
        </div>
      </div>

      <div className="action-row action-row--end">
        <button className="button button--secondary" disabled={props.actionLoading} onClick={props.onSave} type="button">
          저장
        </button>
        <button className="button button--danger" disabled={props.actionLoading || !canApprove} onClick={props.onReject} type="button">
          반려
        </button>
        <button className="button button--primary" disabled={props.actionLoading || !canApprove} onClick={props.onApprove} type="button">
          공구 등록
        </button>
      </div>
    </aside>
  );
}

function GroupBuyPanel(props: {
  actionLoading: boolean;
  form: GroupBuyForm | null;
  items: GroupBuy[];
  loading: boolean;
  onFormChange: (form: GroupBuyForm | null) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onSave: () => void;
  onSelect: (item: GroupBuy | null) => void;
  onStatusChange: (value: "ALL" | GroupBuyStatus) => void;
  page: number;
  query: string;
  selected: GroupBuy | null;
  status: "ALL" | GroupBuyStatus;
  total: number;
  totalPages: number;
}) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Group Buys</p>
          <h2>공구 노출 관리</h2>
        </div>
        <Filters
          query={props.query}
          status={props.status}
          statusOptions={GROUP_BUY_STATUS_OPTIONS}
          onQueryChange={props.onQueryChange}
          onStatusChange={props.onStatusChange}
        />
      </div>

      <div className="split-view">
        <div className="table-panel">
          <ListMeta loading={props.loading} page={props.page} total={props.total} totalPages={props.totalPages} />
          <div className="table-wrap desktop-table">
            <table className="admin-table admin-table--clickable">
              <thead>
                <tr>
                  <th>상품</th>
                  <th>카테고리</th>
                  <th>마감</th>
                  <th>추천</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {props.items.map((item) => (
                  <tr
                    className={props.selected?.id === item.id ? "selected" : ""}
                    key={item.id}
                    onClick={() => props.onSelect(item)}
                  >
                    <td>{item.productName}</td>
                    <td>{item.category ?? "-"}</td>
                    <td>{item.endDate ? dateInput(item.endDate) : "-"}</td>
                    <td>{item.isMonthlyFeatured ? item.monthlyFeaturedRank ?? "노출" : "-"}</td>
                    <td><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MobileGroupBuyCards
            items={props.items}
            loading={props.loading}
            onSelect={props.onSelect}
            selected={props.selected}
          />
          {props.items.length === 0 && !props.loading ? <div className="empty-state">항목 없음</div> : null}
          <Pagination page={props.page} totalPages={props.totalPages} onPageChange={props.onPageChange} />
        </div>
        <GroupBuyEditor
          actionLoading={props.actionLoading}
          form={props.form}
          onChange={props.onFormChange}
          onClose={() => props.onSelect(null)}
          onSave={props.onSave}
          selected={props.selected}
        />
      </div>
    </section>
  );
}

function MobileGroupBuyCards({
  items,
  loading,
  onSelect,
  selected,
}: {
  items: GroupBuy[];
  loading: boolean;
  onSelect: (item: GroupBuy | null) => void;
  selected: GroupBuy | null;
}) {
  if (loading) {
    return (
      <div className="mobile-card-list">
        <LoadingRows />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mobile-card-list" aria-label="모바일 공구 목록">
      {items.map((item) => (
        <article
          className={`mobile-record-card${selected?.id === item.id ? " selected" : ""}`}
          key={item.id}
          onClick={() => onSelect(item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") onSelect(item);
          }}
          role="button"
          tabIndex={0}
        >
          <div className="mobile-record-card__top">
            <span className="mobile-record-kicker">{item.category ?? "미지정"}</span>
            <StatusBadge status={item.status} />
          </div>
          <strong>{item.productName || "상품명 없음"}</strong>
          <p>{item.brandName || "브랜드 미지정"}</p>
          <div className="mobile-record-meta">
            <span>마감</span>
            <strong>{item.endDate ? dateInput(item.endDate) : "-"}</strong>
            <span>추천</span>
            <strong>{item.isMonthlyFeatured ? item.monthlyFeaturedRank ?? "노출" : "-"}</strong>
          </div>
        </article>
      ))}
    </div>
  );
}

function GroupBuyEditor(props: {
  actionLoading: boolean;
  form: GroupBuyForm | null;
  onChange: (form: GroupBuyForm | null) => void;
  onSave: () => void;
  selected: GroupBuy | null;
  onClose: () => void;
  onToggleVisibility?: (hide: boolean) => void;
}) {
  const form = props.form;
  if (!props.selected || !form) {
    return <aside className="detail-panel empty-state">선택된 공구 없음</aside>;
  }
  const setField = <K extends keyof GroupBuyForm>(key: K, value: GroupBuyForm[K]) => {
    props.onChange({ ...form, [key]: value });
  };
  const isHidden = form.status === "REJECTED";

  return (
    <aside className="detail-panel">
      <div className="detail-back-bar">
        <button className="detail-back" onClick={props.onClose} type="button">← 목록으로</button>
      </div>
      <div className="detail-title">
        <div>
          <p className="eyebrow">{props.selected.sourceType ?? "GROUP_BUY"}</p>
          <h3>{form.productName || "상품명 없음"}</h3>
        </div>
        <StatusBadge status={form.status} />
      </div>
      <div className="visibility-toggle">
        <button className="button button--danger" disabled={props.actionLoading || !isHidden} onClick={() => props.onToggleVisibility?.(true)} type="button">노출 중지</button>
        <button className="button button--primary" disabled={props.actionLoading || isHidden} onClick={() => props.onToggleVisibility?.(false)} type="button">다시 노출</button>
      </div>

      <div className="form-grid">
        <TextField label="제품명" value={form.productName} onChange={(value) => setField("productName", value)} required />
        <SelectField label="카테고리" value={form.category} options={CATEGORY_OPTIONS} onChange={(value) => setField("category", value)} />
        <TextField label="브랜드/계정" value={form.brandName} onChange={(value) => setField("brandName", value)} />
        <TextField label="구매 URL" value={form.purchaseUrl} onChange={(value) => setField("purchaseUrl", value)} />
        <TextField label="시작일" value={form.startDate} onChange={(value) => setField("startDate", value)} type="date" />
        <TextField label="마감일" value={form.endDate} onChange={(value) => setField("endDate", value)} type="date" />
        <TextField label="할인 정보" value={form.discountInfo} onChange={(value) => setField("discountInfo", value)} />
        <TextField label="썸네일 URL" value={form.thumbnailUrl} onChange={(value) => setField("thumbnailUrl", value)} />
        <TextField label="비디오 URL" value={form.videoUrl} onChange={(value) => setField("videoUrl", value)} />
        <SelectField
          label="상태"
          value={form.status}
          options={GROUP_BUY_STATUS_OPTIONS.filter((item) => item.value !== "ALL")}
          onChange={(value) => setField("status", value as GroupBuyStatus)}
        />
        <TextField label="이달의 순위" value={form.monthlyFeaturedRank} onChange={(value) => setField("monthlyFeaturedRank", value)} type="number" />
      </div>

      <CheckboxField label="종일 공구" checked={form.isAllDay} onChange={(value) => setField("isAllDay", value)} />
      <CheckboxField label="이달의 공구 노출" checked={form.isMonthlyFeatured} onChange={(value) => setField("isMonthlyFeatured", value)} />
      <TextareaField label="요약" value={form.summary} onChange={(value) => setField("summary", value)} rows={5} />
      <TextareaField label="미디어 URL 목록" value={form.mediaUrlsText} onChange={(value) => setField("mediaUrlsText", value)} rows={4} />
      <TextareaField label="미디어 JSON" value={form.mediaItemsText} onChange={(value) => setField("mediaItemsText", value)} rows={7} monospace />

      <div className="action-row action-row--end">
        <button className="button button--primary" disabled={props.actionLoading} onClick={props.onSave} type="button">
          저장
        </button>
      </div>
    </aside>
  );
}

function UserPanel(props: {
  actionLoading: boolean;
  form: UserForm | null;
  items: AppUser[];
  loading: boolean;
  onFormChange: (form: UserForm | null) => void;
  onPageChange: (page: number) => void;
  onQueryChange: (value: string) => void;
  onSave: () => void;
  onSelect: (item: AppUser | null) => void;
  page: number;
  query: string;
  selected: AppUser | null;
  total: number;
  totalPages: number;
  expandedUserId: string | null;
}) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Users</p>
          <h2>가입자 관리</h2>
        </div>
        <div className="filters">
          <input
            aria-label="검색"
            className="search-input"
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder="이메일, 닉네임"
            value={props.query}
          />
        </div>
      </div>

      <div className="split-view">
        <div className="table-panel">
          <ListMeta loading={props.loading} page={props.page} total={props.total} totalPages={props.totalPages} />
          <div className="table-wrap desktop-table">
            <table className="admin-table admin-table--clickable">
             <thead>
               <tr>
                 <th>이메일</th>
                 <th>닉네임</th>
                  <th>상태</th>
                 <th>가입일</th>
               </tr>
             </thead>
             <tbody>
               {props.items.map((item) => (
                 <tr
                   className={props.selected?.id === item.id ? "selected" : ""}
                   key={item.id}
                   onClick={() => props.onSelect(item)}
                 >
                   <td className="truncate">{item.email}</td>
                   <td>{item.nickname ?? "-"}</td>
                    <td><StatusBadge status={item.status ?? "ACTIVE"} /></td>
                   <td>{formatDateTime(item.createdAt)}</td>
                 </tr>
               ))}
             </tbody>
            </table>
          </div>
          <MobileUserCards
            items={props.items}
            loading={props.loading}
            onSelect={props.onSelect}
            selected={props.selected}
            expandedUserId={props.expandedUserId}
            form={props.form}
            onFormChange={props.onFormChange}
            actionLoading={props.actionLoading}
            onSave={props.onSave}
          />
          {props.items.length === 0 && !props.loading ? <div className="empty-state">가입자 없음</div> : null}
          <Pagination page={props.page} totalPages={props.totalPages} onPageChange={props.onPageChange} />
        </div>
        <UserEditor
          actionLoading={props.actionLoading}
          form={props.form}
          onChange={props.onFormChange}
          onClose={() => props.onSelect(null)}
          onSave={props.onSave}
          selected={props.selected}
        />
      </div>
    </section>
  );
}

function MobileUserCards({
  items,
  loading,
  onSelect,
  selected,
  expandedUserId,
  form,
  onFormChange,
  actionLoading,
  onSave,
}: {
  items: AppUser[];
  loading: boolean;
  onSelect: (item: AppUser | null) => void;
  selected: AppUser | null;
  expandedUserId: string | null;
  form: UserForm | null;
  onFormChange: (form: UserForm | null) => void;
  actionLoading: boolean;
  onSave: () => void;
}) {
  if (loading) {
    return (
      <div className="mobile-card-list">
        <LoadingRows />
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mobile-card-list" aria-label="모바일 사용자 목록">
      {items.map((item) => (
        <div key={item.id}>
          <article
            className={`mobile-record-card${selected?.id === item.id ? " selected" : ""}`}
            onClick={() => onSelect(item)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") onSelect(item);
            }}
            role="button"
            tabIndex={0}
          >
            <div className="mobile-record-card__top">
              <span className="mobile-record-kicker">{item.nickname ?? "닉네임 없음"}</span>
              <StatusBadge status={item.status ?? "ACTIVE"} />
            </div>
            <strong>{item.email ?? item.id}</strong>
            <p>{item.fcmToken ? "푸시 토큰 등록됨" : "푸시 토큰 없음"}</p>
            <div className="mobile-record-meta">
              <span>가입일</span>
              <strong>{formatDateTime(item.createdAt)}</strong>
            </div>
          </article>
          {expandedUserId === item.id && form ? (
            <div className="user-inline-editor expanded">
              <TextField label="닉네임" value={form.nickname} onChange={(value) => onFormChange({ ...form, nickname: value })} />
              <TextareaField label="FCM 토큰" value={form.fcmToken} onChange={(value) => onFormChange({ ...form, fcmToken: value })} rows={4} monospace />
              <div className="action-row">
                <button className="button button--secondary" disabled={actionLoading || form.status === "SUSPENDED"} onClick={() => onFormChange({ ...form, status: "SUSPENDED" })} type="button">정지</button>
                <button className="button button--danger" disabled={actionLoading || form.status === "BANNED"} onClick={() => onFormChange({ ...form, status: "BANNED" })} type="button">차단</button>
                <button className="button button--ghost" disabled={actionLoading || form.status === "ACTIVE"} onClick={() => onFormChange({ ...form, status: "ACTIVE" })} type="button">활성화</button>
              </div>
              <div className="action-row action-row--end">
                <button className="button button--primary" disabled={actionLoading} onClick={onSave} type="button">저장</button>
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function UserEditor(props: {
  actionLoading: boolean;
  form: UserForm | null;
  onChange: (form: UserForm | null) => void;
  onSave: () => void;
  selected: AppUser | null;
  onClose: () => void;
}) {
  const form = props.form;
  if (!props.selected || !form) {
    return <aside className="detail-panel empty-state">선택된 가입자 없음</aside>;
  }
  const setField = (key: keyof UserForm, value: string) => {
    props.onChange({ ...form, [key]: value });
  };

  return (
    <aside className="detail-panel">
      <div className="detail-back-bar">
        <button className="detail-back" onClick={props.onClose} type="button">← 목록으로</button>
      </div>
      <div className="detail-title">
        <div>
          <p className="eyebrow">User</p>
          <h3>{props.selected.email ?? props.selected.id}</h3>
        </div>
        <StatusBadge status={props.selected.status ?? "ACTIVE"} />
      </div>

      <div className="form-grid">
        <TextField label="닉네임" value={form.nickname} onChange={(value) => setField("nickname", value)} />
      </div>
      <TextareaField label="FCM 토큰" value={form.fcmToken} onChange={(value) => setField("fcmToken", value)} rows={4} monospace />

      <div className="action-row">
        <button
          className="button button--secondary"
          disabled={props.actionLoading || form.status === "SUSPENDED"}
          onClick={() => props.onChange({ ...form, status: "SUSPENDED" })}
          type="button"
        >
          정지
        </button>
        <button
          className="button button--danger"
          disabled={props.actionLoading || form.status === "BANNED"}
          onClick={() => props.onChange({ ...form, status: "BANNED" })}
          type="button"
        >
          추방
        </button>
        <button
          className="button button--ghost"
          disabled={props.actionLoading || form.status === "ACTIVE"}
          onClick={() => props.onChange({ ...form, status: "ACTIVE" })}
          type="button"
        >
          활성화
        </button>
      </div>

      <div className="action-row action-row--end">
        <button className="button button--primary" disabled={props.actionLoading} onClick={props.onSave} type="button">
          저장
        </button>
      </div>
    </aside>
  );
}

function Filters<T extends string>({
  query,
  status,
  statusOptions,
  onQueryChange,
  onStatusChange,
}: {
  query: string;
  status: T;
  statusOptions: Array<{ value: T; label: string }>;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: T) => void;
}) {
  return (
    <div className="filters">
      <input
        aria-label="검색"
        className="search-input"
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="상품명, 브랜드, URL"
        value={query}
      />
      <select value={status} onChange={(event) => onStatusChange(event.target.value as T)}>
        {statusOptions.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </div>
  );
}

function ListMeta({ loading, page, total, totalPages }: { loading: boolean; page: number; total: number; totalPages: number }) {
  return (
    <div className="list-meta">
      <span>{loading ? "조회 중" : `${total.toLocaleString()}건`}</span>
      <span>{page} / {totalPages}</span>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="pagination">
      <button className="button button--ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)} type="button">
        이전
      </button>
      <button className="button button--ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} type="button">
        다음
      </button>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="loading-rows" aria-label="조회 중">
      <span />
      <span />
      <span />
    </div>
  );
}

function TextField({
  label,
  onChange,
  required,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <label className="field field--stack">
      <span>{label}{required ? " *" : ""}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} type={type} />
    </label>
  );
}

function SelectField<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
}) {
  return (
    <label className="field field--stack">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  monospace,
  onChange,
  rows,
  value,
}: {
  label: string;
  monospace?: boolean;
  onChange: (value: string) => void;
  rows: number;
  value: string;
}) {
  return (
    <label className="field field--stack">
      <span>{label}</span>
      <textarea
        className={monospace ? "monospace" : ""}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function CheckboxField({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox-field">
      <input checked={checked} onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span>{label}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-badge--${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}

function statusLabel(status: string) {
  switch (status) {
    case "PENDING":
      return "검수 대기";
    case "APPROVED":
      return "승인";
    case "REJECTED":
      return "반려";
    case "DUPLICATE":
      return "중복";
    case "CANCELLED":
      return "취소";
    case "REVIEW_REQUIRED":
      return "검수 필요";
    case "EXPIRED":
      return "마감";
    case "ACTIVE":
      return "활성";
    case "SUSPENDED":
      return "정지";
    case "BANNED":
      return "추방";
    default:
      return status;
  }
}
