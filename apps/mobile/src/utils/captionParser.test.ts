import { describe, expect, it } from 'vitest';

import { parseSubmissionCaption } from './captionParser';

describe('parseSubmissionCaption', () => {
  const referenceDate = new Date('2026-07-03T00:00:00+09:00');

  it('extracts a schedule row from a monthly gonggu caption', () => {
    const caption = [
      '🌊 7월 뷰티더람 공구 일정 OPEN 🌊',
      '',
      '📍7/2 ~ 7/4 보떼덤',
      '📍7/6 ~ 7/8 일론',
      '7월도 인기 브랜드들과 함께합니다',
    ].join('\n');

    expect(parseSubmissionCaption(caption, { referenceDate })).toMatchObject({
      productName: '보떼덤 공구',
      brandName: '보떼덤',
      startDate: '2026-07-02',
      endDate: '2026-07-04',
    });
  });

  it('extracts product, brand, discount, and purchase url from sales copy', () => {
    const caption = [
      '이동아 X 스쿳앤라이드',
      '스쿳앤라이드 킥보드 푸쉬앤고 최초공구',
      '정가 229,000원 -> 29% 163,560원~',
      '시작일 2026.07.01',
      '종료일 2026.07.02',
      'https://example.com/deal',
    ].join('\n');

    expect(parseSubmissionCaption(caption, { referenceDate })).toMatchObject({
      productName: '스쿳앤라이드 킥보드 푸쉬앤고 최초공구',
      brandName: '이동아',
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      discountInfo: '정가 229,000원 -> 29% 163,560원~',
      purchaseUrl: 'https://example.com/deal',
    });
  });

  it('falls back to the account name when no brand is found', () => {
    expect(
      parseSubmissionCaption('신상 선크림 공구\n마감 7/10', {
        referenceDate,
        fallbackBrandName: 'beauty_theram',
      }),
    ).toMatchObject({
      productName: '신상 선크림 공구',
      brandName: 'beauty_theram',
      endDate: '2026-07-10',
    });
  });
});
