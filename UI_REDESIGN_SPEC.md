# UI 리디자인 스펙 — 토스 스타일

> **작성일**: 2026-06-07  
> **대상 파일**: `src/app/trading.css`, `src/components/*.tsx`  
> **목표**: 전반적인 가독성 향상 + 토스 앱 특유의 "깔끔하고 신뢰감 있는" 느낌으로 개선

---

## 1. 핵심 방향성

토스의 디자인 언어는 **"필요한 것만, 정확하게"** 입니다.

| 현재 | 변경 후 |
|---|---|
| 유리 질감(glassmorphism), 배경 그라디언트 | 완전한 플랫 화이트 + 아주 연한 회색 배경 |
| 6가지 이상의 강조색 (빨강·파랑·보라·청록·초록·주황) | **3가지로 단순화** (브랜드 블루, 손익 빨강, 손익 파랑) |
| 작은 텍스트(0.62~0.72rem) 위주 | 수치는 크고 굵게, 레이블은 명확한 계층 |
| 카드마다 상이한 테두리 색 | 테두리 없음, 그림자만으로 구분 |
| 이모지가 레이블에 섞임 | 이모지 제거, 텍스트 레이블로 통일 |

---

## 2. 디자인 토큰 (CSS 변수)

`src/app/trading.css` 상단 `:root` 블록을 아래로 교체하세요.

```css
:root {
  /* ── 배경 ── */
  --bg-base:        #F5F6F8;   /* 전체 페이지 배경 — 토스 특유의 아주 옅은 블루그레이 */
  --bg-surface:     #FFFFFF;   /* 카드, 패널 배경 */
  --bg-input:       #F2F4F6;   /* input 배경 */

  /* ── 텍스트 ── */
  --text-primary:   #191F28;   /* 본문, 수치 — 토스 메인 텍스트 색 */
  --text-secondary: #4E5968;   /* 서브 레이블 */
  --text-muted:     #8B95A1;   /* 힌트, 비활성 */
  --text-label:     #6B7684;   /* 폼 레이블 */

  /* ── 브랜드 ── */
  --brand:          #3182F6;   /* 토스 블루 — 주 버튼, 활성 탭, 포커스 링 */
  --brand-soft:     #EBF3FE;   /* 버튼 hover, 선택된 카드 배경 */

  /* ── 손익 색 (딱 2가지만) ── */
  --loss:           #F04452;   /* 손실·매수 빨강 */
  --loss-soft:      #FFF0F1;
  --gain:           #246CF9;   /* 이익·매도 파랑 */
  --gain-soft:      #EBF3FE;

  /* ── 중립 수치 ── */
  --in-color:       #00B493;   /* 입금 */
  --out-color:      #F4A623;   /* 출금 */
  --div-color:      #6B46C1;   /* 배당 */

  /* ── 그림자 ── */
  --shadow-sm:  0 1px 4px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 16px rgba(0,0,0,0.08);

  /* ── 모서리 ── */
  --r-xs:   4px;
  --r-sm:   8px;
  --r-md:   12px;
  --r-lg:   16px;
  --r-xl:   20px;
  --r-pill: 999px;

  /* ── 레이아웃 ── */
  --page-pad:   28px;
  --header-h:   64px;
  --aside-w:    320px;

  /* ── 테두리 ── */
  --border:     #E5E8EB;
}
```

---

## 3. 타이포그래피 체계

폰트는 현재 Pretendard를 그대로 사용. **사이즈 스케일만 정리합니다.**

| 역할 | 크기 | 굵기 | 색 |
|---|---|---|---|
| 카드 수치 (큰 숫자) | `1.6rem` | 700 | `--text-primary` |
| 카드 보조 수치 | `1.0rem` | 600 | `--text-primary` |
| 섹션 제목 | `0.95rem` | 700 | `--text-primary` |
| 폼 레이블 | `0.80rem` | 600 | `--text-label` |
| 테이블 본문 | `0.875rem` | 400 | `--text-secondary` |
| 테이블 숫자 | `0.875rem` | 500 | `--text-primary` (JetBrains Mono) |
| 테이블 헤더 | `0.75rem` | 600 | `--text-muted` |
| 힌트·노트 | `0.75rem` | 400 | `--text-muted` |
| 뱃지 | `0.72rem` | 700 | (색별) |

