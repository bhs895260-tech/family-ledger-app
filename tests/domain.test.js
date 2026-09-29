import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNEL, STATUS, POOL, OPERATION, THRESHOLDS, DIRECT_BLOCK_MESSAGE,
  classifyListing, createListing, closeListing, canChangeChannel, changeChannel,
  assertChannelInvariant, directListings, consultingListings, filterDirect,
  createBuyer, matchListingsForBuyer, matchBuyersForListing, formatManwon,
} from '../market/js/domain.js';

const directOk = {
  name: '테스트 분식', sido: '부산', sigungu: '해운대구', category: '분식',
  monthlySales: 1200, monthlyProfit: 300, deposit: 1000, premium: 2000, extra: 0, rent: 120,
  operation: OPERATION.OWNER, contact: '010-0000-0000',
  flags: { publicOk: true, ownerHandlesInquiry: true, saleKnownOk: true },
};

test('직거래 조건을 모두 충족하면 두 채널 모두 선택 가능', () => {
  const r = classifyListing(directOk);
  assert.equal(r.directBlocked, false);
  assert.deepEqual(r.channels, [CHANNEL.DIRECT, CHANNEL.CONSULTING]);
  assert.equal(r.message, '');
});

test('월매출·권리금·총양도가 기준 이상이면 직거래가 막힌다', () => {
  for (const patch of [
    { monthlySales: THRESHOLDS.monthlySales },
    { monthlyProfit: THRESHOLDS.monthlyProfit },
    { premium: THRESHOLDS.premium },
    { deposit: 8000, premium: 3000 }, // 총 1.1억
  ]) {
    const r = classifyListing({ ...directOk, ...patch });
    assert.equal(r.directBlocked, true, JSON.stringify(patch));
    assert.deepEqual(r.channels, [CHANNEL.CONSULTING]);
    assert.equal(r.message, DIRECT_BLOCK_MESSAGE);
  }
});

test('컨설팅 전용 플래그 하나라도 있으면 직거래가 막힌다', () => {
  for (const flag of ['wantsPrivate', 'staffExposureRisk', 'complexContract', 'competitorRisk', 'highTicketInvestor']) {
    const r = classifyListing({ ...directOk, flags: { ...directOk.flags, [flag]: true } });
    assert.equal(r.directBlocked, true, flag);
  }
});

test('공개 가능·직접 응대·매각 사실 공개 무방 중 하나라도 빠지면 직거래 불가', () => {
  for (const flag of ['publicOk', 'ownerHandlesInquiry', 'saleKnownOk']) {
    const r = classifyListing({ ...directOk, flags: { ...directOk.flags, [flag]: false } });
    assert.equal(r.directBlocked, true, flag);
  }
});

test('createListing은 분류 결과에 없는 채널을 거부한다', () => {
  const l = createListing(directOk, CHANNEL.DIRECT, 1);
  assert.equal(l.channel, CHANNEL.DIRECT);
  assert.equal(l.status, STATUS.ACTIVE);
  assert.equal(l.totalPrice, 3000);
  assert.throws(() => createListing({ ...directOk, premium: 9000 }, CHANNEL.DIRECT), /비공개 컨설팅 검토 대상/);
  assert.throws(() => createListing(directOk, 'BOTH'), /DIRECT 또는 CONSULTING/);
});

test('매물 하나는 채널 하나만 가진다 (불변식)', () => {
  const d = createListing(directOk, CHANNEL.DIRECT, 1);
  const c = createListing({ ...directOk, name: '고매출 카페', monthlySales: 8000, flags: {} }, CHANNEL.CONSULTING, 2);
  assert.ok(assertChannelInvariant([d, c]));
  assert.throws(() => assertChannelInvariant([d, { ...c, id: d.id }]), /ID 중복/);
  assert.throws(() => assertChannelInvariant([{ ...d, channel: 'BOTH' }]), /하나가 아닙니다/);
});

test('직거래 화면은 컨설팅 매물을, 컨설팅 화면은 직거래 매물을 절대 보지 못한다', () => {
  const d = createListing(directOk, CHANNEL.DIRECT, 1);
  const c = createListing({ ...directOk, name: '고매출 카페', monthlySales: 8000, flags: {} }, CHANNEL.CONSULTING, 2);
  const all = [d, c];
  assert.deepEqual(directListings(all).map((l) => l.id), [d.id]);
  assert.deepEqual(consultingListings(all).map((l) => l.id), [c.id]);
  assert.deepEqual(filterDirect(all, {}).map((l) => l.id), [d.id]);
});

test('채널 변경은 기존 판매채널 종료 후에만 가능하다', () => {
  const d = createListing(directOk, CHANNEL.DIRECT, 1);
  assert.equal(canChangeChannel(d, CHANNEL.CONSULTING).ok, false);
  assert.throws(() => changeChannel(d, CHANNEL.CONSULTING), /먼저 종료/);
  assert.equal(canChangeChannel(d, CHANNEL.DIRECT).ok, false);

  const closed = closeListing(d, 5);
  assert.equal(closed.status, STATUS.CLOSED);
  const moved = changeChannel(closed, CHANNEL.CONSULTING, 6);
  assert.equal(moved.channel, CHANNEL.CONSULTING);
  assert.equal(moved.status, STATUS.ACTIVE);
  assert.equal(moved.id, d.id);
  assert.equal(moved.channelHistory.length, 2);
});

