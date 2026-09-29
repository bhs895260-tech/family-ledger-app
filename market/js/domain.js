// 직거래 / 컨설팅 시장 분리 도메인 규칙.
// 브라우저(ESM)와 Node(테스트)에서 동일하게 사용한다. DOM·저장소 의존 없음.

export const CHANNEL = Object.freeze({ DIRECT: 'DIRECT', CONSULTING: 'CONSULTING' });
export const STATUS = Object.freeze({ ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' });
export const POOL = Object.freeze({ DIRECT: 'DIRECT', CONSULTING: 'CONSULTING' });
export const OPERATION = Object.freeze({ OWNER: 'OWNER', AUTO: 'AUTO', ANY: 'ANY' });

// 금액 단위: 만원. 기준 이상이면 직거래 버튼을 막고 컨설팅 검토로 보낸다.
export const THRESHOLDS = Object.freeze({
  monthlySales: 3000,   // 월매출 3천만원 이상
  monthlyProfit: 700,   // 월순이익 700만원 이상
  premium: 5000,        // 권리금 5천만원 이상
  totalPrice: 10000,    // 총 양도가(보증금+권리금+기타) 1억 초과
});

export const DIRECT_BLOCK_MESSAGE = '이 매물은 비공개 컨설팅 검토 대상입니다';

export const REGIONS = Object.freeze([
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]);

export const CATEGORIES = Object.freeze([
  '한식', '중식', '일식', '양식', '분식', '치킨', '피자', '카페', '베이커리', '주점',
  '편의점', '마트', '미용', '네일', '피부관리', '헬스', '학원', '스터디카페', '무인점포', '세탁',
  '기타',
]);

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 매도 등록 입력을 정규화한다. 금액은 만원 단위 정수. */
export function normalizeListingInput(input = {}) {
  const deposit = num(input.deposit);
  const premium = num(input.premium);
  const extra = num(input.extra);
  const totalPrice = input.totalPrice != null && input.totalPrice !== ''
    ? num(input.totalPrice)
    : deposit + premium + extra;
  return {
    name: String(input.name || '').trim(),
    sido: String(input.sido || '').trim(),
    sigungu: String(input.sigungu || '').trim(),
    category: String(input.category || '').trim(),
    monthlySales: num(input.monthlySales),
    monthlyProfit: num(input.monthlyProfit),
    deposit,
    premium,
    extra,
    rent: num(input.rent),
    totalPrice,
    operation: input.operation || OPERATION.OWNER,
    description: String(input.description || '').trim(),
    contact: String(input.contact || '').trim(),
    flags: {
      publicOk: !!input.flags?.publicOk,             // 공개 노출 가능
      ownerHandlesInquiry: !!input.flags?.ownerHandlesInquiry, // 점주가 직접 문의 응대 가능
      saleKnownOk: !!input.flags?.saleKnownOk,       // 매각 사실이 알려져도 문제 없음
      wantsPrivate: !!input.flags?.wantsPrivate,     // 비공개 요청
      staffExposureRisk: !!input.flags?.staffExposureRisk, // 직원·고객 노출 곤란
      complexContract: !!input.flags?.complexContract,     // 본사·명의변경·계약구조 복잡
      competitorRisk: !!input.flags?.competitorRisk,       // 경쟁점 노출 위험
      highTicketInvestor: !!input.flags?.highTicketInvestor, // 고액 투자자 대상
    },
  };
}

/**
 * 1차 분류. 반환값:
 *  - channels: 선택 가능한 채널 목록
 *  - directBlocked: 직거래 버튼을 막아야 하는지
 *  - reasons: 직거래를 막은 사유 (사용자 안내용)
 */
export function classifyListing(rawInput) {
  const l = normalizeListingInput(rawInput);
  const reasons = [];
  const f = l.flags;

  if (l.monthlySales >= THRESHOLDS.monthlySales) reasons.push(`월매출 ${THRESHOLDS.monthlySales.toLocaleString()}만원 이상 (고매출)`);
  if (l.monthlyProfit >= THRESHOLDS.monthlyProfit) reasons.push(`월순이익 ${THRESHOLDS.monthlyProfit.toLocaleString()}만원 이상 (고수익)`);
  if (l.premium >= THRESHOLDS.premium) reasons.push(`권리금 ${THRESHOLDS.premium.toLocaleString()}만원 이상 (높은 권리금)`);
  if (l.totalPrice > THRESHOLDS.totalPrice) reasons.push(`총 양도가 ${THRESHOLDS.totalPrice.toLocaleString()}만원 초과`);

  if (f.wantsPrivate) reasons.push('비공개 요청');
  if (f.staffExposureRisk) reasons.push('직원·고객에게 매각 사실 노출 곤란');
  if (f.complexContract) reasons.push('본사·명의변경·계약구조가 복잡함');
  if (f.competitorRisk) reasons.push('경쟁점 노출 위험이 큼');
  if (f.highTicketInvestor) reasons.push('고액 투자자 대상');

  if (!f.publicOk) reasons.push('공개 노출 불가');
  if (!f.ownerHandlesInquiry) reasons.push('점주가 직접 문의 응대 불가');
  if (!f.saleKnownOk) reasons.push('매각 사실이 주변에 알려지면 곤란');

  const directBlocked = reasons.length > 0;
  return {
    channels: directBlocked ? [CHANNEL.CONSULTING] : [CHANNEL.DIRECT, CHANNEL.CONSULTING],
    directBlocked,
    reasons,
    message: directBlocked ? DIRECT_BLOCK_MESSAGE : '',
  };
}

let idSeq = 0;
export function newId(prefix) {
  idSeq += 1;
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function validateListing(l) {
  const errors = [];
  if (!l.name) errors.push('상호를 입력하세요');
  if (!REGIONS.includes(l.sido)) errors.push('지역(시/도)을 선택하세요');
  if (!CATEGORIES.includes(l.category)) errors.push('업종을 선택하세요');
  if (l.totalPrice <= 0) errors.push('총 양도가(보증금·권리금)를 입력하세요');
  if (!l.contact) errors.push('연락처를 입력하세요');
  return errors;
}

/**
 * 매물을 생성한다. 채널은 분류 결과에 포함된 것만 허용한다.
 * 매물 하나는 정확히 하나의 채널만 가진다.
 */
export function createListing(rawInput, channel, now = Date.now()) {
  if (channel !== CHANNEL.DIRECT && channel !== CHANNEL.CONSULTING) {
    throw new Error('채널은 DIRECT 또는 CONSULTING 중 하나여야 합니다');
  }
  const l = normalizeListingInput(rawInput);
  const errors = validateListing(l);
  if (errors.length) throw new Error(errors.join(', '));
  const cls = classifyListing(l);
  if (!cls.channels.includes(channel)) {
    throw new Error(`${DIRECT_BLOCK_MESSAGE}: ${cls.reasons.join(', ')}`);
  }
  return {
    id: newId('L'),
    channel,
    status: STATUS.ACTIVE,
    createdAt: now,
    updatedAt: now,
    closedAt: null,
    channelHistory: [{ channel, at: now }],
    ...l,
  };
}

export function closeListing(listing, now = Date.now()) {
  if (listing.status === STATUS.CLOSED) return listing;
  return { ...listing, status: STATUS.CLOSED, closedAt: now, updatedAt: now };
}

/** 채널 변경 가능 여부. 기존 판매채널을 종료한 뒤에만 가능하다. */
export function canChangeChannel(listing, newChannel) {
  if (newChannel !== CHANNEL.DIRECT && newChannel !== CHANNEL.CONSULTING) {
    return { ok: false, reason: '유효하지 않은 채널입니다' };
  }
  if (listing.channel === newChannel) {
    return { ok: false, reason: '이미 해당 채널에 등록된 매물입니다' };
  }
  if (listing.status !== STATUS.CLOSED) {
    return { ok: false, reason: '기존 판매채널을 먼저 종료해야 채널을 변경할 수 있습니다' };
  }
  const cls = classifyListing(listing);
  if (!cls.channels.includes(newChannel)) {
    return { ok: false, reason: `${DIRECT_BLOCK_MESSAGE} (${cls.reasons.join(', ')})` };
  }
  return { ok: true, reason: '' };
}

/** 종료된 매물을 다른 채널로 다시 연다. 실패 시 예외. */
export function changeChannel(listing, newChannel, now = Date.now()) {
  const check = canChangeChannel(listing, newChannel);
  if (!check.ok) throw new Error(check.reason);
  return {
    ...listing,
    channel: newChannel,
    status: STATUS.ACTIVE,
    closedAt: null,
    updatedAt: now,
    channelHistory: [...(listing.channelHistory || []), { channel: newChannel, at: now }],
  };
}

/** 저장소 불변식: 매물 ID는 유일하고, 채널은 정확히 하나. 위반 시 예외. */
export function assertChannelInvariant(listings) {
  const seen = new Set();
  for (const l of listings) {
    if (seen.has(l.id)) throw new Error(`매물 ID 중복: ${l.id}`);
    seen.add(l.id);
    if (l.channel !== CHANNEL.DIRECT && l.channel !== CHANNEL.CONSULTING) {
      throw new Error(`매물 ${l.id}의 채널이 DIRECT/CONSULTING 중 하나가 아닙니다: ${l.channel}`);
    }
  }
  return true;
}

// ---- 화면별 조회. 직거래 화면과 컨설팅 화면은 서로의 매물을 절대 보지 못한다. ----

export function directListings(listings) {
  return listings.filter((l) => l.channel === CHANNEL.DIRECT && l.status === STATUS.ACTIVE);
}

export function consultingListings(listings, { includeClosed = false } = {}) {
  return listings.filter((l) => l.channel === CHANNEL.CONSULTING && (includeClosed || l.status === STATUS.ACTIVE));
}

/** 직거래 매물 필터. 가격대: 5000(5천 이하), 10000(1억 이하), null(전체). */
export function filterDirect(listings, { maxPrice = null, category = '', sido = '', sigungu = '' } = {}) {
  return directListings(listings).filter((l) => {
    if (maxPrice != null && l.totalPrice > maxPrice) return false;
    if (category && l.category !== category) return false;
    if (sido && l.sido !== sido) return false;
    if (sigungu && !(l.sigungu || '').includes(sigungu)) return false;
    return true;
  });
}

// ---- 매수 조건 ----

export function normalizeBuyerInput(input = {}) {
  return {
    name: String(input.name || '').trim(),
    contact: String(input.contact || '').trim(),
    sido: String(input.sido || '').trim(),
    sigungu: String(input.sigungu || '').trim(),
    category: String(input.category || '').trim(), // '' = 업종 무관
    budgetMax: num(input.budgetMax),                // 총투자금 상한 (만원)
    rentMax: num(input.rentMax),                    // 월세 상한 (만원, 0 = 무관)
    targetProfit: num(input.targetProfit),          // 희망 월수익 (만원, 0 = 무관)
    operation: input.operation || OPERATION.ANY,    // 직접운영 / 오토 / 무관
    pool: input.pool === POOL.CONSULTING ? POOL.CONSULTING : POOL.DIRECT,
  };
}

export function createBuyer(rawInput, now = Date.now()) {
  const b = normalizeBuyerInput(rawInput);
  const errors = [];
  if (!REGIONS.includes(b.sido)) errors.push('지역(시/도)을 선택하세요');
  if (b.budgetMax <= 0) errors.push('총투자금을 입력하세요');
  if (!b.contact) errors.push('연락처를 입력하세요');
  if (errors.length) throw new Error(errors.join(', '));
  return { id: newId('B'), createdAt: now, ...b };
}

export function directBuyers(buyers) {
  return buyers.filter((b) => b.pool === POOL.DIRECT);
}
export function consultingBuyers(buyers) {
  return buyers.filter((b) => b.pool === POOL.CONSULTING);
}

// ---- 자동매칭 (직거래 전용). 지역 + 예산 + 업종이 필수, 나머지는 가점. ----

function operationCompatible(buyerOp, listingOp) {
  if (!buyerOp || buyerOp === OPERATION.ANY) return true;
  if (!listingOp) return true;
  return buyerOp === listingOp;
}

/** 매수 조건과 직거래 매물 하나를 비교한다. 필수 조건 미충족 시 null. */
export function scoreMatch(buyer, listing) {
  if (listing.channel !== CHANNEL.DIRECT || listing.status !== STATUS.ACTIVE) return null;
  if (buyer.sido && listing.sido !== buyer.sido) return null;
  if (buyer.sigungu && listing.sigungu && !listing.sigungu.includes(buyer.sigungu)) return null;
  if (buyer.budgetMax > 0 && listing.totalPrice > buyer.budgetMax) return null;
  if (buyer.category && listing.category !== buyer.category) return null;

  let score = 60; // 필수 3요소 충족
  const hits = ['지역', '예산', buyer.category ? '업종' : '업종 무관'];
  if (buyer.sigungu && listing.sigungu && listing.sigungu.includes(buyer.sigungu)) { score += 10; hits.push('시군구'); }
  if (buyer.rentMax > 0) {
    if (listing.rent <= buyer.rentMax) { score += 10; hits.push('월세'); } else { score -= 15; }
  }
  if (buyer.targetProfit > 0) {
    if (listing.monthlyProfit >= buyer.targetProfit) { score += 10; hits.push('희망수익'); } else { score -= 10; }
  }
  if (operationCompatible(buyer.operation, listing.operation)) { score += 10; hits.push('운영방식'); } else { score -= 20; }
  return { score: Math.max(0, Math.min(100, score)), hits };
}

/** 매수 조건에 맞는 직거래 매물. 컨설팅 매물은 절대 포함되지 않는다. */
export function matchListingsForBuyer(buyer, listings) {
  const out = [];
  for (const l of directListings(listings)) {
    const m = scoreMatch(buyer, l);
    if (m) out.push({ listing: l, ...m });
  }
  return out.sort((a, b) => b.score - a.score || b.listing.createdAt - a.listing.createdAt);
}

/** 직거래 매물에 맞는 매수자. 컨설팅 매물에는 이 기능을 적용하지 않는다(예외). */
export function matchBuyersForListing(listing, buyers) {
  if (listing.channel !== CHANNEL.DIRECT) {
    throw new Error('컨설팅 매물에는 직거래 자동매칭을 적용하지 않습니다');
  }
  const out = [];
  for (const b of directBuyers(buyers)) {
    const m = scoreMatch(b, listing);
    if (m) out.push({ buyer: b, ...m });
  }
  return out.sort((a, b) => b.score - a.score || b.buyer.createdAt - a.buyer.createdAt);
}

// ---- 표시 유틸 ----
export function formatManwon(v) {
  const n = num(v);
  if (n >= 10000) {
    const eok = Math.floor(n / 10000);
    const rest = n % 10000;
    return rest ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${n.toLocaleString()}만원`;
}

export const CHANNEL_LABEL = Object.freeze({
  [CHANNEL.DIRECT]: '공개 직거래',
  [CHANNEL.CONSULTING]: '비공개 컨설팅',
});
export const OPERATION_LABEL = Object.freeze({
  [OPERATION.OWNER]: '직접 운영',
  [OPERATION.AUTO]: '오토(관리자 운영)',
  [OPERATION.ANY]: '무관',
});
