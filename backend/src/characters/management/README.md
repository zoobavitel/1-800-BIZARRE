# backend/src/characters/management/

Standard Django plumbing for custom `manage.py` subcommands. Only `commands/` is interesting — every `*.py` there becomes a `python manage.py <name>` subcommand.

See [`commands/README.md`](commands/README.md) for the actual command catalogue.

```
management/
├── __init__.py
└── commands/        # one file per `manage.py <command>`
```
