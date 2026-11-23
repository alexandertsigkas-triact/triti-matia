/**
 * Sends sign-in links. ConsoleMailer is for testing: it prints the link and the
 * page shows it directly. For real use, replace it with an email service
 * (for example Postmark, Brevo or Amazon SES) implementing the same send().
 */
export class ConsoleMailer {
  /** showLinks: return the link to the page as well. Never true in production, or anyone could sign in as anyone. */
  constructor({ showLinks = true } = {}) {
    this.test = showLinks;
    this.sent = [];
  }
  async send({ to, subject, text, link }) {
    this.sent.push({ to, subject, text, link });
    console.log(`[mail to ${to}] ${subject}\n${link}`);
  }
}

export function loginEmail(lang, link) {
  return lang === 'en'
    ? { subject: 'Your sign-in link for Third Look', text: `Open this link to sign in. It works once, within 15 minutes:\n\n${link}\n\nIf you did not ask for it, ignore this email.` }
    : { subject: 'Ο σύνδεσμος σύνδεσης για την Τρίτη Ματιά', text: `Ανοίξτε αυτόν τον σύνδεσμο για να συνδεθείτε. Ισχύει μία φορά, για 15 λεπτά:\n\n${link}\n\nΑν δεν τον ζητήσατε, αγνοήστε αυτό το μήνυμα.` };
}
