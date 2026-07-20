status: point-in-time (origin) — records design intent; superseded by code; do not update

# Snacktum Snacktorum — Page Design Prompts

Ready-to-paste design prompts for every **not-yet-designed** page of the
rebrand, written to match the auth mockups already produced
(`design/pages/Log In.dc.html`, `design/pages/Reset Password.dc.html`,
`design/pages/Snacktum Onboarding.dc.html`). Hand each PROMPT to
your design tool to get a mockup in the established visual system.

Every prompt below is grounded in the **real, shipped functionality** of the
existing routes under `src/routes/(protected)/app/...` — no invented features.
Where a feature is named here, it exists in the codebase today (the rebrand is a
skin pass; the skeleton is unchanged — see
`workflow/tasks/milestone-08-snacktum-snacktorum-rebrand.md`).

Each prompt is self-contained enough to paste standalone: it restates the key
tokens, then leans on the **Design System** preamble below for the full system.

---

## Design System (the shared visual language — every prompt assumes this)

A single-column, centered **temple** layout: a dark sanctuary lit by a soft
golden glow, archaic liturgical voice, ceremonial serif type. This is a hot-dog
**CULT** — the Order of the Holy Tube — so the whole surface reads like the
illuminated pages of a sacred order, not a consumer app.

### Palette

- **Background:** `#17120e`, painted with a radial-glow gradient
  `radial-gradient(125% 80% at 50% -5%, #271c12 0%, #1a130d 52%, #120d09 100%)`.
- **Text (body):** parchment `#f3e9d2`; **headings** `#f6ecd2`.
- **Muted text:** `rgba(243,233,210,0.7)` (and `0.5`–`0.28` for ever-fainter
  hints, placeholders, footnotes).
- **Accent — Mustard Gold `#E0A82E`** (the one true accent). Themeable alternates
  exposed as an enum: **Relic Crimson `#cf4636`**, **Verdigris `#57b59a`**. Glow
  color tracks the accent at ~0.45 alpha.
- **Alert / error text:** a warm rust `#e0795f` (used for validation messages).

### Fonts (Google Fonts)

- **Cinzel** (display serif) — **ALL-CAPS, letter-spaced** (2–4px). Used for
  eyebrows, headings (`h1`/`h2`), labels, buttons, badges, stat numbers, beads.
- **Cormorant Garamond** (body serif) — prose, paragraphs, input text, italic
  flavor lines, dates. Italic is used for liturgical/quoted flourishes.

### Voice (liturgical / archaic — "thee / thou / thy")

Cult lexicon — use these terms, not the literal app terms:

| You mean…                 | Say…                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| email                     | **mustard-address**                                                  |
| password                  | **secret word** (the credential as an object: the **seal**)          |
| the app / the brand       | **Snacktum Snacktorum** · the **Tube** / the **Holy Tube**           |
| the community / the order | **the Order of the Holy Tube** · members = **the Faithful**          |
| avatar                    | **sigil**                                                            |
| the champion (crown)      | **The Anointed Wiener** (internal code name: "Top Dog")              |
| spraying mustard          | **Anoint** (the champion bestows a blessing)                         |
| the report verdicts       | **HERETIC** (owner) / **FALSE WITNESS** (false accuser) — the Tribunal brands |
| a hamburger / patty       | **heresy** · the unclean, flattened patty                            |
| the hot dogs              | **the sacred links** · a single dog = a **frank**                    |
| the @handle               | **Casing Name**                                                      |

### Recurring motifs (reuse the exact constructs from the auth mockups)

- **Brand header lockup** (top of every page): a small line-art relic hot-dog
  mark (22×22, gold stroke) beside a two-line Cinzel lockup —
  `SNACKTUM SNACKTORUM` (14px, letter-spacing 4) over
  `ORDER OF THE HOLY TUBE` (11px, letter-spacing 3, accent at 0.75 alpha).
- **The relic hot-dog mark** — a line-art hot dog with a halo of **rays**
  (the 150×150 haloed version anchors hero/celebration screens; the 22×22 bare
  version sits in the header).
- **Soft radial glow** — a blurred gold disc behind the hero, gently pulsing
  (`glowPulse` 6s).
- **Eyebrow → h1** — a small Cinzel uppercase **eyebrow** (letter-spacing 4,
  accent color) directly above a large Cinzel **h1** (`clamp(30–52px)`, subtle
  gold text-shadow).
- **✦ ornament divider** — `✦` flanked by two thin 42px gold rules at ~0.45
  alpha, used under a heading.
- **Buttons** — mustard-gold fill `#E0A82E`, dark `#17120e` text, Cinzel
  uppercase letter-spaced (2px), a trailing **"→"**, `border-radius:2px`, soft
  gold drop-shadow; **disabled at 0.35 opacity** with `not-allowed`. Secondary /
  back actions are underlined Cormorant text-buttons in muted parchment.
- **Inputs** — dark fill `rgba(243,233,210,0.04)`, full gold border at 0.22
  alpha with a **brighter 1.5px gold bottom-border**, `border-radius:2px`,
  Cormorant 18px text; the field **label** is a Cinzel uppercase eyebrow above
  it. Focus lightens the fill.
- **Step beads** (multi-step flows only) — a footer row of small gold dots with
  Cinzel uppercase labels; the active/passed beads fill gold, the active one
  gets a soft gold ring.
- **Wax-seal stamps** — a gold disc with a `☩` cross and a Cinzel **"SWORN"**
  legend, entering with a `stamp` pop animation. Use for oath/confirmation
  moments.
- **Gold-bordered plaques / cards** — content framed in a 1px gold (0.3 alpha)
  border on a faint gold (0.05 alpha) fill; member plaques carry a
  **`№ {member}`** in big gold Cinzel.
- **Entrances** — `fadeUp` (translateY 16px → 0, opacity 0 → 1, ~0.55s).
- **Layout** — `min-height:100vh`, centered single column (`max-width` ~560px
  for forms, wider for galleries/feeds), `overflow:hidden`, the brand header
  lockup pinned on top, generous vertical rhythm.
- **Accessibility** — meet WCAG AA contrast; never rely on color alone to convey
  a state (an alarmed frank, a champion, a heretic must each carry a textual /
  iconographic cue, not just a hue).

