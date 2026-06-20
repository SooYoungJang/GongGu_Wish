import { Metadata } from "next";
import SubmitForm from "./SubmitForm";

export const metadata: Metadata = {
  title: "공구 제보하기 | GongGu Wish",
  description: "발견한 공동구매 정보를 제보해주세요. 운영자 승인 후 캘린더에 반영됩니다.",
  openGraph: {
    title: "공구 제보하기 | GongGu Wish",
    description: "발견한 공동구매 정보를 제보해주세요. 운영자 승인 후 캘린더에 반영됩니다.",
    type: "website",
    locale: "ko_KR",
  },
  twitter: {
    card: "summary",
    title: "공구 제보하기 | GongGu Wish",
    description: "발견한 공동구매 정보를 제보해주세요.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SubmitPage() {
  return <SubmitForm />;
}