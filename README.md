# Tree-of-Birds

# Coefficient of Inbreeding
Breeding a pair of related animals produces more consistent, predictable traits in their offspring, but that also causes harmful side effects. These include lower fertility, smaller offspring, early mortality, and shorter lifespan. The higher the level of inbreeding, the greater those detrimental effects. The coefficient of inbreeding (COI) is a statistic used to estimated the level of inbreeding between two individual animals as a percentage.

"The coefficient of inbreeding is the probability of inheriting two copies of the same allele from an ancestor that occurs on both sides of the pedigree. These alleles are "identical by descent". The inbreeding coefficient is also the fraction of all of the genes of an animal that are homozygous (two copies of the same allele). So, for a mating that would result in offspring with an inbreeding coefficient of 10%, there is a one in 10 chance that any particular locus would have two copies of the same allele, and 10% of all of the genes in an animal will be homozygous."

More info here:
https://www.instituteofcaninebiology.org/blog/coi-faqs-understanding-the-coefficient-of-inbreeding

Coefficient of relatedness is another factor used (R), where Offspring inbreeding is often annotated (F).
https://conductscience.com/tools/coefficient-of-relatedness-calculator

Examples:
Animal mated to its own parent (eg Sire / daughter)	= COI 25%
Half sib matings (parents have a common sire or dam) = COI 12.5%
Full sib matings (parents have a common sire and dam)	= COI 25%
Animal has a single common great grand parent	= COI 3.1%

0% = a dog with two apparently unrelated parents (based on all available pedigree information)
12.5% = the genetic equivalent of a dog produced from a grandfather to granddaughter mating, or the mating of a half-brother/sister
25% = the genetic equivalent of a dog produced from a father to daughter mating, or the mating of full-brother/sister
More than 25% - inbreeding is accumulative, so if it has occurred to a significant degree over several generations, the inbreeding coefficient may exceed 25%


To calculate an individual's inbreeding coefficient (\[F_{X}\]), use Wright's path coefficient formula: \(F_X = \sum [(1/2)^n \times (1 + F_A)]\)

1. Find common ancestors: Identify any ancestors shared by both the mother and the father.

2. Trace the path (n): For each common ancestor, count the total number of individuals (steps/nodes) in the path going from one parent up to the common ancestor and back down to the other parent. Do not include the individual being tested, but include the common ancestor in the count. 

3. Check ancestor inbreeding (\[F_{A}\]): Determine if the common ancestor itself is inbred (\[F_{A}\]). If they are not inbred or if it is unknown, \((1 + F_A)\) simplifies to (1 + 0) = 1.

4. Calculate for each path: Compute \((1/2)^n \times (1 + F_A)\) for each distinct path through every common ancestor.

5. Sum the values (\[\sum \]): Add the results together if there is more than one path or common ancestor. Multiply by 100 to get a percentage. YouTube·Nikolay's Genetics Lessons +2
