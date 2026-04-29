import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="breadcrumb"
      className="text-caption text-text-tertiary flex items-center gap-1.5 flex-wrap"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-text-primary transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-text-primary" : undefined}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <CaretRight
                size={11}
                weight="bold"
                className="text-text-tertiary opacity-60"
                aria-hidden="true"
              />
            )}
          </span>
        );
      })}
    </nav>
  );
}
