import { Component, type KeyboardEvent } from "react";

type PreviewTab = "home" | "card" | "detail";

export interface AppLivePreviewDeal {
  productName: string;
  brandName: string;
  category: string;
  startDate: string;
  endDate: string;
  discountInfo: string;
  priceKrw: number | null;
  summary: string;
  imageUrl: string;
  mediaCount: number;
  isHomeBanner: boolean;
  homeBannerStartDate: string;
  homeBannerEndDate: string;
}

interface AppLivePreviewProps {
  deal: AppLivePreviewDeal;
}

interface AppLivePreviewState {
  activeTab: PreviewTab;
}

const previewTabs: Array<{ id: PreviewTab; label: string }> = [
  { id: "home", label: "홈 배너" },
  { id: "card", label: "공구 카드" },
  { id: "detail", label: "상세 화면" },
];

const wonFormatter = new Intl.NumberFormat("ko-KR");
let previewInstanceCount = 0;

function formatPrice(priceKrw: number | null) {
  return typeof priceKrw === "number" ? `${wonFormatter.format(priceKrw)}원` : "가격 미정";
}

function formatWeeklyDeadline(value: string, now = new Date()) {
  if (!value || value === "미정") return "마감일 미정";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "마감일 확인 필요";

  const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  return days === 0 ? "오늘 마감" : `${days}일 남음`;
}

type HomeBannerCopy = {
  accentLabel: string;
  detailLabel?: string;
  secondaryLabel?: string;
};

function parsePreviewDate(value: string, endOfDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLegacyPrice(discountInfo: string) {
  return discountInfo.match(/(?:\d{1,3}(?:,\d{3})+|\d{4,})\s*원/)?.[0].replace(/\s+/g, "") ?? null;
}

function getHomeBannerCopy(deal: AppLivePreviewDeal, now = new Date()): HomeBannerCopy {
  const startDate = parsePreviewDate(deal.startDate);
  const endDate = parsePreviewDate(deal.endDate, true);

  if (endDate && endDate.getTime() < now.getTime()) {
    return { accentLabel: "공구 종료" };
  }

  const price = deal.priceKrw === null ? getLegacyPrice(deal.discountInfo) : formatPrice(deal.priceKrw);
  const discountPercent = deal.discountInfo.match(/(?:^|\D)(\d{1,3})\s*%/)?.[1] ?? null;

  if (startDate && startDate.getTime() > now.getTime()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const daysUntilStart = Math.max(0, Math.round((startDay.getTime() - today.getTime()) / 86_400_000));
    return {
      accentLabel: daysUntilStart === 0 ? "오늘" : `D+${daysUntilStart}`,
      detailLabel: `${startDate.getMonth() + 1}/${startDate.getDate()} 시작`,
      secondaryLabel: price ?? "가격 공개 예정",
    };
  }

  if (discountPercent) {
    return {
      accentLabel: `${discountPercent}%`,
      detailLabel: price ?? "상세에서 가격 확인",
    };
  }

  return {
    accentLabel: "공구 진행 중",
    detailLabel: price ?? "상세에서 가격 확인",
  };
}

function getBannerPeriodStatus(deal: AppLivePreviewDeal) {
  if (!deal.homeBannerStartDate || !deal.homeBannerEndDate) {
    return "배너 기간 미설정";
  }

  const now = Date.now();
  const start = new Date(`${deal.homeBannerStartDate}T00:00:00`).getTime();
  const end = new Date(`${deal.homeBannerEndDate}T23:59:59`).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "배너 기간 확인 필요";
  }

  if (now < start) {
    return "배너 예약";
  }

  if (now > end) {
    return "배너 기간 종료";
  }

  return "배너 기간 내";
}

function PreviewImage({
  deal,
  className,
  fallbackLabel = "이미지 없음",
}: {
  deal: AppLivePreviewDeal;
  className: string;
  fallbackLabel?: string;
}) {
  if (!deal.imageUrl) {
    return (
      <div className={`${className} app-live-preview__image-placeholder`} aria-label="이미지 미리보기 없음">
        {fallbackLabel}
      </div>
    );
  }

  return <img className={className} src={deal.imageUrl} alt={`${deal.productName} 미리보기`} />;
}

export class AppLivePreview extends Component<AppLivePreviewProps, AppLivePreviewState> {
  private readonly baseId = `app-live-preview-${++previewInstanceCount}`;

  state: AppLivePreviewState = {
    activeTab: "home",
  };

  private selectTab = (activeTab: PreviewTab) => {
    this.setState({ activeTab }, () => {
      document.getElementById(`${this.baseId}-${activeTab}-tab`)?.focus();
    });
  };

