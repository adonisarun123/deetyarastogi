// Deetya's 16th birthday invite at /sweet16.
// Not in navigation, the sitemap or search engines (noindex), and it switches itself off after
// `expiresAt`. NOTE: /sweet16 is a guessable address — anyone who types it sees the photo, date and
// venue until it expires. The PRD keeps exact birthdays and routine locations off the public site.

export const BIRTHDAY = {
  expiresAt: "2026-10-12T00:00:00+05:30",
  name: "Deetya",
  dateLabel: "Saturday, 10 October 2026",
  shortDate: "Saturday 10 October",
  time: "12 noon onwards",
  venue: "Paws Pannai Retreat",
  address: "Near Shoolagiri, Tamil Nadu",
  mapsUrl: "https://maps.google.com/?cid=10278887574214274125",
  dressCode: "", // optional
  rsvpBy: "Thursday, 8 October",
  whatsapp: "919717334639", // international format, digits only
  phoneDisplay: "+91 97173 34639",
};

export function birthdayActive() {
  return Date.now() < new Date(BIRTHDAY.expiresAt).getTime();
}

export const INVITE_PATH = "/sweet16";
