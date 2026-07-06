import { describe, it, expect } from 'vitest';

import { searchInfluencers } from '../utils/search';
import type { Influencer } from '../types';

const mockInfluencers: Influencer[] = [
  { id: 'inf-1', instagramUsername: 'fashionista_kim', displayName: '패셔니스타 김', isActive: true },
  { id: 'inf-2', instagramUsername: 'beauty_lee', displayName: '뷰티 리', isActive: true },
  { id: 'inf-3', instagramUsername: 'food_chung', displayName: null, isActive: true },
  { id: 'inf-4', instagramUsername: 'travel_park', displayName: '여행가 박', isActive: false },
];

describe('searchInfluencers', () => {
  it('returns empty array for empty query', () => {
    expect(searchInfluencers(mockInfluencers, '')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchInfluencers(mockInfluencers, '   ')).toEqual([]);
  });

  it('filters by username (case-insensitive)', () => {
    const results = searchInfluencers(mockInfluencers, 'fashion');
    expect(results).toHaveLength(1);
    expect(results[0].instagramUsername).toBe('fashionista_kim');
  });

  it('filters by display name', () => {
    const results = searchInfluencers(mockInfluencers, '패셔니스타');
    expect(results).toHaveLength(1);
    expect(results[0].instagramUsername).toBe('fashionista_kim');
  });

  it('matches display name ignoring spacing', () => {
    // displayName "패셔니스타 김" — 띄어쓰기 유무와 관계없이 매칭
    expect(searchInfluencers(mockInfluencers, '패셔니스타김')).toHaveLength(1);
    expect(searchInfluencers(mockInfluencers, '패 셔 니 스 타 김')).toHaveLength(1);
    expect(searchInfluencers(mockInfluencers, '스타김')).toHaveLength(1);
  });

  it('strips leading @ from query', () => {
    const results = searchInfluencers(mockInfluencers, '@beauty');
    expect(results).toHaveLength(1);
    expect(results[0].instagramUsername).toBe('beauty_lee');
  });

  it('finds partial matches in username', () => {
    const results = searchInfluencers(mockInfluencers, 'chung');
    expect(results).toHaveLength(1);
    expect(results[0].instagramUsername).toBe('food_chung');
  });

  it('returns multiple matches', () => {
    const results = searchInfluencers(mockInfluencers, 'a');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('returns no results for non-matching query', () => {
    const results = searchInfluencers(mockInfluencers, 'xyz');
    expect(results).toHaveLength(0);
  });

  it('handles influencers with null displayName gracefully', () => {
    const results = searchInfluencers(mockInfluencers, 'chung');
    expect(results).toHaveLength(1);
    expect(results[0].displayName).toBeNull();
  });
});
