# Kingdom 2000 — website

Static site for Kingdom 2000 (Kingshot). No build step, no framework, no dependencies.
Five HTML files and one stylesheet. Anyone who can edit a text file can maintain it.

```
index.html       Home — overview, KvK, leaderboard, NAP summary, alliances, timeline, buffs, events, apply form
nap.html         Full 12-clause non-aggression pact with amendment dates
kvk.html         Every Kingdom of Power cycle, with notes
alliances.html   All seven alliances in detail
applied.html     Confirmation page the form redirects to
404.html         Not-found page
styles.css       All styling
fit.js           Placement estimator — alliance power bands and rank logic
gate.js          Discord vibe check — bot filter, etiquette quiz, obfuscated invite
live.js          Applies data/kingdom.json to the page; degrades silently if absent
data/kingdom.json         Generated. Do not edit by hand — it is overwritten daily
config/alliances.json     Hand-maintained alliance fields the API cannot know
tools/build-data.js       Pulls from the MightPulse API and writes data/kingdom.json
.github/workflows/refresh-data.yml   Runs the above on a daily schedule
worker.js        Cloudflare Worker that receives the application form (deployed separately)
```

---

## 1. Everything in here is placeholder data

Before this goes live, replace every figure with the kingdom's real numbers. The ones that
matter most, and where they live:

| What | File | Search for |
|---|---|---|
| KvK record and cycle notes | `index.html`, `kvk.html` | `Aug 2026` |
| Alliance leaderboard | `index.html` | `class="lb"` |
| Spending mix bars | `index.html`, `alliances.html` | `class="mix"` |
| Power bands, Bear Trap slots, top-10 floor | `fit.js` | `const ALLIANCES` |
| Community schedule | `index.html` | `id="community"` |
| Discord invite code | `gate.js` | `INVITE_ENC` |
| Vibe check questions | `gate.js` | `VIBE_Q` |
| Seats open and minimum power | `index.html`, `alliances.html` | `Seats open` |
| NAP clause text and dates | `nap.html` | `class="clause"` |
| King buff schedule | `index.html` | `class="buffs"` |
| Event times | `index.html` | `id="events"` |
| Timeline | `index.html` | `class="tl"` |
| Rail facts (window, waitlist count) | every file | `railmeta` |
| "Figures last updated" date | every file | `last updated` |

The rail block and footer are duplicated across the five pages on purpose — no build step
means no templating. When you change the rail, change it in all five.

### The placement estimator

`fit.js` holds one array, `ALLIANCES`. Each entry needs:

```js
{ tag, name, members, seats, minPower, status, statusText,
  bt,        // "14:00 and 01:00 UTC" — the alliance's two Bear Hunt slots
  rally,     // "8 leads / 40 join slots"
  shift,     // which hours it has leadership awake
  spend: { heavy, mid, f2p },        // percentages, should total 100
  bands: [[lowM, highM, count], ...] // highest band first, counts total to members
}
```

To refresh the bands, sort the alliance's member list by power in game and count how many
fall in each range. It takes about five minutes per alliance and it is the single most
useful thing on the site — it is what lets an applicant see they would be 8th of 94 rather
than 60th of 98.

**Do not publish a named roster with individual power figures.** Bands and floors are enough
for an applicant and useless to an opponent scouting you before KvK. A named list is not.

### Discord invite link and the vibe check

The invite is no longer written into the buttons. Every "Click here to join our Discord!"
button now scrolls to the **Vibe check** section, and the real link is only assembled after a
visitor clears both gates. It lives in `gate.js` as one obfuscated string.

**To set your invite code**, open a browser console on any page and run:

```js
btoa("YourInviteCode".split("").reverse().join(""))
```

Paste the result into `gate.js`, replacing the value of `INVITE_ENC`. Use only the code — the
part after `discord.gg/` — not the whole URL.

Use a **permanent** invite: Discord → server name → Invite People → Edit invite link →
set **Expire after: Never** and **Max uses: No limit**. A default invite expires in 7 days and
the button will silently start sending people to a dead link.

**Be honest with yourself about what this is.** Reversing a base64 string takes anyone with a
browser console about ten seconds. It stops drive-by scrapers and it stops someone skimming
the page source for a link, and that is all it does. It is a speed bump, not a lock.

#### Layer 1 — bot filter

`BOT_Q` in `gate.js` holds six arithmetic questions dressed in game language; one is picked at
random per page load. There is also a hidden honeypot field and a four-second minimum before
the form will grade — bots submit instantly.

If you start getting real bot traffic, swap this layer for **Cloudflare Turnstile**: it is free,
it needs no user interaction, and Cloudflare Pages supports it natively. Dashboard → Turnstile →
Add site → paste the widget snippet into the step 1 block and check the token server-side.

#### Layer 2 — the etiquette quiz

`VIBE_Q` holds ten yes/no questions with the answer a decent kingdom-mate gives and a one-line
explanation shown when someone gets it wrong. `PASS_MARK` is 8 of 10.

