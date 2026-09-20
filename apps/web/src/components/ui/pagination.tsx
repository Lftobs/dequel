import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationProps {
	page: number;
	totalItems: number;
	pageSize: number;
	onPageChange: (page: number) => void;
}

export function Pagination({ page, totalItems, pageSize, onPageChange }: PaginationProps) {
	const totalPages = Math.ceil(totalItems / pageSize);
	if (totalPages <= 1) return null;

	return (
		<div className="flex items-center justify-between pt-3">
			<span className="text-[11px] text-muted-foreground">
				{Math.min((page - 1) * pageSize + 1, totalItems)}-{Math.min(page * pageSize, totalItems)} of {totalItems}
			</span>
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
					className="h-7 w-7 p-0 text-muted-foreground"
				>
					<ChevronLeft className="h-3.5 w-3.5" />
				</Button>
				{Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
					let pageNum: number;
					if (totalPages <= 5) {
						pageNum = i + 1;
					} else if (page <= 3) {
						pageNum = i + 1;
					} else if (page >= totalPages - 2) {
						pageNum = totalPages - 4 + i;
					} else {
						pageNum = page - 2 + i;
					}
					return (
						<Button
							key={pageNum}
							var="ghost"
							size="sm"
							onClick={() => onPageChange(pageNum)}
							className={`h-7 w-7 p-0 text-[11px] ${pageNum === page ? "bg-muted text-foreground font-semibold" : "text-muted-foreground"}`}
						>
							{pageNum}
						</Button>
					);
				})}
				<Button
					variant="ghost"
					size="sm"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
					className="h-7 w-7 p-0 text-muted-foreground"
				>
					<ChevronRight className="h-3.5 w-3.5" />
				</Button>
			</div>
		</div>
	);
}
