'use client';

import { use } from 'react';
import ClassTestPicker from '@/components/admin/ClassTestPicker';

export default function ClassAnswersHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ClassTestPicker classId={Number(id)} mode="answers" />;
}