Edit these freely — they should sound like your kingdom, not like mine. Three rules if you do:

- **Keep them about conduct, not knowledge.** "Do you read the battle report before retaliating"
  filters for temperament. "What generation is our server" filters for nothing.
- **No trick questions.** Anyone who has played on a decent server should walk it. The quiz is
  meant to turn away the small number of people who genuinely think love-tapping is a war crime,
  not to be hard.
- **Keep the explanations.** The failure screen shows what you differed on. That is the part
  that actually changes behaviour, and it is why failing is not hostile.

Two answers are tied to the NAP — the untagged-city question is clause 3 and the castle-drop
question is clause 8. If you amend those clauses, amend the quiz.

---

## 1b. Live data from MightPulse

[MightPulse](https://mightpulse.com/) indexes Kingshot kingdoms and offers a free authenticated
API. Roughly a third of the figures on this site can come from it automatically.

**Automated** — kingdom age and opening date, active governors, alliance count, top-100 power
floor, the alliance leaderboard, each alliance's power and member count, every top-10 power
floor, and the power bands behind the placement estimator.

**Still by hand, because no API has it** — KvK results, the NAP, the king buff schedule, event
times, open seats, Bear Trap slots, spending mix, castle crowns, the community schedule.

### Setup

1. Go to <https://api.mightpulse.com/>, sign in with Discord, create a key. It is shown once.
2. Repo → Settings → Secrets and variables → Actions → New repository secret.
   Name `MIGHTPULSE_KEY`, value your `kss_…` key.
3. Check the tags in `config/alliances.json` match your in-game alliance abbreviations exactly.
   **Tags are case-sensitive** and the same tag can exist in other kingdoms, which is why the
   kingdom ID is in the request path.
4. Actions tab → *Refresh kingdom data* → Run workflow. It commits `data/kingdom.json`,
   Cloudflare Pages redeploys, and the site updates.

After that it runs itself at 05:00 UTC daily.

To test locally before trusting it:

```bash
MIGHTPULSE_KEY=kss_your_key node tools/build-data.js
```

### Four things to hold on to

- **The key never goes in the browser.** It allows 60 requests a minute and 5,000 a day, and
  anyone who can read your page source can read an embedded key and burn the lot. It lives in a
  GitHub secret and is only ever used by the build script. Do not move the fetch into `live.js`.
- **The site degrades on its own.** If `data/kingdom.json` is missing, stale or malformed,
  `live.js` gives up quietly and the figures written into the HTML stand. A recruitment page
  showing last week's numbers beats one showing empty boxes because a third-party API had a bad
  morning. Keep the HTML fallbacks realistic for that reason.
- **Responses can be up to an hour old**, and MightPulse indexes what it indexes. If Kingdom 2000
  is not tracked, or an alliance tag is not found, the script logs it and keeps your manual
  values. Check the Actions log occasionally rather than assuming.
- **Do not publish the roster.** The API will happily hand you every member's name and power,
  and it is tempting to put that on the page. Don't. Bands and floors give an applicant
  everything they need to decide; a named list with power figures is a scouting document for
  whoever draws you in the next KvK. The build script deliberately computes bands and discards
  the names.

MightPulse is an independent fan site, not affiliated with Century Games. The footer stamp
credits it and links back — leave that in.

### A dependency risk worth knowing about, not hiding

MightPulse's API returns data — individual player coordinates, hero gear down to enhancement
level, gem loadouts — that has no documented public source. Getting it at that granularity,
across every kingdom the site tracks, is very unlikely to have been obtained through means
Century Games' own Terms of Service permit: Section 4 of Century Games' ToS prohibits
scraping, downloading or reproducing game materials without express permission, and Section 2
prohibits reverse-engineering the service, both without qualification for third parties.

This is not a comment on your site's own standing — you are a step removed, consuming a public
API from a service that already exists and already made that call. But it does mean MightPulse
could be told to stop, or could disappear without notice, entirely outside your control. That
is a normal risk in this genre (equivalent trackers exist for most mobile 4X games and most run
for years, but some get shut down) and it is why `live.js` degrades to the hardcoded HTML
figures rather than failing loudly. If MightPulse goes dark, your site keeps working; the
"Figures last updated" stamp will start saying so once the data is more than three days stale,
which is your cue to check it and switch that section back to manual updates if needed.

Whoever takes over maintenance after you should read this paragraph before assuming the feed is
permanent.

---

## 2. Deploy to Cloudflare Pages

1. Create a GitHub repository and push these files to the root of it.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick the repo. Build settings: **framework preset = None**, **build command = blank**,
   **output directory = `/`**. There is nothing to compile.
4. Deploy. The site is live at `kingdom2000.pages.dev` within about a minute.
5. Every later `git push` redeploys automatically.

Unlimited bandwidth on the free tier, so a link posted in a large Discord cannot take it down.

### Free alternatives, if you prefer

- **GitHub Pages** — repo → Settings → Pages → Deploy from branch `main`, folder `/root`.
  Lands on `kingdom2000.github.io`. Roughly 100GB/month soft cap.
- **Netlify** — drag this folder onto app.netlify.com/drop. Lands on `kingdom2000.netlify.app`.
  100GB/month; the site is paused if you exceed it.

---

## 3. The application form

`index.html` posts to a Cloudflare Worker, which forwards submissions into a Discord channel.
Until you deploy the Worker, the form will not work.

1. Cloudflare dashboard → **Workers & Pages** → **Create Worker**. Name it
   `kingdom2000-apply`. Paste `worker.js` over the default code and deploy.
2. In Discord: your officers' channel → **Edit Channel** → **Integrations** → **Webhooks** →
   **New Webhook** → **Copy Webhook URL**.
3. Worker → **Settings** → **Variables and Secrets**:
   - `DISCORD_WEBHOOK` — type **Secret**, value = the webhook URL.
   - `SITE_ORIGIN` — type **Text**, value = `https://kingdom2000.pages.dev`.
4. Optional flood guard: **Storage & Databases** → **KV** → create a namespace, then bind it
   to the Worker under **Bindings** with the variable name `RATE`. One submission per IP
   per minute.
5. Copy the Worker's URL and paste it into `index.html`, replacing
   `https://kingdom2000-apply.YOURNAME.workers.dev` in the `<form action="...">`.

The form already carries a hidden honeypot field, so most bot traffic is discarded silently.

### What the form collects, and why that list is short

Governor name, kingdom, power, Town Center level, passes held, timezone, Discord handle,
alliance preference, free-text notes. No email address, no real name. The confirmation page
tells applicants the list is deleted when the transfer window closes — so delete it.

---

## 4. Free domain

There is no such thing as a free top-level domain any more. Freenom shut its free `.tk` /
`.ml` / `.ga` service down in early 2024 and nothing replaced it. Anything advertising a
"forever free .com" is bundling paid hosting or selling a first-year promotion.

What is genuinely free, indefinitely:

| Address | How |
|---|---|
| `kingdom2000.pages.dev` | Comes with Cloudflare Pages. Instant, free SSL, unlimited bandwidth. **Use this.** |
| `kingdom2000.github.io` | Comes with GitHub Pages. |
| `kingdom2000.netlify.app` | Comes with Netlify. |
| `kingdom2000.eu.org` | The only free real domain left. Apply at eu.org — volunteer-reviewed, can take weeks, intended for non-profit use. If granted, add it as a custom domain in Cloudflare Pages and keep the `pages.dev` address as a permanent alias so old Discord links never break. |

If the kingdom ever wants an address it owns and can move between hosts, that costs about
$10–35 a year. `kingdom2000.gg` is the obvious paid upgrade.

Subdomain availability is checked at sign-up, not in advance. If `kingdom2000` is taken on a
platform, the agreed fallbacks in order are `k2000`, `kingdom2000ks`, `kingdom2000kingshot`.

---

## 5. Maintenance cadence

| What | How often | Owner |
|---|---|---|
| King buff schedule | Weekly, posted 48h ahead | King |
| Alliance leaderboard | Automatic, daily | MightPulse feed |
| Power bands and top-10 floors | Automatic, daily | MightPulse feed |
| Kingdom age, active count, power floor | Automatic, daily | MightPulse feed |
| Castle crowns | Weekly, in `config/alliances.json` | Transfer officer |
| Spending mix | Each season | Alliance R5s |
| Bear Trap slots | Whenever an alliance changes them | Alliance R5s |
| Community schedule | When the rotation changes; review monthly | Community officer |
| Vibe check questions | Review when the NAP is amended | Community officer |
| Seats open and status tags | Weekly; daily during an open window | Transfer officer |
| KvK table and cycle notes | Within 48h of battle phase closing | KvK lead |
| Event times / kingdom ranks | Times weekly, ranks monthly | Events officer |
| Timeline | As milestones land | King |
| NAP text | On amendment only, always dated | NAP council |
| "Figures last updated" footer | Every time you touch anything | Whoever edited |

A page with one visibly stale number loses the credibility of every other number on it.
Cut any section that has no named owner — a smaller accurate site beats a complete abandoned one.

---

## 6. Standing notes

- **Defer to the game.** Transfer requirements, pass costs and Town Center gates shift by
  event, server and kingdom age. The site says so in writing. Never publish a pass cost as a
  promise; only the in-game confirm screen can quote one.
- **Never delete a losing KvK row.** The losses are the reason the wins are believed.
- **Intellectual property.** Kingshot belongs to Century Games. Do not host game art or
  screenshots of paid content, and keep the footer line stating the site is run by the
  kingdom council and not by Century Games.
- **Keep a copy.** Free-tier accounts can be changed or suspended. The repository is the
  backup; keep it under kingdom control, not one person's personal account.
