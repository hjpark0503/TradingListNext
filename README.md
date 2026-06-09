# TradingList

국내·해외 주식 거래 내역을 관리하고, 실현손익과 해외주식 양도세를 자동 계산해주는 개인용 투자 기록 앱입니다.

**[→ 앱 바로가기](https://tradinglist-2026.web.app)**

---

## 주요 기능

- **거래 내역 기록** — 매수 / 매도 / 입금 / 출금 / 배당금, 국내(KRW) · 해외(USD) 시장 구분
- **실현손익 계산** — 가중평균 원가 기준으로 종목별 손익 자동 계산
- **해외주식 양도세 계산기** — 연도별 양도차익 집계, 기본공제 ₩250만 차감, 세율 22% 적용 (소득세 20% + 지방세 2%)
- **거래 유형별 도넛 차트** — 시장별 정산금액 시각화
- **Excel 내보내기 / 불러오기** — `.xlsx` 형식으로 백업 및 복원
- **로컬 저장** — 브라우저 `localStorage`에 자동 저장, 별도 서버 불필요

## 기술 스택

| 항목 | 내용 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, `ssr: false` 단일 페이지) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 + 커스텀 CSS (`trading.css`) |
| 차트 | Chart.js / react-chartjs-2 |
| Excel | xlsx (SheetJS) |
| 배포 | Firebase Hosting |

## 로컬 실행

```bash
npm install
npm run dev       # http://localhost:3000
```

```bash
npm run build     # 프로덕션 빌드 (타입 검사 포함)
npm run lint      # ESLint
```

## 배포 (Firebase Hosting)

```bash
npm run build     # out/ 폴더 생성
npx firebase deploy --only hosting
```

## 데이터 관리

- 모든 데이터는 브라우저 `localStorage`에 저장됩니다 (서버·DB 없음).
- **백업**: 헤더의 `내보내기` 버튼으로 `.xlsx` 파일 다운로드
- **복원**: `불러오기` 버튼으로 Excel 파일 업로드 (기존 내역 교체)
- Excel 열 이름: `거래일`, `시장`, `종목명`, `거래유형`, `상세`, `단가`, `수량`, `거래금액`, `수수료`, `세금`, `정산금액`, `통화`

## 정산금액 계산 기준

| 거래유형 | 정산금액 |
|---|---|
| 매수 | 거래금액 + 수수료 + 세금 |
| 매도 | 거래금액 − 수수료 − 세금 |
| 입금 / 출금 / 배당금 | 거래금액 |
