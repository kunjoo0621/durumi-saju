// 5명 재물운·결혼운 결과표를 두루미 다크 톡스풍 모바일 페이지로 렌더 (자체완결 HTML).
// 실행: node --import tsx scripts/build-preview-artifact.mts <출력경로.html>
import { readFileSync, writeFileSync } from "node:fs";

const data = JSON.parse(readFileSync("scripts/enrich-quality-output.json", "utf8"));
const out = process.argv[2] ?? "preview.html";

// 짧은 라벨/서브
const META: Record<string, { short: string; sub: string }> = {
  "운영자(1995-06-21 계미)": { short: "운영자", sub: "1995 · 계미 · 솔로" },
  "기혼여성(1988-03-15)": { short: "기혼", sub: "1988 · 여성 · 기혼" },
  "다시혼자여성(1975-11-02)": { short: "다시혼자", sub: "1975 · 여성 · 이혼·사별" },
  "연애중남성(1992-07-20)": { short: "연애중", sub: "1992 · 남성 · 연애중" },
  "시간모름여성(2000-01-10)": { short: "시간모름", sub: "2000 · 여성 · 시간미상" },
};

const enriched = data.map((p: any) => ({ ...p, meta: META[p.label] ?? { short: p.label, sub: "" } }));

const html = `<h1 class="sr-only">재물운·결혼운 풍부화 결과 미리보기</h1>
<div id="app"></div>
<script id="data" type="application/json">${JSON.stringify(enriched).replace(/</g, "\\u003c")}</script>
<script>
const DATA = JSON.parse(document.getElementById("data").textContent);
const MOOD = {
  강세: { icon: "☀", label: "맑음", cls: "m-sun" },
  보통: { icon: "☁", label: "흐림", cls: "m-cloud" },
  주의: { icon: "☂", label: "비 예보", cls: "m-rain" },
};
const GRADE_LABEL = { S: "SS", A: "S", B: "A", C: "B", D: "C" }; // 내부→표시 격상(참고표기)
let pIdx = 0, svc = "wealth";

const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
const esc = (s) => String(s).replace(/[&<>]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]));

function timeline(tl, accent) {
  if (!tl || !tl.entries || !tl.entries.length) return el("div");
  const wrap = el("section", "tl");
  const strip = el("div", "tl-strip");
  const row = el("div", "tl-row");
  tl.entries.forEach(e => {
    const m = MOOD[e.mood] || MOOD["보통"];
    const cell = el("div", "tl-cell" + (e.isCurrent ? " cur" : "") + (e.isPast ? " past" : ""));
    cell.innerHTML = \`<span class="tl-yr">\${e.year}</span><span class="tl-ic \${m.cls}">\${m.icon}</span><span class="tl-lb">\${e.isPast ? "지남" : m.label}</span>\`;
    row.appendChild(cell);
  });
  strip.appendChild(row); wrap.appendChild(strip);
  const detail = el("div", "tl-detail");
  tl.entries.filter(e => !e.isPast).forEach(e => {
    const m = MOOD[e.mood] || MOOD["보통"];
    const r = el("article", "tl-d");
    r.innerHTML = \`<div class="tl-d-top"><span class="tl-d-yr">\${e.year}</span><span class="tl-ic sm \${m.cls}">\${m.icon}</span><span class="tl-d-lb \${m.cls}">\${m.label}</span></div>
      <p class="tl-hint">\${esc(e.hint)}</p>
      <p class="tl-sub">\${e.age}세 · \${e.pillarKorean}년 · \${esc(e.tenStar)}운 · \${esc(e.twelveStage)}</p>\`;
    detail.appendChild(r);
  });
  wrap.appendChild(detail);
  if (tl.daeun && tl.daeun.length) {
    const d = el("div", "daeun");
    d.innerHTML = '<div class="daeun-h">10년 단위 큰 흐름</div><div class="daeun-chips">' +
      tl.daeun.map(x => \`<span class="chip">\${x.startAge}~\${x.endAge}세 · \${esc(x.star)} 대운</span>\`).join("") + '</div>';
    wrap.appendChild(d);
  }
  return wrap;
}

function block(eyebrow, title, text) {
  return \`<section class="blk"><p class="eyebrow">\${eyebrow}</p>\${title ? \`<h3 class="blk-t">\${title}</h3>\` : ""}<p class="body">\${esc(text)}</p></section>\`;
}

function adviceList(adv) {
  if (!adv || !adv.length) return "";
  return '<section class="adv"><p class="eyebrow">실천 조언</p>' + adv.map(a => {
    const tag = (a.tag || "").replace(/\\[근거:?/, "").replace(/\\]/, "").trim();
    return \`<div class="adv-i"><p class="adv-t">\${esc(a.text)}</p>\${tag ? \`<span class="adv-tag">\${esc(tag)}</span>\` : ""}</div>\`;
  }).join("") + "</section>";
}

function sheet(p) {
  const isW = svc === "wealth";
  const b = (isW ? p.wealth : p.marriage).blocks;
  const info = isW ? p.wealth : p.marriage;
  const accent = isW ? "w" : "m";
  const root = el("div", "sheet acc-" + accent);
  const disp = GRADE_LABEL[info.grade] || info.grade;
  // 히어로
  root.appendChild(el("div", "hero", \`
    <div class="hero-top"><span class="svc-badge">\${isW ? "재물운" : "결혼운"} 심층검사</span>
      <span class="grade-badge g-\${info.grade}">\${disp}<i>등급</i></span></div>
    <h2 class="headline">\${esc(b.gradeHeadline || "")}</h2>
    <div class="qa"><span>총 \${info.total.toLocaleString()}자</span><span>·</span><span>재생성 \${info.attempts}회</span><span>·</span><span>본문 5블록</span></div>\`));

  const body = el("div", "sheet-body");
  if (isW) {
    body.innerHTML = block("재성 · 어느 국면의 돈인가", "재성 진단", b.jaeseongDiagnosis)
      + block("", "재를 담는 그릇", b.jaeGripDiagnosis);
    body.appendChild(timeline(b.serverTimeline, accent));
    body.insertAdjacentHTML("beforeend",
      block("관심사 · 방식", "돈이 붙고 새는 방식", b.savingStyle)
      + block("속도 · 리스크", "네 재물 페이스", b.riskAndPace)
      + block("타이밍", "언제 움직일까", b.timingFlow)
      + adviceList(b.advice)
      + \`<section class="cta">\${esc(b.yearlyCta || "")}</section>\`);
  } else {
    body.innerHTML = block("배우자궁 · 배우자성", "배우자궁 진단", b.spousePalace)
      + block("", "배우자성 분석", b.spouseStar);
    body.appendChild(timeline(b.serverTimeline, accent));
    body.insertAdjacentHTML("beforeend",
      block("배우자상", "곁에 어울리는 사람", b.partnerProfile)
      + block("관계 패턴", "네가 관계에서 그리는 그림", b.relationshipPattern)
      + block("타이밍", "인연의 흐름", b.timingFlow)
      + adviceList(b.advice)
      + \`<section class="cta">\${esc(b.gunghapCta || "")}</section>\`);
  }
  root.appendChild(body);
  return root;
}

function render() {
  const app = document.getElementById("app");
  app.innerHTML = "";
  // 헤더
  const head = el("header", "top");
  head.innerHTML = \`<div class="brand">두루미 · 결과표 미리보기</div>
    <div class="note">재물운·결혼운 풍부화 후 실제 생성본 (운영자 포함 5명 · 실 파이프라인)</div>\`;
  // 사람 선택
  const people = el("div", "people");
  DATA.forEach((p, i) => {
    const c = el("button", "pchip" + (i === pIdx ? " on" : ""));
    c.innerHTML = \`<span class="pchip-n">\${p.meta.short}</span><span class="pchip-s">\${p.meta.sub}</span>\`;
    c.onclick = () => { pIdx = i; render(); window.scrollTo({ top: 0 }); };
    people.appendChild(c);
  });
  head.appendChild(people);
  // 서비스 탭
  const tabs = el("div", "tabs");
  [["wealth", "재물운"], ["marriage", "결혼운"]].forEach(([k, l]) => {
    const t = el("button", "tab" + (svc === k ? " on acc-" + (k === "wealth" ? "w" : "m") : ""));
    t.textContent = l;
    t.onclick = () => { svc = k; render(); };
    tabs.appendChild(t);
  });
  head.appendChild(tabs);
  app.appendChild(head);
  app.appendChild(sheet(DATA[pIdx]));
}
render();
</script>

<style>
:root{
  --bg:#0f0f11; --card:#1a1a1d; --card2:#232327; --line:rgba(255,255,255,.07);
  --tx:#f2f2f3; --tx2:#a6a6ad; --tx3:#75757e;
  --w:#e3b25c; --w-soft:rgba(227,178,92,.14);
  --m:#e392ac; --m-soft:rgba(227,146,172,.14);
  --sun:#79c996; --cloud:#8b8b93; --rain:#d9ad5c;
  --maxw:460px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--tx);
  font-family:"Apple SD Gothic Neo","Pretendard","Malgun Gothic",system-ui,-apple-system,sans-serif;
  line-height:1.5;-webkit-font-smoothing:antialiased;}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}
#app{max-width:var(--maxw);margin:0 auto;padding-bottom:64px;}

/* 헤더 */
.top{position:sticky;top:0;z-index:10;background:linear-gradient(180deg,var(--bg) 70%,transparent);
  padding:16px 18px 10px;backdrop-filter:blur(8px);}
.brand{font-size:13px;font-weight:700;letter-spacing:.02em;color:var(--tx2);}
.note{font-size:11.5px;color:var(--tx3);margin-top:3px;line-height:1.45;}
.people{display:flex;gap:8px;overflow-x:auto;margin:12px -18px 0;padding:0 18px 2px;scrollbar-width:none;}
.people::-webkit-scrollbar{display:none}
.pchip{flex:0 0 auto;background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:8px 13px;text-align:left;color:var(--tx2);cursor:pointer;transition:.15s;display:flex;flex-direction:column;gap:2px;}
.pchip:hover{border-color:rgba(255,255,255,.18)}
.pchip.on{background:var(--card2);border-color:rgba(255,255,255,.28);color:var(--tx);}
.pchip-n{font-size:13.5px;font-weight:700;}
.pchip-s{font-size:10.5px;color:var(--tx3);font-variant-numeric:tabular-nums;}
.tabs{display:flex;gap:8px;margin-top:12px;}
.tab{flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;
  font-size:14px;font-weight:700;color:var(--tx2);cursor:pointer;transition:.15s;}
.tab.on.acc-w{background:var(--w-soft);border-color:var(--w);color:var(--w);}
.tab.on.acc-m{background:var(--m-soft);border-color:var(--m);color:var(--m);}

/* 시트 */
.sheet{padding:6px 18px 0;}
.acc-w{--acc:var(--w);--acc-soft:var(--w-soft);}
.acc-m{--acc:var(--m);--acc-soft:var(--m-soft);}
.hero{background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line);
  border-radius:22px;padding:20px 18px;margin-top:14px;}
.hero-top{display:flex;justify-content:space-between;align-items:center;}
.svc-badge{font-size:11.5px;font-weight:700;color:var(--acc);background:var(--acc-soft);
  padding:5px 10px;border-radius:999px;}
.grade-badge{font-size:22px;font-weight:800;color:var(--acc);display:flex;align-items:baseline;gap:4px;}
.grade-badge i{font-size:11px;font-style:normal;font-weight:600;color:var(--tx3);}
.headline{font-size:22px;line-height:1.34;font-weight:800;margin:15px 0 0;
  letter-spacing:-.01em;text-wrap:balance;word-break:keep-all;}
.qa{display:flex;gap:6px;margin-top:12px;font-size:11px;color:var(--tx3);
  font-variant-numeric:tabular-nums;border-top:1px solid var(--line);padding-top:11px;}

.sheet-body{margin-top:6px;}
.blk{padding:26px 2px 0;}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.04em;color:var(--acc);margin:0;text-transform:none;}
.blk-t{font-size:15.5px;font-weight:800;margin:12px 0 8px;color:var(--tx);}
.body{font-size:15px;line-height:1.78;color:var(--tx);margin:8px 0 0;word-break:keep-all;
  white-space:pre-line;letter-spacing:-.003em;}

/* 타임라인 */
.tl{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:18px 16px;margin-top:26px;}
.tl-strip{overflow-x:auto;margin:0 -16px;padding:0 16px;scrollbar-width:none;}
.tl-strip::-webkit-scrollbar{display:none}
.tl-row{display:flex;gap:8px;width:max-content;}
.tl-cell{flex:0 0 auto;width:64px;border-radius:14px;padding:11px 0;display:flex;flex-direction:column;
  align-items:center;gap:5px;background:transparent;}
.tl-cell.cur{background:var(--card2);box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);}
.tl-cell.past{opacity:.4;}
.tl-yr{font-size:13px;font-weight:700;color:var(--tx2);font-variant-numeric:tabular-nums;}
.tl-ic{font-size:26px;line-height:1;}
.tl-ic.sm{font-size:20px;}
.m-sun{color:var(--sun);} .m-cloud{color:var(--cloud);} .m-rain{color:var(--rain);}
.tl-lb{font-size:10.5px;font-weight:700;white-space:nowrap;color:var(--tx3);}
.tl-detail{margin-top:16px;border-top:1px solid var(--line);padding-top:6px;}
.tl-d{padding:13px 0;border-bottom:1px solid var(--line);}
.tl-d:last-child{border-bottom:0;}
.tl-d-top{display:flex;align-items:center;gap:9px;margin-bottom:6px;}
.tl-d-yr{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;}
.tl-d-lb{font-size:12.5px;font-weight:700;margin-left:auto;}
.tl-hint{font-size:15px;font-weight:600;line-height:1.6;margin:0;word-break:keep-all;color:var(--tx);}
.tl-sub{font-size:11.5px;color:var(--tx3);margin:6px 0 0;font-variant-numeric:tabular-nums;}
.daeun{margin-top:16px;background:var(--card2);border-radius:16px;padding:14px 15px;}
.daeun-h{font-size:11.5px;font-weight:700;color:var(--tx3);margin-bottom:9px;}
.daeun-chips{display:flex;flex-wrap:wrap;gap:7px;}
.chip{font-size:12.5px;font-weight:700;background:rgba(255,255,255,.06);border-radius:999px;padding:6px 12px;}

/* 조언 */
.adv{padding:26px 2px 0;}
.adv-i{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px 15px;margin-top:10px;}
.adv-t{font-size:14.5px;line-height:1.65;margin:0;word-break:keep-all;}
.adv-tag{display:inline-block;margin-top:9px;font-size:11px;font-weight:700;color:var(--acc);
  background:var(--acc-soft);border-radius:8px;padding:3px 9px;}
.cta{margin:24px 2px 0;background:var(--acc-soft);border:1px solid var(--acc);border-radius:18px;
  padding:17px 16px;font-size:14.5px;font-weight:600;line-height:1.6;color:var(--tx);word-break:keep-all;}
</style>`;

writeFileSync(out, html);
console.log("✅ wrote " + out + " (" + (html.length / 1024).toFixed(1) + " KB)");
