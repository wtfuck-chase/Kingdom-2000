/* Kingdom 2000 — alliance placement estimator.
   Answers the question applicants actually ask: given my power and my spending,
   where would I sit inside each alliance, and would I earn anything?

   Bands are [lowMillions, highMillions, memberCount], highest first. Update these
   from the alliance power list after Monday council — see README. */

let ALLIANCES = [
  { tag: "2KVG", name: "Two Thousand Vanguard", members: 98, seats: 6, minPower: 32,
    status: "invite", statusText: "Invitational only",
    bt: "14:00 and 01:00 UTC", rally: "8 leads / 40 join slots", shift: "Americas + APAC building",
    spend: { heavy: 22, mid: 43, f2p: 35 },
    bands: [[70, 999, 3], [45, 70, 11], [30, 45, 28], [20, 30, 32], [12, 20, 18], [0, 12, 6]] },

  { tag: "VLR", name: "Valor Regnant", members: 94, seats: 18, minPower: 21,
    status: "open", statusText: "Accepting now",
    bt: "14:00 and 01:00 UTC", rally: "6 leads / 40 join slots", shift: "EU evenings",
    spend: { heavy: 12, mid: 46, f2p: 42 },
    bands: [[70, 999, 1], [45, 70, 5], [30, 45, 19], [20, 30, 31], [12, 20, 26], [0, 12, 12]] },

  { tag: "IRN", name: "Ironhold", members: 89, seats: 21, minPower: 14,
    status: "open", statusText: "Accepting now",
    bt: "15:00 and 02:00 UTC", rally: "5 leads / 40 join slots", shift: "Americas",
    spend: { heavy: 6, mid: 38, f2p: 56 },
    bands: [[70, 999, 0], [45, 70, 3], [30, 45, 12], [20, 30, 24], [12, 20, 31], [0, 12, 19]] },

  { tag: "TSK", name: "Taskmasters", members: 83, seats: 17, minPower: 0,
    status: "open", statusText: "Accepting now",
    bt: "16:00 and 03:00 UTC", rally: "3 leads / 40 join slots", shift: "Mixed",
    spend: { heavy: 2, mid: 21, f2p: 77 },
    bands: [[70, 999, 0], [45, 70, 0], [30, 45, 4], [20, 30, 9], [12, 20, 25], [0, 12, 45]] },

  { tag: "OBL", name: "Obelisk", members: 100, seats: 0, minPower: 0,
    status: "full", statusText: "Full — waitlist only",
    bt: "09:00 and 20:00 UTC", rally: "4 leads / 40 join slots", shift: "EU mornings",
    spend: { heavy: 5, mid: 34, f2p: 61 },
    bands: [[70, 999, 0], [45, 70, 2], [30, 45, 8], [20, 30, 22], [12, 20, 33], [0, 12, 35]] },
];

/* Rank a power (in millions) inside an alliance's band table. */
function placeIn(a, powerM) {
  let above = 0;
  for (const [lo, hi, n] of a.bands) {
    if (powerM >= hi) break;                      // user is above this whole band
    if (powerM >= lo) {                            // user sits inside this band
      const span = Math.max(hi - lo, 0.001);
      above += Math.round(n * ((hi - powerM) / span));
      break;
    }
    above += n;                                    // whole band is above the user
  }
  const rank = Math.max(1, Math.min(a.members, above + 1));
  return { rank, pct: Math.round((rank / a.members) * 100) };
}

const VERDICTS = [
  [10, "Rally lead territory. You would be one of the strongest accounts here and would be asked to lead, not join.", "great"],
  [33, "Top third. Reliable top-tier rewards in alliance events, and a real shot at the podium in Bear Hunt and Championship.", "great"],
  [66, "Mid-table. Steady milestone rewards, rarely a podium. Good if you want the wins without carrying the roster.", "ok"],
  [101, "Bottom third. You would be carried here — fine for growth and safe territory, thin on personal rankings.", "weak"],
];

