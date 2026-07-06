/**
 * 검색 로직 테스트 — 실제 API 데이터 구조를 기반으로 검색이 정확히 동작하는지 검증.
 *
 * searchInfluencers: 인플루언서 검색 (username, displayName 매칭)
 * SearchScreen dealResults: 공구 검색 (productName, brandName, username 매칭)
 */
import { describe, it, expect } from 'vitest';

import { searchInfluencers, normalizeForSearch } from '../../utils/search';
import { expectedInfluencers, expectedGroupBuys } from './realApiData';
import type { GroupBuy } from '../../types';

describe('검색 로직 — 실제 데이터 기반', () => {
  const influencers = expectedInfluencers;

  describe('searchInfluencers', () => {
    it('username으로 정확히 검색된다', () => {
      const results = searchInfluencers(influencers, 'some_influencer');
      expect(results).toHaveLength(1);
      expect(results[0].instagramUsername).toBe('some_influencer');
    });

    it('@ 접두사를 붙여도 동일하게 검색된다', () => {
      const results = searchInfluencers(influencers, '@linen_closet');
      expect(results).toHaveLength(1);
      expect(results[0].instagramUsername).toBe('linen_closet');
    });

    it('displayName으로 검색된다', () => {
      const results = searchInfluencers(influencers, '린넨');
      expect(results).toHaveLength(1);
      expect(results[0].displayName).toBe('린넨클로젯');
    });

    it('username 부분 일치로 검색된다', () => {
      const results = searchInfluencers(influencers, 'linen');
      expect(results).toHaveLength(1);
      expect(results[0].instagramUsername).toBe('linen_closet');
    });

    it('빈 쿼리는 빈 배열을 반환한다', () => {
      expect(searchInfluencers(influencers, '')).toEqual([]);
      expect(searchInfluencers(influencers, '   ')).toEqual([]);
    });

    it('대소문자 구분 없이 검색된다', () => {
      const results = searchInfluencers(influencers, 'SOME_INFLUENCER');
      expect(results).toHaveLength(1);
    });

    it('매칭되는 결과가 없으면 빈 배열을 반환한다', () => {
      expect(searchInfluencers(influencers, '존재하지않는유저')).toEqual([]);
    });

    it('null displayName을 가진 인플루언서도 크래시하지 않는다', () => {
      const nullDisplayInf = [
        { id: '1', instagramUsername: 'test_user', displayName: null, isActive: true },
      ];
      const results = searchInfluencers(nullDisplayInf, 'test');
      expect(results).toHaveLength(1);
    });
  });

  describe('공구 검색 (SearchScreen dealResults 로직)', () => {
    // SearchScreen 내부의 dealResults useMemo 로직과 동일한 필터링
    function searchDeals(groupBuys: GroupBuy[], query: string) {
      // 띄어쓰기를 무시하고 매칭한다 (SearchScreen normalizeForSearch 적용과 동일)
      const q = normalizeForSearch(query);
      if (!q) return [];
      return groupBuys.filter((gb) => {
        const name = normalizeForSearch(gb.productName ?? '');
        const brand = normalizeForSearch(gb.brandName ?? '');
        const user = normalizeForSearch(gb.rawPost.influencer.instagramUsername);
        return name.includes(q) || brand.includes(q) || user.includes(q);
      });
    }

    it('제품명으로 검색된다', () => {
      const results = searchDeals(expectedGroupBuys, '린넨');
      expect(results).toHaveLength(1);
      expect(results[0].productName).toBe('여름 린넨 원피스');
    });

    it('띄어쓰기를 달리해도 제품명으로 검색된다', () => {
      // "여름 린넨 원피스" → 띄어쓰기 유무와 관계없이 매칭
      expect(searchDeals(expectedGroupBuys, '여름린넨원피스')).toHaveLength(1);
      expect(searchDeals(expectedGroupBuys, '여 름 린 넨')).toHaveLength(1);
      expect(searchDeals(expectedGroupBuys, '여 름 린 넨 원 피 스')).toHaveLength(1);
    });

    it('띄어쓰기가 없는 브랜드명은 띄어쓰기 쿼리로도 매칭된다', () => {
      expect(searchDeals(expectedGroupBuys, '린넨클로젯')).toHaveLength(1);
      expect(searchDeals(expectedGroupBuys, '린 넨 클 로 젯')).toHaveLength(1);
    });

    it('브랜드명으로 검색된다', () => {
      const results = searchDeals(expectedGroupBuys, '글로우스킨');
      expect(results).toHaveLength(1);
      expect(results[0].brandName).toBe('글로우스킨');
    });

    it('인플루언서 username으로 검색된다', () => {
      const results = searchDeals(expectedGroupBuys, 'linen_closet');
      expect(results).toHaveLength(1);
      expect(results[0].rawPost.influencer.instagramUsername).toBe('linen_closet');
    });

    it('동일 인플루언서의 공구가 여러 개면 모두 반환한다', () => {
      // some_influencer는 테스트 제품과 클렌징 오일 2개 공구를 가짐
      const results = searchDeals(expectedGroupBuys, 'some_influencer');
      expect(results).toHaveLength(2);
    });

    it('빈 쿼리는 빈 배열을 반환한다', () => {
      expect(searchDeals(expectedGroupBuys, '')).toEqual([]);
    });

    it('매칭되는 결과가 없으면 빈 배열을 반환한다', () => {
      expect(searchDeals(expectedGroupBuys, '존재하지않는제품')).toEqual([]);
    });

    it('null productName을 가진 공구도 크래시하지 않는다', () => {
      const nullNameDeal = [
        { ...expectedGroupBuys[0], productName: null },
      ];
      const results = searchDeals(nullNameDeal, '테스트');
      // productName이 null이어도 brandName에 '테스트 브랜드'가 매칭됨
      expect(results).toHaveLength(1);
    });
  });
});