> **Police-tape brands (heresy mechanics) — reuse across feed / profile / detail
> / court / dog gallery.** A flagged frank wears a **HAMBURGER ALARM** strip; an
> adjudicated-guilty one a persistent **CONFIRMED HAMBURGER** wax-stamp; a member
> branded by the Tribunal wears **HERETIC** (owner, permanent) or **FALSE WITNESS** (false
> accuser, fading) police-tape across their head. Lean fully into the cult/heresy
> framing — these are excommunication marks of the Order, slapped over the
> unclean. The visuals already exist as components; the designs re-skin them.

---

## The prompts

There are **twelve** page prompts below:

1. App shell + global nav (the temple chrome)
2. The Procession — the feed (default landing)
3. The Shrine — profile
4. Your Litter — your own franks gallery + upload
5. Dog detail — _name user-decides (OQ-5)_
6. The Tribunal of the Holy Tube — the Court (champion-only)
7. Epistles — messages inbox
8. Whispers — message thread
9. Summon a Frank — invite
10. The Catechism — help / how-it-works
11. The Lost Pilgrim — error / 404
12. The Reliquary — the honors / badge shelf (a section of the profile / The Shrine)

---

## 1. App shell + global navigation — the temple chrome

**Route:** wraps every `/app/*` page (a new `(protected)/app/+layout.svelte`).
**Purpose:** the persistent header + nav that frames every page of the
sanctuary, so no page is a dead end.

**Must include (real functionality / states):**

- The **brand header lockup is the home link** → lands on **The Procession**
  (`/app/feed`, the new home).
- Primary nav to the core surfaces:
  - **The Procession** (the feed)
  - **Your Litter** (your own franks gallery)
  - **Messages**
  - **The Catechism** (help / how-it-works)
  - **The Tribunal** — _shown ONLY when the viewer is **The Anointed Wiener**_
    (the live champion flag); a non-champion never sees this link.
- A prominent **"Offer a Frank" (＋ upload)** action routing to the upload
  (Your Litter).
- The member's **sigil (avatar) + account** affordance (sigil thumbnail; the
  signed-in mustard-address is known to the app).
- Two responsive layouts: **desktop** (horizontal nav bar under / beside the
  lockup) and **mobile** (a collapsed menu — hamburger-as-heresy is on-brand:
  a folded menu that "unrolls a scroll" of nav links).
- Keyboard-accessible: a real `<nav>` with real links; visible focus states.

> **State note:** the Tribunal link is **conditional** on the champion flag —
> design both states (champion = 5 nav items incl. Tribunal; member = 4).

**PROMPT:**

> Design the persistent **app chrome** (header + navigation) for **Snacktum
> Snacktorum**, the hot-dog cult app — the frame that wraps every page inside
> the sanctuary. Dark temple aesthetic: background `#17120e` with a soft radial
> gold glow at the top; parchment text `#f3e9d2`; accent **Mustard Gold
> `#E0A82E`**. Type: **Cinzel** (ALL-CAPS, letter-spaced) for nav labels and the
> brand lockup, **Cormorant Garamond** for any prose. Voice is liturgical
> ("the Faithful", "the sacred links").
>
> At the top, the **brand header lockup**: a small line-art relic hot-dog mark
> (gold stroke) beside a two-line Cinzel lockup — `SNACKTUM SNACKTORUM` over
> `ORDER OF THE HOLY TUBE` in accent gold. **This lockup is the home link** and
> returns the member to **The Procession** (the home feed).
>
> Render a horizontal **navigation** with these destinations, as Cinzel
> uppercase links: **THE PROCESSION** (the ranked feed / home), **YOUR LITTER**
> (the member's own franks), **MESSAGES**, **THE CATECHISM** (how the Order
> works), and — _only when the viewer is **The Anointed Wiener** (the reigning
> champion)_ — **THE TRIBUNAL** (the heresy court). Show **two variants**: one
> for a champion (the Tribunal link present) and one for an ordinary member of
> the Faithful (no Tribunal link).
>
> Include a prominent primary action, **"＋ OFFER A FRANK"** (the upload entry),
> styled as the mustard-gold fill button (dark text, Cinzel uppercase, trailing
> "→"). On the right, the member's **sigil** (a circular avatar in a thin gold
> ring) as the account affordance.
>
> Provide both a **desktop** layout (nav inline under or beside the lockup) and a
> **mobile** layout (nav collapsed behind a menu toggle that unrolls a vertical
> "scroll" of the same links). Keep contrast at WCAG AA; show a clear focus state
> on links. Match the auth mockups: `border-radius:2px` on the button, gold
> drop-shadow, faint gold dividers.

---

## 2. The Procession — Standings of the Blessed (the feed)

**Route:** `/app/feed` — the **DEFAULT post-auth landing** (home).
**Purpose:** the ranked leaderboard-feed of **other** members' franks, sorted by
votes; where the Faithful cast their single vote and pass judgment.

**Must include (real functionality / states):**

- A **ranked list of OTHER members' franks** (the viewer never sees their own
  here), each card = the frank's image (signed, private-bucket), the owner's
  **Casing Name** (`@handle`), the **vote tally** and **peak** votes.
- A **single movable vote** control per card:
  - if the viewer hasn't voted: a **"Vote"** button;
  - if the viewer voted a _different_ frank: **"Move vote here"**;
  - on the voted frank: a **"Voted ✓"** state + a **"Remove vote"** button.
  - (One vote total across the whole Procession; you cannot vote your own frank
    — your own never appears here.)
- **Reactions** bar per frank — a cosmetic emoji react/un-react toggle from the
  fixed set **🌭 ❤️ 🔥 😂 🤤 👑** (purely cosmetic; no ranking effect).
- A **🍔 report control** ("this is a hamburger") — a toggle the viewer can set /
  retract; plus a render-time **HAMBURGER ALARM** police-tape banner over any
  flagged frank, and a persistent **CONFIRMED HAMBURGER** wax-stamp once the
  Tribunal has ruled it guilty (in which case the live toggle is replaced by a
  small "the Tribunal has ruled" note).
