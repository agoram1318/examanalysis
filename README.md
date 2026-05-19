# 봉샘스쿨 테스트 분석표 생성기

수학 테스트 자동 채점 및 **학생별 분석 리포트 / 강사용 상담 자료** 생성 시스템.

## 🚀 실행 방법

```bash
npm install
npm run dev
# http://localhost:3000
```

## 📋 주요 기능

| 기능 | 설명 |
|------|------|
| 테스트 관리 | 제목, 과목, 반, 날짜, 총점 설정 후 문항(정답/배점/난이도/단원) 입력 |
| 답안 입력 | 학생별 답안 수동 입력, 즉시 자동 채점 피드백 |
| 학생별 분석표 | 점수·등급·단원별 성취도·취약단원·강점단원·레이더 차트 |
| 반 전체 분석표 | 평균/최고/최저점, 점수분포, 오답률 TOP10, 순위표, 단원별 성취도 |
| 학생/반 관리 | CRUD |
| 단원 관리 | 과목 > 대단원 > 중단원 > 소단원 계층 구조 관리 |

## 🗂 프로젝트 구조

```
app/
  dashboard/         대시보드
  tests/             테스트 목록 및 생성
  tests/[id]/questions/  문항 입력
  answers/           답안 입력 (자동 채점)
  analysis/student/  학생별 분석표
  analysis/class/    반 전체 분석표
  students/          학생 관리
  classes/           반 관리
  curriculum/        단원 관리

lib/
  types.ts           타입 정의
  sample-data.ts     초기 샘플 데이터
  store.ts           로컬스토리지 기반 CRUD (→ Supabase 교체 예정)
  analysis.ts        채점 및 분석 로직
  utils.ts           유틸리티
```

## 🗄 데이터 저장 방식 (초기 버전)

브라우저 **로컬스토리지**에 저장. (`bongsam_exam_db` 키)

Supabase 연동 시 `lib/store.ts`의 각 함수를 Supabase 쿼리로 교체하면 됩니다.

## 🔮 Supabase 연동 계획

`.env.local.example`을 복사해 `.env.local`에 Supabase URL/키를 입력하고,
`lib/store.ts`의 localStorage 기반 함수를 `@supabase/ssr`를 사용한 쿼리로 교체합니다.

## 📊 9등급 기준

| 등급 | 기준 |
|------|------|
| 1등급 | 96% 이상 |
| 2등급 | 89% 이상 |
| 3등급 | 77% 이상 |
| 4등급 | 60% 이상 |
| 5등급 | 40% 이상 |
| 6등급 | 23% 이상 |
| 7등급 | 11% 이상 |
| 8등급 | 4% 이상 |
| 9등급 | 4% 미만 |

## 🖨 인쇄 / PDF

브라우저 인쇄(Ctrl+P) 시 사이드바와 컨트롤 UI가 자동으로 숨겨집니다.
추후 `react-to-pdf` 또는 `puppeteer`를 사용한 PDF 다운로드 기능으로 확장 가능합니다.

## 기술 스택

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Recharts** (레이더/바 차트)
- **Lucide React** (아이콘)
- **Supabase** (연동 준비 완료)
