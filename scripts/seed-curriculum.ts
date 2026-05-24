import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import path from 'node:path';

type CurriculumType = 'old' | 'new';

type SmallUnitInput = {
  name: string;
};

type MiddleUnitInput = {
  name: string;
  smalls: SmallUnitInput[];
};

type MajorUnitInput = {
  name: string;
  middles: MiddleUnitInput[];
};

type SubjectInput = {
  name: string;
  curriculumType: CurriculumType;
  majors: MajorUnitInput[];
};

type TableName = 'subjects' | 'units_major' | 'units_middle' | 'units_small';

type InsertableRecord = Record<string, string | number>;

const rootDir = process.cwd();

config({ path: path.join(rootDir, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('필수 Supabase 환경변수가 설정되지 않았습니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function cleanName(value: string) {
  return value.trim().replace(/\s*:\s*$/, '').trim();
}

function stripMajor(value: string) {
  return cleanName(value.trim().replace(/^\d{2}\s+/, ''));
}

function stripMiddle(value: string) {
  return cleanName(value.trim().replace(/^\d+\.\s+/, ''));
}

function stripSmall(value: string) {
  return cleanName(value.trim().replace(/^\d{2}\.?\s*/, ''));
}

function parseCurriculum(filePath: string, curriculumType: CurriculumType): SubjectInput[] {
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const subjects: SubjectInput[] = [];
  let subject: SubjectInput | null = null;
  let major: MajorUnitInput | null = null;
  let middle: MiddleUnitInput | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const indent = (line.match(/^ */) ?? [''])[0].length;
    const trimmed = line.trim();
    let subjectMatch = trimmed.match(/^\[(?:구|신)교육과정\]\s*-\s*(.+?)\s*:\s*$/);

    if (!subjectMatch && /^-\s*.+:\s*$/.test(trimmed)) {
      subjectMatch = trimmed.match(/^-\s*(.+?)\s*:\s*$/);
    }

    if (!subjectMatch && !trimmed.startsWith('[') && /^.+:\s*$/.test(trimmed) && indent === 0) {
      subjectMatch = trimmed.match(/^(.+?)\s*:\s*$/);
    }

    if (subjectMatch) {
      subject = { name: cleanName(subjectMatch[1]), curriculumType, majors: [] };
      subjects.push(subject);
      major = null;
      middle = null;
      continue;
    }

    if (!subject) continue;

    if (indent === 3 && /^\d{2}\s+/.test(trimmed)) {
      major = { name: stripMajor(trimmed), middles: [] };
      subject.majors.push(major);
      middle = null;
      continue;
    }

    if (indent === 10 && /^\d+\.\s+/.test(trimmed)) {
      middle = { name: stripMiddle(trimmed), smalls: [] };
      if (!major) {
        major = { name: '미분류', middles: [] };
        subject.majors.push(major);
      }
      major.middles.push(middle);
      continue;
    }

    if (indent >= 18 && /^\d{2}\.?\s*/.test(trimmed)) {
      if (!middle) {
        if (!major) {
          major = { name: '미분류', middles: [] };
          subject.majors.push(major);
        }
        middle = { name: '미분류', smalls: [] };
        major.middles.push(middle);
      }
      middle.smalls.push({ name: stripSmall(trimmed) });
    }
  }

  return subjects;
}

function countCurriculum(subjects: SubjectInput[]) {
  const counts = {
    subjects: subjects.length,
    majors: 0,
    middles: 0,
    smalls: 0,
  };

  for (const subject of subjects) {
    counts.majors += subject.majors.length;
    for (const major of subject.majors) {
      counts.middles += major.middles.length;
      for (const middle of major.middles) {
        counts.smalls += middle.smalls.length;
      }
    }
  }

  return counts;
}

async function tableHasOrderIndex(table: TableName) {
  const { error } = await supabase.from(table).select('order_index').limit(1);
  return !error;
}

function withOrderIndex(
  record: InsertableRecord,
  orderIndex: number,
  enabled: boolean,
): InsertableRecord {
  return enabled ? { ...record, order_index: orderIndex } : record;
}

async function deleteExistingCurriculum() {
  for (const table of ['units_small', 'units_middle', 'units_major', 'subjects'] as const) {
    const { error } = await supabase.from(table).delete().gte('id', 0);
    if (error) {
      throw new Error(`${table} 삭제 실패: ${error.message}`);
    }
  }
}

async function insertAndReturnId(table: TableName, record: InsertableRecord) {
  const { data, error } = await supabase.from(table).insert(record).select('id').single();

  if (error) {
    throw new Error(`${table} 삽입 실패: ${error.message}`);
  }

  if (!data?.id) {
    throw new Error(`${table} 삽입 후 id를 받지 못했습니다.`);
  }

  return Number(data.id);
}

async function seedCurriculum(subjects: SubjectInput[]) {
  const hasOrderIndex = {
    subjects: await tableHasOrderIndex('subjects'),
    units_major: await tableHasOrderIndex('units_major'),
    units_middle: await tableHasOrderIndex('units_middle'),
    units_small: await tableHasOrderIndex('units_small'),
  };

  await deleteExistingCurriculum();

  for (const [subjectIndex, subject] of subjects.entries()) {
    const subjectId = await insertAndReturnId(
      'subjects',
      withOrderIndex(
        {
          name: subject.name,
          curriculum_type: subject.curriculumType,
        },
        subjectIndex + 1,
        hasOrderIndex.subjects,
      ),
    );

    for (const [majorIndex, major] of subject.majors.entries()) {
      const majorId = await insertAndReturnId(
        'units_major',
        withOrderIndex(
          {
            subject_id: subjectId,
            name: major.name,
          },
          majorIndex + 1,
          hasOrderIndex.units_major,
        ),
      );

      for (const [middleIndex, middle] of major.middles.entries()) {
        const middleId = await insertAndReturnId(
          'units_middle',
          withOrderIndex(
            {
              major_unit_id: majorId,
              name: middle.name,
            },
            middleIndex + 1,
            hasOrderIndex.units_middle,
          ),
        );

        for (const [smallIndex, small] of middle.smalls.entries()) {
          await insertAndReturnId(
            'units_small',
            withOrderIndex(
              {
                middle_unit_id: middleId,
                name: small.name,
              },
              smallIndex + 1,
              hasOrderIndex.units_small,
            ),
          );
        }
      }
    }
  }
}

async function main() {
  const subjects = [
    ...parseCurriculum(path.join(rootDir, 'data', 'curriculum', '구교육과정.txt'), 'old'),
    ...parseCurriculum(path.join(rootDir, 'data', 'curriculum', '신교육과정.txt'), 'new'),
  ];
  const counts = countCurriculum(subjects);

  await seedCurriculum(subjects);

  console.log('삭제 완료: 예');
  console.log(`추가한 과목 수: ${counts.subjects}`);
  console.log(`추가한 대단원 수: ${counts.majors}`);
  console.log(`추가한 중단원 수: ${counts.middles}`);
  console.log(`추가한 소단원 수: ${counts.smalls}`);
  console.log('커리큘럼 seed 완료');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
  console.error(message);
  process.exit(1);
});