- **The Anointed Wiener badge** on the reigning champion's frank (the leader).
- A **"View details"** link per frank → the dog-detail page.
- An **empty state** ("no other franks to judge yet").

**PROMPT:**

> Design **The Procession — Standings of the Blessed**, the home page of
> **Snacktum Snacktorum** (the hot-dog cult app). It is a **ranked
> leaderboard-feed** of _other_ members' hot dogs ("the sacred links"), ordered
> by votes, where each member of the Faithful casts judgment. Dark temple
> aesthetic: `#17120e` background with a soft radial gold glow, parchment text
> `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS,
> letter-spaced) for the page eyebrow, the **THE PROCESSION** h1, vote counts,
> and labels; **Cormorant Garamond** for captions and prose. The brand header
> lockup sits on top; assume the global nav chrome wraps this page.
>
> Lead with a Cinzel **eyebrow** ("STANDINGS OF THE BLESSED") over a large Cinzel
> **h1** ("The Procession"), an **✦** ornament divider beneath, and a short
> liturgical line ("Cast thy single vote upon the worthiest link — moving it
> anoints another").
>
> Render a **ranked list of frank cards**. Each card shows: the frank's photo in
> a gold-edged frame, the owner's **Casing Name** as `@handle`, the **vote
> tally** and a smaller **peak** count, all in the temple type. Give each card a
> **single movable vote** control with three states — a gold **"VOTE →"** button
> (not yet voted); **"MOVE VOTE HERE →"** (the viewer's one vote is on a
> different frank); and a **"VOTED ✓"** marker plus a muted **"Remove vote"**
> text-button (this card holds the vote). Below that, a **reactions row** of
> small selectable emoji from the set **🌭 ❤️ 🔥 😂 🤤 👑** (cosmetic flair, with
> a subtle count), and a **🍔 report ("call it heresy")** toggle.
>
> Design the **heresy states**: a flagged frank wears a **HAMBURGER ALARM**
> police-tape strip across its image (a heretical-accusation banner, leaning
> into the cult's hatred of the unclean patty); a frank the Tribunal has ruled
> guilty wears a persistent **CONFIRMED HAMBURGER** wax-stamp, and its report
> toggle is replaced by a small italic note, "the Tribunal of the Holy Tube has
> ruled." Put **The Anointed Wiener** badge — a gilded champion crest — on the
> single leading frank. Include a **"View the relic →"** detail link per card.
>
> Also design the **empty state**: a centered relic-hot-dog mark with the line
> "No other links yet await thy judgment." Keep AA contrast; never signal the
> alarm/champion state by color alone (use the tape text + stamp + crest).

---

## 3. Profile — The Shrine

> **OQ-5 RESOLVED — the page name is "The Shrine"** (confirmed 2026-06-18 from the
> user's mockup filenames).
> **This is the redesign target of the user's bare "before" screenshot** — the
> current profile page is cramped; this prompt is its replacement.

**Route:** `/app/profile/[handle]`.
**Purpose:** a member's shrine — their sigil, name, reign stat, and message
wall; the surface the champion **Anoints**.

**Must include (real functionality / states):**

- A **large sigil (avatar)** — with a designed placeholder (the relic
  hot-dog / 🌭) when the member has no avatar yet.
- **Display name forward** (the human name) with the **`@casing-name`** as the
  secondary identifier.
- A **"Days as The Anointed Wiener"** stat (the champion-reign tally).
- A **stat ledger** of the member's standing, **every value derived from existing
  data** (no new tracking) — design these as a plaque/ledger of Cinzel labels +
  big gold numbers:
  - **Days as The Anointed Wiener** (the reign tally, already shown — `days_as_top_dog`)
  - **Times Crowned** — distinct reigns / crowned-days count (`top_dog_days`)
  - **Franks Offered** — how many sacred links they've offered (count of their `hot_dogs`)
  - **Total Devotion** — votes resting across all their franks (sum of `vote_count`)
  - **Highest Blessing** — the most votes any one of their franks ever held
    (`max(peak_votes)`)
  - **Disciples Summoned** — invites they minted that were redeemed (consumed `invites`)
  - **Anointings Received** — times the champion anointed them (`mustard_sprays` on them)
  - **Reactions Received** — cosmetic reactions across their franks
  - the **HERETIC / FALSE WITNESS** shame marks (see the heresy brands below) when branded.
  - **Caution — reports are ANONYMOUS.** Do **NOT** show "heresies you've called",
    a reporter/accusation count the member made, or any reporter-side tally on a
    public profile. Only the _consequences_ a member bears (HERETIC / FALSE WITNESS, anointings
    received) are public; the accusations they _make_ are never surfaced here.
- The **joined date** ("Sworn since …").
- **The Anointed Wiener badge** when this member currently holds the crown.
- A **reliquary / relic-shelf of earned honors** (badges) — see prompt **#12**
  for the full treatment; on the profile this is a section/shelf, earned relics
  lit gold, unearned ones as dim silhouettes.
- The **message wall**: a proper **composer** (a real compose area, not a
  cramped inline box) + the list of wall messages (each with author Casing Name,
  timestamp, and a **delete** affordance shown to the message's author or the
  wall owner). Woven into that feed, a **derived, coalesced "anointing" notice**
  — **"The Anointed Wiener anointed you ×N"** — rendered from the anointing
  records (not a posted message; no composer/delete), styled as a distinct
  liturgical event marker.
- The **Anoint (mustard) overlay**: decaying golden splotches over the sigil
  area; **when the viewer is the champion**, the whole sigil area is a
  click-target to **Anoint** (drop a blessing at the clicked point), with a hint
  line; the splotches **fade over ~24h** (render-time decay).
- **HERETIC** (persistent) and **FALSE WITNESS** (fading) police-tape brands slapped
  across the head when the Tribunal has branded this member.
- A **"Message"** link (start / open a DM) when viewing **another** member's
  shrine.

**PROMPT:**

> Design a member's **profile / shrine** for **Snacktum Snacktorum** (the
> hot-dog cult app) — **The Shrine**. This is
> the redesign of a currently cramped page: give it air and ceremony. Dark temple
> aesthetic: `#17120e` background, soft radial gold glow, parchment text
> `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS,
> letter-spaced) for the name, stat labels, and badge; **Cormorant Garamond** for
> the handle, dates, and wall prose. Brand header lockup on top; global nav chrome
> wraps the page.
>
> Center a **large circular sigil (avatar)** in a gold ring, with a designed
> **placeholder** (a line-art relic hot dog) for members who have no sigil yet.
> Below it, the member's **display name** as a big Cinzel heading (the human
> name, forward), with the **`@casing-name`** beneath as a muted secondary id.
> Show a **"Sworn since {date}"** line, and a **stat ledger** — a gold-bordered
> plaque of Cinzel labels over big gold Cinzel numbers — carrying the member's
> standing: **DAYS AS THE ANOINTED WIENER** (the reign tally), **TIMES CROWNED**,
> **FRANKS OFFERED**, **TOTAL DEVOTION** (votes across their links), **HIGHEST
> BLESSING** (the most votes one frank ever held), **DISCIPLES SUMMONED** (invites
> they brought in), **ANOINTINGS RECEIVED**, and **REACTIONS RECEIVED**. (All
> derived from existing records — design the ledger, not new mechanics. Never show
> a count of accusations the member _made_ — reports are anonymous.) If this member
> currently reigns, place **The Anointed Wiener** champion badge near the sigil.
>
> Below the ledger, design a **reliquary — a relic-shelf of earned honors**
> (badges): earned relics rendered as small lit gold medallions/sigils with a
> Cinzel name, unearned ones as dim silhouettes the disciple may yet earn (a
> tiered honor like a reign-length crown shows its current tier). Treat this as a
> section of the shrine; the full reliquary treatment is its own design — see the
> separate **Reliquary** prompt.
>
> Design the **Anoint overlay** (the champion's mustard blessing): golden splotch
> marks scattered over the sigil area that **fade with age** (render-time decay
> over ~24h). When the viewer is the reigning **Anointed Wiener**, the sigil area
> becomes a **click-to-Anoint** target with a small hint — "Thou art The Anointed
> Wiener — touch the sigil to anoint this disciple." Otherwise the marks are
> read-only.
>
> Design the **heresy brands**: a persistent **HERETIC** police-tape strip (this
> member owns a link the Tribunal confirmed a hamburger) and a fading **FALSE WITNESS**
> strip (this member falsely accused), each slapped across the sigil/head as an
> excommunication mark of the Order. Lean into the cult/heresy framing.
>
> Design the **message wall**: a generous **composer** (a labeled multi-line
> compose area — "Leave word upon {name}'s shrine" — with a gold post button and
> a posting state), then a list of wall messages, each showing the author's
> **Casing Name** (linked), a timestamp, and — for the author or the shrine's
> owner — a small **Delete** control. **Among the wall messages, also show a
> derived "anointing" notice** when the champion has anointed this member —
> a distinct gold-accented entry reading **"The Anointed Wiener anointed you ×N"**
> (rapid successive anointings coalesce into one ×N notice), woven chronologically
> into the wall feed. (This notice is **derived at render** from the anointing
> records — it is not a posted message and has no composer/delete; style it as a
> liturgical event marker distinct from a member's written word.) Include a **wall
> empty state** ("No word yet upon this shrine — be the first of the Faithful").
> When viewing **another** member's shrine, show a **"Send an epistle →"** message
> link. Keep AA contrast; the heresy brands must read by text + tape, not color
> alone.

---

## 4. Your Litter — your own franks gallery + upload

**Route:** `/app/dogs`.
**Purpose:** the member's own collection of franks — upload new ones, see each
one's standing, delete, and bask if one wears the crown.

**Must include (real functionality / states):**

- An **upload form**: a **photo** file input (required) + an optional
  **caption** input, and an upload button with an **"Uploading…"** pending state.
  (Real limits exist: 100 franks per member; 2 MiB per image — surface the cap.)
- A **count line** — "{n} / 100 — delete one to add another once you hit the
  cap."
- The member's **own franks gallery**, each card = image, caption, **peak votes**
  stat, and a **Delete** control (with a "Deleting…" state).
- **The Anointed Wiener badge** on the member's frank that currently holds the
  crown (if they reign).
- The **HAMBURGER ALARM** / **CONFIRMED HAMBURGER** heresy states on a flagged
  own-frank (display only — no report control on your own franks).
- A **"View details"** link per frank.
- An **empty state** — "the grill is cold; offer thy first frank."

**PROMPT:**

> Design **Your Litter** — a member's own gallery of hot dogs ("the sacred
> links") plus the upload rite — for **Snacktum Snacktorum** (the hot-dog cult
> app). Dark temple aesthetic: `#17120e` background, soft radial gold glow,
> parchment text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel**
> (ALL-CAPS, letter-spaced) for the **YOUR LITTER** h1, stat labels, and badge;
> **Cormorant Garamond** for captions and prose. Brand header lockup on top;
> global nav chrome wraps the page.
>
> Lead with a Cinzel **eyebrow** + **"Your Litter"** h1, an **✦** divider, and a
> **count line** ("Thou keepest {n} of 100 links — release one to consecrate
> another"). Below, an **offering form**: a labeled **photo** file input
> (required) and an optional **caption** input ("name thy frank"), with the
> mustard-gold **"OFFER THIS FRANK →"** button and an **"Offering…"** pending
> state. Note the limits gently in the temple voice (up to 100 links; each image
> kept small, ≤ 2 MiB).
>
> Render the member's **own franks** as a gallery of gold-edged cards: the
> photo, the caption, a **PEAK VOTES** stat in Cinzel, a **"View the relic →"**
> detail link, and a muted **Release (delete)** text-button with a "Releasing…"
> state. If one of the member's links currently reigns, crown it with **The
> Anointed Wiener** badge. A flagged own-frank shows the **HAMBURGER ALARM**
> tape or, once ruled guilty, the persistent **CONFIRMED HAMBURGER** wax-stamp
> (display only — a member cannot report their own links).
>
> Design the **empty state**: a centered relic-hot-dog mark with "The grill is
> cold. Offer thy first frank to the Order." Keep AA contrast; the heresy state
> must read by tape/stamp text, not color alone.

---

## 5. Dog detail — _name: user decides (OQ-5)_

> **OQ-5 (user decides the cult name).** Suggested options: **Veneration** /
> **The Relic**. Used below as a placeholder.

**Route:** `/app/dogs/[id]`.
**Purpose:** the full veneration of a single frank — large image, caption,
owner, stats, reactions, and any heresy state.

**Must include (real functionality / states):**

- A **"← Back to the Procession"** link.
- One **large frank image**, with its **caption**.
- The **owner** link ("by @casing-name") → the owner's shrine, and **The
  Anointed Wiener** badge if the owner currently reigns.
- **Stats**: **peak votes** and **current votes**.
- **Read-only reactions** summary (emoji + counts) — shown only when there are
  any.
- The heresy states: **HAMBURGER ALARM** (while flagged + unadjudicated) or
  persistent **CONFIRMED HAMBURGER** stamp; a **report control** appears **only
  when the viewer does NOT own the frank** and it is still unadjudicated
  (otherwise a small "the Tribunal has ruled" note).

**PROMPT:**

> Design the **single-frank detail / veneration page** for **Snacktum
> Snacktorum** (the hot-dog cult app) — _working title **The Relic** /
> **Veneration** (user to finalize)_. Dark temple aesthetic: `#17120e`
> background, soft radial gold glow, parchment text `#f3e9d2`, accent **Mustard
> Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS, letter-spaced) for headings, the
> stats, and the badge; **Cormorant Garamond** for the caption and prose. Brand
> header lockup on top; global nav chrome wraps the page.
>
> At the top, a muted **"← Back to the Procession"** link. Center one **large
> frank photograph** in a gold-edged frame, like a venerated relic, with the
> **caption** beneath it as an italic Cormorant line. Show the **owner** as a
> linked **"venerated by @casing-name"** (to their shrine), and place **The
> Anointed Wiener** champion badge near it if the owner currently reigns.
>
> Add a **Stats** section (Cinzel labels): **PEAK VOTES** and **CURRENT VOTES**,
> each a large gold number. If the relic has any reactions, show a small
> **read-only reactions** summary (the emoji from **🌭 ❤️ 🔥 😂 🤤 👑** with
> counts).
>
> Design the **heresy states**: while the relic stands accused and unjudged, a
> **HAMBURGER ALARM** police-tape strip crosses the image, and — _only if the
> viewer does not own this relic_ — a **🍔 "Call it heresy" report** toggle
> appears below. Once the **Tribunal of the Holy Tube** has ruled it guilty, a
> persistent **CONFIRMED HAMBURGER** wax-stamp replaces the alarm and the toggle
> becomes a small italic note, "the Tribunal has ruled." Keep AA contrast; signal
> heresy by tape/stamp text, never color alone.

