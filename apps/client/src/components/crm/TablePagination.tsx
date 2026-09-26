import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CRM_LOCALE } from '@crm/shared';
import { Button } from '@/components/ui/button';

interface Props {
  page: number; // 1-based
  limit: number;
  total: number;
  onPage: (page: number) => void;
}

/**
 * Paginación server-side: "X–Y de N" + anterior/siguiente. Se oculta cuando todo
 * cabe en una página.
 */
export function TablePagination({ page, limit, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground" aria-label="Paginación">
      <span className="tabular-nums">
        {from.toLocaleString(CRM_LOCALE)}–{to.toLocaleString(CRM_LOCALE)} de {total.toLocaleString(CRM_LOCALE)}
      </span>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="tabular-nums">
        {page}/{pages}
      </span>
      <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Página siguiente">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}
