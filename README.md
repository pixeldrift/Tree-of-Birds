# Tree of Birds

An interactive pedigree/family-tree viewer for tracking bird breeding lines — explore any
bird's ancestors, siblings, and offspring as a generation-aligned tree.

## Try it

This needs to be served over `http(s)://`, not opened directly as a `file://` path —
browsers block the sample data fetch otherwise. Easiest options:

- **GitHub Pages**: enable it once under the repo's Settings → Pages → deploy from
  `main` / `/ (root)`, then open the URL it gives you.
- **Locally**: from the repo root, run a static server (e.g. `python3 -m http.server`)
  and open `index.html` through it.

It loads the sample pedigree in [`data/`](data) automatically, or use **Choose File** in
the header to load your own CSV/TSV.

- **Select**: click a bird in the graph, or in the Bird List at the bottom
- **Pan**: click and drag the graph background
- **Zoom**: scroll wheel, or the `+` / `−` / fit buttons in the bottom-left of the graph
- **Parents / Siblings / Offspring / Related** checkboxes (bottom-right of the graph)
  control how much of the tree is shown around your current selection, and whether
  consanguineous pairings (the two birds share a common ancestor) are highlighted in red
- The **Bird Info** sidebar on the right lists a card per selected bird, with its
  mother/father/offspring as clickable links that add them to the selection too
- Two tools live at the bottom of the sidebar, both keyed off your current selection:
  **Coefficient of Inbreeding** (select two birds) and **Mutation Predictor** (select one
  or two Green-Cheek Conures) — see below

## Data format

Load a `.csv` or `.tsv` file with these columns (see
`data/Geneology Sample Data - Sheet1.tsv` for a full example):

| Column     | Required | Notes                                   |
|------------|----------|------------------------------------------|
| `id`       | yes      | Unique per bird; may be zero-padded      |
| `name`     | yes      |                                          |
| `sex`      |          | `M` or `F`                              |
| `motherID` |          | Another bird's `id`                     |
| `fatherID` |          | Another bird's `id`                     |
| `mutation`, `subspecies`, `species`, `scigenus`, `scispecies`, `scifamily` | | shown as extra detail |

## Project structure

```
index.html, main.js, style.css, birdImages.js   the app
data/                            sample pedigree + reference species data
images/                          logo and bird thumbnail art
archive/                         earlier prototypes and abandoned framework attempts,
                                  kept for reference (see archive/research for the
                                  original survey of tree-drawing libraries)
```

The tree layout is computed with [Dagre](https://github.com/dagrejs/dagre) (a free,
open-source layered-graph algorithm), rendered by hand as absolutely-positioned HTML/SVG —
no paid or GPL-encumbered charting library involved. Earlier attempts using vis-network
and GoJS live under `archive/` for reference.

## Coefficient of Inbreeding

Breeding a pair of related animals produces more consistent, predictable traits in their
offspring, but that also causes harmful side effects: lower fertility, smaller offspring,
early mortality, and shorter lifespan. The higher the level of inbreeding, the greater
those detrimental effects. The **coefficient of inbreeding (COI)** estimates the level of
inbreeding between two individuals as a percentage.

> The coefficient of inbreeding is the probability of inheriting two copies of the same
> allele from an ancestor that occurs on both sides of the pedigree. These alleles are
> "identical by descent." The inbreeding coefficient is also the fraction of all of the
> genes of an animal that are homozygous (two copies of the same allele). So, for a mating
> that would result in offspring with an inbreeding coefficient of 10%, there is a one in
> 10 chance that any particular locus would have two copies of the same allele, and 10% of
> all of the genes in an animal will be homozygous.

