import { describe, it, expect } from 'vitest';

import { pushRecentTerm } from '../utils/search';

describe('pushRecentTerm — 최근 검색어 큐', () => {
  it('새 검색어를 맨 앞에 추가한다', () => {
    expect(pushRecentTerm(['a', 'b'], 'c', 10)).toEqual(['c', 'a', 'b']);
  });

  it('빈 문자열/공백은 무시한다', () => {
    expect(pushRecentTerm(['a', 'b'], '', 10)).toEqual(['a', 'b']);
    expect(pushRecentTerm(['a', 'b'], '   ', 10)).toEqual(['a', 'b']);
  });

  it('양끝 공백은 trim 해서 저장한다', () => {
    expect(pushRecentTerm([], '  린넨  ', 10)).toEqual(['린넨']);
  });

  it('이미 있는 검색어는 맨 앞으로 옮긴다 (중복 제거 후 선두 배치)', () => {
    expect(pushRecentTerm(['a', 'b', 'c'], 'b', 10)).toEqual(['b', 'a', 'c']);
  });

  it('최대 개수를 초과하면 가장 오래된 것(끝)부터 제거한다', () => {
    // 10개 꽉 찬 상태에서 새 항목 추가 → 끝 항목 1개 제거
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`); // ['t0'..'t9']
    const next = pushRecentTerm(ten, 'new', 10);
    expect(next).toHaveLength(10);
    expect(next[0]).toBe('new');
    // 가장 오래된 t9 가 제거되고, t0..t8 은 뒤로 밀린다
    expect(next).toEqual(['new', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8']);
    expect(next).not.toContain('t9');
  });

  it('초과 상태에서 기존 항목을 다시 검색하면 길이는 유지되고 그 항목이 선두로', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`);
    const next = pushRecentTerm(ten, 't5', 10);
    expect(next).toHaveLength(10);
    expect(next[0]).toBe('t5');
    // 기존 항목 재검색이므로 제거는 발생하지 않는다 (길이 유지, t9도 보존)
    expect(next).toContain('t9');
    expect(next.filter((s) => s === 't5')).toHaveLength(1);
  });

  it('최대 10개까지 모두 보관한다', () => {
    let prev: string[] = [];
    for (let i = 0; i < 10; i++) {
      prev = pushRecentTerm(prev, `term${i}`, 10);
    }
    expect(prev).toHaveLength(10);
    expect(prev[0]).toBe('term9');
    expect(prev[9]).toBe('term0');
  });
});
