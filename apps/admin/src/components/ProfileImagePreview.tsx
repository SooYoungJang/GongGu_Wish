import { useEffect, useState } from "react";

type ProfileImagePreviewProps = {
  className?: string;
  instagramUsername: string | null | undefined;
  profileImageUrl: string | null | undefined;
};

export function ProfileImagePreview({
  className = "",
  instagramUsername,
  profileImageUrl,
}: ProfileImagePreviewProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const normalizedUsername = (instagramUsername ?? "")
    .trim()
    .replace(/^@+/, "");
  const handle = normalizedUsername ? `@${normalizedUsername}` : "인스타그램";
  const normalizedImageUrl = profileImageUrl?.trim() ?? "";

  useEffect(() => {
    setImageFailed(false);
  }, [normalizedImageUrl]);

  const rootClassName = ["profile-image-preview", className]
    .filter(Boolean)
    .join(" ");

  if (!normalizedImageUrl || imageFailed) {
    const initial = normalizedUsername.slice(0, 1).toLocaleUpperCase() || "@";
    return (
      <span
        aria-label={`${handle} 프로필 이미지 없음`}
        className={`${rootClassName} profile-image-preview--fallback`}
        role="img"
      >
        <span aria-hidden="true">{initial}</span>
      </span>
    );
  }

  return (
    <span className={rootClassName}>
      <img
        alt={`${handle} 프로필 이미지`}
        className="profile-image-preview__image"
        onError={() => setImageFailed(true)}
        src={normalizedImageUrl}
      />
    </span>
  );
}
