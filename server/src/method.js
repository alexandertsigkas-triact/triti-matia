/**
 * The P·L·T reading of a photo: the instructions sent to Claude and the check of its answer.
 * The same text lives in ../../index.html for the version that runs inside Claude;
 * keep the two in step when changing the method.
 */

export const KINDS = ['auto', 'space', 'work', 'vsm', 'art'];

export const KIND_HINT = {
  auto: 'Decide yourself what kind of scene this is.',
  space: 'Read it as a building, street, square or interior: who uses it, what rules and forces shape it.',
  work: 'Read it as a workplace or process: flows of material, people, information, time, safety, quality.',
  art: 'Read it as an artwork or image: the orders, materials, gazes and meanings that meet in it.',
  vsm: 'This is a photo of a VALUE STREAM MAP (lean VSM, hand-drawn or printed). Read it as a value stream: process boxes, data boxes, inventory triangles, push arrows, supermarkets, information flow from production control, customer and supplier, timeline. The logics are those of the actors and rules on the map (e.g. production control scheduling by forecast, the customer\'s demand, set-up economics, maintenance, quality, the supplier). Thresholds are hand-offs, inventory points and information links; place each at its position ON THE MAP. Moves may use lean means (supermarket pull, FIFO lane, pacemaker, levelling, set-up reduction) but must say which two logics they let act together. Lean terms are fine; P·L·T terms are not.',
};

const VSM_SHAPE = `Also read the numbers on the map into a field "vsm":
{"processes": [{"name": string, "ct": seconds or null, "co": minutes or null, "uptime": percent or null, "operators": number or null, "invPcs": pieces waiting BEFORE this process or null, "invDays": days of stock before this process or null}] in flow order from supplier side to customer side,
 "fgPcs": finished-goods pieces or null, "fgDays": finished-goods days or null, "demand": customer demand per day in pieces or null, "available": available working seconds per day or null,
 "unreadable": [short strings naming values you could not read clearly]}
Convert units: C/T to seconds, C/O to minutes. If demand is given per month, divide by working days written on the map, or by 20 if none. Use null for anything not on the map; never guess numbers.
`;

export function buildPrompt({ kind, lang, note }) {
  const language = lang === 'el' ? 'Greek (Modern Greek, plain everyday register)' : 'English (plain everyday register)';
  return `You are analysing ONE photo with the P·L·T method (Polycontexturality · Liminality · Transjunction, by Alexander Tsigkas).
Method, in short:
- Polycontexturality: a situation holds several logics (contexts) at once, each valid on its own terms, with its own rules and values. Name 2 to 4 that are really visible or strongly implied in the photo. Do not invent people or facts that cannot be seen.
- Liminality: the thresholds where those logics meet and neither one governs. Locate 2 to 4 such thresholds IN THE PHOTO and give the approximate position of each as x and y percentages of the image width and height (0,0 = top left).
- Transjunction: concrete moves that let two logics act together without one absorbing the other. Give 2 to 4, each tied to a threshold, small and testable, with how one would know it works.
- The false third: one tempting fix that only hides or displaces the tension.
${KIND_HINT[kind]}
${note ? 'The person adds this context: """' + note.slice(0, 600) + '"""' : 'The person gave no extra context.'}
Write every text field in ${language}. Use plain words for a member of the public: no method jargon (do not write "context", "contexture", "liminal", "transjunction", "P·L·T" in the fields). Be specific to what is visible. Short sentences.
${kind === 'vsm' ? VSM_SHAPE : ''}Return ONLY JSON with exactly this shape:
{"subject": string (max 8 words), "summary": string (2-3 sentences),
 "logics": [{"name": string (e.g. "The driver's logic"), "wants": string, "evidence": string (what in the photo shows it)}],
 "thresholds": [{"title": string, "between": [logic index, logic index] (0-based), "happens": string, "x": number, "y": number}],
 "moves": [{"title": string, "how": string, "connects": [logic index, logic index], "threshold": number (1-based threshold number), "test": string}],
 "falseFix": string, "open": [string, string], "limits": string (what one photo cannot show)${kind === 'vsm' ? ', "vsm": object as described above' : ''}}`;
}

export function cleanAnalysis(d) {
  const arr = (v) => Array.isArray(v) ? v : [];
  const n = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null; };
  const logics = arr(d.logics).slice(0, 4).map((l) => ({ name: String(l.name || ''), wants: String(l.wants || ''), evidence: String(l.evidence || '') }));
  const idx = (v) => arr(v).map(Number).filter((j) => Number.isInteger(j) && j >= 0 && j < logics.length);
  const thresholds = arr(d.thresholds).slice(0, 4).map((th) => ({ title: String(th.title || ''), between: idx(th.between), happens: String(th.happens || ''), x: n(th.x, 0, 100) ?? 50, y: n(th.y, 0, 100) ?? 50 }));
  return {
    subject: String(d.subject || ''), summary: String(d.summary || ''), logics, thresholds,
    moves: arr(d.moves).slice(0, 4).map((m) => ({ title: String(m.title || ''), how: String(m.how || ''), connects: idx(m.connects), threshold: n(m.threshold, 1, thresholds.length), test: String(m.test || '') })),
    falseFix: String(d.falseFix || ''), open: arr(d.open).slice(0, 4).map(String), limits: String(d.limits || ''),
    vsm: d.vsm && typeof d.vsm === 'object' ? cleanVsm(d.vsm) : null,
  };
}

function cleanVsm(v) {
  const num = (x) => { const n = Number(x); return x === null || x === '' || !Number.isFinite(n) || n < 0 ? null : n; };
  return {
    processes: (Array.isArray(v.processes) ? v.processes : []).slice(0, 15).map((p) => ({
      name: String(p.name || ''), ct: num(p.ct), co: num(p.co), uptime: num(p.uptime), operators: num(p.operators), invPcs: num(p.invPcs), invDays: num(p.invDays) })),
    fgPcs: num(v.fgPcs), fgDays: num(v.fgDays), demand: num(v.demand), available: num(v.available),
    unreadable: (Array.isArray(v.unreadable) ? v.unreadable : []).slice(0, 8).map(String),
  };
}
