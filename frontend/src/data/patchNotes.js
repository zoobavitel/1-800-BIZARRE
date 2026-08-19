/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-08-13",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #109 from zoobavitel/fix/remove-legacy-views-py"
        ]
      }
    ]
  },
  {
    "date": "2026-08-12",
    "version": null,
    "sections": [
      {
        "title": "Documentation",
        "items": [
          "sync SRD and SRD_DEV working rules text"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "remove dead characters/views.py monolith"
        ]
      }
    ]
  },
  {
    "date": "2026-08-11",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #108 from zoobavitel/fix/clock-visible-players-sync",
          "Merge pull request #107 from zoobavitel/feature/sheet-history-undo-rebased",
          "Merge pull request #106 from zoobavitel/feature/xp-available-pool-label",
          "Merge pull request #105 from zoobavitel/feature/xp-available-pool-label",
          "Merge pull request #101 from zoobavitel/fix/session-xp-settle-for-update-stand",
          "Merge pull request #104 from zoobavitel/feature/npc-card-click-edit",
          "Merge origin/master into fix/session-xp-settle-for-update-stand",
          "Merge pull request #102 from zoobavitel/feature/xp-hybrid-rules-align",
          "Merge pull request #103 from zoobavitel/feature/npc-clock-edit-segments",
          "Merge pull request #100 from zoobavitel/feature/stand-playbook-identity"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "stop duplicating GM clocks as shared-party on sheet",
          "sync GM clock player visibility and refresh list faster",
          "satisfy trauma hydrate exhaustive-deps for CI",
          "protect sheet ground truth from poll/autosave races",
          "stop poll/autosave wiping XP ticks",
          "ticks spend free pool; drop +1 buttons",
          "tick marks allocate pool xp",
          "coerce xp_clocks in add-xp",
          "ticks allocate from free pool",
          "expect heritage undo clamp at track cap",
          "keep Available XP usable without active session",
          "show free-pool Available XP, not track sum",
          "add migration for LEVEL_UP_HERITAGE / BUY_HP choices",
          "lock Character only when settling session XP"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "align XP delete test with sheet AUTO guard",
          "expect STRUGGLE settle to free pool"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "refresh patch notes for sheet/XP fixes"
        ]
      },
      {
        "title": "Added",
        "items": [
          "untick XP tracks refunds free pool",
          "add manual XP to free pool",
          "add sheet edit undo/redo + XP/GM separation",
          "Take advance on full XP tracks",
          "open NPC edit on card click",
          "allow editing clock segments after create",
          "hybrid free-pool scorecard and spend options"
        ]
      }
    ]
  },
  {
    "date": "2026-08-08",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #99 from zoobavitel/fix/stand-archetype-revert"
        ]
      }
    ]
  },
  {
    "date": "2026-08-07",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "stand identity under PLAYBOOK"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "persist stand playbook XP archetypes"
        ]
      }
    ]
  },
  {
    "date": "2026-07-22",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #98 from zoobavitel/fix/xp-trigger-live-refresh"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "live XP/stand refresh; player B→A"
        ]
      }
    ]
  },
  {
    "date": "2026-07-16",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Clean up README by removing duplicate links",
          "Revise README for project overview and CI/CD info",
          "Merge pull request #97 from zoobavitel/feature/npc-heritage-benefit-toggles",
          "Merge pull request #96 from zoobavitel/fix/npc-hide-stand-coin-non-stand",
          "made it so the stand coin stats and other stand related items to disappear on non-stand user NPC sheets",
          "Merge pull request #95 from zoobavitel/fix/npc-ability-description-save"
        ]
      },
      {
        "title": "Added",
        "items": [
          "toggle heritage benefits and detriments in play"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "queue autosave when save already in flight"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "remove NPCViewSet debug instrumentation",
          "add debug probes for NPC ability autosave"
        ]
      }
    ]
  },
  {
    "date": "2026-07-15",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #94 from zoobavitel/fix/list-modal-end-session-xp-scorecard"
        ]
      }
    ]
  },
  {
    "date": "2026-07-14",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "merge tracker toggles into list end-live XP scorecard"
        ]
      }
    ]
  },
  {
    "date": "2026-07-06",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "XP undo/redo and GM history revert",
          "lock stand coin after chargen"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #93 from zoobavitel/feature/stand-coin-chargen-lock"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "checkmark for spent stand armor charges"
        ]
      }
    ]
  },
  {
    "date": "2026-07-04",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update ability selection rules in SRD documents and enhance patch notes with recent changes. Clarified A-grade ability options to allow for two standard abilities or one custom ability with additional features. Added multiple entries to patch notes for recent merges and fixes, improving documentation clarity."
        ]
      }
    ]
  },
  {
    "date": "2026-06-28",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #92 from zoobavitel/feature/leveldownfix"
        ]
      }
    ]
  },
  {
    "date": "2026-06-24",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Remove unused advanceActionDot after server-side XP apply",
          "Merge pull request #91 from zoobavitel/cursor/fix-xp-archetype-snap-back-19da",
          "Add reversible XP allocations and Stand B→A level-up rewards",
          "Fix XP archetype checkbox snap-back on character sheet",
          "Merge pull request #88 from zoobavitel/cursor/character-sheet-pdf-export-e0a7",
          "Bump greenlet floor for Python 3.14 venv installs",
          "Merge pull request #89 from zoobavitel/feature/dual-playbook"
        ]
      }
    ]
  },
  {
    "date": "2026-06-15",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Export PC stress track as 9 boxes per SRD (not durability-based)",
          "Export healing clock with 4 segments on PC PDF sheet",
          "Fix playbook XP export (10 marks) and lazy PDF dependency loading",
          "Add optional secondary playbook on character sheet",
          "Add fillable PDF export for PC and NPC character sheets"
        ]
      }
    ]
  },
  {
    "date": "2026-05-28",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #87 from zoobavitel/fix/ci-playwright-install-hang",
          "ci(e2e): revert workflow to commit 7449823",
          "revert: restore files to 963a70d state",
          "ci(e2e): set Playwright install timeout to 5m",
          "ci(e2e): lower Playwright install step timeout to 5m",
          "ci(e2e): remove man-db before Playwright install-deps",
          "ci(e2e): use with-deps on miss, deps-only on hit",
          "ci(e2e): fix Playwright install hang on partial cache",
          "ci(e2e): fix Playwright cache key and install gating",
          "ci(e2e): serve prod build and fix Playwright base path",
          "Enhance CI workflow by adding Playwright browser caching and OS dependencies installation. Updated Playwright installation command to avoid unnecessary dependencies. Increased timeout for UI smoke tests.",
          "Remove SECURITY.md and temp_xp_script.py files; update README and frontend documentation for clarity and alignment with SRD UI touchpoints.",
          "Remove MVP.md file and reorganize patch notes sections for clarity. Swapped \"Added\" and \"Other\" titles in patch notes to better reflect content. Consolidated merge requests under appropriate sections."
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "align smoke test navigation with playwright baseURL",
          "navigate smoke test via PLAYWRIGHT_BASE_URL",
          "resolve smoke URL relative to baseURL path",
          "bump @playwright/test to 1.60.0 for Node 24.16+"
        ]
      }
    ]
  },
  {
    "date": "2026-05-14",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #86 from zoobavitel/feature/xp-trigger-toggle",
          "Massive README sweep, revising Durability armor charge pool",
          "Merge branch 'master' into feature/xp-trigger-toggle"
        ]
      },
      {
        "title": "Added",
        "items": [
          "0-dot desperate +2; drop encoded col"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "expect STRUGGLE encode on complete, not Abilities roll"
        ]
      }
    ]
  },
  {
    "date": "2026-05-13",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #85 from zoobavitel/feature/xp-trigger-toggle",
          "Merge pull request #84 from zoobavitel/feature/xp-trigger-toggle",
          "Merge pull request #83 from zoobavitel/feature/xp-trigger-toggle",
          "Merge pull request #82 from zoobavitel/feature/xp-trigger-toggle",
          "Merge pull request #81 from zoobavitel/fix/sessions-filter-by-campaign",
          "Merge pull request #80 from zoobavitel/fix/sessions-filter-by-campaign"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "hide NPC/GM 'special negate' blurb from PC sheet",
          "remove redundant session?.id from refetchSessionPanel deps",
          "toggle XP feeds BELIEFS/STRUGGLE/STANDOUT columns + Total",
          "add charCampaign?.sessions to history-fetch deps",
          "scope list endpoint to ?campaign=<id>"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "rename canonical SRD to 1-(800)-BIZARRE; drop root duplicates",
          "prune obsolete AI reports and integration plans"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "remove legacy root scripts and update docs"
        ]
      },
      {
        "title": "Added",
        "items": [
          "playbook-specific trigger + award attribution in session XP log",
          "realtime session panel, crew autoattach, sheet fixes",
          "attribution + delete-any on XP records; misc sheet polish",
          "toggle end-of-session triggers from sheet + GM scorecard",
          "inline faction editor and all-campaign roster"
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "rename 'Manual session XP toggle' to 'Session XP trigger'"
        ]
      }
    ]
  },
  {
    "date": "2026-05-12",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #79 from zoobavitel/cursor/session-status-lifecycle",
          "Merge pull request #78 from zoobavitel/cursor/session-status-lifecycle",
          "Merge pull request #77 from zoobavitel/cursor/gm-xp-preview-clear-active-end-live",
          "Merge pull request #76 from zoobavitel/feature/crew-xp-trigger-toggles",
          "Merge pull request #75 from zoobavitel/cursor/stand-coin-srd-dev-sync"
        ]
      },
      {
        "title": "Added",
        "items": [
          "GM session roster and session management",
          "GM session lifecycle from list and detail",
          "GM live XP scorecard and Clear active end-live modal",
          "session-end XP toggles and rep contributions",
          "sync Session.status with campaign live slot"
        ]
      },
      {
        "title": "Style",
        "items": [
          "JoJo-inspired login and signup cards"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "refetch session list when live slot changes"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "add migration 0080 for Crew JSONField help_text"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "add SRD dev copy and refresh patch notes"
        ]
      }
    ]
  },
  {
    "date": "2026-05-11",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "session XP settle, sheet rolls, campaign GM UI",
          "Stand recall row + stress button on Stand coin column",
          "stand coin sync, session XP pool, collapsible GM rosters"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "open blank custom ability modal on + Custom",
          "GM visible session clocks for players; set clock created_by",
          "list all four Stand-coin roll stats in Stand pill",
          "drop hero badge, tighten copy, readable coin hint",
          "define new_sid after campaign save in perform_update",
          "remove unused isRecoveryLinkedRoll (CI eslint)"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "SRD — Durability resist, stand recall, armor types, Stand Users",
          "align canonical SRD with dev (stand coin, structure)"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #74 from zoobavitel/cursor/stand-coin-srd-dev-sync",
          "Merge pull request #73 from zoobavitel/cursor/stand-coin-srd-dev-sync",
          "Merge pull request #72 from zoobavitel/cursor/stand-coin-srd-dev-sync",
          "Session GM: quick NPC create, dark selects, inline faction",
          "Show NPC character/session history"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "regenerate patch notes from git log",
          "regenerate patch notes from git log"
        ]
      }
    ]
  },
  {
    "date": "2026-05-10",
    "version": null,
    "sections": [
      {
        "title": "Tests",
        "items": [
          "campaign player hits 403 not 404"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "disguised_as_human migration + patch notes"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "GM sees hidden fortunes; manual fortune log"
        ]
      },
      {
        "title": "Added",
        "items": [
          "heal fortune, armor, recover-in-play UX"
        ]
      }
    ]
  },
  {
    "date": "2026-05-09",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "deep-link GM session view; assist +1d pending; roll pool labels",
          "SRD_DEV pools, durability vs stress, hero coin UI"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "session list captions; heuristic heal recover copy"
        ]
      }
    ]
  },
  {
    "date": "2026-05-08",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "sync sheet notes and SRD dev draft"
        ]
      }
    ]
  },
  {
    "date": "2026-05-07",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #71 from zoobavitel/fix/remove-character-planning-load"
        ]
      }
    ]
  },
  {
    "date": "2026-05-06",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "enhance action dot budget calculations and add utility functions",
          "per-track XP for level/minor advance; drop info cards",
          "remove healing UI components and related files",
          "add sheetDraftIsDirty prop to CharacterSheetWrapper",
          "session retrieve P/E, stress overflow, downtime recovery UI"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "action dot budget includes action_dice_gained",
          "Copilot review — XP settlement on session delete, multi-tracker rolls, faction image clear, history ACL"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #70 from zoobavitel/cursor/session-xp-gm-sheet-history"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "fix Ripple Breathing Character create (drop invalid name kw)"
        ]
      }
    ]
  },
  {
    "date": "2026-05-05",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "session NPC clocks, Staying Power on L4, Parry/Break cleanup",
          "ripple free-push, recovery rolls, NPC sheet heals",
          "heal bolsters picker, exclusions, downtime recover",
          "improve session GM controls and recovery flow",
          "track modifier sources and improve session/NPC roll flow"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "clarify resistance counterattack tick scaling"
        ]
      }
    ]
  },
  {
    "date": "2026-05-04",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "SRD Speed & Bizarre Intuition; NPC rules; session GM panels"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "drop NPC harm clock; vulnerability clock only"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "stress as marked track; sheet ability rolls UX"
        ]
      }
    ]
  },
  {
    "date": "2026-05-02",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "session XP settlement, GM sheet history splits"
        ]
      }
    ]
  },
  {
    "date": "2026-05-01",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #69 from zoobavitel/cursor/ci-lxc-tailscale-and-pages-api-url",
          "ci(deploy-lxc): Tailscale OAuth (TS_OAUTH_*) replaces authkey",
          "Merge pull request #68 from zoobavitel/cursor/ci-lxc-tailscale-and-pages-api-url",
          "Merge pull request #67 from zoobavitel/cursor/ci-lxc-tailscale-and-pages-api-url",
          "Merge pull request #66 from zoobavitel/fix/session-date-scatterplot-campaignmanagementredundancy-characteredithistory",
          "ci(perf): optional Lighthouse desktop preset for CI stability",
          "ci(perf): lighthouse against production build, not dev server"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "write LXC deploy key to file for ssh-action",
          "deploy CT over Tailscale SSH; Pages API base",
          "address remaining review comments (artifact, a11y, group action case, perf budget)",
          "push and group-action stress semantics"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "add 2026-05-01 entry; dedupe workflow lines"
        ]
      }
    ]
  },
  {
    "date": "2026-04-30",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "add GroupAction.status CANCELLED choice"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "assist stress spend, sessions for campaign players; CI Jest/playwright layout"
        ]
      },
      {
        "title": "Other",
        "items": [
          "patch notes: add theme changelog line; tidy older entries"
        ]
      },
      {
        "title": "Added",
        "items": [
          "enhance theme management and styling across components",
          "enhance AppBar with search and account menu functionality",
          "enhance action handling and group action management",
          "enhance session management and roll handling",
          "add increment wanted action and roll deletion",
          "add roll goal mapping by character",
          "add action_name field to GroupAction model and update related serializers and views",
          "enhance NPC routing and campaign management"
        ]
      }
    ]
  },
  {
    "date": "2026-04-28",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "enhance layout and accessibility of HomeStandCoin component",
          "enhance HomeStandCoin component layout and accessibility",
          "center stand coin in hero"
        ]
      }
    ]
  }
];
