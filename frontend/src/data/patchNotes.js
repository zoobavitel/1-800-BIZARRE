/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-11-01",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "wip armor"
        ]
      }
    ]
  },
  {
    "date": "2026-10-30",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "heritage picks stick; stop healing-clock autosave loop"
        ]
      }
    ]
  },
  {
    "date": "2026-10-29",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #258 from zoobavitel/fix/clock-fk-checks"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "a clock only points at things in its own campaign (S6)"
        ]
      }
    ]
  },
  {
    "date": "2026-10-27",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #257 from zoobavitel/fix/crew-npc-write-checks"
        ]
      }
    ]
  },
  {
    "date": "2026-10-26",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "crew stats, crew delete and campaign NPCs are GM only (S5)",
          "a player may save loadout for any of their own PCs, and only theirs",
          "keep session writes inside the GM's own campaign",
          "only add a PC to a campaign you're in",
          "undo and redo work after real saves",
          "word the trauma-box refusal for a track that is already full",
          "only a PC's player or the GM may roll for it",
          "make the SRD catalogs read-only and remove unused per-PC routes",
          "send the newest event id as the cursor on connect and resync",
          "take only identity fields the server changed",
          "list tied heritages in name order",
          "show another device's Name, Stand name, Background and Look"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #256 from zoobavitel/fix/session-write-checks",
          "Merge pull request #255 from zoobavitel/fix/character-campaign-membership",
          "Merge remote-tracking branch 'origin/master' into fix/character-campaign-membership",
          "Merge pull request #254 from zoobavitel/test/permission-matrix",
          "Merge remote-tracking branch 'origin/master' into test/permission-matrix",
          "Merge pull request #253 from zoobavitel/fix/sheet-undo-redo",
          "Merge pull request #252 from zoobavitel/chore/remove-dead-character-actions",
          "Merge pull request #251 from zoobavitel/fix/character-write-checks",
          "Merge pull request #250 from zoobavitel/fix/lock-open-routes",
          "Merge pull request #249 from zoobavitel/fix/sse-resync-cursor",
          "Merge branch 'master' into fix/sse-resync-cursor",
          "Merge pull request #248 from zoobavitel/fix/site-stats-tie-order",
          "Merge pull request #247 from zoobavitel/feature/sse-one-stream-per-browser",
          "Merge pull request #246 from zoobavitel/fix/sheet-identity-sync",
          "Merge pull request #245 from zoobavitel/fix/sheet-edit-lost-on-sync",
          "Merge pull request #244 from zoobavitel/feature/sse-replay"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "S4 closes the session holes in the permission matrix",
          "fail the matrix when a positive control gets a server error",
          "S3 closes the PC-attach hole in the permission matrix",
          "fresh actors, positive controls and refusal messages in the matrix",
          "fail the matrix when a route has no object to target",
          "walk every write route as a stranger and as a non-owner member"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "remove character actions that nothing calls"
        ]
      },
      {
        "title": "Added",
        "items": [
          "one campaign stream per browser, shared by its tabs (PR 5b)"
        ]
      }
    ]
  },
  {
    "date": "2026-10-25",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "don't drop an edit when a live event arrives before its autosave",
          "tell an evicted stream it was replaced; client waits to reconnect",
          "save a change undone while its save was in flight",
          "lock only the character row in commit_respec",
          "sign out other devices when the password changes",
          "stop faction autosave from losing edits or revealing hidden info"
        ]
      },
      {
        "title": "Added",
        "items": [
          "number campaign events and replay missed ones on reconnect (PR 6)",
          "send version with sheet saves and resolve 409s (PR 7b)",
          "version every character write and 409 stale sheet saves"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #243 from zoobavitel/fix/sse-evict-loop",
          "Merge pull request #242 from zoobavitel/feature/sheet-version",
          "Merge pull request #241 from zoobavitel/feature/character-version",
          "Merge pull request #240 from zoobavitel/ci/backend-tests-on-postgres",
          "Merge remote-tracking branch 'origin/ci/backend-tests-on-postgres' into feature/character-version",
          "ci: run the backend tests on Postgres, the same engine as prod",
          "Merge pull request #239 from zoobavitel/fix/password-change-revokes-tokens",
          "Merge pull request #238 from zoobavitel/fix/faction-autosave",
          "Merge pull request #237 from zoobavitel/feature/knox-token-expiry"
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "own error for superseded saves; unique e2e usernames"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "keep the test password out of a set_password() literal"
        ]
      }
    ]
  },
  {
    "date": "2026-10-24",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "ignore the placeholder token in the logout curl example"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "split logout curl example so the secret scan does not flag it"
        ]
      },
      {
        "title": "Added",
        "items": [
          "expiring per-device login tokens and real logout"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #236 from zoobavitel/fix/sse-drop-token"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "open SSE streams with a ticket in the perf scripts"
        ]
      }
    ]
  },
  {
    "date": "2026-10-23",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "stop accepting the login token in the stream URL",
          "stop new streams attaching to a leaving listener",
          "stop autosave creating duplicate characters",
          "refresh clocks without resyncing every sheet",
          "open the campaign stream with a one-use ticket"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #235 from zoobavitel/fix/realtime-listener-race",
          "Merge pull request #234 from zoobavitel/fix/duplicate-character-create",
          "Merge pull request #233 from zoobavitel/fix/clock-sync",
          "Merge pull request #232 from zoobavitel/fix/sse-ticket-frontend"
        ]
      }
    ]
  },
  {
    "date": "2026-10-22",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #231 from zoobavitel/fix/sse-ticket",
          "Merge pull request #230 from zoobavitel/fix/remove-update-field",
          "Merge pull request #228 from zoobavitel/feat/api-cloudflare-host",
          "Merge pull request #229 from zoobavitel/fix/own-media-url-pin"
        ]
      },
      {
        "title": "Added",
        "items": [
          "one-use tickets for opening the campaign stream"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "remove the any-field character update endpoint"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "ignore gitleaks false positive on media host test"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "mark host-name test line as gitleaks false positive"
        ]
      }
    ]
  },
  {
    "date": "2026-10-21",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "keep uploaded portraits as files, never host-pinned URLs"
        ]
      },
      {
        "title": "Added",
        "items": [
          "serve the API from api.1-800-bizarre.com via Cloudflare Tunnel"
        ]
      }
    ]
  },
  {
    "date": "2026-10-20",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #227 from zoobavitel/fix/xp-pending-advance-stale",
          "Merge pull request #226 from zoobavitel/fix/sse-stream-cap",
          "Merge pull request #225 from zoobavitel/fix/sse-scoped-refetch",
          "Merge pull request #224 from zoobavitel/fix/caddy26-gunicorn-4w",
          "Merge pull request #223 from zoobavitel/feature/sheet-roll-session-ux",
          "Merge pull request #222 from zoobavitel/fix/perf-ops-caddy-conn",
          "Merge pull request #221 from zoobavitel/fix/pdf-hide-hidden-factions"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "stop other server-owned fields going stale",
          "keep Take advance visible after banking XP",
          "cap live SSE streams per user per campaign",
          "Caddy 2.6 config and 4 gunicorn workers",
          "trim home stats and show an NPC chooser",
          "reuse DB connections and put Caddy in front of Funnel",
          "start crew actions collapsed",
          "keep help popovers inside the viewport",
          "omit action outcomes on resistance history",
          "close resistance result after harm reduction",
          "NPC sheet export is GM-only",
          "character sheet PDF is always the player view",
          "keep hidden factions and NPCs out of player PDF exports"
        ]
      },
      {
        "title": "Performance",
        "items": [
          "refetch only what each SSE event changed"
        ]
      },
      {
        "title": "Added",
        "items": [
          "choose starting position and effect before bonuses"
        ]
      }
    ]
  },
  {
    "date": "2026-10-19",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #220 from zoobavitel/fix/pdf-portrait-placement",
          "Merge pull request #218 from zoobavitel/fix/respec-baseline-overflow",
          "Merge pull request #217 from zoobavitel/fix/deploy-graceful-reload",
          "Merge pull request #216 from zoobavitel/fix/pdf-export-portrait",
          "Merge pull request #215 from zoobavitel/fix/sheet-sync-fanout",
          "Merge pull request #214 from zoobavitel/feature/npc-faction-section-visibility"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "move the PDF portrait off the Identity fields",
          "stop counting XP spends twice (\"Cannot raise grade beyond S\")",
          "reload gunicorn on deploy instead of restarting it",
          "stop PDF export crashing when a portrait is attached",
          "refetch only what changed instead of every open sheet"
        ]
      },
      {
        "title": "Added",
        "items": [
          "let GMs hide NPC and faction sections from players"
        ]
      }
    ]
  },
  {
    "date": "2026-10-18",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #213 from zoobavitel/chore/remove-daily-bug-review"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "remove unused daily critical bug review workflow"
        ]
      }
    ]
  },
  {
    "date": "2026-10-17",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #212 from zoobavitel/fix/remove-ngrok",
          "Merge pull request #210 from zoobavitel/fix/keepalive-n1-retry",
          "Merge pull request #211 from zoobavitel/fix/realtime-redis-and-prod-tree",
          "Merge pull request #209 from zoobavitel/fix/sse-reconnect-backoff"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "drop ngrok from the live site",
          "retry a GET once after a dropped connection",
          "keep idle connections open past the Funnel proxy",
          "share SSE across workers and keep logs out of the tree",
          "back off dead campaign streams"
        ]
      },
      {
        "title": "Performance",
        "items": [
          "prefetch xp_entries on session retrieve"
        ]
      }
    ]
  },
  {
    "date": "2026-10-16",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #208 from zoobavitel/fix/firefox-private-network",
          "Merge pull request #207 from zoobavitel/fix/campaign-roster-phone-level"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "let GitHub Pages reach the Funnel host from Firefox",
          "show sheet level and stack phone columns"
        ]
      }
    ]
  },
  {
    "date": "2026-10-13",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #206 from zoobavitel/feature/npc-contacts-portraits",
          "Merge pull request #205 from zoobavitel/fix/black-autofix-python",
          "Merge pull request #204 from zoobavitel/feature/npc-sheet-vis-cancel-xp-hamon-spin"
        ]
      }
    ]
  },
  {
    "date": "2026-10-12",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #203 from zoobavitel/feature/rep-tab-standing-cards",
          "Merge pull request #202 from zoobavitel/fix/deploy-prod-gunicorn-bind-localhost",
          "Merge pull request #201 from zoobavitel/feature/session-npc-clock-visibility-ui"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "bind gunicorn to 127.0.0.1 in deploy-prod.sh"
        ]
      }
    ]
  },
  {
    "date": "2026-10-11",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "show contact, faction, and crew portraits",
          "GM visibility gear, cancel pending XP, desperate XP harden",
          "campaign/session Rep edits, peer visibility, home NPC links",
          "toggle NPC clock visibility from Campaign Management"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "run Black autofix on Python 3.11",
          "align NPC players_see_inventory help_text with migration 0128"
        ]
      }
    ]
  },
  {
    "date": "2026-10-07",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #200 from zoobavitel/docs/scrub-1password-refs",
          "Merge pull request #199 from zoobavitel/fix/deploy-prod-env-group-read"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "scrub leftover 1Password refs from agent-safety docs"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "put bizarre-deploy in bizarre group for prod.env read",
          "protect harm edits from poll/SSE hydrate flicker"
        ]
      }
    ]
  },
  {
    "date": "2026-10-06",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #198 from zoobavitel/fix/harm-dirty-intent",
          "Merge pull request #197 from zoobavitel/fix/agent-sudoers-usr-bin",
          "Merge pull request #196 from zoobavitel/fix/sse-bound-gthread-recycle",
          "Merge pull request #195 from zoobavitel/fix/downtime-recover-no-stress-harm"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "sudoers /usr/bin paths and prod.env 640 root:bizarre",
          "bound streams so gthread recycles can drain",
          "durability stress track, downtime recover, fuller PDF export"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "align L1 stress fixtures with Durability track caps"
        ]
      }
    ]
  },
  {
    "date": "2026-10-05",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #194 from zoobavitel/fix/faction-npc-strip-playbook-back"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "sync faction NPC strip, create/playbook, and Back nav"
        ]
      }
    ]
  },
  {
    "date": "2026-10-01",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #193 from zoobavitel/feature/agent-safety-guardrails",
          "Add restore-drill Cursor skill for OPSEC-safe backup practice.",
          "Harden agent safety: write-target hooks, nightly DB+media backup, secrets hygiene.",
          "Merge pull request #192 from zoobavitel/feature/agent-safety-guardrails",
          "Merge pull request #191 from zoobavitel/feature/delete-confirm-modal",
          "Add agent safety hooks, CT103 least-privilege setup, and backup policy docs.",
          "Merge pull request #190 from zoobavitel/fix/sanitize-test-script-url-lint",
          "Merge pull request #189 from zoobavitel/fix/equal-roster-column-height",
          "Merge pull request #188 from zoobavitel/fix/api-default-127-host"
        ]
      },
      {
        "title": "Added",
        "items": [
          "confirm before PC, NPC, and faction deletes"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "quiet no-script-url on XSS payload"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "readable campaign stats over full-bleed art",
          "use profile avatars on campaign GM/player chips",
          "show accurate PC heritage and level on cards",
          "drop Collapse; use Show NPC/PC only",
          "equal-height columns, compact tokens, avatar footer"
        ]
      }
    ]
  },
  {
    "date": "2026-09-30",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "prefer 127.0.0.1 over localhost for local API",
          "persist NPC −/+ without flicker after save refresh",
          "split prod tree from agent workspace",
          "stop tab clobber; close last tabs; contact pickers",
          "show newest campaign session first in list"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #187 from zoobavitel/feature/npc-standing-open-sheet",
          "Merge pull request #186 from zoobavitel/fix/npc-standing-autosave",
          "Merge pull request #185 from zoobavitel/feature/standing-display-clarity",
          "Merge pull request #184 from zoobavitel/fix/deploy-prod-tree-split",
          "Merge pull request #183 from zoobavitel/feature/npc-standing-visibility",
          "Merge pull request #182 from zoobavitel/fix/faction-member-visibility",
          "Fix See checkbox snapping back after toggle.",
          "Fix GM hide/show of faction NPCs for players.",
          "Merge pull request #181 from zoobavitel/feature/npc-sheet-restructure",
          "Merge pull request #180 from zoobavitel/fix/session-list-newest-first"
        ]
      },
      {
        "title": "Added",
        "items": [
          "open See-on standing/strip NPCs as read-only sheets",
          "sync faction↔faction status both ways",
          "show NPCs without revealing faction",
          "restructure layout, PC/NPC standing, XP collapse"
        ]
      }
    ]
  },
  {
    "date": "2026-09-29",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #179 from zoobavitel/chore/dedupe-resistance-stress-dead-dice-rolling"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "dedupe resistance stress cost, remove dead dice-rolling"
        ]
      }
    ]
  }
];
