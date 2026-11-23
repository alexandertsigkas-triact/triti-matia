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

  async analyse({ imageBase64, mediaType, kind, lang, note }) {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: buildPrompt({ kind, lang, note }) },
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
}

/** Test mode without an API key: returns a fixed sample so the whole flow can be tried. */
export class SampleAnalyzer {
  constructor() {
    this.test = true;
  }

  async analyse({ kind, lang }) {
    const el = lang !== 'en';
    const sample = {
      subject: el ? 'Δοκιμαστική ανάλυση (χωρίς Claude)' : 'Test analysis (no Claude)',
      summary: el
        ? 'Ο διακομιστής τρέχει σε δοκιμαστική λειτουργία χωρίς κλειδί Claude, οπότε δείχνει πάντα αυτό το δείγμα. Με κλειδί, εδώ εμφανίζεται η πραγματική ανάγνωση της φωτογραφίας.'
        : 'The server runs in test mode without a Claude key, so it always shows this sample. With a key, the real reading of the photo appears here.',
      logics: [
        { name: el ? 'Η λογική του πρώτου χρήστη' : 'The first user’s logic', wants: el ? 'Να περάσει γρήγορα.' : 'To get through quickly.', evidence: el ? 'Δείγμα.' : 'Sample.' },
        { name: el ? 'Η λογική του δεύτερου χρήστη' : 'The second user’s logic', wants: el ? 'Να σταθεί με ασφάλεια.' : 'To stop safely.', evidence: el ? 'Δείγμα.' : 'Sample.' },
      ],
      thresholds: [{ title: el ? 'Το σημείο συνάντησης' : 'The meeting point', between: [0, 1], happens: el ? 'Οι δύο ρυθμοί συγκρούονται.' : 'The two rhythms clash.', x: 50, y: 55 }],
      moves: [{ title: el ? 'Χρονική ζώνη' : 'A time window', how: el ? 'Ξεχωριστές ώρες για κάθε χρήση.' : 'Separate hours for each use.', connects: [0, 1], threshold: 1, test: el ? 'Καμία αναμονή πάνω από 2 λεπτά.' : 'No wait over 2 minutes.' }],
      falseFix: el ? 'Ένα εμπόδιο που απλώς μεταφέρει τη σύγκρουση αλλού.' : 'A barrier that just moves the clash elsewhere.',
      open: [el ? 'Ποιος αποφασίζει τις ώρες;' : 'Who sets the hours?'],
      limits: el ? 'Δείγμα δοκιμής.' : 'Test sample.',
    };
    if (kind === 'vsm') {
      sample.vsm = {
        processes: [
          { name: el ? 'Χύτευση' : 'Casting', ct: 55, co: 45, uptime: 85, operators: 1, invPcs: 2400, invDays: null },
          { name: el ? 'Μηχανουργική' : 'Machining', ct: 62, co: 20, uptime: 90, operators: 2, invPcs: null, invDays: 3.5 },
          { name: el ? 'Έλεγχος' : 'Inspection', ct: 30, co: 0, uptime: 100, operators: 1, invPcs: 600, invDays: null },
        ],
        fgPcs: 1200, fgDays: null, demand: 400, available: 27600, unreadable: [],
      };
    }
    return { analysis: cleanAnalysis(sample), tokens: { input: 0, output: 0 } };
  }
}