> **핵심**: 현재 `0.62rem`, `0.64rem`, `0.68rem` 같은 극소 텍스트가 산재해 있습니다.  
> **최소 허용 크기는 `0.75rem`** 으로 통일하세요.

---

## 4. 컴포넌트별 변경 사항

### 4-1. Header (`.header`)

**현재**: 반투명 blur + 좌측 issuer-label + 부제목  
**변경**: 완전 불투명 흰 배경, 타이틀만 심플하게

```
┌─────────────────────────────────────────────────────┐
│  영차영차 주식 거래일지            [불러오기] [내보내기] │
└─────────────────────────────────────────────────────┘
```

- 배경: `#FFFFFF`, border-bottom: `1px solid var(--border)`
- 그림자: `0 1px 0 var(--border)` (얇게)
- `backdrop-filter` 제거
- `issuer-label`, `.sub`, `.meta` 제거 — 타이틀 하나만 남김
- 타이틀 폰트: `1.0rem`, weight 700, `--text-primary`

---

### 4-2. 버튼 시스템

```
[btn-primary]   배경 #3182F6 | 흰 텍스트 | radius 8px | 높이 40px
[btn-secondary] 배경 #F2F4F6 | --text-secondary | border 없음 | radius 8px | 높이 40px
[btn-ghost]     배경 투명 | --text-muted | border 없음 | radius 8px | 높이 36px
[btn-danger]    배경 #FFF0F1 | #F04452 텍스트 | radius 8px | 높이 36px
```

- `border-radius: var(--r-pill)` → **`var(--r-sm)` (8px)** 로 변경 (pill 버튼은 토스 스타일이 아님)
- hover 시 `opacity` 조절 대신 **배경색 10% 어둡게**
- transform translateY 제거 (올라가는 애니메이션 제거)

---

### 4-3. 사이드 폼 (`.form-card`)

**현재**: 그림자 + border 조합  
**변경**: 그림자만으로 구분, 내부 섹션을 구분선으로 분리

- `border: none`
- `box-shadow: var(--shadow-md)`
- `border-radius: var(--r-xl)` (20px)
- `.form-card-header`: 배경색 제거 (`rgba(0,0,0,0.015)` → 투명)
- `.form-card-title` 폰트 크기: `0.80rem` → `0.875rem`

**Input 필드**

```
배경: --bg-input (#F2F4F6)
border: none (기본 상태)
border-radius: var(--r-sm)
높이: 44px (기존 34px에서 증가 → 터치 타깃 확보)
font-size: 0.875rem
focus: border 1px solid --brand + 배경 white
```

**세그먼트 컨트롤** (시장 선택, 거래유형)

```
배경: --bg-input
border: none
border-radius: var(--r-md)
높이: 44px

active 버튼:
  배경: #FFFFFF
  box-shadow: 0 1px 4px rgba(0,0,0,0.12)
  color: --text-primary
  (토스의 실제 탭 스타일 — 배경이 떠오르는 느낌)
```

**자동계산 박스** (`.calc-box`)

```
배경: --brand-soft (#EBF3FE)
border: none
border-radius: var(--r-md)
padding: 14px 16px

.calc-label > 텍스트: 0.80rem, --text-secondary
.calc-formula: 제거 (없애도 됨 — 공간 낭비)
.calc-value: 1.0rem, weight 700, --text-primary
highlight 행 .calc-value: --brand
```

---

### 4-4. 서머리 카드 (`.card`)

토스 앱의 자산 카드 스타일을 참고합니다.

**현재**: glassmorphism, 글로우 효과, 이모지 레이블  
**변경**: 플랫 화이트, 명확한 계층

```
배경: #FFFFFF
border: none
box-shadow: var(--shadow-sm)
border-radius: var(--r-xl)   ← 20px
padding: 20px 18px
cursor: pointer

::before 그라디언트 오버레이: 제거

hover:
  box-shadow: var(--shadow-md)
  transform: 없음   ← 올라가는 효과 제거

active(선택됨):
  배경: --brand-soft (#EBF3FE)
  box-shadow: var(--shadow-sm)
```

**카드 내부 구조 변경**

```
현재:
  .label  → "💳 매수"  (0.68rem, uppercase)
  .value  → "3건"      (1.22rem, mono)
  .note   → "총 ₩..."

변경:
  .label  → "매수"     (0.75rem, weight 600, --text-muted)  ← 이모지 제거
  .value  → "3건"      (1.6rem, weight 700, --text-primary) ← 숫자 키움
  .note   → "총 ₩..."  (0.80rem, --text-secondary)         ← 읽기 편하게
```

