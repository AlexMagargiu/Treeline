# Design contract

The skill `design-taste-frontend` (tasteskill v2) is the only source of design rules for
this project. It is installed at `.claude/skills/design-taste-frontend/SKILL.md` and
`.agents/skills/design-taste-frontend/SKILL.md`, pinned in `skills-lock.json`.

This file adapts it to Treeline. Read this file and the skill together. Where they
disagree, this file wins, and every divergence below carries the evidence for it.

## 1. When the skill fires

Load the skill before writing or changing any of these, without being asked:

- Any `.tsx`, `.jsx`, `.css` or `.scss` file in the web app.
- Any screen, component, layout, theme token, font, icon, colour or motion decision.
- Any user-facing string that ships in the interface.
- Any review of the above.

Do not load it for API code, worker code, migrations, SQL, tiles or infrastructure.

You load the skill first, then this file, then the spec section that governs the screen.
Announce it in one line: "Using design-taste-frontend for the trail page."

## 2. What binds, and what does not

The skill says at its head that it is for landing pages, portfolios and redesigns, and
Section 13 puts "dashboards, dense product UI, data tables and multi-step forms" out of
scope. Treeline is product UI. The skill's own instruction for that case is to say so,
and to apply only the parts that fit. That is what this section does.

**Binds in full, on every surface:**

| Skill section | Why it applies here |
| --- | --- |
| 0. Brief inference, 0.D anti-default discipline | The defaults it names are exactly what a hiking app drifts into |
| 1. The three dials | Set once in section 3 below, for the whole product |
| 2. Brief to design system map | shadcn/ui is the chosen foundation, so its rules apply: own the code, never ship a component in its default state, one system per project |
| 3.A Stack, 3.C icons, 3.D emoji, 3.E layout mechanics, 3.F dependency check | Tailwind v4, one icon family, no emoji, grid over flex math, check `package.json` first |
| 4.1 Typography, 4.2 Colour, 4.4 Materiality and shape lock | One accent, one radius scale, no AI purple |
| 4.5 Interactive states, 4.6 forms | Loading, empty and error states are half of phase 1 |
| 4.11 Theme lock | One theme at a time, never a section that inverts |
| 6. Performance and accessibility | The spec demands the same things and adds to them |
| 8. Dark mode protocol | The spec requires dark mode and a high contrast mode |
| 9. AI tells, including 9.G the em dash ban | All of it, on every visible string |

**Binds only on `/login`**, which is the one page that behaves like a front door:

4.7 hero discipline, 4.8 image strategy, 4.9 content density, 4.10 quotes.

**Does not apply anywhere in Treeline:**

| Skill rule | Why not |
| --- | --- |
| At least 8 sections, 4 layout families per page | The site has screens, not marketing pages. A trail page is one subject |
| Hero stack, hero padding, CTA intent, logo walls, trust strips | There is nothing to sell. One user, already logged in |
| Bento cell counts, marquee budget, zigzag cap, split header ban | No such sections exist in the spec |
| The other Section 2.A systems | shadcn/ui is the choice. Fluent, Carbon, Material, Polaris and the rest do not enter this tree |
| 5. Scroll hijack, sticky stacks, horizontal pans | The map never unmounts and the sheet is the only scroll surface |
| 12. Block library | Not populated |

**Eyebrow restraint** (4.7) does apply, in its real spirit: no small uppercase labels above
headings anywhere in this product. Not a budget of one per three sections. Zero.

## 3. The design read and the dials

**Design read:** a private, map first field instrument for one hiker, read on a phone in
direct sun and in gloves, with a restrained cartographic language, built on Tailwind v4
and shadcn/ui components that we own and retheme, around a MapLibre canvas.

| Dial | Value | Reasoning |
| --- | --- | --- |
| `DESIGN_VARIANCE` | **3** | The skill puts accessibility critical briefs at 3 to 4. Correctness is guaranteed at 320 px, where every asymmetric layout collapses to one column anyway. Variance would only buy risk |
| `MOTION_INTENSITY` | **2** | The spec requires `prefers-reduced-motion`, warns that the map must not block first paint, and spends a section on battery. The skill says that if you cannot ship real motion, drop the dial and ship clean static. The bottom sheet between its three rest positions is the one motion that carries meaning, and that is feedback, not decoration |
| `VISUAL_DENSITY` | **6** | A catalogue with six filter chips, a drawer, and a trail page of numbers is the skill's "daily app" band. Not a cockpit: cards are still allowed where elevation means something |

