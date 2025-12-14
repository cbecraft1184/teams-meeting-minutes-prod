import { Button, makeStyles, shorthands, tokens } from "@fluentui/react-components";
import {
  ChevronLeft24Regular,
  ChevronRight24Regular,
  ChevronDoubleLeft20Regular,
  ChevronDoubleRight20Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  paginationRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    ...shorthands.gap("4px"),
    marginTop: "16px",
  },
  pageButton: {
    minWidth: "32px",
  },
  pageNumberButton: {
    minWidth: "36px",
    height: "36px",
    ...shorthands.padding("0"),
  },
  pageNumberButtonActive: {
    minWidth: "36px",
    height: "36px",
    ...shorthands.padding("0"),
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    ":hover": {
      backgroundColor: tokens.colorBrandBackgroundHover,
      color: tokens.colorNeutralForegroundOnBrand,
    },
  },
  pageInfo: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    ...shorthands.padding("0", "8px"),
  },
});

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
}: PaginationProps) {
  const styles = useStyles();

  if (totalPages <= 1) {
    return null;
  }

  const getVisiblePages = (): number[] => {
    const pages: number[] = [];
    const half = Math.floor(maxVisiblePages / 2);
    
    let start = Math.max(1, currentPage - half);
    let end = Math.min(totalPages, start + maxVisiblePages - 1);
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={styles.paginationRow}>
      <Button
        appearance="subtle"
        icon={<ChevronDoubleLeft20Regular />}
        disabled={currentPage === 1}
        onClick={() => onPageChange(1)}
        data-testid="button-first-page"
        className={styles.pageButton}
        title="First page"
      />
      <Button
        appearance="subtle"
        icon={<ChevronLeft24Regular />}
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        data-testid="button-prev-page"
        className={styles.pageButton}
        title="Previous page"
      />
      
      {visiblePages.map((page) => (
        <Button
          key={page}
          appearance={page === currentPage ? "primary" : "subtle"}
          onClick={() => onPageChange(page)}
          data-testid={`button-page-${page}`}
          className={page === currentPage ? styles.pageNumberButtonActive : styles.pageNumberButton}
        >
          {page}
        </Button>
      ))}
      
      <Button
        appearance="subtle"
        icon={<ChevronRight24Regular />}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        data-testid="button-next-page"
        className={styles.pageButton}
        title="Next page"
      />
      <Button
        appearance="subtle"
        icon={<ChevronDoubleRight20Regular />}
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(totalPages)}
        data-testid="button-last-page"
        className={styles.pageButton}
        title="Last page"
      />
      
      <span className={styles.pageInfo} data-testid="text-page-info">
        ({currentPage} of {totalPages})
      </span>
    </div>
  );
}
