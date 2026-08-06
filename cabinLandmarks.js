// Direct Second Life landmarks for each auto-assigned Island Paradise cabin.
// Keep this as the single source of truth for both live and standalone assignment flows.
const CABIN_LANDMARKS = Object.freeze({
  F02: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/102/184/41",
  C02: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/161/41",
  S02: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/102/143/41",
  C03: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/116/41",
  C05: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/97/41",
  C06: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/74/41",
  F03: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/75/76/41",
  F05: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/98/41",
  S08: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/143/41",
  C08: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/161/41",
  F08: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/183/41",
  F01: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/184/46",
  C01: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/102/163/46",
  S01: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/143/46",
  S03: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/116/46",
  C04: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/102/96/46",
  S04: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/101/75/46",
  S05: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/75/46",
  F04: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/75/98/46",
  S06: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/115/46",
  F06: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/144/46",
  C07: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/162/46",
  F07: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/185/46",
  S07: "http://maps.secondlife.com/secondlife/Ethereal%20Paradise/74/114/41",
});

function cabinLandmarkFor(cabinId) {
  return CABIN_LANDMARKS[String(cabinId || "").trim().toUpperCase()] || null;
}

module.exports = { CABIN_LANDMARKS, cabinLandmarkFor };