`MOTION_INTENSITY: 2` means the page does not animate beyond state feedback. That is a
deliberate reading of the skill's own rule that a claimed dial must be shown.

## 4. The brief

- **Page kind:** private product UI. One public page, `/login`.
- **Product:** Treeline. Plans a hike in the Romanian Carpathians, records what happened
  on it, and photographs the same viewpoints every season.
- **Audience:** one walker, on an Android phone, at 05:40 on a platform at Bucuresti Nord
  and at 1800 m in wind. Cold hands, gloves, bright screen, one hand free.
- **Vibe words:** restrained, cartographic, legible, instrument.
- **References:** paper topographic sheets and station timetable boards. The user has
  named no product references. If you want a different anchor, say so and this line
  changes.
- **Avoid:** AI purple and violet glows, glassmorphism, centred marketing heroes, three
  equal feature cards, decorative status dots, scroll cues, section numbering, eyebrow
  labels, fake screenshots built from divs, stock mountain photography standing in for the
  user's own record, anything that carries meaning only on hover, anything below 48 px,
  any fixed pixel width.

## 5. Divergences from the skill, with evidence

The skill allows divergence when it is evidenced and written down. These five are.

1. **No decorative photography in phase 1.** The skill says a text only page is incomplete
   work and to reach for a generation tool, then Picsum. Treeline has no photographs until
   phase 5, and the ones it will have are the user's own record of real places. A Picsum
   mountain on a trail page is a fabricated memory in a personal journal. The map, the
   massif shading and the elevation profile are the visual content of this product. On
   `/login` one real image is allowed and wanted.
2. **Data graphics are not hand rolled decoration.** The skill discourages hand rolled SVG.
   The elevation profile, the massif shading, the coverage bars and the junction strip are
   data, not ornament. They are governed by the `dataviz` skill, which is installed. Load
   `dataviz` for those and `design-taste-frontend` for everything around them. The SVG ban
   still holds for icons and for ornament.
3. **Three themes, not two.** The skill locks one theme per page. The spec requires dark
   mode and a high contrast mode for direct sun. These are global themes chosen once at
   the root, never a section that flips. The lock is kept, the count is three.
4. **Numbers use a mono face.** The skill reserves that for density 8 and above. A trail
   page compares distances, ascents, times and difficulty across rows, and tabular figures
   are the reason the comparison reads. Applies to numerals only, not to prose.
5. **The em dash ban covers shipped strings only.** Every visible string in the interface:
   headline, label, button, caption, error, alt text, aria label. It does not cover
   repository documents or commit messages, which follow the Writing and Commits sections
   of `CLAUDE.md`. The rule exists because the em dash is the clearest tell in generated
   interface copy, not because the character is wrong.

## 6. Locked for the whole product

Pick these once. Changing one later is a design decision, not an implementation detail.

- **Tailwind v4** with the `@tailwindcss/postcss` plugin or the Vite plugin, never the v3
  `tailwindcss` PostCSS entry.
- **shadcn/ui** for components, installed with `npx shadcn@latest add`. The code lives in
  the repository and we own it. **Never ship a component in its default state:** its
  radius, colour, shadow, spacing and type come from our tokens before it reaches a
  screen. One system, so nothing from Fluent, Carbon, Material or Radix Themes enters the
  tree beside it. The Radix primitives that shadcn itself depends on are not a second
  system.
- **One accent colour, settled on 2026-09-19: a topographic blue.** Used identically on
  every screen. It is not purple, not violet, not a gradient, and its saturation stays
  under 80 percent. Route lines carry the season difficulty scale, which is a data ramp
  and not the accent.

  | Theme | `--primary` | Saturation | Contrast |
  | --- | --- | --- | --- |
  | Light | `#2A5F87` | 69 percent | white on it 6.81, it on the off-white surface 6.57 |
  | Dark | `#7FC3E6` | 45 percent | on the dark surface 9.41, near-black text on it 9.41 |
  | High contrast | `#1B4A6B` | 75 percent | 9.38 on pure white, both directions |

  The light blue the brief asked for is the dark theme. As a light-theme primary it
  measures 1.92 against an off-white surface, which fails AA by a distance, so it is the
  same accent seen on a dark ground rather than a second colour. The blue also stays clear
  of the difficulty ramp, which runs green to amber to red, so an accent control never
  reads as a difficulty.
