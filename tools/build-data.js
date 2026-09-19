#!/usr/bin/env node
/**
 * Kingdom 2000 — pull live figures from the MightPulse API into data/kingdom.json.
 *
 *   MIGHTPULSE_KEY=kss_... node tools/build-data.js
 *
 * Run it on a schedule (see .github/workflows/refresh-data.yml), never from the browser.
 * The key must not reach the client: it allows 60 requests a minute and 5,000 a day, and
 * anyone who can read it can burn your whole quota.
 *
 * What this replaces: kingdom age, active governors, alliance count, top-100 power floor,
 * the alliance leaderboard, each alliance's power and member count, the power bands behind
 * the placement estimator, and every top-10 power floor.
 *
 * What it cannot replace, because no API has it: KvK results, the NAP, the king buff
 * schedule, event times, open seats, Bear Trap slots, spending mix, community schedule.
 * Those stay in config/alliances.json and in the HTML.
 */

const fs = require("fs");
const path = require("path");

const KEY  = process.env.MIGHTPULSE_KEY;
const KID  = process.env.KINGDOM_ID || "2000";
const BASE = "https://api.mightpulse.com/v1";
const OUT  = path.join(__dirname, "..", "data", "kingdom.json");
const CFG  = path.join(__dirname, "..", "config", "alliances.json");

if (!KEY) { console.error("MIGHTPULSE_KEY is not set. Get a key at https://api.mightpulse.com/ (sign in with Discord)."); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get(pathname, attempt = 1) {
  const res = await fetch(BASE + pathname, {
    headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" },
  });
  if (res.status === 429) {                       // rate limited — back off and retry
    if (attempt > 4) throw new Error(`429 after ${attempt} attempts on ${pathname}`);
    const wait = 5000 * attempt;
    console.warn(`  rate limited, waiting ${wait / 1000}s…`);
    await sleep(wait);
    return get(pathname, attempt + 1);
  }
  if (res.status === 404) { console.warn(`  404 ${pathname} — skipping`); return null; }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${pathname}`);
  return res.json();
}

/* Power bands for the placement estimator, in millions, highest first.
   Must match the band edges fit.js expects. */
const EDGES = [[70, 999], [45, 70], [30, 45], [20, 30], [12, 20], [0, 12]];

function bandsFrom(powers) {
  return EDGES.map(([lo, hi]) => [lo, hi, powers.filter(p => p >= lo && p < hi).length]);
}

function topTenFloor(powers) {
  const sorted = [...powers].sort((a, b) => b - a);
  return sorted.length >= 10 ? sorted[9] : (sorted[sorted.length - 1] ?? 0);
}

const M = n => +(Number(n || 0) / 1e6).toFixed(1);

async function main() {
  const manual = JSON.parse(fs.readFileSync(CFG, "utf8"));

  console.log(`Kingdom ${KID}…`);
  const k = await get(`/kingdoms/${KID}`);
  if (!k) throw new Error(`Kingdom ${KID} is not indexed by MightPulse.`);
  const kingdom = k.kingdom || k;

  // Top-100 personal power board gives us the kingdom's top-100 power floor.
  console.log("Personal power board…");
  const board = await get(`/kingdoms/${KID}/ranks?board=personal_power&limit=100`);
  const entries = board?.ranks || board?.entries || board?.board || [];
  const floor100 = entries.length ? M(entries[entries.length - 1].score) : null;

  // Alliance power board — the leaderboard.
  console.log("Alliance power board…");
  const ab = await get(`/kingdoms/${KID}/ranks?board=alliance_power&limit=100`);
  const allianceBoard = ab?.ranks || ab?.entries || ab?.board || [];

  // Rosters, one call per alliance we care about.
  const alliances = [];
  for (const cfg of manual.alliances) {
    if (!cfg.tag || cfg.skipApi) { alliances.push({ ...cfg, live: false }); continue; }
    console.log(`Roster ${cfg.tag}…`);
    const a = await get(`/alliances/${KID}/${encodeURIComponent(cfg.tag)}?include=info,roster`);
    if (!a) { alliances.push({ ...cfg, live: false }); continue; }

    const info    = a.alliance || {};
    const members = a.members || [];
    const powers  = members.map(m => Number(m.power || 0) / 1e6).filter(p => p > 0);

    alliances.push({
      ...cfg,                                   // seats, minPower, bt, rally, shift, spend, status
      name:     cfg.name || info.name,
      power:    M(info.power),
      members:  info.count ?? members.length,
      rank:     info.power_rank ?? null,
      top10:    powers.length ? +topTenFloor(powers).toFixed(1) : null,
      bands:    powers.length ? bandsFrom(powers) : cfg.bands,
      live:     powers.length > 0,
    });
    await sleep(1200);                          // stay well inside 60/min
  }

  alliances.sort((a, b) => (b.power || 0) - (a.power || 0));

  const out = {
    generatedAt: new Date().toISOString(),
    source: "MightPulse (https://mightpulse.com) — independent Kingshot fan site, not affiliated with Century Games",
    kingdom: {
      kid:          kingdom.kid ?? Number(KID),
      ageDays:      kingdom.age_days ?? null,
      openedOn:     kingdom.opened_on ?? null,
      players:      kingdom.player_count ?? null,
      active7d:     kingdom.active_7d ?? null,
      active30d:    kingdom.active_30d ?? null,
      allianceCount: kingdom.alliance_count ?? null,
      power:        M(kingdom.power),
      powerRank:    kingdom.power_rank ?? null,
      activityRank: kingdom.activity_rank ?? null,
      floor100,
    },
    leaderboard: allianceBoard.slice(0, 5).map((r, i) => ({
      pos: i + 1, abbr: r.abbr, name: r.name, power: M(r.score),
    })),
    alliances,
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
  console.log(`  ${out.alliances.filter(a => a.live).length} of ${out.alliances.length} alliances refreshed from the API`);
  console.log(`  kingdom age ${out.kingdom.ageDays}d · ${out.kingdom.active7d} active in 7d · top-100 floor ${floor100} M`);
}

main().catch(e => { console.error("\nFailed:", e.message); process.exit(1); });
