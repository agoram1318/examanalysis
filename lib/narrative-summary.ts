/**
 * 학생별 학습 총평 생성 모듈 (규칙 기반)
 *
 * 구조 분리 원칙:
 * - analyzeStudentPerformance : 순수 분석 (수치 + 태그 집계)
 * - 각 buildPara* 함수        : 문단별 문장 생성
 * - generateStudentNarrativeSummary : 외부 진입점
 *
 * 추후 AI 연동 시 buildPara* 함수들만 AI 호출로 교체하면 됩니다.
 */

// ── 입력 타입 ────────────────────────────────────────────────────────────────
export type QAInput = {
  question_number: number;
  difficulty: number | null;
  question_comment: string | null;
  question_format: 'objective' | 'subjective';
  subject_name: string | null;
  major_unit_name: string | null;
  middle_unit_name: string | null;
  small_unit_name: string | null;
  score: number;
  ans: {
    is_correct: boolean;
    is_blank: boolean;
    is_guessed: boolean;
    selected_answer: string | null;
    earned_score: number;
  } | null;
};

// ── 태그 타입 ────────────────────────────────────────────────────────────────
type SkillTag =
  | '개념 이해' | '조건 해석' | '식 세우기' | '식 변형'
  | '그래프 해석' | '그래프-식 연결' | '범위 판단' | '경우 분류'
  | '계산 정확도' | '추론' | '복합 사고' | '시간 관리' | '검토 습관';

type ErrorTag =
  | '개념 혼동' | '조건 누락' | '범위 누락' | '식 세우기 부족'
  | '접근 전략 부족' | '그래프 해석 오류' | '부호 실수' | '계산 실수'
  | '경우 누락' | '답 검토 부족' | '복합 조건 처리 부족';

type SolvingStepTag =
  | '문제 읽기' | '조건 변환' | '풀이 전략' | '계산 실행' | '답 검토';

export type WeaknessCategory =
  | '개념 이해 부족' | '조건 해석 부족' | '식 변형 부족'
  | '그래프-식 연결 부족' | '범위 판단 부족' | '경우 분류 부족'
  | '계산 안정성 부족' | '검토 습관 부족' | '시간 관리 문제' | '복합 사고 부족';

type QuestionTags = {
  skillTags: SkillTag[];
  errorTags: ErrorTag[];
  solvingStepTags: SolvingStepTag[];
};

// ── 출력 타입 ────────────────────────────────────────────────────────────────
export type AnalysisData = {
  scoreRate: number;
  tier: 'high' | 'mid' | 'low';
  wrongCount: number;
  blankCount: number;
  totalCount: number;
  strongUnits: string[];
  wrongUnitNames: string[];
  coreWeaknesses: WeaknessCategory[];
  dominantStep: SolvingStepTag | null;
};

export type NarrativeSummaryResult = {
  paragraphs: string[];
  priorityPoints: string[];
  analysisData: AnalysisData;
};

// ── 단원 키워드 → 태그 매핑 규칙 ────────────────────────────────────────────
type TagRule = {
  pattern: RegExp;
  skills: SkillTag[];
  errors: ErrorTag[];
  steps: SolvingStepTag[];
};

