/*
 * CCR functions shared by the app page and the server: finding related registry entries
 * and drafting a new CCR entry from an analysis. Plain JavaScript with no imports, so the
 * same text runs in the browser (embedded into index.html by ccr/embed.mjs) and in Node.
 * P·L·T framework created by Alexander Tsigkas.
 */
const CCR = (() => {
  const str = (v, max = 600) => String(v ?? '').slice(0, max);
  const arr = (v) => (Array.isArray(v) ? v : []);

  /** The analysis reduced to what the registry comparison needs. */
  function digest(a) {
    return {
      kind: a.kind || 'auto',
      subject: str(a.subject, 120),
      summary: str(a.summary, 500),
      logics: arr(a.logics).map((l) => `${str(l.name, 80)}: ${str(l.wants, 160)}`),
      thresholds: arr(a.thresholds).map((t) => `${str(t.title, 80)}: ${str(t.happens, 200)}`),
      moves: arr(a.moves).map((m) => `${str(m.title, 80)}: ${str(m.how, 200)}`),
      falseFix: str(a.falseFix, 300),
    };
  }

  function registryLines(registry) {
    return arr(registry.entries).map((x) => [x.id, x.domain, x.title, x.signature?.en ? `signature "${x.signature.en}"` : '', x.verdict?.en ? `verdict: ${x.verdict.en}` : '', x.summary, arr(x.contextures).length ? `contextures: ${x.contextures.join('; ')}` : ''].filter(Boolean).join(' | ')).join('\n');
  }

  function matchPrompt(analysis, registry, lang) {
    const language = { en: 'English', de: 'German' }[lang] || 'Modern Greek';
    return `You compare one new P·L·T analysis with a registry of earlier P·L·T cases (the CCR library of Alexander Tsigkas).
A case is related when its STRUCTURE is similar, not just its topic: the same kind of contextures meeting, the same kind of threshold (trap or seam, hand-off, stock, boundary, channel collapse), or the same kind of transjunctive move or false third. A case from another domain can be the closest match.

REGISTRY (one entry per line: id | domain | title | signature | verdict | summary | contextures):
${registryLines(registry)}

NEW ANALYSIS (JSON):
${JSON.stringify(digest(analysis))}

Choose up to 3 entries, closest first. Choose none if nothing is structurally close. Never invent ids.
Write "shares" and "differs" in ${language}, one sentence each, concrete.
Return ONLY JSON: {"matches": [{"id": string, "shares": string, "differs": string}]}`;
  }

  function cleanMatches(raw, registry) {
    const byId = new Map(arr(registry.entries).map((x) => [x.id, x]));
    const seen = new Set();
    return arr(raw?.matches)
      .filter((m) => byId.has(m?.id) && !seen.has(m.id) && seen.add(m.id))
      .slice(0, 3)
      .map((m) => ({ id: m.id, title: byId.get(m.id).title, signature: byId.get(m.id).signature?.en || '', shares: str(m.shares, 400), differs: str(m.differs, 400) }));
  }

  const DOMAINS = ['URB', 'MFG', 'SEC', 'CCU', 'SYS', 'NRG', 'DIP', 'ADM', 'LAW', 'POL', 'ORG', 'ENV', 'MTH'];

  function draftPrompt(analysis, matches) {
    return `Draft a CCR registry entry (Compound Contexture Registry) from the P·L·T analysis below, in the registry conventions of Alexander Tsigkas:
- Contextures are written K₁, K₂, … (K for Kontextur). Each is a logic valid on its own terms.
- Thresholds are L₁, L₂, …; transjunctive moves are T₁, T₂, …
- Phase P0 is the pre-intervention diagnostic: what holds now, before any move.
- Overdetermination (OD) on a 1–5 scale: how many contextures claim the same place or object at once.
- The three refusals test a proposed move: R1 no domination (one contexture does not absorb another), R2 no separation (they are not simply kept apart), R3 no false closure (something stays open). Each is Pass, Conditional or Fail, with one reason.
- Verdict class: certified, conditional or uncertified.
- In a transjunction something always stays open: name that remainder.
- The signature is a short paradox in 4–8 words (e.g. "The right ground, the wrong temperature"), given in English, German and Greek.
Domain code: one of ${DOMAINS.join(', ')}.
Use British spelling. Base everything on the analysis; do not add facts that it does not contain. Write in English except the German and Greek signatures.
${matches?.length ? `Related registry entries to cite: ${matches.map((m) => m.id).join(', ')}.` : ''}

ANALYSIS (JSON):
${JSON.stringify(digest(analysis))}

Return ONLY JSON:
{"domain": string, "title": string, "signature": {"en": string, "de": string, "el": string},
 "phaseP0": string (2-3 sentences),
 "contextures": [{"k": "K₁", "name": string, "logic": string}],
 "thresholds": [{"l": "L₁", "title": string, "between": ["K₁","K₂"], "type": "trap" | "seam", "note": string}],
 "moves": [{"t": "T₁", "title": string, "how": string, "connects": ["K₁","K₂"], "test": string}],
 "falseThird": string,
 "od": number,
 "refusals": [{"r": "R1", "result": "Pass"|"Conditional"|"Fail", "why": string}, {"r": "R2", ...}, {"r": "R3", ...}],
 "verdict": {"class": "certified"|"conditional"|"uncertified", "text": string},
 "remainder": string,
 "related": [string]}`;
  }

  function cleanDraft(d, registry) {
    const ids = new Set(arr(registry?.entries).map((x) => x.id));
    const res = (v) => (['Pass', 'Conditional', 'Fail'].includes(v) ? v : 'Conditional');
    const od = Number(d?.od);
    const domain = DOMAINS.includes(d?.domain) ? d.domain : 'URB';
    return {
      number: `CCR-${domain}-????`,
      domain,
      title: str(d?.title, 160),
      signature: { en: str(d?.signature?.en, 120), de: str(d?.signature?.de, 120), el: str(d?.signature?.el, 120) },
      phaseP0: str(d?.phaseP0, 900),
      contextures: arr(d?.contextures).slice(0, 6).map((c, i) => ({ k: `K${'₁₂₃₄₅₆'[i]}`, name: str(c.name, 120), logic: str(c.logic, 300) })),
      thresholds: arr(d?.thresholds).slice(0, 6).map((t, i) => ({ l: `L${'₁₂₃₄₅₆'[i]}`, title: str(t.title, 120), between: arr(t.between).map((x) => str(x, 4)), type: t.type === 'trap' ? 'trap' : 'seam', note: str(t.note, 300) })),
      moves: arr(d?.moves).slice(0, 6).map((m, i) => ({ t: `T${'₁₂₃₄₅₆'[i]}`, title: str(m.title, 120), how: str(m.how, 300), connects: arr(m.connects).map((x) => str(x, 4)), test: str(m.test, 200) })),
      falseThird: str(d?.falseThird, 400),
      od: Number.isFinite(od) ? Math.min(5, Math.max(1, Math.round(od))) : null,
      refusals: ['R1', 'R2', 'R3'].map((r, i) => {
        const x = arr(d?.refusals).find((y) => y?.r === r) || arr(d?.refusals)[i] || {};
        return { r, result: res(x.result), why: str(x.why, 300) };
      }),
      verdict: { class: ['certified', 'conditional', 'uncertified'].includes(d?.verdict?.class) ? d.verdict.class : 'conditional', text: str(d?.verdict?.text, 300) },
      remainder: str(d?.remainder, 400),
      related: arr(d?.related).filter((x) => ids.has(x)).slice(0, 5),
      status: 'Draft — number to be assigned',
    };
  }

  /** The draft as Markdown, ready to paste into a document. */
  function draftMarkdown(d, author = 'Alexander Tsigkas') {
    const rows = (h, list) => [h, '|' + h.split('|').slice(1, -1).map(() => ' --- ').join('|') + '|', ...list].join('\n');
    return [
      `# ${d.number} — ${d.title}`,
      `*${d.signature.en}* · *${d.signature.de}* · *${d.signature.el}*`,
      `Status: ${d.status} · Domain: ${d.domain} · OD ${d.od ?? '—'}`,
      '', '## Phase P0', d.phaseP0,
      '', '## Contextures', rows('| K | Contexture | Logic |', d.contextures.map((c) => `| ${c.k} | ${c.name} | ${c.logic} |`)),
      '', '## Thresholds', rows('| L | Threshold | Between | Type | Note |', d.thresholds.map((t) => `| ${t.l} | ${t.title} | ${t.between.join(' / ')} | ${t.type} | ${t.note} |`)),
      '', '## Transjunctive moves', rows('| T | Move | Connects | How | Test |', d.moves.map((m) => `| ${m.t} | ${m.title} | ${m.connects.join(' / ')} | ${m.how} | ${m.test} |`)),
      '', '## False third', d.falseThird,
      '', '## Three refusals', d.refusals.map((r) => `- **${r.r} ${r.result}:** ${r.why}`).join('\n'),
      '', `## Verdict: ${d.verdict.class}`, d.verdict.text,
      '', '## Remainder', d.remainder,
      ...(d.related.length ? ['', `Related: ${d.related.join(', ')}`] : []),
      '', `P·L·T framework created by ${author}. Draft generated from a photo analysis; to be reviewed before registration.`,
    ].join('\n');
  }

  return { digest, matchPrompt, cleanMatches, draftPrompt, cleanDraft, draftMarkdown, DOMAINS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CCR;