- **One neutral family.** Do not mix warm and cool greys.
- **One corner radius scale**, expressed as shadcn's `--radius` and derived from it
  everywhere. No component carries its own radius.
- **One icon family: Lucide** (`lucide-react`), one stroke weight, imported per icon so
  the bundle stays small on 3G. No hand drawn icon paths. No emoji.
  The skill discourages Lucide as a default and allows it when the project already depends
  on it. shadcn/ui ships Lucide inside the components it generates, so the project does
  depend on it. Taking Phosphor instead would mean either two icon families in one bundle,
  which the skill's one-family rule forbids, or rewriting the imports of every component
  the generator adds, forever. Lucide it is, deliberately, through the skill's own
  override.
- **One sans, one mono, settled on 2026-09-19: IBM Plex Sans and IBM Plex Mono**, loaded
  with `next/font/google`, which self hosts them at build time. Never a Google Fonts
  `<link>`. Plex is drawn for technical material, which is the design read of this
  product, and the mono is a true sibling of the sans rather than a borrowed face, which
  matters because divergence 4 puts mono numerals inside sans prose on every trail page.
  Plex Mono carries tabular figures, so a column of distances lines up.

  The Romanian check was run, not assumed. Both faces encode U+0218 to U+021B, and in both
  of them `ș` is the glyph `scommaaccent`, built as `s + uni0326`, distinct from
  `scedilla`. A face that renders Prapastiile Zarnestiului with a Turkish cedilla fails
  the spec's naming rule, and this pair does not. Five other candidates passed the same
  test (Source Sans 3, JetBrains Mono, Geist, Geist Mono, Atkinson Hyperlegible), so the
  choice between them was made on the design read, not on coverage.
- **Theme tokens as CSS variables**, using shadcn's own names as the token layer. Light
  under `:root`, dark and high contrast under `[data-theme="dark"]` and
  `[data-theme="contrast"]`, with Tailwind's `dark` variant pointed at the same attribute
  so `dark:` and the tokens never disagree. One strategy, not two. There are three themes
  because the spec requires a high contrast mode for direct sun, and shadcn ships two.
- **No pure black and no pure white.**
- **Numbers on screen are formatted, never printed raw.** The view `route_derived` keeps
  full `numeric` precision on purpose, so a corrected distance moves every figure that
  depends on it. `2.5238095238095238` is a storage value and it must never reach a screen.
  Every surface formats at the edge, in one shared helper, not per component:

  | Value | On screen | Not |
  | --- | --- | --- |
  | Distance | `16.0 km`, one decimal always, so a column aligns | `16 km`, `16.00 km` |
  | Ascent, descent | `1050 m`, whole metres | `1050.00 m` |
  | Any duration | `8 h 20`, hours and minutes | `8.33 h`, `8.3333333 h` |
  | Effort points | `26.5`, one decimal | `26.5000000000000000` |
  | Difficulty, stage | whole numbers | any decimal |
  | Energy | the net figure as the headline, gross behind it, both rounded to ten by the view | an unrounded figure, gross alone |

  Durations are the one that matters most. `8.33 h` is a spreadsheet artefact, and nobody
  standing on a platform converts it. Hours and minutes, every time.

  **Energy, settled on 2026-09-19.** The catalogue's figure is gross: it includes the
  roughly 130 kcal an hour a 130 kg walker burns sitting still, which is about 1100 kcal of
  route 52's 6830. The headline is therefore the net figure, what the walk itself costs,
  with the gross figure available behind it for anyone comparing against the original
  spreadsheet. Both carry the plus or minus 25 percent band the spec requires. The band is
  not decoration: for route 52 it spans 5120 to 8540, which brackets both the net figure
  and the higher number the ACSM formula gives for the same day, so it is an honest
  statement of how little anybody knows about this.

## 7. Decisions settled on 2026-09-19

All three are closed. A frontend coding prompt no longer has anything to stop on.

1. **The type pair: IBM Plex Sans and IBM Plex Mono.** Section 6 carries the reasoning and
   the diacritics evidence.
