import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/supabase/client", () => ({
  adminRuntimeConfig: {
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "test-anon-key",
  },
  supabase: {},
}));

import { GroupBuyEditor, groupBuyToForm } from "../App";
import type { GroupBuy } from "../types";

describe("GroupBuyEditor profile link candidates", () => {
  it("keeps the Instagram source separate and lets a reviewer choose a purchase URL", () => {
    const selected = {
      id: "group-buy-1",
      productName: "테스트 공구",
      brandName: "테스트 브랜드",
      instagramUsername: "seller_one",
      profileImageUrl: null,
      originalPostUrl: "https://www.instagram.com/p/source-post/",
      category: "living",
      startDate: "2026-08-11",
      endDate: "2026-08-20",
      purchaseUrl: null,
      discountInfo: null,
      priceKrw: null,
      summary: "자동 수집 검수",
      thumbnailUrl: null,
      mediaUrls: [],
      mediaItems: [],
      mediaType: "IMAGE",
      status: "REVIEW_REQUIRED",
      sourceType: "PLAYWRIGHT_PUBLIC",
      collectionReviewStatus: "PENDING",
      collectionProposalSnapshot: {
        originalPostUrl: "https://www.instagram.com/p/source-post/",
        profileLinkCandidates: [
          { url: "https://shop.example/item", label: "스마트스토어" },
          { url: "https://link.example/profile", label: "링크 모음" },
        ],
      },
      collectionReviewedSnapshot: null,
      collectionHikerUsed: false,
      collectionHikerLookupAt: null,
      collectionRulesetVersion: "test-v3",
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
      isHomeBanner: false,
      homeBannerStartDate: null,
      homeBannerEndDate: null,
    } as unknown as GroupBuy;
    const form = groupBuyToForm(selected);
    const onChange = vi.fn();

    render(
      <GroupBuyEditor
        actionLoading={false}
        automaticCollection
        form={form}
        hikerLookupLoading={false}
        onApprove={vi.fn()}
        onChange={onChange}
        onClose={vi.fn()}
        onLookupHiker={vi.fn()}
        onReject={vi.fn()}
        onRejectReasonChange={vi.fn()}
        onSave={vi.fn()}
        onToggleVisibility={vi.fn()}
        rejectReason=""
        selected={selected}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Instagram 원본" }).getAttribute("href"),
    ).toBe("https://www.instagram.com/p/source-post/");
    expect(
      screen
        .getByRole("link", { name: "스마트스토어 새 창에서 열기" })
        .getAttribute("href"),
    ).toBe("https://shop.example/item");

    fireEvent.click(
      screen.getAllByRole("button", { name: "구매 URL로 사용" })[0],
    );

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ purchaseUrl: "https://shop.example/item" }),
    );
  });
});
