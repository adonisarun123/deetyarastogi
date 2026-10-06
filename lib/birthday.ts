// Deetya's 16th birthday invite — a private, link-only page.
// Not in navigation, search, the sitemap or search engines (noindex), and it switches itself
// off after `expiresAt`. The PRD keeps exact birthdays and routine locations off the public site,
// so share this link only with guests. To rotate the link, set BIRTHDAY_CODE in the environment.

export const BIRTHDAY = {
  code: (process.env.BIRTHDAY_CODE || "hrceqyqf").toLowerCase(),
  expiresAt: "2026-10-12T00:00:00+05:30",
  name: "Deetya",
  dateLabel: "Saturday, 10 October 2026",
  shortDate: "Saturday 10 October",
  time: "[TIME]", // e.g. "4:00 pm onwards"
  venue: "[VENUE]",
  address: "[AREA, CITY]",
  mapsUrl: "", // optional Google Maps link for “Get directions”
  dressCode: "", // optional
  rsvpBy: "Thursday, 8 October",
  whatsapp: "919717334639", // international format, digits only
  phoneDisplay: "+91 97173 34639",
};

export function birthdayActive(code: string) {
  return code.toLowerCase() === BIRTHDAY.code && Date.now() < new Date(BIRTHDAY.expiresAt).getTime();
}

export function invitePath() {
  return `/sweet16/${BIRTHDAY.code}`;
}
