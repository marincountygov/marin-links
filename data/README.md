# Agencies and departments master list

`agencies.json` is the master list of County of Marin agencies, departments, and divisions. It is meant to become one list that every Marin app and repo can use, so each app does not keep its own copy.

- Format: see `agencies.schema.json`. The list is flat. A division points to its department with `parent`.
- An `id` is permanent. A department's id is a short lowercase name (`hhs`). A division's id is its department's id, a slash, and a short name (`hhs/public-health`). Never rename or reuse an id. When an agency closes, set `status` to `retired`. Apps leave retired entries out of menus.
- The order of the list is the order people see in menus.
- Source: the County web team's `marin-county-agencies-departments.json` (October 2026). The ids were added for this list.

## Change the list

The list is no longer edited here. `data/agencies.json` and `data/agencies.schema.json` are copies of the master list in `marin-data` (`organizations/agencies.json`).

1. Edit `agencies.json` in `marin-data`, then run `python3 check_orgs.py` there.
2. Here, run `python3 ../marin-data/scripts/sync_copies.py .` to copy it, then `python3 scripts/build-agencies.py` to write `assets/agencies.js`, which the page reads.
3. Run `bash scripts/check.sh`. It fails if the copy differs from `marin-data`, if the list is invalid, or if `assets/agencies.js` is out of date.

## Where it lives

The master list lives in `marin-data` (`organizations/agencies.json`). Other apps use it the same way: copy it, keep the ids as they are, and never edit the copy. The ids are the part other repos rely on, for example the `agency` and `division` labels that Marin Links adds to links and that Stats filters by.

## Tracking choices and campaigns

`tracking-options.json` holds the channel, source, language and content choices. Each has an `id`, a permanent `code` that is the only value sent in a link, a `label` people see, and `legacy` values that mean the same choice. Never change, reuse, or renumber a code.

The campaigns are not listed there. They come from the shared list of projects in `marin-data` (`projects/projects.json`): every project with a `links` entry is a campaign, shown A to Z. `data/projects.json` is a copy. Never edit it here.

1. To add or change a campaign, edit the project in `marin-data`, then run `python3 check_projects.py` there.
2. Here, run `python3 ../marin-data/scripts/sync_copies.py .` to copy the list, then `python3 scripts/build-options.py` to write `assets/tracking-options.js`, which the page reads. The scheduled update does both and pushes a `data-sync` branch.
3. Run `bash scripts/check.sh`. It fails if the copy differs from `marin-data` or if `assets/tracking-options.js` is out of date.

## Places and facilities

The "Place or facility" choices (the `location` value) are not listed in `tracking-options.json` either. They come from the shared list in `marin-data` (`organizations/locations.json`): every city, town, community, supervisorial district and facility. The code is the part a link carries (`san-rafael`, `marin-district-3`, `bolinas`, `civic-center`). A code is permanent, and `marin-data` fails if one is removed or changed. `data/locations.json` is a copy. Never edit it here.

1. To add or rename a place or site, change it in `marin-data`, then run `bash scripts/build.sh` there.
2. Here, run `python3 ../marin-data/scripts/sync_copies.py .` to copy the list, then `python3 scripts/build-options.py` to write `assets/tracking-options.js`. The scheduled update does both and pushes a `data-sync` branch.
3. Run `bash scripts/check.sh`. It fails if the copy differs from `marin-data` or if `assets/tracking-options.js` is out of date.