---

### 4-5. 뱃지 (`.badge`)

**현재**: 6가지 색상 뱃지 (빨강, 파랑, 보라, 청록, 초록, 황토)  
**변경**: 색을 3가지로 줄이고, 디자인을 단순화

| 유형 | 배경 | 텍스트 |
|---|---|---|
| 매수 | `#FFF0F1` | `#F04452` |
| 매도 | `#EBF3FE` | `#246CF9` |
| 입금 | `#E8FBF7` | `#00B493` |
| 출금 | `#FEF6E7` | `#F4A623` |
| 배당금 | `#F3EFFD` | `#6B46C1` |

```css
/* 공통 */
.badge {
  padding: 3px 10px;
  border-radius: var(--r-pill);  /* 유지 */
  font-size: 0.72rem;
  font-weight: 700;
  border: none;  /* 테두리 제거 */
}
```

---

### 4-6. 탭 바 (`.tab-bar`, `.tab-btn`)

**현재**: 탭 아래에 파란 2px 밑줄, 활성 탭 배경  
**변경**: 토스 스타일의 언더라인 탭

```
.tab-bar:
  border-bottom: 1px solid var(--border)
  padding: 0 20px
  gap: 0

.tab-btn:
  padding: 14px 16px
  font-size: 0.875rem
  font-weight: 600
  color: --text-muted
  border-radius: 0

.tab-btn.active:
  color: --text-primary
  배경 없음
  ::after 밑줄: 높이 2px, 색 --brand, bottom 0

.tab-btn:hover:
  color: --text-secondary
  배경 없음
```

---

### 4-7. 거래내역 테이블

**현재**: 복잡한 셀 스타일, 극소 텍스트  
**변경**: 넉넉한 행 높이, 명확한 계층

```
thead th:
  font-size: 0.75rem
  font-weight: 600
  color: --text-muted
  padding: 12px 16px
  배경: transparent (기존 rgba(0,0,0,0.02) 제거)
  border-bottom: 1px solid var(--border)
  text-transform: none   ← uppercase 제거

tbody tr:
  border-bottom: 1px solid var(--border)

tbody td:
  padding: 14px 16px   ← 기존 8px에서 증가
  font-size: 0.875rem
  vertical-align: middle

tbody tr:hover:
  background: #F8FAFF

.date-cell:     color: --text-muted, font-family: JetBrains Mono
.stock-cell:    font-weight: 700, color: --text-primary
.settle-cell:   font-weight: 700, color: --text-primary
.fee-cell,
.tax-cell:      color: --text-muted

tfoot:
  배경: --bg-input (#F2F4F6)
  border-top: 1px solid var(--border)
  font-size: 0.875rem
```

---

### 4-8. 실현손익 카드 & 패널

**손익 카드** (`.card-pl`)

```
.pl-pos: color #F04452 (손실이면 빨강 → 이건 현재처럼 유지)
.pl-neg: color #246CF9 (이익이면 파랑)

주의: 국내 주식은 상승=빨강 관행이므로 현재 color 매핑(buy=빨강, sell=파랑)은 유지
```

**실현손익 상세 패널** (`.pl-detail-panel`)

```
border: 1px solid var(--border)
box-shadow: var(--shadow-md)
border-radius: var(--r-xl)
배경: #FFFFFF

.pl-detail-header:
  padding: 16px 20px
  font-size: 0.875rem
  font-weight: 700
  배경: transparent

.pl-detail-hint:
  font-size: 0.75rem
  color: --text-muted
  font-family: JetBrains Mono 제거 → Pretendard로 통일
```

---

### 4-9. 해외 패널 & 양도세 계산기

**해외 패널** (`.overseas-panel`)

```
배경: #FFFFFF
border: 1px solid var(--border)
box-shadow: var(--shadow-sm)
border-radius: var(--r-xl)
padding: 20px

.overseas-panel__title:
  font-size: 0.75rem
  font-weight: 700
  color: --text-muted
  text-transform: none   ← uppercase 제거
  letter-spacing: normal

.overseas-panel__value:
  font-size: 1.4rem
  font-weight: 700
  color: --text-primary
```