More info:
- [COI FAQs — Institute of Canine Biology](https://www.instituteofcaninebiology.org/blog/coi-faqs-understanding-the-coefficient-of-inbreeding)
- [Coefficient of relatedness calculator — Conduct Science](https://conductscience.com/tools/coefficient-of-relatedness-calculator)

Coefficient of *relatedness* (R) is a related statistic; offspring inbreeding is usually
annotated F.

### Reference values

| Pairing                                                    | COI    |
|-------------------------------------------------------------|--------|
| Animal mated to its own parent (e.g. sire × daughter)        | 25%    |
| Half-sib matings (parents share one common sire or dam)      | 12.5%  |
| Full-sib matings (parents share both a common sire and dam)  | 25%    |
| Animal has a single common great-grandparent                 | 3.1%   |

- **0%** — two apparently unrelated parents (based on all available pedigree information)
- **12.5%** — genetically equivalent to a grandfather × granddaughter mating, or a
  half-brother/sister mating
- **25%** — genetically equivalent to a father × daughter mating, or a full-brother/sister
  mating
- **>25%** — inbreeding is cumulative, so several generations of significant inbreeding can
  push the coefficient past 25%

### Calculating it — Wright's path coefficient method

$$F_X = \sum \left[ (1/2)^n \times (1 + F_A) \right]$$

1. **Find common ancestors** — identify any ancestors shared by both the mother and the
   father.
2. **Trace the path (n)** — for each common ancestor, count the total number of
   individuals (steps/nodes) in the path from one parent up to the common ancestor and
   back down to the other parent. Exclude the individual being tested; include the common
   ancestor.
3. **Check ancestor inbreeding ($F_A$)** — if the common ancestor is not known to be
   inbred, $(1 + F_A)$ simplifies to $1 + 0 = 1$.
4. **Calculate for each path** — compute $(1/2)^n \times (1 + F_A)$ for every distinct
   path through every common ancestor.
5. **Sum the values** — add the results together across all paths/common ancestors, then
   multiply by 100 for a percentage.

The app implements this as a sidebar tool: select any two birds and click **Coefficient
of Inbreeding** at the bottom of the Bird Info panel for a report on their relatedness (R),
their potential offspring's inbreeding coefficient (F), a health meter, a plain-language
relationship summary (siblings, half-siblings, share a grandparent, etc.), and a
breed/don't-breed conclusion. Same-sex pairs get a message instead, since they can't be
bred. Rather than the path-counting method above, the app computes this with the
equivalent (and more robust with real-world pedigrees) recursive kinship-coefficient
method, which handles arbitrarily tangled inbreeding loops without needing to enumerate
pedigree paths by hand.

## Mutation Predictor

One Mendelian engine shared across five species, each with its own gene profile: **Green-
Cheek Conure**, **Cockatiel**, **Indian Ringneck Parakeet**, **Peach-Faced Lovebird**, and
**Gouldian Finch**. This started from a standalone gene-switches prototype
(`archive/research/Mutation Switches/birdGenetics.html`) that mapped a single Green-Cheek
Conure's own genes to its phenotype name; the sidebar tool extends that into a breeding
predictor and generalizes it to more species and more kinds of inheritance:

- **Recessive** (e.g. Green-Cheek Dilute, Cockatiel Pied) — needs two copies to show; one
  copy is an invisible "split."
- **Dominant** (e.g. Indian Ringneck Grey) — shows with just one copy; a second copy is
  assumed (not provable from a single generation) to look the same.
- **Incomplete dominant** (e.g. Lovebird Dark Factor: Normal/Olive/Jade, or Cobalt/Mauve
  jointly with the Blue gene; Cockatiel Silver: Single/Double Factor) — looks different at
  0, 1, and 2 copies, so unlike the other types there's never a hidden state to infer.
- **Sex-linked recessive** (e.g. Cinnamon, Lutino, Pearl, Opaline, or a Gouldian's
  Red-Headed gene) — birds are ZW, so a hen carries (and always shows) only one copy while
  a cock carries two and can be a "split" — odds genuinely differ for sons vs. daughters,
  shown separately alongside the combined odds.

Usage:

- **Select two birds of the same species**, opposite sex, for a full offspring report: each
  parent's known genotype per gene, and the likely outcomes with probabilities.
- **Select just one** to search your whole collection instead: pick a desired outcome and
  it ranks every opposite-sex bird of that same species by their probability of producing
  it, alongside how the two birds are related (reusing the COI tool's relationship logic).

The catch: a spreadsheet entry only records what a bird *looks like*, not what recessive
genes it silently *carries*. The predictor automatically detects **proven splits** from
your pedigree — if two normal-looking parents produced a visibly mutated chick, whichever
parent(s) could have hidden it must carry it — with zero extra data entry required. It
can't detect a split that's never been proven by an offspring, so treat the odds shown as
a **floor**: real results can include more than predicted if a parent turns out to carry
an unproven split. Each species profile covers a solid, well-established core gene set —
not necessarily every mutation that exists for it.
