import { PortfolioBuilder } from "@/components/portfolio-builder";

export const metadata = {
  title: "Portfolio Books — EA Index",
  description: "Drag-and-drop portfolio construction with real-time metrics",
};

export default function BooksPage() {
  return (
    <main className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-semibold text-text mb-1">
          Portfolio Books
        </h1>
        <p className="text-sm text-text-tertiary">
          Build and manage strategy portfolios. Drag strategies from the library
          to assemble weighted books with real-time allocation validation.
        </p>
      </div>
      <PortfolioBuilder />
    </main>
  );
}
