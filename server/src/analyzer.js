import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, cleanAnalysis } from './method.js';

/** Pulls the JSON object out of a model answer, tolerating code fences or a sentence around it. */
export function extractJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The answer contained no JSON.');
  return JSON.parse(t.slice(start, end + 1));
}

/** Reads photos through the Claude API with Triact's key. */
export class ClaudeAnalyzer {
  constructor({ apiKey, model }) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.test = false;
  }

  async analyse({ images = [], mediaType = 'image/jpeg', source = { type: 'photo' }, kind, lang, note }) {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: source.type === 'photo' ? 3000 : 4000,
      messages: [
        {
          role: 'user',
          content: [
            ...images.map((data) => ({ type: 'image', source: { type: 'base64', media_type: mediaType, data } })),
            { type: 'text', text: buildPrompt({ kind, lang, note, source }) },
          ],
        },
      ],
    });
    const text = res.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    return {
      analysis: cleanAnalysis(extractJson(text)),
      tokens: { input: res.usage?.input_tokens ?? null, output: res.usage?.output_tokens ?? null },
    };
  }

  /** A text-only request that must answer with JSON (used for the CCR functions). */
  async completeJson(prompt) {
    const res = await this.client.messages.create({ model: this.model, max_tokens: 4000, messages: [{ role: 'user', content: prompt }] });
    return extractJson(res.content.filter((c) => c.type === 'text').map((c) => c.text).join(''));
  }
}

/** Test mode without an API key: returns a fixed sample so the whole flow can be tried. */
export class SampleAnalyzer {
  constructor() {
    this.test = true;
  }

  async analyse({ kind, lang, source = { type: 'photo' } }) {
    const L = (el, en, de) => ({ el, en, de }[lang] ?? en);
    const sample = {
      subject: L('Δοκιμαστική ανάλυση (χωρίς Claude)', 'Test analysis (no Claude)', 'Testanalyse (ohne Claude)'),
      summary: L('Ο διακομιστής τρέχει σε δοκιμαστική λειτουργία χωρίς κλειδί Claude, οπότε δείχνει πάντα αυτό το δείγμα. Με κλειδί, εδώ εμφανίζεται η πραγματική ανάγνωση της φωτογραφίας.',
        'The server runs in test mode without a Claude key, so it always shows this sample. With a key, the real reading of the photo appears here.',
        'Der Server läuft im Testmodus ohne Claude-Schlüssel und zeigt deshalb immer dieses Beispiel. Mit Schlüssel erscheint hier die echte Lesart des Fotos.'),
      logics: [
        { name: L('Η λογική του πρώτου χρήστη', 'The first user’s logic', 'Die Logik der ersten Nutzerin'), wants: L('Να περάσει γρήγορα.', 'To get through quickly.', 'Schnell durchkommen.'), evidence: L('Δείγμα.', 'Sample.', 'Beispiel.') },
        { name: L('Η λογική του δεύτερου χρήστη', 'The second user’s logic', 'Die Logik des zweiten Nutzers'), wants: L('Να σταθεί με ασφάλεια.', 'To stop safely.', 'Sicher anhalten.'), evidence: L('Δείγμα.', 'Sample.', 'Beispiel.') },
      ],
      thresholds: [{ title: L('Το σημείο συνάντησης', 'The meeting point', 'Der Treffpunkt'), between: [0, 1], happens: L('Οι δύο ρυθμοί συγκρούονται.', 'The two rhythms clash.', 'Die zwei Rhythmen stoßen zusammen.'), x: 50, y: 55 }],
      moves: [{ title: L('Χρονική ζώνη', 'A time window', 'Ein Zeitfenster'), how: L('Ξεχωριστές ώρες για κάθε χρήση.', 'Separate hours for each use.', 'Eigene Zeiten für jede Nutzung.'), connects: [0, 1], threshold: 1, test: L('Καμία αναμονή πάνω από 2 λεπτά.', 'No wait over 2 minutes.', 'Keine Wartezeit über 2 Minuten.') }],
      falseFix: L('Ένα εμπόδιο που απλώς μεταφέρει τη σύγκρουση αλλού.', 'A barrier that just moves the clash elsewhere.', 'Eine Absperrung, die den Konflikt nur verschiebt.'),
      open: [L('Ποιος αποφασίζει τις ώρες;', 'Who sets the hours?', 'Wer legt die Zeiten fest?')],
      limits: L('Δείγμα δοκιμής.', 'Test sample.', 'Testbeispiel.'),
    };
    if (kind === 'vsm') {
      sample.vsm = {
        processes: [
          { name: L('Χύτευση', 'Casting', 'Gießen'), ct: 55, co: 45, uptime: 85, operators: 1, invPcs: 2400, invDays: null },
          { name: L('Μηχανουργική', 'Machining', 'Zerspanung'), ct: 62, co: 20, uptime: 90, operators: 2, invPcs: null, invDays: 3.5 },
          { name: L('Έλεγχος', 'Inspection', 'Prüfung'), ct: 30, co: 0, uptime: 100, operators: 1, invPcs: 600, invDays: null },
        ],
        fgPcs: 1200, fgDays: null, demand: 400, available: 27600, unreadable: [],
      };
    }
    if (source.type !== 'photo') sample.thresholds[0].quote = source.type === 'doc' ? String(source.text).slice(0, 80) : L('Δείγμα παράθεσης.', 'Sample quote.', 'Beispielzitat.');
    return { analysis: cleanAnalysis(sample), tokens: { input: 0, output: 0 } };
  }

  /** Test answers for the CCR functions. */
  async completeJson(prompt) {
    if (prompt.startsWith('Translate the text values')) {
      // Test mode: mark the text instead of translating it, so the flow can be seen.
      const to = { Modern: 'EL', English: 'EN', German: 'DE' }[/into (\w+)/.exec(prompt)[1]];
      const mark = (v) => (typeof v === 'string' ? `[${to}] ${v}` : Array.isArray(v) ? v.map(mark) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mark(x)])) : v);
      return mark(JSON.parse(prompt.slice(prompt.indexOf('\n\n') + 2)));
    }
    if (prompt.includes('"matches"')) {
      return { matches: [
        { id: 'CCR-URB-0009', shares: 'Test mode: several logics meet at one threshold.', differs: 'Test mode: sample comparison, not a real reading.' },
        { id: 'CCR-URB-0001', shares: 'Test mode: an edge where neither side governs.', differs: 'Test mode: sample comparison.' },
      ] };
    }
    return {
      domain: 'URB', title: 'Test draft (no Claude)', signature: { en: 'Two rhythms, one kerb', de: 'Zwei Rhythmen, ein Bordstein', el: 'Δύο ρυθμοί, ένα κράσπεδο' },
      phaseP0: 'Test mode: a sample draft is shown instead of a real one.',
      contextures: [{ name: 'First user', logic: 'Speed' }, { name: 'Second user', logic: 'Safety' }],
      thresholds: [{ title: 'The meeting point', between: ['K₁', 'K₂'], type: 'trap', note: 'Sample.' }],
      moves: [{ title: 'A time window', how: 'Separate hours.', connects: ['K₁', 'K₂'], test: 'No wait over 2 minutes.' }],
      falseThird: 'A barrier.', od: 3,
      refusals: [{ r: 'R1', result: 'Pass', why: 'Sample.' }, { r: 'R2', result: 'Conditional', why: 'Sample.' }, { r: 'R3', result: 'Pass', why: 'Sample.' }],
      verdict: { class: 'conditional', text: 'Sample verdict.' }, remainder: 'Who sets the hours stays open.', related: ['CCR-URB-0009'],
    };
  }
}
