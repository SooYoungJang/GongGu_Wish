export type HomeBannerFormFields = {
  isHomeBanner: boolean;
  homeBannerStartDate: string;
  homeBannerEndDate: string;
};

export function validateHomeBannerForm(form: HomeBannerFormFields): string | null {
  if (!form.isHomeBanner) return null;

  if (!form.homeBannerStartDate || !form.homeBannerEndDate) {
    return "홈 배너 노출 시작일과 종료일을 모두 선택해주세요.";
  }

  if (form.homeBannerStartDate > form.homeBannerEndDate) {
    return "홈 배너 노출 종료일은 시작일과 같거나 이후여야 합니다.";
  }

  return null;
}
