'use client';

import { use } from 'react';
import StudentTestPicker from '@/components/admin/StudentTestPicker';

export default function StudentReportHubPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  return <StudentTestPicker studentId={Number(studentId)} />;
}
