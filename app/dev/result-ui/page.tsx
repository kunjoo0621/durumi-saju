import { notFound } from "next/navigation";
import ResultTable from "@/components/result/ResultTable";
import { MOCK_RESULT } from "@/lib/mockResult";

export default function DevResultUiPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background-primary px-6 py-8">
      <div className="max-w-[640px] mx-auto">
        <ResultTable result={MOCK_RESULT} locked={false} statusLabel="언락" initialExpandedCount={0} />
      </div>
    </div>
  );
}
