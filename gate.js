/* Kingdom 2000 — Discord gate.
   Layer 1: a bot filter. Layer 2: an etiquette quiz, because we would rather
   lose an applicant than gain a boor.

   The invite is assembled from an obfuscated string only after both layers pass.
   This is a speed bump, not security — anyone who reads the source can decode it.
   See README for how to set INVITE and how to swap layer 1 for Cloudflare Turnstile. */

/* ---- your invite, lightly scrambled. Set it with makeInvite() — see README. ---- */
const INVITE_ENC = "RURPQy1FVElWTkktUlVPWQ==";   // placeholder: YOUR-INVITE-CODE
const decode = s => atob(s).split("").reverse().join("");

/* ---- Layer 1: bot filter ---- */
const BOT_Q = [
  { q: "Kingdom 2000 is matched against Kingdom 1877. How many kingdoms is that in total?", a: 2 },
  { q: "Bear Hunt runs twice a day. How many Bear Hunts is that across three days?", a: 6 },
  { q: "You have four Transfer Passes and you spend one. How many are left?", a: 3 },
  { q: "A rally holds five marches. Two have joined. How many slots are free?", a: 3 },
  { q: "The castle window is six hours long and you have held it for two. Hours remaining?", a: 4 },
  { q: "Type the last digit of our kingdom number.", a: 0 },
];

/* ---- Layer 2: the vibe check. `a` is the answer a decent kingdom-mate gives. ---- */
const VIBE_Q = [
  { q: "Someone marches 69 troops at your city. Is that a declaration of war?", a: false,
    why: "It's a joke. Send 69 back." },
  { q: "An ally love-taps you at 3am. Do you wake your whole alliance for a revenge rally?", a: false,
    why: "It's a love tap. Screenshot it, laugh, move on." },
  { q: "You spot an untagged city. Under our NAP, is it fair game?", a: true,
    why: "Clause 3. No tag, no protection — that's the whole point of the clause." },
  { q: "You get hit. Do you read the battle report before you retaliate?", a: true,
    why: "Half of all 'attacks' are mis-clicks and rally joins." },
  { q: "A new player asks something in kingdom chat that you think is obvious. Do you answer them properly?", a: true,
    why: "Everyone was new. This one is not negotiable." },
  { q: "You're holding the castle. Do you drop it before the three-hour timer so the next alliance gets its turn?", a: true,
    why: "Clause 8. The crown rotates here." },
  { q: "Is \"I spend more than you, so I decide\" a good argument during a rally call?", a: false,
    why: "Whales are welcome. Whales who lead by invoice are not." },
  { q: "You lose a fight badly. Do you take it to the off-topic channel and argue about it for three days?", a: false,
    why: "Post the report in the council channel, or let it go." },
  { q: "Would you tent in contested territory and then complain when it gets taken?", a: false,
    why: "Clause 4. Tents are always open, everywhere, always." },
  { q: "Someone in your alliance is having a bad week and says so in voice. Do you give them grief for it?", a: false,
    why: "This is a game. They're a person." },
];

const PASS_MARK = 8;
let botQ = null, answers = {}, startedAt = Date.now();

function shuffle(a) { return a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]); }