const UNIT_TAG_RULES: TagRule[] = [
  {
    pattern: /이차함수|이차.*그래프|이차.*최대|이차.*최소|포물선/,
    skills: ['그래프 해석', '범위 판단', '조건 해석'],
    errors: ['범위 누락', '조건 누락'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /이차방정식|판별식|근과.*계수|중근/,
    skills: ['식 변형', '개념 이해'],
    errors: ['부호 실수', '계산 실수'],
    steps: ['계산 실행', '답 검토'],
  },
  {
    pattern: /부등식|연립.*부등식|해의.*범위|절댓값.*부등식/,
    skills: ['범위 판단', '식 변형'],
    errors: ['범위 누락', '부호 실수'],
    steps: ['조건 변환', '계산 실행', '답 검토'],
  },
  {
    pattern: /함수.*그래프|그래프.*함수|일차함수|절댓값.*함수|그래프.*개형/,
    skills: ['그래프 해석', '그래프-식 연결', '조건 해석'],
    errors: ['그래프 해석 오류', '조건 누락'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /복소수|허수|켤레/,
    skills: ['계산 정확도', '개념 이해'],
    errors: ['부호 실수', '계산 실수'],
    steps: ['계산 실행'],
  },
  {
    pattern: /나머지정리|인수정리|조립제법|항등식/,
    skills: ['식 변형', '식 세우기'],
    errors: ['접근 전략 부족', '식 세우기 부족'],
    steps: ['풀이 전략', '계산 실행'],
  },
  {
    pattern: /집합|원소|부분집합|합집합|교집합|여집합/,
    skills: ['개념 이해', '경우 분류'],
    errors: ['개념 혼동', '경우 누락'],
    steps: ['문제 읽기', '조건 변환'],
  },
  {
    pattern: /경우의.*수|확률|순열|조합|중복순열/,
    skills: ['경우 분류', '조건 해석'],
    errors: ['경우 누락', '조건 누락', '복합 조건 처리 부족'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /수열|등차|등비|시그마|점화식|귀납/,
    skills: ['식 변형', '추론'],
    errors: ['식 세우기 부족', '계산 실수'],
    steps: ['풀이 전략', '계산 실행'],
  },
  {
    pattern: /지수|로그|로그방정식|로그부등식|지수함수|로그함수/,
    skills: ['조건 해석', '범위 판단', '식 변형'],
    errors: ['조건 누락', '범위 누락'],
    steps: ['조건 변환', '답 검토'],
  },
  {
    pattern: /삼각함수|사인|코사인|탄젠트|삼각.*방정식|삼각.*부등식/,
    skills: ['그래프 해석', '범위 판단', '식 변형'],
    errors: ['범위 누락', '그래프 해석 오류'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /미분|도함수|적분|정적분|극값|극대.*극소/,
    skills: ['식 변형', '그래프 해석', '범위 판단'],
    errors: ['계산 실수', '범위 누락'],
    steps: ['계산 실행', '답 검토'],
  },
  {
    pattern: /행렬|역행렬|행렬.*연산/,
    skills: ['계산 정확도', '식 변형'],
    errors: ['계산 실수', '부호 실수'],
    steps: ['계산 실행'],
  },
  {
    pattern: /직선.*방정식|원.*방정식|도형.*방정식|기울기.*절편/,
    skills: ['그래프-식 연결', '조건 해석'],
    errors: ['그래프 해석 오류', '범위 누락'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /다항식|인수분해|전개식/,
    skills: ['식 변형', '계산 정확도'],
    errors: ['계산 실수', '부호 실수'],
    steps: ['계산 실행'],
  },
];

const COMMENT_TAG_RULES: TagRule[] = [
  {
    pattern: /조건|해석|읽/,
    skills: ['조건 해석'],
    errors: ['조건 누락'],
    steps: ['조건 변환', '풀이 전략'],
  },
  {
    pattern: /계산|실수|검산/,
    skills: ['계산 정확도'],
    errors: ['계산 실수'],
    steps: ['계산 실행', '답 검토'],
  },
  {
    pattern: /중상|고난|난도|변별|킬러/,
    skills: ['복합 사고', '추론'],
    errors: ['접근 전략 부족'],
    steps: ['풀이 전략'],
  },
  {
    pattern: /개념|정의|원리/,
    skills: ['개념 이해'],
    errors: ['개념 혼동'],
    steps: ['문제 읽기'],
  },
  {
    pattern: /그래프|도형|그림|좌표/,
    skills: ['그래프 해석', '그래프-식 연결'],
    errors: ['그래프 해석 오류'],
    steps: ['조건 변환'],
  },
  {
    pattern: /활용|응용|추론|서술/,
    skills: ['복합 사고', '추론'],
    errors: ['복합 조건 처리 부족'],
    steps: ['풀이 전략'],
  },
  {
    pattern: /범위|정의역|치역|구간/,
    skills: ['범위 판단'],
    errors: ['범위 누락'],
    steps: ['조건 변환', '답 검토'],
  },
  {
    pattern: /경우|분류|나누/,
    skills: ['경우 분류'],
    errors: ['경우 누락'],
    steps: ['조건 변환', '풀이 전략'],
  },
];

// ── 태그 추론 ────────────────────────────────────────────────────────────────
function inferTags(qa: QAInput): QuestionTags {
  const skillSet = new Set<SkillTag>();
  const errorSet = new Set<ErrorTag>();
  const stepSet = new Set<SolvingStepTag>();

  const unitText = [
    qa.subject_name,
    qa.major_unit_name,
    qa.middle_unit_name,
    qa.small_unit_name,
  ]
    .filter(Boolean)
    .join(' ');

  for (const rule of UNIT_TAG_RULES) {
    if (rule.pattern.test(unitText)) {
      rule.skills.forEach((s) => skillSet.add(s));
      rule.errors.forEach((e) => errorSet.add(e));
      rule.steps.forEach((s) => stepSet.add(s));
    }
  }

  if (qa.question_comment) {
    for (const rule of COMMENT_TAG_RULES) {
      if (rule.pattern.test(qa.question_comment)) {
        rule.skills.forEach((s) => skillSet.add(s));
        rule.errors.forEach((e) => errorSet.add(e));
        rule.steps.forEach((s) => stepSet.add(s));
      }
    }
  }

  const d = qa.difficulty;
  if (d !== null && d >= 6) {
    skillSet.add('복합 사고');
    errorSet.add('접근 전략 부족');
    stepSet.add('풀이 전략');
  }
  if (d !== null && d <= 2 && qa.ans && !qa.ans.is_correct && !qa.ans.is_blank) {
    skillSet.add('개념 이해');
    errorSet.add('개념 혼동');
  }
  if (qa.ans?.is_guessed) {
    skillSet.add('시간 관리');
    stepSet.add('풀이 전략');
  }
  if (qa.ans?.is_blank) {
    skillSet.add('시간 관리');
    stepSet.add('풀이 전략');
  }

  if (skillSet.size === 0) {
    skillSet.add('개념 이해');
    errorSet.add('개념 혼동');
    stepSet.add('풀이 전략');
  }

  return {
    skillTags: [...skillSet],
    errorTags: [...errorSet],
    solvingStepTags: [...stepSet],
  };
}

// ── 집계 유틸 ────────────────────────────────────────────────────────────────
function addCount<T extends string>(map: Map<T, number>, items: T[]) {
  items.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1));
}

function topN<T>(map: Map<T, number>, n: number): T[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

// ── 약점 카테고리 도출 ───────────────────────────────────────────────────────
function deriveWeaknessCategories(
  skillCounts: Map<SkillTag, number>,
  errorCounts: Map<ErrorTag, number>,
): WeaknessCategory[] {
  const catScore = new Map<WeaknessCategory, number>();
  const add = (cat: WeaknessCategory, score: number) =>
    catScore.set(cat, (catScore.get(cat) ?? 0) + score);

  const skillMapping: [SkillTag, WeaknessCategory][] = [
    ['개념 이해', '개념 이해 부족'],
    ['조건 해석', '조건 해석 부족'],
    ['식 세우기', '식 변형 부족'],
    ['식 변형', '식 변형 부족'],
    ['그래프 해석', '그래프-식 연결 부족'],
    ['그래프-식 연결', '그래프-식 연결 부족'],
    ['범위 판단', '범위 판단 부족'],
    ['경우 분류', '경우 분류 부족'],
    ['계산 정확도', '계산 안정성 부족'],
    ['검토 습관', '검토 습관 부족'],
    ['시간 관리', '시간 관리 문제'],
    ['복합 사고', '복합 사고 부족'],
  ];
  skillMapping.forEach(([s, c]) => add(c, (skillCounts.get(s) ?? 0)));

  const errorMapping: [ErrorTag, WeaknessCategory, number][] = [
    ['개념 혼동', '개념 이해 부족', 2],
    ['조건 누락', '조건 해석 부족', 2],
    ['범위 누락', '범위 판단 부족', 2],
    ['식 세우기 부족', '식 변형 부족', 2],
    ['접근 전략 부족', '복합 사고 부족', 2],
    ['그래프 해석 오류', '그래프-식 연결 부족', 2],
    ['부호 실수', '계산 안정성 부족', 2],
    ['계산 실수', '계산 안정성 부족', 2],
    ['경우 누락', '경우 분류 부족', 2],
    ['답 검토 부족', '검토 습관 부족', 2],
    ['복합 조건 처리 부족', '복합 사고 부족', 2],
  ];
  errorMapping.forEach(([e, c, w]) => add(c, (errorCounts.get(e) ?? 0) * w));

  return [...catScore.entries()]
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat);
}

// ── 강점 단원 추출 ───────────────────────────────────────────────────────────
export function extractStrengths(qaRows: QAInput[]): string[] {
  const unitMap = new Map<string, { correct: number; total: number }>();
  for (const qa of qaRows) {
    const unit = qa.major_unit_name || qa.subject_name || '기타';
    if (!unitMap.has(unit)) unitMap.set(unit, { correct: 0, total: 0 });
    const s = unitMap.get(unit)!;
    s.total++;
    if (qa.ans?.is_correct) s.correct++;
  }
  return [...unitMap.entries()]
    .filter(([, s]) => s.total >= 2 && s.correct / s.total >= 0.8)
    .map(([unit]) => unit);
}

// ── 오답 단원명 추출 ─────────────────────────────────────────────────────────
function extractWrongUnitNames(wrongQAs: QAInput[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const qa of wrongQAs) {
    const name = qa.middle_unit_name || qa.major_unit_name || qa.subject_name;
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

// ── 풀이 단계 설명 ───────────────────────────────────────────────────────────
const SOLVING_STAGE_DESC: Record<SolvingStepTag, string> = {
  '문제 읽기': '문제에서 핵심 정보를 파악하는 단계',
  '조건 변환': '주어진 조건을 식·표·그래프·범위로 바꾸는 단계',
  '풀이 전략': '풀이 방향과 접근 방식을 결정하는 단계',
  '계산 실행': '식을 전개하고 계산을 실행하는 단계',
  '답 검토': '구한 답이 조건에 맞는지 확인하는 단계',
};

// ── 약점별 처방 ──────────────────────────────────────────────────────────────
const WEAKNESS_PRESCRIPTION: Record<WeaknessCategory, { action: string; method: string }> = {
  '조건 해석 부족': {
    action: '문제의 조건을 식·그래프·범위로 바꾸는 훈련',
    method:
      '풀이를 시작하기 전에 조건을 따로 정리하고, 정의역·범위·제한 조건을 먼저 표시하는 습관을 만드세요.',
  },
  '범위 판단 부족': {
    action: '정의역·해의 범위·조건 구간 설정 연습',
    method:
      '수직선이나 표를 활용해 범위를 시각적으로 표시하고, 답을 구한 후 원래 조건에 대입해 범위를 확인하는 단계를 습관화하세요.',
  },
  '그래프-식 연결 부족': {
    action: '함수식과 그래프 사이를 오가는 훈련',
    method:
      '식을 보면 그래프 개형을 그리고, 그래프를 보면 식으로 표현하는 연습을 반복하세요. 증감·최대최소·교점 등을 식으로 정리하는 훈련이 중요합니다.',
  },
  '계산 안정성 부족': {
    action: '부호 처리와 중간 계산 과정 정확성 높이기',
    method:
      '계산 중간에 식을 전개하면서 부호를 단계마다 확인하는 습관을 만들고, 구한 답을 원래 식에 대입하는 검산을 습관화하세요.',
  },
  '개념 이해 부족': {
    action: '핵심 개념 정의와 적용 조건 재확인',
    method:
      '개념을 외우기보다 왜 성립하는지 이해하고, 같은 개념이 다른 상황에 어떻게 적용되는지 예제를 통해 확인하세요.',
  },
  '식 변형 부족': {
    action: '주어진 식을 풀이에 맞는 형태로 바꾸는 연습',
    method:
      '인수분해·완전제곱식·치환 등 다양한 변형 방법을 연습하고, 어떤 형태로 바꾸면 풀이가 편해지는지 감을 키우세요.',
  },
  '복합 사고 부족': {
    action: '두 개 이상의 개념이 결합된 문항 훈련',
    method:
      '문항에 등장하는 개념들을 먼저 따로 정리한 뒤, 서로 어떻게 연결되는지 확인하며 풀이 방향을 설계하는 습관을 만드세요.',
  },
  '경우 분류 부족': {
    action: '조건에 따라 경우를 나누는 훈련',
    method:
      '풀이 전에 어떤 경우가 존재하는지 먼저 나열하고, 각 경우에서 조건이 어떻게 달라지는지 표나 수직선으로 정리하세요.',
  },
  '검토 습관 부족': {
    action: '답 검토 습관 형성',
    method:
      '구한 답을 원래 식이나 조건에 직접 대입해 맞는지 확인하는 과정을 풀이의 마지막 단계로 고정하세요.',
  },
  '시간 관리 문제': {
    action: '문항 풀이 순서와 시간 배분 전략 연습',
    method:
      '쉬운 문항을 먼저 확보하고 어려운 문항에 시간을 분배하는 연습을 하세요. 모의 환경에서 제한 시간 안에 풀어보는 훈련이 필요합니다.',
  },
};

// ── 약점별 위험 경고 ─────────────────────────────────────────────────────────
const WEAKNESS_RISK: Partial<Record<WeaknessCategory, string>> = {
  '조건 해석 부족':
    '조건이 길거나 여러 조건이 결합된 문항에서 실점 가능성이 높습니다.',
  '범위 판단 부족':
    '범위 조건이 숨어 있거나 부등식과 함수가 결합된 문항에서 실점할 가능성이 있습니다.',
  '그래프-식 연결 부족':
    '그래프와 식이 함께 등장하거나 그래프에서 직접 답을 읽어야 하는 유형에서 실점할 가능성이 있습니다.',
  '계산 안정성 부족':
    '계산 단계가 길어지는 문항에서 중간 실수가 누적될 가능성이 높습니다.',
  '개념 이해 부족':
    '낯선 표현이나 변형된 형태로 출제되는 문항에서 당황할 가능성이 있습니다.',
  '복합 사고 부족':
    '두 단원 이상의 개념이 합쳐지거나 조건이 복잡하게 얽힌 문항에서 접근이 어려워질 수 있습니다.',
  '경우 분류 부족':
    '경우를 나눠야 하는 상황이 명시되지 않은 문항에서 실점 가능성이 있습니다.',
  '시간 관리 문제':
    '시험 후반부 문항에서 충분히 검토하지 못한 채 제출할 가능성이 있습니다.',
};

// ── 유형 간 공통 약점 연결 문장 ──────────────────────────────────────────────
const CROSS_UNIT_CONNECTION: Partial<Record<WeaknessCategory, string>> = {
  '조건 해석 부족':
    '공통적으로 주어진 조건을 읽고 풀이 방향을 결정해야 하는 과정에서 어려움이 나타납니다.',
  '범위 판단 부족':
    '모두 정의역·해의 범위·조건 구간을 정확히 설정해야 하는 유형이라는 공통점이 있습니다.',
  '그래프-식 연결 부족':
    '식과 그래프의 관계를 연결해서 해석해야 하는 과정에서 공통적으로 어려움이 나타납니다.',
  '계산 안정성 부족':
    '부호 처리나 중간 계산 과정에서 반복적으로 실수가 발생하고 있습니다.',
  '개념 이해 부족':
    '기본 개념이나 공식을 실제 문제 상황에 연결하는 단계에서 공통적으로 어려움이 나타납니다.',
  '식 변형 부족':
    '주어진 식을 풀이에 맞는 형태로 변형하는 과정에서 공통적으로 막히는 패턴이 보입니다.',
  '복합 사고 부족':
    '두 가지 이상의 개념이 결합된 상황에서 공통적으로 풀이 방향을 잡기 어려워하는 모습이 나타납니다.',
  '경우 분류 부족':
    '조건에 따라 경우를 나눠야 하는 상황을 공통적으로 놓치는 경향이 있습니다.',
};

// ── 분석 함수 ────────────────────────────────────────────────────────────────
export function analyzeStudentPerformance(qaRows: QAInput[]): AnalysisData {
  const totalCount = qaRows.length;
  const totalPossible = qaRows.reduce((s, qa) => s + qa.score, 0);
  const totalScore = qaRows.reduce((s, qa) => s + (qa.ans?.earned_score ?? 0), 0);
  const scoreRate = totalPossible > 0 ? (totalScore / totalPossible) * 100 : 0;

  const wrongQAs = qaRows.filter(
    (qa) => qa.ans && !qa.ans.is_correct && !qa.ans.is_blank,
  );
  const blankQAs = qaRows.filter(
    (qa) => !qa.ans || qa.ans.is_blank,
  );

  const tier: 'high' | 'mid' | 'low' =
    scoreRate >= 80 ? 'high' : scoreRate >= 50 ? 'mid' : 'low';

  const skillCounts = new Map<SkillTag, number>();
  const errorCounts = new Map<ErrorTag, number>();
  const stepCounts = new Map<SolvingStepTag, number>();

  for (const qa of [...wrongQAs, ...blankQAs]) {
    const tags = inferTags(qa);
    addCount(skillCounts, tags.skillTags);
    addCount(errorCounts, tags.errorTags);
    addCount(stepCounts, tags.solvingStepTags);
  }

  const coreWeaknesses = deriveWeaknessCategories(skillCounts, errorCounts);
  const topSteps = topN(stepCounts, 1);
  const dominantStep: SolvingStepTag | null = topSteps[0] ?? null;

  return {
    scoreRate,
    tier,
    wrongCount: wrongQAs.length,
    blankCount: blankQAs.length,
    totalCount,
    strongUnits: extractStrengths(qaRows),
    wrongUnitNames: extractWrongUnitNames([...wrongQAs, ...blankQAs]),
    coreWeaknesses,
    dominantStep,
  };
}

// ── 문단 빌더 ────────────────────────────────────────────────────────────────
function buildPara1(ad: AnalysisData): string {
  const { tier, scoreRate, totalCount, wrongCount, blankCount, strongUnits } = ad;
  const answered = totalCount - blankCount;
  const correct = answered - wrongCount;
  const pct = Math.round(scoreRate);
  const parts: string[] = [];

  if (tier === 'high') {
    parts.push(
      `이번 시험에서 ${totalCount}문항 중 ${correct}문항을 정답 처리했습니다(정답률 ${pct}%). 전반적으로 안정적인 성취도를 보였으며, 기본~중간 난이도 문항에서는 큰 흔들림이 없었습니다.`,
    );
  } else if (tier === 'mid') {
    parts.push(
      `이번 시험에서 정답률 ${pct}%를 기록했습니다. 기본 유형은 어느 정도 따라가고 있으나, 조건이 변형되거나 두 개 이상의 개념이 결합될 때 풀이 방향이 흔들리는 모습이 나타났습니다.`,
    );
  } else {
    parts.push(
      `이번 시험에서 정답률 ${pct}%를 기록했습니다. 현재는 여러 유형을 한꺼번에 확장하기보다, 기본 개념과 계산 과정을 먼저 안정화하는 것이 우선인 단계입니다.`,
    );
  }

  if (strongUnits.length >= 2) {
    parts.push(
      `특히 ${strongUnits.slice(0, 2).join(', ')} 단원에서는 비교적 안정적인 모습을 보였습니다.`,
    );
  } else if (strongUnits.length === 1) {
    parts.push(`${strongUnits[0]} 단원에서는 비교적 안정적인 성취도를 확인할 수 있었습니다.`);
  } else if (tier === 'high') {
    parts.push('기본 계산형 문항에서는 큰 실수 없이 마무리했습니다.');
  } else if (tier === 'mid') {
    parts.push(
      '직접 공식을 적용하거나 기본 개념을 확인하는 문항에서는 비교적 안정적이었습니다.',
    );
  }

  return parts.join(' ');
}

function buildPara2(ad: AnalysisData): string {
  const { tier, wrongUnitNames, coreWeaknesses } = ad;
  if (wrongUnitNames.length === 0) return '';

  const units = wrongUnitNames.slice(0, 3);
  const unitList =
    units.length >= 3
      ? `${units[0]}, ${units[1]}, ${units[2]}`
      : units.length === 2
        ? `${units[0]}, ${units[1]}`
        : units[0];

  let intro: string;
  if (tier === 'high') {
    intro = `실점이 발생한 문항을 살펴보면, ${unitList} 유형에서 오답이 나타났습니다.`;
  } else if (tier === 'mid') {
    intro = `오답이 반복된 주요 유형은 ${unitList}입니다.`;
  } else {
    intro = `오답이 집중된 부분은 ${unitList} 관련 문항입니다.`;
  }

  const primary = coreWeaknesses[0];
  if (primary && units.length >= 2) {
    const connection = CROSS_UNIT_CONNECTION[primary];
    if (connection) {
      return `${intro} 이 유형들은 단원은 서로 달라 보이지만, ${connection} 따라서 각 단원을 따로 복습하기보다 공통된 사고 과정을 먼저 훈련하는 접근이 효과적입니다.`;
    }
  }
  if (primary) {
    const action = WEAKNESS_PRESCRIPTION[primary]?.action ?? primary;
    return `${intro} 이 유형들의 공통적인 취약점은 ${action} 부분에서 찾아볼 수 있습니다.`;
  }
  return intro;
}

function buildPara3(ad: AnalysisData): string | null {
  const { dominantStep, coreWeaknesses, tier } = ad;
  if (!dominantStep && coreWeaknesses.length === 0) return null;

  const step = dominantStep ?? '풀이 전략';
  const stepDesc = SOLVING_STAGE_DESC[step];

  let base: string;
  if (step === '계산 실행') {
    base = `오답의 주된 원인은 ${stepDesc}에서 발생한 것으로 보입니다. 계산을 실행하는 과정에서 부호 처리나 전개 과정의 실수가 반복되고 있습니다.`;
  } else if (step === '답 검토') {
    base = `오답이 발생한 단계를 살펴보면, ${stepDesc}을 건너뛴 경우가 많습니다. 구한 값을 원래 조건에 대입해 확인하는 습관이 필요합니다.`;
  } else if (step === '조건 변환' || step === '풀이 전략') {
    base = `이번 오답은 계산 마지막 단계의 실수라기보다, ${stepDesc}에서 어려움이 있었던 것으로 보입니다. 풀이를 시작하기 전에 조건을 구조화하고 접근 방향을 먼저 정하는 훈련이 필요합니다.`;
  } else {
    base = `오답이 주로 발생한 단계는 ${stepDesc}입니다.`;
  }

  const primary = coreWeaknesses[0];
  if (primary === '범위 판단 부족') {
    return (
      base +
      ' 특히 정의역, 해의 범위, 조건 구간을 풀이 초반에 먼저 표시하는 습관이 도움이 됩니다.'
    );
  }
  if (primary === '그래프-식 연결 부족') {
    return (
      base +
      ' 식과 그래프를 서로 연결하는 훈련을 통해 이 단계에서의 실수를 줄일 수 있습니다.'
    );
  }
  if (primary === '조건 해석 부족') {
    return (
      base + ' 조건을 발견하는 즉시 기호나 메모로 표시하는 습관을 만들어 보세요.'
    );
  }
  if (tier === 'high') {
    return base + ' 답을 구한 뒤 조건에 맞는지 한 번 더 확인하는 단계를 추가하면 실점을 줄일 수 있습니다.';
  }
  return base;
}

function buildPara4(ad: AnalysisData): string {
  const { tier, coreWeaknesses, wrongCount, blankCount } = ad;
  const primary = coreWeaknesses[0];
  const secondary = coreWeaknesses[1];
  const prescription = primary ? WEAKNESS_PRESCRIPTION[primary] : null;

  let base: string;
  if (tier === 'high') {
    base = `가장 우선적으로 보완해야 할 부분은 ${primary ?? '고난도 문항 접근 전략'}입니다.`;
    if (prescription) base += ` ${prescription.method}`;
    if (secondary) base += ` 이와 함께 ${secondary}에 대한 보완도 함께 진행하면 효과적입니다.`;
  } else if (tier === 'mid') {
    if (prescription) {
      base = `우선적으로 ${prescription.action}이 필요합니다. ${prescription.method}`;
    } else {
      base =
        '기본 개념과 대표 유형을 반복하면서 풀이 흐름을 안정화하는 것이 중요합니다.';
    }
    if (secondary) {
      base += ` 이후 ${secondary}를 보완하는 방향으로 학습 계획을 세우면 좋습니다.`;
    }
  } else {
    base = blankCount > 0
      ? '미응답 문항이 있으므로, 쉬운 유형부터 차근차근 확보하는 전략이 필요합니다. '
      : '';
    if (prescription) {
      base += `현재 가장 필요한 것은 ${prescription.action}입니다. ${prescription.method}`;
    } else {
      base +=
        '기본 개념을 다시 정리하고, 핵심 유형별로 단계적으로 반복하는 방식으로 접근하는 것이 좋습니다.';
    }
    if (wrongCount >= 5) {
      base += ' 한꺼번에 여러 단원을 확장하기보다, 한 유형씩 완전히 이해한 뒤 다음으로 넘어가는 방식을 권장합니다.';
    }
  }

  return base.trim();
}

function buildPara5(ad: AnalysisData): string | null {
  const { tier, coreWeaknesses } = ad;
  const primary = coreWeaknesses[0];
  if (!primary) return null;

  const warning = WEAKNESS_RISK[primary] ?? '';

  let base: string;
  if (tier === 'high') {
    base =
      '개념 이해는 안정적인 수준이지만, 현재 패턴이 이어질 경우 다음 시험에서 고난도 조건형 문항에서 실점 가능성이 있습니다.';
  } else if (tier === 'mid') {
    base =
      '현재 패턴이 이어질 경우, 다음 시험에서 단순 계산 문항보다 조건이 복잡한 문항에서 더 많은 실점이 예상됩니다.';
  } else {
    base =
      '기본기를 탄탄히 다지지 않으면 다음 시험에서도 비슷한 유형에서 어려움이 반복될 수 있습니다.';
  }

  const combined = warning ? `${base} ${warning}` : base;
  return combined + ' 단순 반복 풀이보다 문제를 읽는 첫 단계에서 조건을 구조화하는 훈련이 우선입니다.';
}

// ── 메인 진입점 ──────────────────────────────────────────────────────────────
export function generateStudentNarrativeSummary(qaRows: QAInput[]): NarrativeSummaryResult {
  // 예외: 데이터 없음
  if (qaRows.length === 0) {
    return {
      paragraphs: [
        '분석 가능한 문항 데이터가 부족합니다. 문항과 답안을 입력한 후 다시 확인해 주세요.',
      ],
      priorityPoints: [],
      analysisData: {
        scoreRate: 0,
        tier: 'low',
        wrongCount: 0,
        blankCount: 0,
        totalCount: 0,
        strongUnits: [],
        wrongUnitNames: [],
        coreWeaknesses: [],
        dominantStep: null,
      },
    };
  }

  const ad = analyzeStudentPerformance(qaRows);

  // 예외: 오답 거의 없음
  if (ad.wrongCount + ad.blankCount <= 1) {
    const unitDesc =
      ad.strongUnits.length > 0 ? `${ad.strongUnits.slice(0, 2).join(', ')} 등 ` : '';
    return {
      paragraphs: [
        `이번 시험에서 ${unitDesc}전체 문항에 걸쳐 매우 안정적인 성취도를 보였습니다. 오답이 거의 없는 결과로, 기본 개념 이해와 풀이 과정 모두 안정적입니다.`,
        `현재 수준을 유지하면서, 고난도 문항에서의 실수 관리와 풀이 시간 단축에 초점을 맞추는 것이 좋습니다. 복합 조건이 결합된 문항이나 새로운 변형 유형에서 접근 전략을 다양화하는 연습이 다음 단계입니다.`,
      ],
      priorityPoints: ['고난도 실수 관리', '풀이 시간 단축'],
      analysisData: ad,
    };
  }

  // 예외: 오답 70% 이상
  if (ad.wrongCount + ad.blankCount >= ad.totalCount * 0.7) {
    const unitList = ad.wrongUnitNames.slice(0, 2).join(', ');
    return {
      paragraphs: [
        `이번 시험 정답률 ${Math.round(ad.scoreRate)}%로, 전체적으로 기본 개념과 풀이 방향을 다시 정리할 필요가 있습니다.`,
        unitList
          ? `세부 유형별 분석 전에, ${unitList} 관련 기본 문항부터 개념 정의와 핵심 풀이 흐름을 먼저 안정화하는 것이 우선입니다.`
          : '세부 유형별 분석보다 기본 개념과 핵심 유형의 풀이 흐름을 먼저 안정화하는 것이 우선입니다.',
        '한꺼번에 여러 유형을 확장하기보다, 가장 쉬운 난이도부터 정확하게 풀어내는 경험을 반복하는 것이 지금 단계에서 가장 효과적입니다.',
      ],
      priorityPoints: ['기본 개념 재정리', '핵심 유형 반복', '계산 안정성'],
      analysisData: ad,
    };
  }

  // 정상 경로: 5문단 생성
  const para1 = buildPara1(ad);
  const para2 = buildPara2(ad);
  const para3 = buildPara3(ad);
  const para4 = buildPara4(ad);
  const para5 = buildPara5(ad);

  const paragraphs = [para1, para2, para3, para4, para5].filter(
    (p): p is string => !!p && p.length > 0,
  );

  const priorityPoints = ad.coreWeaknesses
    .slice(0, 3)
    .map((w) => w.replace(' 부족', '').replace(' 문제', ''));

  return { paragraphs, priorityPoints, analysisData: ad };
}
