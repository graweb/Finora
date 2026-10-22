import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-zinc-400">
      <span>{totalItems} registros</span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Página anterior"
          className="text-white hover:bg-[#302e67] hover:text-white"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span>
          Página {page} de {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Próxima página"
          className="text-white hover:bg-[#302e67] hover:text-white"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
