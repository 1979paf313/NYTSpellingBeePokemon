# Pokémon in the Bee

A static GitHub Pages game that asks whether an English Pokémon species name fits the NYT Spelling Bee letters. It includes guesses, answer reveals, saved progress on each device, spoiler-free sharing, historical statistics, and past Bees to play.

The GitHub Action fetches daily letter metadata, commits the updated data, and explicitly deploys Pages. There is no server, database, API key, or personal access token to configure.

## Install in your existing repository

Repository: https://github.com/1979paf313/NYTSpellingBeePokemon

1. Unzip the download. In the repository, choose **Add file → Upload files**. Upload the extracted files and the `data`, `scripts`, and `tests` folders to the repository root. Replace the existing `index.html`. Keep the files inside those folders; do not put the entire extracted project inside an extra folder. Commit to `main`.
2. Add the workflow if the upload did not include it. Choose **Add file → Create new file**, enter `.github/workflows/daily.yml` as the name, and paste the complete contents of the supplied `daily-workflow.txt`. Commit to `main`. The ZIP also contains this same YAML file inside `.github/workflows`.
3. Open **Settings → Pages**. Under **Build and deployment → Source**, select **GitHub Actions**. This one change is necessary because automated commits using GitHub's built-in token do not trigger the old branch-based Pages build.
4. Open **Actions → Daily Bee and website → Run workflow**. Leave the optional fields blank, choose `main`, and click the green **Run workflow** button. When the run finishes green, open https://1979paf313.github.io/NYTSpellingBeePokemon/ and refresh.

If an automatic run starts before step 3 and fails at Pages configuration, complete step 3 and run it again.

## Your manual backup form

Open https://github.com/1979paf313/NYTSpellingBeePokemon/actions/workflows/daily.yml and choose **Run workflow**:

- **center:** the single center letter, such as `A`.
- **outer:** the six outer letters, such as `B D F L O R`.
- **date:** leave blank for today's date in New York; otherwise use `YYYY-MM-DD`.

Fill in both letter fields to publish a manual puzzle. Leave both blank to retrieve the letters automatically. A same-day manual correction is preserved by later automatic runs. You will use your normal GitHub sign-in; no separate admin account or credentials are needed.

The site's **Enter letters yourself** form checks letters on the visitor's screen. Its owner link opens the GitHub form that updates the published puzzle for everyone. A purely static public form cannot safely write to your repository without authentication; GitHub supplies that authenticated form.

## Daily behavior

The first scheduled attempt is at 08:17 UTC: 4:17 a.m. Eastern in summer, 3:17 a.m. in winter. There are later retry runs at 09:17, 10:17, 11:17, 12:17, and 15:17 UTC. Once that day's puzzle is stored, later runs skip the source request. GitHub may delay scheduled runs.

The source is https://spellingbeesolver.dev/archive/. Its public page includes structured date, center-letter, and letter-set metadata. The updater reads those fields and stores no NYT answer lists. SB Solver itself blocked automated requests during this investigation, so it is not used.

The updater validates seven distinct letters and the requested date. On a retrieval failure it preserves the existing data; the scheduled run reports failure and a later attempt retries. The page labels an older puzzle with its actual date rather than presenting it as today's letters. During an ordinary code upload, a failed retrieval is allowed to keep the last stored puzzle so the site can still deploy.

The included snapshot is through October 8, 2026. The first successful update retrieves the current date. The archive contains 3,074 Bees; September 28, 2025 is absent from the source and is not invented.

## Name rules

- Official English species names in the included PokéAPI dataset: 1,025 species, through Pecharunt. Alternate forms are excluded.
- Spaces, punctuation, accents, and gender symbols are ignored. Repeated letters are allowed.
- At least four normalized letters are required; Mew and Muk are excluded.
- Names containing digits are excluded; Porygon2 cannot be spelled with letters alone.
- Both Nidoran species normalize to `nidoran`. An eligible guess finds both, and each counts as a species.
- **YES:** at least one eligible name contains the center letter.
- **ALMOST:** no eligible name contains the center letter, but at least one fits if the center is optional.
- **NO:** no eligible name fits even with an optional center.

These are letter-rule matches. They are not a claim that NYT accepts a name as a dictionary answer. The list is bundled locally; no per-visitor Pokémon API requests are made.

## Verification

The browser and Python updater agree on all 3,074 archived puzzles. Nine Python tests cover invalid letters, source changes, stale data, idempotence, historical edits, and preservation of manual corrections. All 793 overlapping dates in a separate archive matched the letter sets and center letters. Automated interface interaction checks are also included in the development verification; a live GitHub Action run still needs the installation above. A visual browser preview could not be completed: the cloud browser cannot reach the local server, and its security policy blocks local-file URLs.

To run the included checks:

```sh
python -m unittest discover -s tests -p 'test_*.py'
node --check script.js
node tests/core.test.cjs
node tests/interface.test.cjs
```

For local play, use VS Code Live Server, or run `python -m http.server 8000` from the project folder and visit `http://localhost:8000`. Opening the HTML directly with `file://` does not provide the normal fetch behavior.

## Changes later

Edit `theme.css` for styling. The code and names are plain files, with no npm build required. Replace `data/pokemon.json` with an updated species list and run `python scripts/update_bee.py --force` to recalculate historical statistics. The daily update does not automatically change the Pokémon list.

To remove a manual correction, remove its `manual` property in `data/history.json` and force an automatic update. Routine edits and new code uploads deploy through the same workflow.

## Troubleshooting

- **Contents-write error during the commit:** open Settings → Actions → General → Workflow permissions, allow read and write permissions, save, and run the workflow again. The workflow already requests `contents: write`; repository or organization policy can still restrict it.
- **Pages deployment error:** check that Settings → Pages → Source is GitHub Actions and the `github-pages` environment permits `main`.
- **Yesterday's letters:** try a blank Run workflow for another automatic attempt, or fill in both letter fields to use the manual backup.
- **Updates stopped:** check the latest Actions run. GitHub can disable scheduled workflows after 60 days without repository activity; successful daily commits normally keep this repository active. Re-enable the workflow if needed.

## Sources

- Daily and historical letter metadata: https://spellingbeesolver.dev/archive/
- English species names: https://github.com/PokeAPI/pokeapi/blob/master/data/v2/csv/pokemon_species_names.csv
- Independent historical check: https://github.com/tedmiston/spelling-bee-answers
- GitHub Pages workflows: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Built-in token behavior: https://docs.github.com/en/actions/concepts/security/github_token

This is an unofficial fan project, unaffiliated with The New York Times, Nintendo, Game Freak, or The Pokémon Company.