  private handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: PreviewTab) => {
    const currentIndex = previewTabs.findIndex((tab) => tab.id === currentTab);
    const lastIndex = previewTabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    this.selectTab(previewTabs[nextIndex].id);
  };

  render() {
    const { deal } = this.props;
    const { activeTab } = this.state;
    const priceText = formatPrice(deal.priceKrw);
    const bannerExposure = deal.isHomeBanner ? "홈 배너 노출" : "홈 배너 미노출";
    const bannerPeriodStatus = getBannerPeriodStatus(deal);
    const homeBannerCopy = getHomeBannerCopy(deal);
    const activeTabLabel = previewTabs.find((tab) => tab.id === activeTab)?.label ?? "홈 배너";

    return (
      <section className="app-live-preview" aria-label="앱 라이브 프리뷰">
        <div className="app-live-preview__header">
          <div>
            <p className="app-live-preview__eyebrow">실시간 앱 화면</p>
            <h2 className="app-live-preview__title">앱 라이브 프리뷰</h2>
          </div>
          <div className="app-live-preview__status-group" aria-label="홈 배너 상태">
            <span className="app-live-preview__status">{bannerExposure}</span>
            <span className="app-live-preview__status app-live-preview__status--period">
              {bannerPeriodStatus}
            </span>
          </div>
        </div>

        <div className="app-live-preview__tabs" role="tablist" aria-label="앱 라이브 프리뷰">
          {previewTabs.map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`${this.baseId}-${tab.id}-tab`}
                className={
                  selected
                    ? "app-live-preview__tab app-live-preview__tab--active"
                    : "app-live-preview__tab"
                }
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${this.baseId}-${tab.id}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => this.selectTab(tab.id)}
                onKeyDown={(event) => this.handleTabKeyDown(event, tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div
          id={`${this.baseId}-${activeTab}-panel`}
          className={`app-live-preview__panel app-live-preview__panel--${activeTab}`}
          role="tabpanel"
          aria-labelledby={`${this.baseId}-${activeTab}-tab`}
        >
          {activeTab === "home" ? (
            <HomeBannerPreview
              deal={deal}
              priceText={priceText}
              bannerExposure={bannerExposure}
              bannerPeriodStatus={bannerPeriodStatus}
              copy={homeBannerCopy}
            />
          ) : null}
          {activeTab === "card" ? <DealCardPreview deal={deal} /> : null}
          {activeTab === "detail" ? (
            <DetailScreenPreview
              deal={deal}
              priceText={priceText}
              activeTabLabel={activeTabLabel}
            />
          ) : null}
        </div>
      </section>
    );
  }
}

function HomeBannerPreview({
  deal,
  priceText,
  bannerExposure,
  bannerPeriodStatus,
  copy,
}: {
  deal: AppLivePreviewDeal;
  priceText: string;
  bannerExposure: string;
  bannerPeriodStatus: string;
  copy: HomeBannerCopy;
}) {
  return (
    <article className="app-live-preview__home-banner" aria-label="홈 배너 미리보기">
      <PreviewImage deal={deal} className="app-live-preview__home-banner-image" />
      <div className="app-live-preview__home-banner-overlay" aria-hidden="true" />
      <span className="app-live-preview__home-banner-counter">1 / 1</span>
      <div className="app-live-preview__home-banner-content">
        <h3 className="app-live-preview__home-banner-title">{deal.productName}</h3>
        <div className="app-live-preview__home-banner-status">
          <strong>{copy.accentLabel}</strong>
          {copy.detailLabel ? <span>{copy.detailLabel}</span> : null}
        </div>
        {copy.secondaryLabel ? (
          <p className="app-live-preview__home-banner-secondary">{copy.secondaryLabel}</p>
        ) : null}
        <span className="app-live-preview__sr-only">{bannerExposure} · {bannerPeriodStatus} · {priceText}</span>
      </div>
    </article>
  );
}

function DealCardPreview({ deal }: { deal: AppLivePreviewDeal }) {
  const fallbackLabel = (deal.brandName || deal.productName || "공구").slice(0, 2);

  return (
    <article className="app-live-preview__deal-card" aria-label="공구 카드 미리보기">
      <div className="app-live-preview__deal-card-image-wrap">
        <PreviewImage
          deal={deal}
          className="app-live-preview__deal-card-image"
          fallbackLabel={fallbackLabel}
        />
        {deal.discountInfo ? (
          <span className="app-live-preview__deal-card-sale-badge">{deal.discountInfo}</span>
        ) : null}
        <span className="app-live-preview__deal-card-deadline-badge">
          {formatWeeklyDeadline(deal.endDate)}
        </span>
      </div>
      <div className="app-live-preview__deal-card-content">
        <p className="app-live-preview__deal-card-brand">{deal.brandName || "브랜드 미지정"}</p>
        <h3 className="app-live-preview__deal-card-title">{deal.productName}</h3>
      </div>
    </article>
  );
}

function DetailScreenPreview({
  deal,
  priceText,
  activeTabLabel,
}: {
  deal: AppLivePreviewDeal;
  priceText: string;
  activeTabLabel: string;
}) {
  return (
    <article className="app-live-preview__detail" aria-label={`${activeTabLabel} 미리보기`}>
      <PreviewImage deal={deal} className="app-live-preview__detail-media" />
      <div className="app-live-preview__detail-body">
        <div className="app-live-preview__detail-meta">
          <span>{deal.brandName}</span>
          <span>{deal.category}</span>
          <span>미디어 {deal.mediaCount}개</span>
        </div>
        <h3 className="app-live-preview__detail-title">{deal.productName}</h3>
        <p className="app-live-preview__detail-price">{priceText}</p>
        <p className="app-live-preview__detail-summary">{deal.summary}</p>
        <div className="app-live-preview__detail-schedule">
          <span>시작 {deal.startDate}</span>
          <span>마감 {deal.endDate}</span>
        </div>
        <button className="app-live-preview__detail-cta" type="button" disabled>
          구매하러 가기
        </button>
      </div>
    </article>
  );
}
