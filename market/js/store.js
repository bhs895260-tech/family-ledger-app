// localStorage 기반 저장소. 모든 쓰기는 domain.js 규칙을 통과해야 하며,
// 저장 직전에 채널 불변식(매물당 채널 하나)을 검사한다.
import {
  createListing, closeListing, changeChannel as domainChangeChannel, createBuyer,
  assertChannelInvariant, CHANNEL, POOL, OPERATION,
} from './domain.js';

const KEY_LISTINGS = 'bm.listings.v1';
const KEY_BUYERS = 'bm.buyers.v1';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 불가 환경 */ }
}

export function allListings() { return read(KEY_LISTINGS); }
export function allBuyers() { return read(KEY_BUYERS); }

function saveListings(listings) {
  assertChannelInvariant(listings);
  write(KEY_LISTINGS, listings);
}

export function addListing(input, channel) {
  const listing = createListing(input, channel);
  saveListings([listing, ...allListings()]);
  return listing;
}

export function getListing(id) {
  return allListings().find((l) => l.id === id) || null;
}

function replaceListing(updated) {
  const next = allListings().map((l) => (l.id === updated.id ? updated : l));
  saveListings(next);
  return updated;
}

export function closeListingById(id) {
  const l = getListing(id);
  if (!l) throw new Error('매물을 찾을 수 없습니다');
  return replaceListing(closeListing(l));
}

export function changeListingChannel(id, newChannel) {
  const l = getListing(id);
  if (!l) throw new Error('매물을 찾을 수 없습니다');
  return replaceListing(domainChangeChannel(l, newChannel));
}

export function addBuyer(input) {
  const buyer = createBuyer(input);
  write(KEY_BUYERS, [buyer, ...allBuyers()]);
  return buyer;
}

export function clearAll() {
  localStorage.removeItem(KEY_LISTINGS);
  localStorage.removeItem(KEY_BUYERS);
}

/** 데모용 샘플 데이터. 직거래 4건, 컨설팅 2건, 매수자 3명. */
export function seedDemo() {
  const base = {
    contact: '010-1234-5678',
    flags: { publicOk: true, ownerHandlesInquiry: true, saleKnownOk: true },
  };
  const direct = [
    { ...base, name: '해운대 김밥천국 분식', sido: '부산', sigungu: '해운대구', category: '분식', monthlySales: 1300, monthlyProfit: 320, deposit: 1000, premium: 1500, rent: 110, operation: OPERATION.OWNER, description: '1인 운영 가능. 점심 위주.' },
    { ...base, name: '사상 치킨호프', sido: '부산', sigungu: '사상구', category: '치킨', monthlySales: 1800, monthlyProfit: 380, deposit: 1500, premium: 2000, rent: 130, operation: OPERATION.OWNER, description: '배달 비중 60%.' },
    { ...base, name: '마포 소형 카페', sido: '서울', sigungu: '마포구', category: '카페', monthlySales: 900, monthlyProfit: 200, deposit: 2000, premium: 1500, rent: 150, operation: OPERATION.AUTO, description: '오토 가능. 직원 1명 인수 가능.' },
    { ...base, name: '수원 무인 아이스크림', sido: '경기', sigungu: '수원시', category: '무인점포', monthlySales: 600, monthlyProfit: 180, deposit: 3000, premium: 4500, rent: 90, operation: OPERATION.AUTO, description: '총 7,500. 오토 운영.' },
  ];
  const consulting = [
    { ...base, name: '서면 대형 고깃집', sido: '부산', sigungu: '부산진구', category: '한식', monthlySales: 8500, monthlyProfit: 1500, deposit: 10000, premium: 15000, rent: 600, operation: OPERATION.OWNER, flags: { ...base.flags, wantsPrivate: true, staffExposureRisk: true } },
    { ...base, name: '강남 프랜차이즈 카페', sido: '서울', sigungu: '강남구', category: '카페', monthlySales: 4200, monthlyProfit: 800, deposit: 5000, premium: 8000, rent: 450, operation: OPERATION.AUTO, flags: { ...base.flags, complexContract: true, competitorRisk: true } },
  ];
  const listings = [
    ...direct.map((d) => createListing(d, CHANNEL.DIRECT)),
    ...consulting.map((c) => createListing(c, CHANNEL.CONSULTING)),
  ];
  const buyers = [
    { name: '김매수', contact: '010-1111-2222', sido: '부산', sigungu: '', category: '치킨', budgetMax: 4000, rentMax: 150, targetProfit: 300, operation: OPERATION.OWNER },
    { name: '이소자본', contact: '010-3333-4444', sido: '부산', sigungu: '해운대', category: '', budgetMax: 3000, rentMax: 120, targetProfit: 250, operation: OPERATION.ANY },
    { name: '박오토', contact: '010-5555-6666', sido: '서울', sigungu: '', category: '카페', budgetMax: 5000, rentMax: 200, targetProfit: 0, operation: OPERATION.AUTO },
    { name: '(비공개) 최투자', contact: '010-7777-8888', sido: '부산', sigungu: '', category: '', budgetMax: 30000, rentMax: 0, targetProfit: 1000, operation: OPERATION.AUTO, pool: POOL.CONSULTING },
  ].map((b) => createBuyer(b));
  saveListings([...listings, ...allListings()]);
  write(KEY_BUYERS, [...buyers, ...allBuyers()]);
  return { listings: listings.length, buyers: buyers.length };
}
