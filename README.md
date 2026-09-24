# Tree of Birds

An interactive pedigree/family-tree viewer for tracking bird breeding lines — upload a
spreadsheet of birds and their parents, then explore any bird's ancestors, siblings, and
offspring as a generation-aligned tree.

## Try it

Open `index.html` in a browser (or visit the GitHub Pages URL for this repo, if enabled).
It loads the sample pedigree in [`data/`](data) automatically — search for a bird by name,
or check **Show entire collection** to see everything at once.

- **Pan**: click and drag the background
- **Zoom**: scroll wheel, or the `+` / `−` / fit buttons in the bottom-right
- **Select**: click a bird, or search by name and hit **Add to tree**
- **Parents / Siblings / Offspring** checkboxes control how much of the tree is shown
  around your current selection
- Pairings flagged in red are consanguineous (the two birds share a common ancestor) —
  toggle this off with **Highlight consanguineous pairings**

## Data format

Bring your own data as a `.csv` or `.tsv` file with these columns:

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
index.html, app.js, style.css   the app
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

This isn't implemented in the app yet — the pedigree data model (`motherID`/`fatherID`
chains) already supports the ancestor-tracing this needs, so it's the natural next
feature once the tree view above is solid.