2. **The accent: the topographic blue in section 6**, one value per theme, each measured
   against its own surface.
3. **`/login` carries no image.** It is a plain gate: one password field, one button, one
   error state. The password is set in `.env` and compared against an argon2id hash, and
   the route is rate limited to five attempts per IP per fifteen minutes.

   Divergence 1 allowed one real photograph here and the user declined it. That is the
   right call twice over. There is no photograph yet that is the user's own, and the skill
   bans a fabricated one; and a login screen with a stock mountain on it is the exact
   marketing gesture this product has no reason to make. The page has to do one thing at
   05:40 with cold hands: take a password. The gate therefore gets a 48 px field, a
   visible focus ring in the accent, an error that names what went wrong without saying
   whether the password exists, and nothing else.

Anything else the spec does not describe still stops a coding agent. These three no longer
do.

## 7a. Two screen decisions settled on 2026-09-20

Recorded here because they answer questions `docs/spec.md` asks outright, and a coding
agent reading the spec alone would stop on both.

**The country map shades by routes known, and carries no switch.** The spec offers three
measures and defaults to time since you were last there, which is the one that helps you
choose where to go. In phase 1 all three are dead: routes walked and share of network
walked are zero for all 15 massifs, and last visited is null for all of them, because
`visit` arrives in phase 4. A three-way switch whose options cannot be chosen is worse than
none, and fifteen massifs reading "never visited" is the discouraging first screen trap 3
warns about. The legend states what is being shaded. The switch arrives with the first
visit.

**The map opens clean, with the sheet at its lowest rest.** The spec proposes opening at
"candidates for next weekend" and asks for confirmation. That ranking needs daylight,
departures and forecast, all of which are phase 6, so phase 1 cannot compute it. A sheet
resting on a list that only pretends to be ranked is worse than a map.

## 8. Paste this block into every frontend coding prompt

The supervisor copies this verbatim into the "Design" section of any
`CODING_PROMPT_{NAME}.md` that touches the interface. A coding agent has no memory of this
session, so the rule has to travel with the prompt.

---

**Design (mandatory, do this before you write any markup)**

1. Load the skill `design-taste-frontend`, then read `docs/design.md`. Announce both in one
   line.
2. The dials for this product are fixed: `DESIGN_VARIANCE: 3`, `MOTION_INTENSITY: 2`,
   `VISUAL_DENSITY: 6`. Do not re-derive them and do not override them.
3. Section 2 of `docs/design.md` says which parts of the skill bind here. The landing page
   rules do not. The anti slop rules, the accessibility rules and the em dash ban do.
4. Zero em dashes and zero en dashes in any string that ships in the interface. Hyphen
   only. Your commit message follows the Commits section of `CLAUDE.md` instead.
5. Respect the locked choices in section 6 of `docs/design.md`. If your screen needs a
   decision that is still open in section 7, stop and ask. Do not pick one.
6. Before you report done, run the Treeline pre-flight check in section 9 of
   `docs/design.md` and write out every box with Pass or Fail and one line of
   justification. Any Fail blocks completion.

---

## 9. Treeline pre-flight check

Replaces Section 14 of the skill. Every box, written out, Pass or Fail, one line each.

**Language and copy**

- [ ] Zero em dashes and en dashes in every shipped string, including alt text, button
      labels, error messages and aria labels.
- [ ] Every visible string re-read. Nothing grammatically broken, nothing cute, nothing
      that reads as an LLM sounding thoughtful.
- [ ] Interface in English. Place names Romanian with correct diacritics, bracketed gloss
      on first mention on the screen, no translated signpost.
- [ ] No invented numbers. Every figure on the screen comes from the database or is
      labelled as an example.

**Composition**

- [ ] No eyebrow labels anywhere. No section numbering. No scroll cues. No decorative
      status dots. No locale or time strips.
- [ ] One accent colour across every screen touched. One radius scale. One neutral family.
- [ ] No shadcn component left in its default state. Radius, colour, shadow, spacing and
      type come from our tokens. Name each component added and what was retuned.
- [ ] Cards used only where elevation carries hierarchy.
- [ ] No fake screenshots built from divs. No hand rolled decorative SVG. Data graphics
      excepted, per section 5.

