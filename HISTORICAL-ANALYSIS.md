# How often is there a Pokémon in the Bee?

Snapshot: May 9, 2018 through October 8, 2026, using 3,074 recorded puzzles and the included current list of 1,025 English Pokémon species names.

| Outcome | Bees | Share |
| --- | ---: | ---: |
| YES — includes the center letter | 1,716 | 55.8% |
| ALMOST — works only without the center | 652 | 21.2% |
| NO — neither works | 706 | 23.0% |

A Pokémon can be spelled from the seven letters, with the center optional, in **2,368 Bees (77.0%)**. A name satisfying the center-letter rule appears in **55.8%**. Your impression that Pokémon appear frequently is supported; strict YES is a little more than half of the archive.

Names are normalized by ignoring spaces, punctuation, accents, and gender symbols. Repeated letters can be used. Names need four letters; Mew and Muk are excluded. Porygon2 is excluded because it contains a digit. Alternate forms are excluded. Both Nidoran species count separately.

Every historical puzzle is evaluated against the same current list. This asks “Would a Pokémon name in today's database fit that puzzle?” It does not restrict each date to species released at that time. It also does not say NYT would accept the name as an answer.

## Most often eligible under the center-letter rule

| Pokémon | Bees |
| --- | ---: |
| Ho-Oh | 143 |
| Rattata | 123 |
| Hoothoot | 101 |
| Cinccino | 77 |
| Abra | 67 |
| Eevee | 63 |
| Alomomola | 57 |
| Entei | 56 |
| Aron | 56 |
| Cacnea | 52 |

## Data checks and limits

The primary source was https://spellingbeesolver.dev/archive/. Its page contains structured date, center-letter, and letter-set fields. Each record was checked for exactly seven distinct letters, inclusion of the center letter, a valid date, and no duplicate dates. A few records provide a pangram rather than seven unrepeated letters in `all_letters`; their seven-letter sets are extracted without changing their center letter.

There is one absent date, September 28, 2025. It was excluded. Every one of the 793 overlapping records in https://github.com/tedmiston/spelling-bee-answers agreed on its center and seven-letter set. The remaining dates were checked structurally, but not individually against a second source.

Pokémon names came from the English rows in https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv. The browser and Python updater independently classified every included Bee and produced identical counts.

The included `data/history.json` contains the letter records and summary statistics; `data/pokemon.json` contains the species names. `tests/core.test.cjs` reproduces the comparison.
