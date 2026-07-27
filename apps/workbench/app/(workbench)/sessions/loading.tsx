import { SkeletonTable } from '@/components/ui/skeleton';

export default function Loading() {
  return <SkeletonTable rows={6} cols={5} />;
}