const SPEND_NOTE = {
  f2p: { label: "Free to play",
    text: "Prep-phase rankings are decided by banked materials, so you will not podium there. Your points come from kill counts, gathering and construction — pick an alliance that rallies often rather than one that outspends you." },
  light: { label: "Light spender",
    text: "Enough to hit most event milestones if you bank consistently. Avoid alliances where the top ten hoard heavily — you will spend the same and rank lower for it." },
  moderate: { label: "Moderate spender",
    text: "You will compete for the second reward tier in most events. An alliance with fewer heavy spenders above you converts the same spending into better placements." },
  heavy: { label: "Heavy spender",
    text: "You will compete for the top tier wherever you land. The question is whether you want to lead a roster or sit behind three or four accounts bigger than yours." },
};

function fmt(n) { return n.toLocaleString("en-US"); }

function estimate() {
  const raw = document.getElementById("myPower").value.replace(/[^0-9.]/g, "");
  const spend = document.getElementById("mySpend").value;
  const out = document.getElementById("fitOut");
  if (!raw) { out.innerHTML = '<p class="fitempty">Enter your total power to see where you would sit in each alliance.</p>'; return; }

  let powerM = parseFloat(raw);
  if (powerM > 1000) powerM = powerM / 1e6;        // accept 24600000 or 24.6
  if (!isFinite(powerM) || powerM <= 0) { out.innerHTML = '<p class="fitempty">That does not look like a power figure. Try 24.6 or 24600000.</p>'; return; }

  const rows = ALLIANCES.map(a => {
    const { rank, pct } = placeIn(a, powerM);
    const v = VERDICTS.find(x => pct <= x[0]);
    const blocked = a.status === "full" ? "At cap — waitlist only"
      : (a.minPower && powerM < a.minPower ? `Below the ${a.minPower} M floor` : null);
    return { a, rank, pct, verdict: v[1], tone: v[2], blocked };
  });

  out.innerHTML = rows.map(r => `
    <div class="fitrow ${r.blocked ? "off" : ""}">
      <div class="fittag"><b>${r.a.tag}</b><em>${r.a.name}</em></div>
      <div class="fitrank">
        <b>#${r.rank}</b> <span>of ${r.a.members} · top ${r.pct}%</span>
        <span class="fitbar"><i class="${r.tone}" style="width:${100 - r.pct}%"></i></span>
      </div>
      <div class="fitsay">
        <p>${r.blocked ? r.blocked + ". " : ""}${r.verdict}</p>
        <span class="fitmeta">Bear Trap ${r.a.bt} · ${r.a.rally} · ${r.a.shift}</span>
      </div>
    </div>`).join("") +
    `<div class="fitspend"><b>${SPEND_NOTE[spend].label}</b><p>${SPEND_NOTE[spend].text}</p></div>
     <p class="fitfoot">Estimated from the power bands published above, not from a live roster read.
     Your real placement moves as people transfer in and out. An officer will give you a firm answer on your application.</p>`;
}

/* live.js calls this once data/kingdom.json has loaded. Manual fields (bt, rally, shift,
   minPower, status) survive; power bands and member counts come from the API. */
window.applyLiveAlliances = function (live) {
  ALLIANCES = live.map(a => ({
    tag: a.tag, name: a.name, members: a.members, seats: a.seats, minPower: a.minPower,
    status: a.status, statusText: a.statusText, bt: a.bt, rally: a.rally, shift: a.shift,
    spend: a.spend, bands: a.bands,
  }));
  if (document.getElementById("myPower") && document.getElementById("myPower").value) estimate();
};

document.addEventListener("DOMContentLoaded", () => {
  const p = document.getElementById("myPower");
  const s = document.getElementById("mySpend");
  if (!p) return;
  p.addEventListener("input", estimate);
  s.addEventListener("change", estimate);
  const btn = document.getElementById("fitGo");
  if (btn) btn.addEventListener("click", e => { e.preventDefault(); estimate(); });
});
