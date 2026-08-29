// Lightweight, rule-based category suggestion. Not ML — just merchant/keyword
// matching against transaction descriptions, mapped to whichever of the
// household's own categories looks like it corresponds to that type. Covers
// both English and Spanish/Colombian merchant names since the app is bilingual.
//
// This is deliberately conservative: if nothing matches, it returns null and
// the transaction stays uncategorized (same as today), rather than guessing
// badly. It only ever suggests — the person can always override it.

const CATEGORY_RULES = [
  {
    type: 'income',
    kind: 'income',
    nameMatch: /salari|income|ingreso|payroll|n[óo]mina/i,
    textMatch: /payroll|direct dep|salary|n[óo]mina|salario|employer/i,
  },
  {
    type: 'rent',
    nameMatch: /rent|mortgage|housing|arriendo|hipoteca|vivienda/i,
    textMatch: /rent payment|mortgage|landlord|property management|arriendo|hipoteca/i,
  },
  {
    type: 'groceries',
    nameMatch: /grocer|mercado|supermerc/i,
    textMatch:
      /walmart|target\b|kroger|safeway|whole foods|trader joe|publix|aldi\b|costco|grocery|groceries|supermarket|[ée]xito|carulla|surtimax|jumbo\b|ol[ií]mpica|\bd1\b|\bara\b|wegmans|giant food|harris teeter/i,
  },
  {
    type: 'utilities',
    nameMatch: /utilit|servicio.?p[uú]blic/i,
    textMatch:
      /electric|water bill|gas company|internet|comcast|xfinity|verizon|at&t|pepco|dominion energy|\bepm\b|acueducto|energ[ií]a|claro\b|movistar|\bune\b|utility/i,
  },
  {
    type: 'transport',
    nameMatch: /transport/i,
    textMatch:
      /\buber\b(?! ?eats)|\blyft\b|shell\b|chevron|exxon|gas station|parking|transmilenio|smartrip|peaje|gasolina|\btaxi\b|marta\b|septa\b/i,
  },
  {
    type: 'dining',
    nameMatch: /dining|restaurant/i,
    textMatch:
      /restaurant|starbucks|mcdonald|chipotle|doordash|grubhub|uber ?eats|rappi|domino|pizza|caf[ée]\b|coffee|wendy|chick-fil-a|panera/i,
  },
  {
    type: 'entertainment',
    nameMatch: /entertain|fun money|entreten/i,
    textMatch:
      /netflix|spotify|hulu|disney\+|hbo|max\b|prime video|steam\b|playstation|xbox|cinema|\bcine\b|theatre|theater|ticketmaster/i,
  },
  {
    type: 'savings',
    nameMatch: /saving|ahorro/i,
    textMatch: /transfer to savings|savings deposit|ahorro|round-?up/i,
  },
]

export function suggestCategoryId(description, amount, categories) {
  if (!description || !categories?.length) return null
  const desc = description.toLowerCase()
  const isIncome = Number(amount) > 0

  for (const rule of CATEGORY_RULES) {
    const ruleIsIncome = rule.type === 'income'
    if (isIncome !== ruleIsIncome) continue
    if (!rule.textMatch.test(desc)) continue
    const match = categories.find((c) => rule.nameMatch.test(c.name) && (!rule.kind || c.kind === rule.kind))
    if (match) return match.id
  }
  return null
}
