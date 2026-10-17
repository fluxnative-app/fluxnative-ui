# Craft: beyond "made by AI", and through store review

The kit's job is to make a screen correct on the first try. This topic is
about the next bar: a template that a person reads as designed, not
generated, and that App Store and Google Play review accepts as an app of
its own. [`docs/llm/CRAFT.index.md`](../llm/CRAFT.index.md) is the short,
versioned rule list a model reads after the catalog index; this page is the
reasoning, the store policies behind it, and what is checked by a machine.

## Why a kit makes the problem worse before it makes it better

A shared kit gives every template the same primitives, the same spacing
scale and, by default, the same blue. That is what makes a template correct,
and it is also exactly what a reviewer sees in a hundred look-alike apps.
Two store policies apply:

- **App Store Review Guidelines, 4.3 Spam** (and 4.2 Minimum Functionality):
  apps that are near-copies of other apps, or thin wrappers, are rejected;
  templated apps have to be submitted by the owner of the content and stand
  on their own. <https://developer.apple.com/app-store/review/guidelines/#spam>
- **Google Play, Spam and Minimum Functionality** (repetitive content): apps
  that merely provide the same experience as other apps, or are created
  from a template with no unique experience, are removed.
  <https://support.google.com/googleplay/android-developer/answer/9898842>

So the kit splits what it standardises from what it must not:

| standardised by the kit (correctness) | owned by the template (identity) |
|---|---|
| the dialect, accessibility, Reduce Motion, states | name, mark, copy voice |
| token *roles* (`type.title`, `shape.card`, `elevation[2]`) | token *values*: the DNA in `design/brand.tokens.json` |
| recipes (ListRow, SearchField, Stepper…) | which recipes, in which composition, with which content |
| the interaction profile's shape | the profile's values (haptic, scale, stagger) |

The brand file (tokens.md) is the mechanism: every template overrides the
palette, type, shape, elevation, motion and density, and the validator keeps
the result legible. The craft rules then ask the template to *use* that
freedom.

## The rules, and what each one is for

The numbered rules in `CRAFT.index.md` fall into four groups.

1. **Identity (rules 1, 12).** A mark component and a `brandName` prop, a
   unique name and description, DNA that differs from every template in the
   same category, three or more real screens, no real brand names. This is
   the part a reviewer compares across apps.
