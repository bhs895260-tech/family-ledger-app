# family-ledger-app

family ledger app installer (`index.html`, `privacy.html`)

## 점포 직거래 · 컨설팅 MVP (`market/`)

정적 페이지만으로 동작하는 10월 MVP. 서버 없이 브라우저 `localStorage`에 저장한다.

| 페이지 | 역할 |
| --- | --- |
| `market/index.html` | 홈, 시스템 규칙, 샘플 데이터 |
| `market/sell.html` | 매도 등록. 조건에 따라 직거래/컨설팅 자동 분기 |
| `market/buy.html` | 매수 조건 등록 + 즉시 자동매칭 |
| `market/direct.html` | 직거래 매물 (5천 이하 / 1억 이하 / 업종 / 지역 필터) |
| `market/my.html` | 내 매물 관리, 판매 종료 후 채널 변경 |
| `market/crm.html` | 컨설팅 CRM. 직거래 매물·매수자는 표시되지 않음 |

핵심 규칙은 `market/js/domain.js`에 있으며 `npm test`로 검증한다.
계획 전체는 `docs/market-split-plan.md` 참고.

```sh
npm test                      # 도메인 규칙 테스트
python3 -m http.server 8000   # 후 http://localhost:8000/market/
```
