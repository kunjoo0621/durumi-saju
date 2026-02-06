"use client";

export default function LandingBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#4f46e5_0%,#2d1b69_36%,#140f2f_62%,#05040f_100%)]" />

      <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-fuchsia-300/30 blur-3xl" />
      <div className="absolute top-16 right-[-70px] h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="absolute top-[32%] left-[-80px] h-72 w-72 rounded-full bg-indigo-300/15 blur-3xl" />
      <div className="absolute top-[38%] right-[10%] h-44 w-44 rounded-[52%_48%_62%_38%/40%_56%_44%_60%] bg-violet-300/20 blur-2xl" />
      <div className="absolute bottom-[26%] left-[16%] h-36 w-36 rounded-[58%_42%_46%_54%/48%_34%_66%_52%] bg-sky-300/15 blur-2xl" />
      <div className="absolute bottom-[18%] right-[-60px] h-80 w-80 rounded-full bg-purple-300/20 blur-3xl" />
      <div className="absolute bottom-[-60px] left-[-30px] h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_45%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(147,197,253,0.12),transparent_35%)]" />
    </div>
  );
}
