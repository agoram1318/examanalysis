import Link from 'next/link';
import { FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function PrintReportLink({
  href,
  label = '인쇄용 리포트 보기',
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer">
      <Button variant="outline" size="sm">
        <FileText size={14} /> {label}
      </Button>
    </Link>
  );
}