**양도세 계산기** (`.cap-gains`)

```
border: 1px solid var(--border)
border-radius: var(--r-xl)

.cap-gains__summary:
  배경: --brand-soft
  border: none
  border-radius: var(--r-lg)

.cg-tax:
  color: --loss (#F04452)
  font-size: 1.0rem
```

---

### 4-10. 수정 모달 (`.modal-card`)

**현재**: max-width 420px  
**변경**: max-width 480px, 더 넉넉한 내부 여백

```
.modal-overlay:
  background: rgba(0, 0, 0, 0.5)
  backdrop-filter: blur(2px)  ← 기존 4px에서 줄임

.modal-card:
  border: none
  border-radius: var(--r-xl)
  box-shadow: 0 20px 60px rgba(0,0,0,0.2)

.modal-header:
  padding: 20px 24px
  border-bottom: 1px solid var(--border)
  backdrop-filter: 제거

.modal-title:
  font-size: 1.0rem
  font-weight: 700
  color: --text-primary

.modal-body:
  padding: 20px 24px
  gap: 16px

.modal-footer:
  padding: 16px 24px
  border-top: 1px solid var(--border)
  background: transparent
```

---

## 5. 배경 및 전체 레이아웃

```css
body {
  background: var(--bg-base);  /* #F5F6F8 */
  /* 기존 radial-gradient 배경 이미지 완전 제거 */
}
```

**메인 레이아웃** (`.main-layout`):

```css
.main-layout {
  grid-template-columns: var(--aside-w) 1fr;  /* 기존 310px → 320px */
  gap: 24px;
  padding: 24px var(--page-pad) 60px;
}
```

---

## 6. 애니메이션 & 인터랙션

| 항목 | 현재 | 변경 |
|---|---|---|
| 카드 hover | `translateY(-2px)` 올라감 | **제거** (그림자 강화만) |
| 버튼 hover | `translateY(-1px)` + glow | 배경색 변경만 |
| 버튼 active | `scale(0.98)` | 유지 (좋음) |
| fadeUp 진입 애니메이션 | 유지 | 유지 (좋음) |
| transition 속도 | `.18s~.2s` | `.15s` 로 통일 |

---

## 7. 마켓 토글 버튼 위치 조정

**현재**: 대시보드 우측 상단에 독립적으로 존재  
**제안**: 헤더 중앙 또는 헤더 우측으로 이동하여 항상 노출

```
헤더 오른쪽:
  [🇰🇷 국내 | 🌐 해외]  [불러오기] [내보내기]
```

이렇게 하면 스크롤 없이 시장을 전환할 수 있어 UX가 향상됩니다.  
폼 사이드바의 종류 선택과 헤더의 토글이 **서로 연동**되어야 합니다 (이미 `switchMarket`으로 연결되어 있으므로 위치만 이동).

---

## 8. 접근성 체크리스트

개발 시 함께 확인해 주세요.

- [ ] 모든 인터랙티브 요소에 `focus-visible` 스타일 (`:focus-visible { outline: 2px solid var(--brand); }`)
- [ ] 버튼 최소 터치 타깃: **44×44px**
- [ ] 컬러만으로 정보 전달 금지 — 손익 표시 시 `+`/`-` 기호 병행 (현재 구현됨, 유지)
- [ ] `aria-label` 없는 아이콘 버튼 없도록 확인 (닫기 버튼 `btn-close`는 현재 ok)

---

## 9. 적용 순서 (권장)

1. `trading.css` `:root` 토큰 교체 → 전체 색상 자동 반영
2. `body` 배경 단순화
3. 버튼 스타일 (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`)
4. `.card` 카드 플랫화 + 수치 폰트 키우기
5. `.inp` 높이 44px 조정
6. `.tab-btn` / `.tab-bar` 스타일
7. 테이블 행 높이 · 폰트 크기
8. `.badge` 색상 단순화
9. 뱃지에서 `border` 제거
10. 모달 패딩 · 그림자 조정
11. 마켓 토글 헤더 이동 (선택 사항)

---

> **참고 자료**
> - Toss Design System (Figma Community에 공개된 비공식 복각본 참고)
> - 토스 웹 앱 `toss.im` — 개발자 도구로 색상·폰트 직접 확인 가능
> - 현재 프로젝트 폰트 `Pretendard` — 토스와 동일 폰트이므로 별도 변경 불필요
