import FloatingSajuCTA from "@/components/dict/FloatingSajuCTA";

export default function DictLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <FloatingSajuCTA />
    </>
  );
}