function renderGate() {
  const el = document.getElementById("gate");
  if (!el) return;
  botQ = BOT_Q[Math.floor(Math.random() * BOT_Q.length)];
  answers = {};
  startedAt = Date.now();
  const qs = shuffle(VIBE_Q.map((q, i) => ({ ...q, i })));

  el.innerHTML = `
    <div class="gstep">
      <div class="gnum">1</div>
      <div>
        <h3>Prove you're a person</h3>
        <p class="gq">${botQ.q}</p>
        <input id="botA" class="ginput" type="text" inputmode="numeric" placeholder="A number" autocomplete="off">
        <input id="gTrap" class="hp" type="text" tabindex="-1" autocomplete="off" aria-hidden="true">
      </div>
    </div>
    <div class="gstep">
      <div class="gnum">2</div>
      <div>
        <h3>Prove you're good company</h3>
        <p class="gq">Ten yes-or-no questions. Get ${PASS_MARK} right and the invite is yours.
          There are no trick questions — if you've played on a decent server you'll walk it.</p>
        <ol class="gquiz">
          ${qs.map(q => `
            <li>
              <span class="gtext">${q.q}</span>
              <span class="gpick" data-i="${q.i}">
                <button type="button" class="gyes" data-v="1">Yes</button>
                <button type="button" class="gno"  data-v="0">No</button>
              </span>
            </li>`).join("")}
        </ol>
      </div>
    </div>
    <div class="gfoot">
      <button type="button" id="gSubmit" class="btn sm">Check my vibes</button>
      <span id="gCount" class="gcount">0 of 10 answered</span>
    </div>
    <div id="gResult" class="gresult" role="status" aria-live="polite"></div>`;

  el.querySelectorAll(".gpick button").forEach(b => b.addEventListener("click", () => {
    const wrap = b.parentElement, i = +wrap.dataset.i;
    answers[i] = b.dataset.v === "1";
    wrap.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    document.getElementById("gCount").textContent =
      `${Object.keys(answers).length} of ${VIBE_Q.length} answered`;
  }));
  document.getElementById("gSubmit").addEventListener("click", grade);
}

function grade() {
  const out = document.getElementById("gResult");
  const bot = document.getElementById("botA").value.replace(/[^0-9-]/g, "");

  if (document.getElementById("gTrap").value) { out.className = "gresult fail"; out.innerHTML = "<p>No.</p>"; return; }
  if (Date.now() - startedAt < 4000) {
    out.className = "gresult fail";
    out.innerHTML = "<p>That was faster than a human reads. Take another run at it.</p>";
    return;
  }
  if (bot === "" || parseInt(bot, 10) !== botQ.a) {
    out.className = "gresult fail";
    out.innerHTML = "<p><b>Step 1 first.</b> The arithmetic question at the top needs a number, and it needs the right one.</p>";
    document.getElementById("botA").focus();
    return;
  }
  if (Object.keys(answers).length < VIBE_Q.length) {
    out.className = "gresult fail";
    out.innerHTML = `<p><b>${VIBE_Q.length - Object.keys(answers).length} still unanswered.</b> No abstaining — that's a vibe in itself.</p>`;
    return;
  }

  const wrong = VIBE_Q.map((q, i) => ({ ...q, i })).filter(q => answers[q.i] !== q.a);
  const score = VIBE_Q.length - wrong.length;

  if (score >= PASS_MARK) {
    out.className = "gresult pass";
    out.innerHTML = `
      <p><b>${score} out of ${VIBE_Q.length}. You'll do.</b> Welcome — the invite is below. Say hello in
        #kingdom when you land, and if you're transferring, drop your governor name in #transfers.</p>
      <a class="dbtn" href="https://discord.gg/${decode(INVITE_ENC)}" rel="noopener">
        <svg width="21" height="16" viewBox="0 0 71 55" aria-hidden="true"><path d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"/></svg>
        <span>Click here to join our Discord!</span></a>`;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return;
  }

  out.className = "gresult fail";
  out.innerHTML = `
    <p><b>${score} out of ${VIBE_Q.length}. Not yet.</b> You need ${PASS_MARK}. Nothing personal — we'd
      rather turn away someone who'd have been fine than let in someone who makes the server worse.
      Here's where we differed:</p>
    <ul class="gwrong">${wrong.map(q => `<li><b>${q.q}</b><span>${q.why}</span></li>`).join("")}</ul>
    <p>Read those, think about whether you actually disagree, and go again.</p>
    <button type="button" id="gRetry" class="btn sm">Try again</button>`;
  document.getElementById("gRetry").addEventListener("click", () => {
    renderGate();
    document.getElementById("vibecheck").scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

document.addEventListener("DOMContentLoaded", renderGate);
