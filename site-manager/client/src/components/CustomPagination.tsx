import React from "react";
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from "@/components/ui/pagination";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface CustomPaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    limit: number;
    onLimitChange: (limit: number) => void;
    totalRecords: number;
    entityName: string;
    limitOptions?: number[];
}

export const CustomPagination: React.FC<CustomPaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    limit,
    onLimitChange,
    totalRecords,
    entityName,
    limitOptions = [10, 20, 50, 100],
}) => {
    const startRange = (currentPage - 1) * limit + 1;
    const endRange = Math.min(currentPage * limit, totalRecords);

    const getPageNumbers = () => {
        const pages = [];
        const showMax = 5;

        if (totalPages <= showMax) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("ellipsis-start");

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) pages.push(i);
            }

            if (currentPage < totalPages - 2) pages.push("ellipsis-end");
            if (!pages.includes(totalPages) && totalPages > 1) pages.push(totalPages);
        }
        return pages;
    };

    if (totalRecords === 0) return null;

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 border-t mt-4">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-muted-foreground w-full sm:w-auto">
                <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <Select
                        value={limit.toString()}
                        onValueChange={(val) => onLimitChange(Number(val))}
                    >
                        <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {limitOptions.map((opt) => (
                                <SelectItem key={opt} value={opt.toString()}>
                                    {opt}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span className="whitespace-nowrap">
                    Showing {startRange}-{endRange} of {totalRecords} {entityName}
                </span>
            </div>

            <Pagination className="w-full sm:w-auto justify-center sm:justify-end">
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (currentPage > 1) onPageChange(currentPage - 1);
                            }}
                            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                    </PaginationItem>

                    {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                            {page === "ellipsis-start" || page === "ellipsis-end" ? (
                                <PaginationEllipsis />
                            ) : (
                                <PaginationLink
                                    href="#"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        onPageChange(page as number);
                                    }}
                                    isActive={currentPage === page}
                                    className="cursor-pointer"
                                >
                                    {page}
                                </PaginationLink>
                            )}
                        </PaginationItem>
                    ))}

                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                if (currentPage < totalPages) onPageChange(currentPage + 1);
                            }}
                            className={
                                currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                            }
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    );
};