**The spec's own floor**

- [ ] Correct at 320, 360, 390 and 412 px. No sideways scrolling at any of them. Screenshot
      or description per width.
- [ ] No fixed pixel widths. `min-width: 0` on flex children, `max-width: 100%` on media.
- [ ] Every touch target at least 48 px, with gaps.
- [ ] No hover state carries meaning. Everything reachable with a thumb.
- [ ] Light, dark and high contrast all checked. Hierarchy survives all three.
- [ ] Visible keyboard focus. `prefers-reduced-motion` honoured, and it collapses motion to
      instant rather than merely shortening it.
- [ ] WCAG AA contrast on body text and on every control, in all three themes.
- [ ] Warnings render above the description, never below it.

**Behaviour**

- [ ] Loading, empty and error states all built. The empty state is composed, not a
      sentence in grey.
- [ ] The massif empty state shades by routes known and says so in the legend. It does not
      read "never visited" on every massif.
- [ ] Filter state lives in the URL, and the URL restores it exactly.
- [ ] No `window.addEventListener('scroll')`. No `h-screen`, use `min-h-[100dvh]`.
- [ ] Every effect, timer and listener cleaned up on unmount.
- [ ] The map does not block first paint, checked under 3G throttling.
- [ ] No new dependency added without checking `package.json` first and naming the install
      command.

## 10. The two prompts, adapted

**Starting a new surface**

```
I have loaded design-taste-frontend as my only source of design rules, and docs/design.md
as the Treeline adaptation of it.

Brief:
- Surface: <the screen, e.g. the massif sheet>
- Spec section: <the section of docs/spec.md that governs it>
- Product: Treeline. A private hiking catalogue and record for the Romanian Carpathians.
- Audience: one walker, on a phone, in sun or rain, in gloves.
- Vibe words: restrained, cartographic, legible, instrument.
- Avoid: everything in section 4 of docs/design.md.
- Dials are fixed: VARIANCE 3, MOTION 2, DENSITY 6. Do not re-derive them.

Step 1. State the design read for this surface in one sentence, name the layout you will
use and why, and list which of the still open decisions in section 7 your screen needs.
Stop.

Step 2 (after my OK). Build the surface. Tailwind v4, shadcn components retuned to our
tokens, Lucide icons, theme set once at the root, no decorative imagery.

Step 3. Run in writing:
- Em dash audit, zero U+2014 and zero U+2013 in shipped strings
- The Treeline pre-flight check, section 9 of docs/design.md, every box Pass or Fail with
  one line of justification
- Width audit at 320, 360, 390 and 412
- Theme audit in light, dark and high contrast

Any Fail blocks completion.
```

**Changing a surface that already exists**

```
I have loaded design-taste-frontend and docs/design.md.

Brief:
- Surface: <path>
- Mode: preserve
- What works today: <two or three specifics to keep>
- What is broken today: <two or three specifics to fix>
- Constraint: the URL, the filter parameter names and the API contract do not change.

Step 1. Run the audit from Section 11.B of the skill against this surface: tokens in use,
the layout families present, what to preserve, what to retire, and the dial reading the
code currently shows against the fixed 3 / 2 / 6. Post it in writing. Stop.

Step 2 (after my OK). Name which modernisation levers from Section 11.D you will apply, in
order. Stop.

Step 3 (after my OK). Implement.

Step 4. Run in writing: em dash audit, the Treeline pre-flight check, and a preservation
audit listing every URL, query parameter, aria label and API field you changed. That list
should be empty.

Any Fail blocks completion.
```

## 11. Quick reminders

- Zero em dashes anywhere in the interface. Hyphen only.
- One theme at the root. Never a section that inverts.
- Correct at 320 px. Test at 320, 360, 390, 412.
- Touch targets 48 px. No hover carries meaning.
- No eyebrows, no section numbers, no scroll cues, no decorative dots, no version labels.
- Real content or no content. No stock photography standing in for the user's own record.
- Icons from Lucide only. No hand drawn SVG icons. No emoji.
- No shadcn component ships in its default state.
- Motion is 2. If a thing animates, it is giving feedback, and it collapses to instant
  under reduced motion.
- Numbers are mono and tabular. Prose is not.
- Romanian names carry diacritics, and the font has to be able to draw them.