2. **The tells of generated UI (rules 2–8).** Kit-default blue and purple
   gradients, one sans at 500 weight everywhere, slogan copy ("Elevate your
   journey"), emoji glyphs, stock-looking heroes, decoration the reference
   does not have, symmetrical grids of identical rounded cards, shadows
   inside shadows, everything bouncing. Each is something a model produces
   by default and a person does not. The opposite failure counts too: a
   photo or a signature element the reference has, flattened into a vector
   (rules 2 and 5, changed on 17 October 2026, below).
3. **States and platform (rules 9–11).** Designed loading, empty and error
   states in both schemes; platform-correct chrome (chevron vs arrow,
   grouped lists on iOS, Material bar on Android, 44 px targets, names on
   icon-only controls); tabs through `TabBar` until the host draws them.
4. **Content realism (rule 4).** Data with variance; prices, dates and names
   that could be real; empty states that say what to do next.

The rules are specific on purpose: a model follows "never picsum or
placeholder services" and ignores "be original" (the research note cites arXiv 2602.11988 and
Vercel's AGENTS.md evals on this).

## What a machine checks

`python3 tool/check_craft.py` in fluxbuilder-template runs over every
template (one row each, JSON with `--json`, a review sheet with
`--report`). It is the checkable half of the rules:

| rule | check | level |
|---|---|---|
| identity | a name no other template uses; description word overlap with another template ≥ 0.6; a `*Mark`/`Wordmark`/`Logo` component or a `brandName` prop | ERROR for a duplicate name, else WARN |
| copy | lorem / placeholder text; three or more generic phrases ("welcome back", "seamless"…); emoji as glyphs | ERROR for placeholder text, else WARN |
| imagery | hotlinked stock and placeholder hosts (Unsplash, picsum, placehold…); under process 4.0 the factory gate accepts the Unsplash API and the pinned `fluxnative-app/image` instead (below) | WARN |
| states | `previewState` offers live, loading, empty, error; at least three screens | WARN |
| a11y | raw pressables with neither a label nor a spread | WARN |
| scheme | a dark file or a scheme lock | WARN |
| distinct | the nearest template in the same category: palette distance (half the weight on `primary` and `accent`, half on the other roles; read from the brand file, `colors.json` or `theme/tokens.ts`) and cosine similarity of JSX tag bigrams over the screens | WARN under 0.08 / over 0.85 |

On a template on the new process (a `design/` folder) the identity, copy,
states and a11y findings are errors: they are part of the contract the
500-template batch is built against, and `npm run check` runs the checker
with `--strict`. Imagery stays a warning until the batch has its own image
CDN, and the thin-template rule applies only to a template that owns its
navigation (a two-screen tab inside the host's shell is not an app of its
own). The four templates on the process in October 2026 (`kova-fashion`,
`kurb-sneakers`, `dewly-skin-scan`, and `nimbus-water` after its migration)
pass with the imagery warning only.

The distinctiveness bars are heuristics. They were set on the 52 templates
of October 2026: `--calibrate` writes the distribution over the 284
same-category pairs (palette distance median 0.043, structure similarity
median 0.76; 38 pairs under both bars, the commerce look-alikes such as
`alder-skin-studio` / `swell-surf-outfitters` at 0.032 / 0.92 among them),
and they should be calibrated against the human review of the 500-template
batch before `--strict` makes them errors. On 12 October 2026 all 52
templates pass `--strict` (the four on the process with the imagery warning
only; the migrated legacy ones with warnings).
Tokens and JSX are what a template *is*; a reviewer judges what it *shows*.
fluxbuilder-template's `tool/look_alike.mjs` scores every pair of templates
on their captures (a colour-blind perceptual hash of the layout, an HSV
histogram, a tone thumbnail; a pair's score is its most similar pair of
screens) and flags the closest tenth of the catalog, the percentile bar of
plan A6.4; `check_craft.py --look-alike` joins that to the `distinct` rule.
On the 39 legacy templates of 12 October it put two wishlist grids
(`ember-market-app` / `swell-surf-outfitters`, 0.85) and two cart screens at
the top, pairs the review panel had passed: the metric finds the screens to
look at, the panel and a person decide, and only a store submission decides
for real.
What the checker cannot judge (whether the asymmetry is intentional, whether
the copy has a voice) stays with the pairwise judges and the reviewer of the
template process.

## What a model panel says

The checker is the checkable half. For the rest, FluxBuilder's review panels (private tooling) put screens in front of a vision model playing two people.

- **The `ai-look` panel** asks the designer's question: would a design-literate person take this for AI-generated? It scores ten tells as yes or no.
- **The `look-alike` panel** asks the reviewer's question: under App Store 4.3 or Google Play's repetitive-content policy, are these two apps the same template?

The first run, on 12 October 2026, used Claude Sonnet 5.5 (report in fluxbuilder-template `design-ops/audit/2026-10-12.md`):

| | judged "AI" / "same template" |
|---|---:|
| 13 screens a model wrote on the kit's defaults | 13 of 13 |
| the 52 templates' opening screens | 31 of 52 |
| the 15 closest same-category template pairs | 0 of 15 (the panel missed 1 of 2 positive controls) |

The panel separates generated defaults from the catalog, and it still flags most templates. The tells it names are the order of work:

1. One system sans at one or two weights.
2. Generic iconography.
3. A stock photo as the hero.

A pass on the first, plus specific copy in place of slogans, flipped one template's verdict in all three runs. On another the pairwise judge preferred the original. That is why a craft change goes through the judge and not through a rule. None of this is store approval, which only a submission gives; it is the measurement the craft rules were missing.

## 17 October 2026: real photos, and signatures with depth (rules 2 and 5)

Until v0.2.0 rule 5 said "never Unsplash, picsum or placeholder hotlinks"
and rule 2 said "no pastel wash or glow blobs behind a screen". Both aimed
at real tells, and both overshot. The template factory's process 4.0,
decided by the owner on 17 October 2026, reviewed 53 factory templates
against their references and found the opposite failure:

| what the reference had | flattened in |
|---|---:|
| photos, products, 3D characters → flat vectors or initials | about 28 of 53 templates, the most frequent reason a template looked weak |
| a glossy orb or a mesh background → a flat fill | about 8 of 10 templates |

A builder that reads "never Unsplash" and has no other image source draws
a vector where the reference has a photograph, and a builder that reads
"no glow" flattens the one element that gives the reference its mood. So
v0.3.0 keeps what the rules were for and moves the line:

- **Rule 5, imagery.** A photo region of the reference stays a photo. The
  sources are the template's own assets, the Unsplash API, or the team's
  image repo `fluxnative-app/image` pinned by commit and served by
  jsDelivr. The Unsplash API guidelines *require* hotlinking
  `images.unsplash.com` and crediting the author, so the hotlink is the
  licensed use, not the shortcut it looked like. Licence and source are
  recorded with the template (the factory keeps them in its asset list).
  Every raster is a `Photo` with `alt` and `fallback`, so a failed load
  degrades to the brand's fallback rather than a broken box. Still banned:
  picsum and placeholder services, a stock-looking hero, emoji as icons,
  and sparkles for AI (`AiBadge mark` carries the brand's own mark).
- **Rule 2, palette.** No decoration the reference does not have:
  decorative washes and glow blobs remain an AI-look tell. A signature the
  reference does have (a mesh gradient, a glossy orb, a glow) is built with
  depth (layered stops, a highlight, a shadow) and never flattened to one
  colour. The palette guidance is unchanged: `primary` from the brand, one
  accent, tint don't flood, gradients only when the brand is built on them.

fluxbuilder-template's `check_craft.py` still warns on an Unsplash host;
the factory's gate is where process 4.0 checks the approved hosts and the
credits, and the checker follows it there.

## How the kit itself stays out of the way

- Recipes read roles, never values: a template that sets `shape.card` to
  `radius.3xl` and `type.display` to a serif gets a different Button, Sheet
  and ListGroup without forking them.
- Defaults are a floor: `interaction.press.haptic` is `none` and the
  palette is the system one, so a template that does nothing looks like
  iOS, not like the kit.
- Variants exist for the common splits (a pill or a field, a track or a
  line, inset or plain) so two templates can use the same recipe and read
  differently.
- The MCP server's `get_design_rules` tool and the kit skill hand the rules
  to an agent before it writes a screen, and `validate_screen` catches the
  mechanical tells (literals, re-implemented primitives) at once.