test('종료했더라도 컨설팅 전용 조건이면 직거래로 되돌릴 수 없다', () => {
  const c = createListing({ ...directOk, monthlySales: 9000, flags: {} }, CHANNEL.CONSULTING, 1);
  const closed = closeListing(c, 2);
  const chk = canChangeChannel(closed, CHANNEL.DIRECT);
  assert.equal(chk.ok, false);
  assert.match(chk.reason, /비공개 컨설팅 검토 대상/);
});

test('직거래 필터: 5천 이하 / 1억 이하 / 업종 / 지역', () => {
  const a = createListing({ ...directOk, name: 'A', deposit: 1000, premium: 2000 }, CHANNEL.DIRECT, 1);           // 3000
  const b = createListing({ ...directOk, name: 'B', category: '카페', deposit: 3000, premium: 4000 }, CHANNEL.DIRECT, 2); // 7000
  const c = createListing({ ...directOk, name: 'C', sido: '서울', sigungu: '마포구', deposit: 2000, premium: 1000 }, CHANNEL.DIRECT, 3); // 3000
  const all = [a, b, c];
  assert.deepEqual(filterDirect(all, { maxPrice: 5000 }).map((l) => l.name).sort(), ['A', 'C']);
  assert.deepEqual(filterDirect(all, { maxPrice: 10000 }).length, 3);
  assert.deepEqual(filterDirect(all, { category: '카페' }).map((l) => l.name), ['B']);
  assert.deepEqual(filterDirect(all, { sido: '서울' }).map((l) => l.name), ['C']);
  assert.deepEqual(filterDirect(all, { sido: '부산', sigungu: '해운대' }).map((l) => l.name).sort(), ['A', 'B']);
});

test('자동매칭: 지역 + 예산 + 업종이 맞아야 하고, 컨설팅 매물은 절대 포함되지 않는다', () => {
  const d1 = createListing({ ...directOk, name: '부산 분식 3천' }, CHANNEL.DIRECT, 1);
  const d2 = createListing({ ...directOk, name: '부산 분식 6천', deposit: 3000, premium: 3000 }, CHANNEL.DIRECT, 2);
  const d3 = createListing({ ...directOk, name: '서울 분식', sido: '서울', sigungu: '' }, CHANNEL.DIRECT, 3);
  const c1 = createListing({ ...directOk, name: '부산 분식 컨설팅', flags: {} }, CHANNEL.CONSULTING, 4); // 금액은 예산 안
  const all = [d1, d2, d3, c1];

  const buyer = createBuyer({ contact: '010', sido: '부산', category: '분식', budgetMax: 4000, rentMax: 150, operation: OPERATION.OWNER }, 10);
  const res = matchListingsForBuyer(buyer, all);
  assert.deepEqual(res.map((r) => r.listing.name), ['부산 분식 3천']);
  assert.ok(res[0].score >= 60);

  const anyCat = createBuyer({ contact: '010', sido: '부산', category: '', budgetMax: 10000 }, 11);
  assert.deepEqual(matchListingsForBuyer(anyCat, all).map((r) => r.listing.name).sort(), ['부산 분식 3천', '부산 분식 6천']);
});

test('매물 기준 매수자 매칭은 직거래 풀만 보고, 컨설팅 매물에는 적용되지 않는다', () => {
  const d = createListing(directOk, CHANNEL.DIRECT, 1);
  const c = createListing({ ...directOk, flags: {} }, CHANNEL.CONSULTING, 2);
  const b1 = createBuyer({ contact: '1', sido: '부산', category: '분식', budgetMax: 5000 }, 1);
  const b2 = createBuyer({ contact: '2', sido: '부산', category: '분식', budgetMax: 5000, pool: POOL.CONSULTING }, 2);
  const b3 = createBuyer({ contact: '3', sido: '부산', category: '치킨', budgetMax: 5000 }, 3);
  const res = matchBuyersForListing(d, [b1, b2, b3]);
  assert.deepEqual(res.map((r) => r.buyer.id), [b1.id]);
  assert.throws(() => matchBuyersForListing(c, [b1, b2]), /컨설팅 매물에는/);
});

test('매수 등록 검증', () => {
  assert.throws(() => createBuyer({ contact: '1', sido: '', budgetMax: 3000 }), /지역/);
  assert.throws(() => createBuyer({ contact: '1', sido: '부산', budgetMax: 0 }), /총투자금/);
  assert.throws(() => createBuyer({ contact: '', sido: '부산', budgetMax: 100 }), /연락처/);
  const b = createBuyer({ contact: '1', sido: '부산', budgetMax: 3000 });
  assert.equal(b.pool, POOL.DIRECT);
});

test('금액 표시', () => {
  assert.equal(formatManwon(3000), '3,000만원');
  assert.equal(formatManwon(10000), '1억원');
  assert.equal(formatManwon(12500), '1억 2,500만원');
});
