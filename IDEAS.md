# CheckDrive — post-MVP differentiation roadmap

Written 2026-06-22 in response to feedback: *"needs more to stand out from a plain
checklist / make people actually use it."* This is a menu + my opinionated ranking,
not decided scope. React and cut it down.

---

## The thesis (read this first)

A checklist is a commodity. Apple Reminders, Notes, and fifty free apps do checkboxes.
CheckDrive's only real moat is **the moment** — it catches you at the exact instant you
leave and arrive in the car. Nothing else knows *when* you need the list.

So "stand out" does **not** mean more checkbox features. It means three things:

1. **The right list for THIS trip** (not one static list you maintain by hand).
2. **Own the arrival, not just the departure** (right now the disconnect moment is
   almost unused — that's half the product sitting idle).
3. **A reason to exist that a plain checklist doesn't have** — safety and peace of
   mind. "Never forget your kid / pet / wallet / meds" is an emotional hook a generic
   list can't claim.

Build toward those three. Anything that doesn't serve one of them is feature soup.

## Hard caveat (don't skip this)

There's still **zero evidence** anyone completes car-detection setup or does a second
trip. Every idea below is a bet on a funnel you haven't measured. The order of
operations is unchanged: ship build 7, watch one real person attempt setup unaided,
see where the loop actually breaks. Treat this doc as the ranked menu for *after* that —
so you can move fast once you know the core loop holds. If setup is the wall, none of
these features matter yet.

---

## Prioritized moves

### Tier 1 — cheapest "stand-out" per hour. Build these first.

- **Trip-type starter templates.** School run, commute, gym, grocery, road trip, pet,
  gym, airport. Today a new user faces an empty list (a cold start that feels generic).
  Instead: "what kind of trip?" → a smart starting list they edit. Near-zero cost
  (static data), instantly reads as "this app gets *driving*," and doubles as a much
  stronger first-run moment than a blank editor. **Effort: S. Risk: none.**

- **Re-add streaks + sharper "peace of mind" stats.** You cut `tripStreaks` /
  `currentStreak` for the MVP — bring them back, the shape already existed. Pair with
  stats that mean something: "12-day complete-trip streak", "94% complete", "you
  haven't forgotten your wallet in 30 trips." This is the *reason to come back* a plain
  checklist never gives you — completion becomes a thing you don't want to break.
  **Effort: S. Risk: low.**

These two together fix the cold start *and* the retention reason, for roughly a weekend.

### Tier 2 — real differentiation (the "whoa")

- **AI / natural-language list generation.** "Make a checklist for a beach day with
  toddlers" → real items. This is the single biggest break from "a static list" — no
  basic checklist app does it, it's on-trend, and it's a clean Pro hook that justifies
  the lifetime price. **Caveat:** it's the first feature that breaks the app's
  no-backend simplicity. You can't ship an LLM key in the client, so it needs a tiny
  proxy (EAS hosting / a serverless function) and carries per-call cost. Gate it behind
  Pro and cap usage. **Effort: M (mostly the backend bit). Risk: med (cost + infra).**

- **Make arrival do real work.** Right now disconnect only fires the back-seat reminder.
  The arrival moment can carry its own short checklist: lights off, windows up, locked,
  grab your bag, plug in (EV). This is the unused half of the product and a generic
  checklist never touches "you just parked." **Effort: S–M. Risk: low.**

- **Home-screen widget / quick-run.** A widget showing today's list with a one-tap run.
  It surfaces the app *without* depending on the fragile auto-trigger — a second, more
  reliable path to the core loop. **Effort: M (native widget work). Risk: low.**

### Tier 3 — bigger bets, later

- **Context-aware suggestions** (weather / time-of-day / calendar): "rain expected —
  umbrella, defrost." Client-side weather API + location permission; no backend needed,
  but more moving parts and a permission ask. **Effort: M.**
- **iOS Live Activity** during a trip — checklist progress on the lock screen. Premium
  feel, native work. **Effort: M–L.**
- **Car maintenance reminders** (oil, tires, registration/insurance expiry). Broadens
  from "trip checklist" to "car companion" — a different, larger product. Periodic, not
  per-trip. **Effort: M. Strategic question, not just a feature.**
- **Shared / family lists** (partner adds "grab the dry cleaning" to your evening list).
  Genuinely sticky, but it's the one idea that forces a real backend + accounts —
  a big jump from today's local-only Zustand/AsyncStorage. **Effort: XL. Defer hard.**

---

## If you build ONE thing next

**Templates + streaks/stats as a single Tier-1 bundle.** A weekend, near-zero risk, and
it immediately makes the app feel less generic *and* gives a reason to return — the two
things the feedback actually asked for. Then **AI list-generation** as the marquee
differentiator and Pro justifier once you've decided you're willing to run a tiny
backend.

Everything here is gated on the same question: **does anyone get through setup and take a
second trip?** Build Tier 1 the moment you have one real "yes." Don't build Tier 2/3 on a
funnel you haven't measured.

## The standing assignment

Ship build 7. Put it on one real person's phone. Watch them try to set up car detection
and shut up while they struggle. Whatever breaks *there* outranks everything in this doc.