---

## 6. The Tribunal of the Holy Tube — the Court (champion-only)

**Route:** `/app/court` — **only the reigning Anointed Wiener may enter;**
everyone else is redirected away and never sees the nav link.
**Purpose:** the champion's heresy docket — review flagged franks and deliver
verdicts that brand HERETICS and FALSE WITNESSES.

**Must include (real functionality / states):**

- A clear framing that **only The Anointed Wiener** adjudicates — "yours is the
  verdict."
- A **docket** of flagged franks, each case = the frank's image, the owner's
  **Casing Name** (linked), caption, a **report count**, and the **current
  verdict state** (awaiting / ruled confirmed / ruled not-a-hamburger).
- Two **verdict controls** per case:
  - **"Confirmed hamburger"** → brands the owner a **HAMBURGER HERETIC**
    (permanent);
  - **"Not a hamburger"** → brands every reporter a **FALSE WITNESS** (fading).
  - each with a **"Ruling…"** pending state.
- An **empty state** — "no flagged links; the Order is honest."

**PROMPT:**

> Design **The Tribunal of the Holy Tube** — the heresy court of **Snacktum
> Snacktorum** (the hot-dog cult app) — a page **only the reigning Anointed
> Wiener** (the champion) ever reaches. Dark temple aesthetic, but more solemn
> and judicial: `#17120e` background, soft radial gold glow, parchment text
> `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS,
> letter-spaced) for the **THE TRIBUNAL OF THE HOLY TUBE** h1, verdict buttons,
> and case labels; **Cormorant Garamond** for the framing prose and captions.
> Brand header lockup on top; global nav chrome wraps the page.
>
> Open with an eyebrow ("THE ANOINTED WIENER ADJUDICATES") over the h1, an **✦**
> divider, and a liturgical framing: "Thou alone holdest the crown, and thine is
> the verdict. Confirm a heresy to brand its maker a **HAMBURGER HERETIC**;
> absolve it to brand every false accuser a **FALSE WITNESS**."
>
> Render a **docket** — a vertical list of flagged cases, each a gold-bordered
> plaque. A case shows: the accused frank's photo, **"made by @casing-name"**
> (linked to their shrine), the caption, a **report count** ("{n} accusations"),
> and a bold **verdict-state line** (Cinzel) — "AWAITING THY RULING", "RULED:
> CONFIRMED HAMBURGER 🍔", or "RULED: NOT A HAMBURGER 🌭". Give each case two
> verdict buttons: a stern **"CONFIRMED HAMBURGER →"** (brands the owner a
> HERETIC) and **"NOT A HAMBURGER →"** (brands the reporters FALSE WITNESSES), each with a
> **"Ruling…"** pending state and disabled-while-settling treatment.
>
> Design the **empty state**: "No links stand accused. The Order is honest." Keep
> AA contrast; the verdict states must read by their Cinzel text, not color
> alone.

---

## 7. Messages inbox — Epistles

> **OQ-5 RESOLVED — the page name is "Epistles"** (confirmed 2026-06-18 from the
> user's mockup filenames).

**Route:** `/app/messages`.
**Purpose:** the member's private-message inbox — a list of conversations with
other members.

**Must include (real functionality / states):**

- A **conversation list**, each row = the counterparty's **display name** + their
  **`@casing-name`**, the **last-message preview**, the **timestamp**, and an
  **unread count badge** when there are unread messages.
- Each row links to the **thread** with that member.
- An **empty state** — "no conversations yet; visit a member's shrine to begin
  one."

**PROMPT:**

> Design the **private-message inbox** for **Snacktum Snacktorum** (the hot-dog
> cult app) — **Epistles**. Dark temple aesthetic: `#17120e` background, soft
> radial gold glow,
> parchment text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel**
> (ALL-CAPS, letter-spaced) for the **EPISTLES** h1 and the counterparty names;
> **Cormorant Garamond** for message previews and dates. Brand header lockup on
> top; global nav chrome wraps the page.
>
> Lead with an eyebrow + **"Epistles"** h1 and an **✦** divider. Render a
> **conversation list** — each row a gold-edged plaque holding the
> counterparty's **sigil** (small avatar), their **display name** in Cinzel with
> the **`@casing-name`** beneath, a single-line **last-message preview** in
> muted Cormorant, and a **timestamp**. Where unread messages exist, add a small
> gold **unread-count badge**. Each row links to the conversation thread.
>
> Design the **empty state**: a centered relic-hot-dog mark with "No epistles
> yet. Seek a disciple's shrine to begin a correspondence." Keep AA contrast; the
> unread badge must carry a number, not rely on color alone.

