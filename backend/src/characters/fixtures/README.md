# backend/src/characters/fixtures/

JSON fixtures loaded into the `characters` app via Django's `loaddata`. Two flavors live here: **SRD reference data** (consumed in every environment) and **demo / scenario data** (only used locally).

## Files

### SRD reference data

| File | Contents |
|------|----------|
| `srd_heritages.json`, `heritages_updated.json` | Heritage rows. |
| `srd_benefits.json`, `srd_detriments.json` | Heritage-linked benefit / detriment options. |
| `srd_hamon_abilities.json`, `srd_spin_abilities.json` | Hamon / Spin playbook abilities. |
| `srd_traumas.json` | Trauma catalogue. |
| `standard_abilities.json` | Standard / cross-playbook abilities. |

These are the rows the app cannot run without. The `load_srd_reference_data` management command idempotently seeds the benefits / detriments tables in production.

### Demo & scenario data

| File | Contents |
|------|----------|
| `initial_data.json` | Bootstrap data for an empty dev DB. |
| `example_campaign.json` | A sample campaign for screenshots / tests. |
| `jack_rice_fixture.json` | A specific PC build used in demo flows. |

## Loading

```bash
source .venv/bin/activate
cd backend/src
python manage.py loaddata characters/fixtures/*.json
# or, in prod (only seeds empty tables):
python manage.py load_srd_reference_data
```

## Conventions

- Anything derived from [`docs/1-(800)-BIZARRE SRD.md`](../../../../docs/1-\(800\)-BIZARRE%20SRD.md) must round-trip through the SRD doc — change the rule first, then the fixture.
- Demo fixtures are fair game to edit, but don't reference users that may not exist on prod.
- If you add a new SRD fixture, wire it into `load_srd_reference_data` so prod can seed it without `loaddata`.
