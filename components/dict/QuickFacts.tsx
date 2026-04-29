export type QuickFactItem = {
  label: string;
  value: string;
};

export default function QuickFacts({ items }: { items: QuickFactItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-background-secondary border border-white/[0.04] px-4 py-3.5"
        >
          <div className="text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
            {item.label}
          </div>
          <div className="text-[15px] text-text-primary mt-1.5 font-semibold leading-tight">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