---

## 8. Message thread — Whispers

> **OQ-5 RESOLVED — the page name is "Whispers"** (confirmed 2026-06-18 from the
> user's mockup filenames).

**Route:** `/app/messages/[handle]`.
**Purpose:** a one-to-one direct-message conversation with another member.

**Must include (real functionality / states):**

- A **"← Messages"** back link.
- A header with the **counterparty's display name** + their **`@casing-name`**
  (linked to their shrine).
- The **message history** as bubbles, visually distinguishing the viewer's own
  sent messages from the counterparty's, each with a sender label ("You" / the
  counterparty's name) and a timestamp.
- A **composer**: a labeled multi-line input + a **Send** button with a
  **"Sending…"** pending state (disabled while empty).
- An **empty state** — "no messages yet; say hello."

**PROMPT:**

> Design a **direct-message conversation thread** for **Snacktum Snacktorum**
> (the hot-dog cult app) — **Whispers**. Dark temple aesthetic: `#17120e`
> background, soft radial gold glow,
> parchment text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel**
> (ALL-CAPS, letter-spaced) for the header name and labels; **Cormorant
> Garamond** for the message bodies and timestamps. Brand header lockup on top;
> global nav chrome wraps the page.
>
> At the top, a muted **"← Epistles"** back link, then a header with the
> **counterparty's display name** (Cinzel) and their **`@casing-name`** (linked
> to their shrine). Render the **message history** as a column of bubbles:
> distinguish the **viewer's own sent whispers** (gold-tinted, aligned one side)
> from the **counterparty's** (parchment-tinted, aligned the other), each with a
> small sender label ("Thee" / the counterparty's name) and a timestamp in muted
> Cormorant.
>
> At the bottom, a **composer**: a labeled multi-line input ("Whisper unto
> {name}…") and a mustard-gold **"SEND →"** button, disabled while empty, with a
> **"Sending…"** pending state. Design the **empty state**: "No whispers yet.
> Greet this disciple." Keep AA contrast; the sent/received distinction must read
> by alignment + label, not color alone.

---

## 9. Summon a Frank — invite

**Route:** `/app/invite`.
**Purpose:** mint a single-use invite — Snacktum Snacktorum is invite-only — and
share the link with someone trusted.

**Must include (real functionality / states):**

- A framing that the Order is **invite-only**, and this mints a **single-use**
  summoning link.
- A **"Generate invite link"** button with a **"Generating…"** pending state.
- After minting: the **shareable link** shown in a read-only field, ready to copy
  (the link is `/sign-up?token=…`).
- An **error state** if minting fails.

**PROMPT:**

> Design the **invite / "Summon a Frank"** page for **Snacktum Snacktorum** (the
> hot-dog cult app), which is **invite-only**. Dark temple aesthetic: `#17120e`
> background, soft radial gold glow, parchment text `#f3e9d2`, accent **Mustard
> Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS, letter-spaced) for the **SUMMON A
> FRANK** h1, label, and button; **Cormorant Garamond** for the prose and the
> link field. Brand header lockup on top; global nav chrome wraps the page.
> Echo the **single-column, centered** ceremony of the auth mockups.
>
> Center the **relic hot-dog mark** with a halo of rays, then an eyebrow ("EXTEND
> THE SUMMONS") over a **"Summon a Frank"** h1, an **✦** divider, and a
> liturgical line: "The Order admits none uninvited. Mint a single-use summoning
> token and bestow it upon one you trust." Provide a mustard-gold **"MINT A
> SUMMONING TOKEN →"** button (dark text, Cinzel uppercase, trailing arrow) with
> a **"Summoning…"** pending state.
>
> Design the **post-mint state**: a line "Bestow this single-use summons:" above
> a **read-only link field** (dark fill, gold bottom-border, Cormorant) holding
> the shareable sign-up URL, with an obvious **copy** affordance. Design an
> **error state** as a warm-rust italic line ("The summons could not be minted —
> try once more."). Keep AA contrast.

---

## 10. The Catechism — help / how-it-works

**Route:** `/app/help`.
**Purpose:** the static, cult-themed scripture of how the Order works — the rules
of votes, the crown, Anointing, reactions, the Tribunal, walls & messages, and
summoning. Must stay **accurate to real mechanics**.

**Must include (real, accurate mechanics — do not alter behavior, only voice):**

- **The vote & the crown** (top billing): **one vote per member**; the vote is
  **movable** (moving it releases the old); **no voting your own frank**; **most
  votes wins** the crown; **ties are sticky** (incumbent keeps it until someone
  pulls strictly ahead); **days as The Anointed Wiener** are tallied over time.
- **Champion powers:** **Anoint** (the mustard blessing) another member's shrine;
  **adjudicate** heresy in the Tribunal.
- **Reactions:** cosmetic emoji, **no effect on votes / ranking / crown**.
- **Anoint (mustard):** the champion anoints a member's shrine; it **fades on its
  own over ~24h**.
- **Walls & messages:** every member has a public wall; private DMs too.
- **The Tribunal (heresy court):** any member may **report** a frank as a
  hamburger → raises a **HAMBURGER ALARM** → the champion **rules**: **not a
  hamburger** brands the reporters **FALSE WITNESS** (fades over ~7 days);
  **confirmed hamburger** brands the owner **HAMBURGER HERETIC** (permanent).

**PROMPT:**

> Design **The Catechism** — the how-it-works scripture of **Snacktum
> Snacktorum** (the hot-dog cult app) — a static, multi-section sacred-text page.
> Dark temple aesthetic: `#17120e` background, soft radial gold glow, parchment
> text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS,
> letter-spaced) for the **THE CATECHISM** h1 and the section `h2`s; **Cormorant
> Garamond** for the explanatory prose, set like illuminated scripture. Brand
> header lockup on top; global nav chrome wraps the page. Use **✦** dividers
> between sections.
>
> Lay out these sections as articles of faith, in this order (the doctrine must
> stay accurate — re-voice only, do not change the rules):
>
> 1. **Of the Vote and the Crown** (give this top billing): each disciple holds
>    **one vote**; the vote is **movable** (to move it releases the prior); **none
>    may vote their own frank**; **the most-voted link crowns its maker The
>    Anointed Wiener**; **ties are sticky** — the reigning champion keeps the crown
>    until another pulls strictly ahead; and **days as The Anointed Wiener** are
>    tallied over the whole reign.
> 2. **Of the Powers of The Anointed Wiener:** the champion alone may **Anoint** a
>    disciple's shrine (the mustard blessing) and **adjudicate heresy** in the
>    Tribunal of the Holy Tube.
> 3. **Of Reactions:** any disciple may react to a link with an emoji — **purely
>    cosmetic**, with **no effect on votes, rank, or the crown**.
> 4. **Of the Anointing (mustard):** the champion's blessing upon a shrine
>    **fades on its own over about a day**.
> 5. **Of Walls and Epistles:** every disciple keeps a public wall for messages,
>    and may send private epistles (DMs) to another.
> 6. **Of the Tribunal of the Holy Tube:** any disciple may **report** a link as a
>    hidden hamburger, raising a **HAMBURGER ALARM** for all to see; then **The
>    Anointed Wiener rules** — **"not a hamburger"** brands the accusers **FALSE
>    WITNESS** (a mark that fades over ~7 days), while **"confirmed hamburger"** brands
>    the maker a **HAMBURGER HERETIC** (a permanent mark of shame). Close with a
>    warning: "Choose thine accusations wisely — a false report brands thee."
>
> Keep AA contrast and a comfortable reading measure for the scripture prose.

---

## 11. The Lost Pilgrim — error / 404

**Route:** root error boundary (`src/routes/+error.svelte`), covering 404 and
generic errors.
**Purpose:** a branded, cult-voiced error / not-found page with a friendly way
back. **Never** shows raw internal error detail.

**Must include (real functionality / states):**

- Handles **404** (unknown route) and **generic errors** with appropriate
  cult-voiced copy (a short status line, e.g. the HTTP status).
- A **friendly message only** — no stack traces, no internal error detail.
- A clear **way back** (a link home to **The Procession** / the gates).

**PROMPT:**

> Design a branded **error / 404 page** — **"The Lost Pilgrim"** — for **Snacktum
> Snacktorum** (the hot-dog cult app). Dark temple aesthetic: `#17120e`
> background, soft radial gold glow, parchment text `#f3e9d2`, accent **Mustard
> Gold `#E0A82E`**. Type: **Cinzel** (ALL-CAPS, letter-spaced) for the eyebrow,
> the big status, and the button; **Cormorant Garamond** for the prose. Echo the
> **single-column, centered** ceremony of the auth mockups, brand header lockup on
> top.
>
> Center the **relic hot-dog mark** (with its halo of rays), then a Cinzel
> **eyebrow** ("THOU HAST STRAYED") over a large Cinzel status — show the error
> code prominently (e.g. **404**) — and a liturgical line for the **not-found**
> case: "This corridor of the Snacktum leads nowhere, pilgrim. The link thou
> sought is not among the sacred." Provide a second, gentler line for **generic
> errors** ("A disturbance in the Tube — the Order is set upon it."). Show only a
> **friendly message** — never a stack trace or internal detail.
>
> End with a mustard-gold **"RETURN TO THE PROCESSION →"** button (dark text,
> Cinzel uppercase, trailing arrow) linking home. Keep AA contrast; convey the
> error by the status text + copy, not color alone.

---

## 12. The Reliquary — the honors / badge shelf

> **A section of the profile / The Shrine (prompt #3), not a standalone route.**
> It renders the member's earned **honors** (badges) as a relic-shelf. **Every
> badge is DERIVED at render from data the app already keeps** — there is no new
> "badge" record, no new tracking, nothing a member can set. So a badge is simply
> a relic that lights up once the underlying record crosses a threshold; the rest
> sit dim as silhouettes the disciple may yet earn. (Build note for the implementer
> is **TASK-089**; this prompt is only the visual.)

**Route:** rendered within `/app/profile/[handle]` (a shelf on The Shrine).
**Purpose:** show, at a glance, which honors of the Order a member has earned —
earned relics lit in gold, unearned ones as dim silhouettes, tiered honors
showing their current tier.

**Must include (real, all DERIVED from existing data — no new mechanic):**

- A **relic-shelf grid** of honor medallions. Each relic is a small gold
  line-art **sigil + a Cinzel name**; below or on hover, a one-line liturgical
  description of how it was earned.
- **Two states per relic:**
  - **Earned** — the medallion lit in mustard gold, crisp, with a faint glow.
  - **Unearned / locked** — the same medallion as a **dim parchment silhouette**
    (no glow), so the shelf reads as a collection with gaps to fill. Never rely
    on color alone — the locked state must also read by reduced contrast + a
    "not yet" cue (e.g. an italic "unearned" line), per AA.
- **Tiered relics** (some honors have ranks) show the **current tier** (e.g. a
  reign relic at I / II / III, or a small "×N" / numeral) and hint the next tier.
- The **v1 honor set** (design a medallion for each — these are the real,
  derivable honors):
  - **First Frank** — offered thy first sacred link.
  - **The Anointed (Crowned)** — _tiered_: held the crown **1 / 7 / 30** days
    (the reign-length relic, three ranks).
  - **Centurion** — a single frank that once bore **100 blessings** (≥100 votes)
    — _tiers optional_.
  - **The Summoner** — _tiered_: disciples thou broughtest into the Order
    (redeemed summons), e.g. **1 / 5 / 25**.
  - **The Drenched** — _tiered_: times the champion **anointed** thee.
  - **Heretic** — a lasting mark: thou keepest a frank the Tribunal confirmed a
    hamburger (a shame-relic, rendered darker / inverted — an excommunication
    mark, not a gilded honor).
  - **False Witness** — thou borest false witness against a clean link (a
    fading shame-relic; lean into the cult/heresy framing).
  - **The Inquisitor** — _tiered_: verdicts thou renderedst as The Anointed
    Wiener (heresies judged from the Tribunal).
  - **Elder** — among the first of the Faithful to be sworn (an early-member
    relic).
- A small **count line** — "Thou hast earned {n} of {total} relics."
- An **empty state** — when none are earned: the dim shelf with "No relics yet —
  earn thy first honor in the service of the Tube."
- A clear cue that the **shame-relics (Heretic / False Witness) are marks of disgrace**,
  not gilded honors — visually distinct from the earned-gold honors so the shelf
  doesn't read a heresy brand as a trophy.

> **State note (for the designer):** every relic is either **earned** or
> **locked** (and tiered relics carry a rank). Design **all three**: a lit earned
> honor, a dim locked silhouette, and a tiered relic showing a current rank +
> next-tier hint. The two **shame-relics** are a fourth visual register (disgrace,
> not honor).

**PROMPT:**

> Design **The Reliquary** — a member's shelf of earned **honors** (badges) — as a
> section of the profile / shrine for **Snacktum Snacktorum** (the hot-dog cult
> app). Dark temple aesthetic: `#17120e` background with a soft radial gold glow,
> parchment text `#f3e9d2`, accent **Mustard Gold `#E0A82E`**. Type: **Cinzel**
> (ALL-CAPS, letter-spaced) for the section heading and the relic names; **Cormorant
> Garamond** for the liturgical one-line descriptions. Assume the brand header lockup
> and global nav chrome wrap the page; this is a shelf within the shrine, beneath the
> member's sigil + stat ledger.
>
> Lead with a Cinzel **eyebrow** ("HONORS OF THE ORDER") over an **h2** ("The
> Reliquary"), an **✦** ornament divider, and a small count line ("Thou hast earned
> {n} of {total} relics"). Render a **relic-shelf grid** of honor medallions — each a
> small **gold line-art sigil** in a thin gold ring, with a **Cinzel name** beneath
> and a one-line **Cormorant** description of how it is earned.
>
> Design **two states for each relic**: an **earned** state — the medallion lit in
> mustard gold, crisp, with a faint glow — and an **unearned / locked** state — the
> same medallion as a **dim parchment silhouette**, no glow, clearly "not yet" (carry
> the locked cue in text + contrast, never color alone). For **tiered** honors, show
> the **current rank** (a small numeral or I / II / III) and hint the next tier.
>
> Lay out medallions for these honors (real, earnable relics of the Order): **First
> Frank** (offered thy first sacred link); **The Anointed** — _tiered I/II/III_ —
> reigned as The Anointed Wiener for **1 / 7 / 30** days; **Centurion** (a single
> frank that bore a hundred blessings); **The Summoner** — _tiered_ — disciples thou
> broughtest into the Order; **The Drenched** — _tiered_ — times the champion anointed
> thee; **The Inquisitor** — _tiered_ — heresies thou judged as the champion; and
> **Elder** (among the first sworn to the Tube). Render two **shame-relics** in a
> distinct, darker / inverted register — **excommunication marks**, not gilded honors:
> **HERETIC** (thou keepest a frank the Tribunal confirmed a hamburger — a lasting
> mark) and **FALSE WITNESS** (thou borest false witness against a clean link —
> a fading mark). Lean fully into the cult/heresy framing for these two.
>
> Design the **empty state** (no relics earned): the dim shelf with a centered
> relic-hot-dog mark and "No relics yet — earn thy first honor in the service of the
> Tube." Keep AA contrast throughout; the earned/locked distinction and the
> honor/shame distinction must each read by shape, glow, and text — never by hue
> alone. Match the auth mockups: `border-radius:2px`, faint gold dividers, gold
> drop-shadow on lit relics.

---

## Appendix — OQ-5 page-name decisions

**OQ-5 is now mostly resolved** (2026-06-18, confirmed from the user's mockup
filenames). **Only the dog-detail name remains open** — the user chooses it:

| Page                                   | Route                    | Cult name                                   |
| -------------------------------------- | ------------------------ | ------------------------------------------- |
| Profile                                | `/app/profile/[handle]`  | **The Shrine** ✅ RESOLVED                  |
| Messages inbox                         | `/app/messages`          | **Epistles** ✅ RESOLVED                    |
| Message thread                         | `/app/messages/[handle]` | **Whispers** ✅ RESOLVED                    |
| `/sign-in` (heading)                   | `/sign-in`               | **Enter the Snacktum** ✅ RESOLVED          |
| `/app` home/hub                        | `/app`                   | **N/A** — retired → redirects to Procession |
| Dog detail                             | `/app/dogs/[id]`         | _OPEN_ — **Veneration** / **The Relic**     |

> The **confirmed** page names in the Page Naming Map:
> `/sign-up` → Take the Casing, `/sign-in` (heading) → Enter the Snacktum,
> `/app/onboarding` → Choose Your Frank Name, `/app/dogs` → Your Litter,
> `/app/feed` → The Procession: Standings of the Blessed,
> `/app/profile/[handle]` → The Shrine, `/app/messages` → Epistles,
> `/app/messages/[handle]` → Whispers, `/app/court` → The Tribunal of the Holy
> Tube, `/app/invite` → Summon a Frank, `/app/help` → The Catechism.
