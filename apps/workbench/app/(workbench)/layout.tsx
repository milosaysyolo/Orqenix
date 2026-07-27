import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function WorkbenchLayout({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary name="Workbench">{children}</ErrorBoundary>;
}
