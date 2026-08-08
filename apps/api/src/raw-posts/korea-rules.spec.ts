import { classifyKoreaCaption } from "./korea-rules";

describe("classifyKoreaCaption", () => {
  it("accepts two Korean market signals", () => {
    expect(classifyKoreaCaption("국내 배송 공구 10,000원")).toMatchObject({
      hangul: true,
      krwPrice: true,
      domesticCommerce: true,
      signalCount: 3,
      isKoreaCandidate: true,
    });
  });

  it("rejects a caption with only one signal", () => {
    expect(classifyKoreaCaption("공구 now available")).toMatchObject({
      signalCount: 1,
      isKoreaCandidate: false,
    });
  });
});
