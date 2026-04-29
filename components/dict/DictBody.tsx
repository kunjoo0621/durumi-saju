import type { DictBody, DictBodySection } from "@/lib/dict/types";

function Section({ section }: { section: DictBodySection }) {
  return (
    <section className="py-1">
      <h2 className="text-title-2 text-text-primary font-aggro mb-5 flex items-center gap-3">
        <span className="w-1 h-6 rounded-full bg-[#FF6B6B]" aria-hidden="true" />
        {section.heading}
      </h2>
      <div className="space-y-4 text-text-secondary leading-[1.85] text-[15px]">
        {section.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

export default function DictBodyView({ body }: { body: DictBody }) {
  return (
    <div>
      {body.intro && (
        <p className="text-body-1 text-text-primary leading-[1.75] tracking-tight mb-2">
          {body.intro}
        </p>
      )}

      <div className="mt-8 space-y-10">
        {body.sections.map((section, i) => (
          <div key={i}>
            <Section section={section} />
            {i < body.sections.length - 1 && (
              <div className="h-px bg-white/[0.06] mt-10" aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
