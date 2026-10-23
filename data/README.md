# Agencies and departments master list

`agencies.json` is the master list of County of Marin agencies, departments, and divisions. It is meant to become one list that every Marin app and repo can use, so each app does not keep its own copy.

- Format: see `agencies.schema.json`. The list is flat. A division points to its department with `parent`.
- An `id` is permanent. A department's id is a short lowercase name (`hhs`). A division's id is its department's id, a slash, and a short name (`hhs/public-health`). Never rename or reuse an id. When an agency closes, set `status` to `retired`. Apps leave retired entries out of menus.
- The order of the list is the order people see in menus.
- Source: the County web team's `marin-county-agencies-departments.json` (October 2026). The ids were added for this list.

## Change the list

1. Edit `agencies.json`.
2. Run `python3 scripts/build-agencies.py`. It checks the list and writes `assets/agencies.js`, which the page reads.
3. Run `bash scripts/check.sh`. It fails if the list is invalid or `assets/agencies.js` is out of date.

## Where it lives

For now the master list lives in this repo (`marin-links`). Marin Links is the only app that reads it today.

Once this repo is published, other apps can read the list at `https://marincountygov.github.io/marin-links/data/agencies.json`, or copy the file. Either way, keep the ids as they are. The ids are the part other repos rely on, for example the `agency` and `division` labels that Marin Links adds to links and that Stats filters by.

If the list is later moved to a shared home, such as the MarinOS data folder or a repo of shared County data, move `agencies.json`, `agencies.schema.json`, and `scripts/build-agencies.py` together, and keep the same ids.
