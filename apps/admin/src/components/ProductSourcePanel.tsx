import { useState, type ReactNode } from "react";
import { formatInstagramHandle } from "@gonggu/shared/utils/instagram";
import { ProfileImagePreview } from "./ProfileImagePreview";

export function ProductSourcePanel({
  imageUrl,
  productName,
  instagramUsername,
  profileImageUrl,
  summary,
  mediaCount,
  mediaType,
  origin,
  hikerStatus,
  actions,
}: {
  imageUrl: string | null | undefined;
  productName: string;
  instagramUsername: string;
  profileImageUrl?: string | null;
  summary: string | null | undefined;
  mediaCount: number;
  mediaType: string;
  origin: string;
  hikerStatus?: string;
  actions?: ReactNode;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const showImage = imageUrl && failedImage !== imageUrl;

  return (
    <section className="product-source" aria-label="원본 게시물 확인">
      <div className="editor-column-heading">
        <span className="editor-column-step">01</span>
        <h2>원본 확인</h2>
        <span className="editor-column-meta">{origin}</span>
      </div>
      {actions ? (
        <div className="product-source__actions">{actions}</div>
      ) : null}
      <div className="product-source__visual">
        {showImage ? (
          <img
            alt={`${productName || "공구"} 원본 미디어`}
            decoding="async"
            key={imageUrl}
            loading="lazy"
            onError={() => setFailedImage(imageUrl)}
            src={imageUrl}
          />
        ) : (
          <div className="product-source__empty">원본 이미지가 없습니다.</div>
        )}
        <span className="product-source__media">
          {mediaType} · {mediaCount}개
        </span>
      </div>
      <div className="product-source__account">
        <ProfileImagePreview
          instagramUsername={instagramUsername}
          profileImageUrl={profileImageUrl}
        />
        <strong>
          {formatInstagramHandle(instagramUsername) || "계정 미확인"}
        </strong>
      </div>
      {summary ? (
        <details className="editor-disclosure">
          <summary>등록된 게시물 정보</summary>
          <p className="product-source__summary">{summary}</p>
        </details>
      ) : null}
      {hikerStatus ? (
        <div className="product-source__hiker" role="status">
          <strong>Hiker</strong>
          <span>{hikerStatus}</span>
          <p>조회 결과는 편집 폼과 앱 미리보기에 자동 반영됩니다.</p>
        </div>
      ) : null}
    </section>
  );
}
