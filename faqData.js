/* =================================================================================================
 *  Tammy Brightwood — default FAQ knowledge base
 *  ------------------------------------------------------------------------------------------------
 *  Rule-based answers to the questions guests ask most. Seeded into Neon on first run; after that
 *  they're editable live with /faq add|remove. `keywords` drive the message auto-responder — a
 *  message matches when it contains any keyword (word-boundary, case-insensitive).
 * ================================================================================================= */

const DEFAULT_FAQS = [
  {
    topic: "HUD not working",
    keywords: ["hud", "hud not working", "wear hud", "hud broken", "hud stuck"],
    answer:
      "If your Lifeline HUD isn't responding: 1) detach and re-attach it, 2) make sure you're wearing the latest version, 3) check you have scripts enabled on the parcel. If it still won't load, use `/redelivery` to get a fresh copy or open `/support`.",
  },
  {
    topic: "Redelivery",
    keywords: ["redeliver", "redelivery", "lost my item", "missing item", "didn't receive", "resend", "lost product"],
    answer:
      "Need an item resent? Use `/redelivery` — tell me your Second Life username and the product, and I'll log it for staff to send from the in-world redelivery system. You'll get a confirmation once it's queued.",
  },
  {
    topic: "Cruise stays",
    keywords: ["cruise", "cabin", "stay", "checkout", "check out", "check-in", "book cabin", "cruise stay"],
    answer:
      "Cruise cabins are booked in-world at the Island Paradise HUD terminals. A stay is only active once it's paid — arriving early doesn't start it. For help with an existing booking, open `/support` and pick **Cruise Help**.",
  },
  {
    topic: "Landmarks",
    keywords: ["landmark", "teleport", "slurl", "how do i get to"],
    answer:
      "Looking for a landmark? Check the pinned landmarks in the server, or open `/landmarks` for the current teleport list. If a landmark is broken, please open `/support`.",
  },
  {
    topic: "Events",
    keywords: ["event", "events", "movie", "movie time", "showtime", "schedule", "whats on", "what's on"],
    answer:
      "Upcoming events, movie times and destination changes are posted in the events channel and announced by me. Use `/events` to see what's coming up.",
  },
  {
    topic: "Rules",
    keywords: ["rules", "the rule", "allowed", "not allowed", "policy", "banned"],
    answer:
      "Please review the server rules in the rules channel. The short version: be respectful, keep content in the right channels, and follow staff direction. If you're unsure whether something's allowed, ask in `/support`.",
  },
  {
    topic: "Support / talking to staff",
    keywords: ["support", "talk to staff", "talk to a human", "open a ticket", "contact staff", "speak to"],
    answer:
      "I can open a private ticket with staff for you — use `/support` and pick what you need help with. I'll collect your details so staff can jump straight in.",
  },
  {
    topic: "Apply to work / blog",
    keywords: ["apply", "application", "job", "hiring", "blogger", "become staff", "work here"],
    answer:
      "Interested in joining? Use `/apply` to submit a staff or blogger application. Staff review every application before anyone is added.",
  },
];

module.exports = { DEFAULT_FAQS };
