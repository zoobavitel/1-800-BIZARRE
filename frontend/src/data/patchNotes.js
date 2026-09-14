/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-09-13",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #151 from zoobavitel/feature/home-character-token-grid"
        ]
      },
      {
        "title": "Added",
        "items": [
          "show characters and NPCs as responsive token cards",
          "full-bleed portraits on PC, NPC, and faction cards",
          "use campaign image as full-bleed card background"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "show when load includes carried coin",
          "align nav slugs with generated SRD section files",
          "build section files from SRD_DEV"
        ]
      },
      {
        "title": "Style",
        "items": [
          "responsive layout for Game Rules on mobile"
        ]
      }
    ]
  },
  {
    "date": "2026-09-12",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #150 from zoobavitel/fix/rules-nav-skill-checks-slug",
          "Merge pull request #148 from zoobavitel/fix/rules-nav-slug-alignment",
          "Merge pull request #149 from zoobavitel/fix/rules-page-responsive-layout",
          "Merge pull request #147 from zoobavitel/fix/rules-srd-dev-split",
          "Merge pull request #146 from zoobavitel/feature/home-card-full-bleed-bg",
          "Merge pull request #145 from zoobavitel/feature/home-campaign-card-bg",
          "Merge pull request #144 from zoobavitel/feature/campaign-list-card-grid"
        ]
      }
    ]
  },
  {
    "date": "2026-09-11",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "restore campaign card accessibility details",
          "restore campaign card details and remove duplicate migration",
          "add merge migration for characters app",
          "merge 0114 campaign image and npc crew leaves",
          "Your Factions only for GM campaigns",
          "show site-wide counts in Live Stats and bar chart"
        ]
      },
      {
        "title": "Added",
        "items": [
          "show list as photo card grid",
          "PC-style inventory, crew standing, crop, responsive",
          "allowArmor prop for NPC kit list",
          "crew FK, standing field, and data migrations",
          "photos with crop upload",
          "nest NPC cards in faction panels with crew merge"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #142 from zoobavitel/feature/npc-crew-standing-inventory",
          "Merge pull request #141 from zoobavitel/feature/home-campaign-photos",
          "Merge pull request #140 from zoobavitel/feature/home-site-wide-stats",
          "Merge pull request #139 from zoobavitel/feature/campaign-roster-card-redesign",
          "merge(master): resolve CampaignManagement roster conflict",
          "Merge pull request #138 from zoobavitel/feature/home-character-preview-limit"
        ]
      }
    ]
  },
  {
    "date": "2026-09-10",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #137 from zoobavitel/fix/stand-coin-bump-after-chargen"
        ]
      },
      {
        "title": "Added",
        "items": [
          "preview first 3 lists and clickable roster cards",
          "spend playbook XP via stand coin wedge click"
        ]
      }
    ]
  },
  {
    "date": "2026-09-09",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #136 from zoobavitel/feature/home-campaign-sort",
          "Merge pull request #135 from zoobavitel/feature/clock-wedge-colors",
          "Merge pull request #134 from zoobavitel/fix/pc-stand-coin-plan-decrease",
          "Merge branch 'master' into fix/pc-stand-coin-plan-decrease",
          "Merge branch 'master' into feature/clock-wedge-colors",
          "Merge pull request #133 from zoobavitel/feature/garage-lair-upgrade",
          "Merge pull request #132 from zoobavitel/feature/remove-character-bar",
          "Merge pull request #131 from zoobavitel/feature/saturday-load-gate",
          "Merge pull request #130 from zoobavitel/fix/inventory-legacy-load-zero",
          "ci: block PRs on API/SSE performance budgets"
        ]
      },
      {
        "title": "Added",
        "items": [
          "sort and collapse campaign/character lists",
          "red→green wedge colors on NPC and GM clocks",
          "rename lair carriage upgrade to garage",
          "move level/XP under portrait, drop character bar",
          "Saturday-table load gate and merge SSE budgets"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "let GM lower PC Stand Coin grades",
          "allow setting legacy item load to 0"
        ]
      }
    ]
  },
  {
    "date": "2026-09-08",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #129 from zoobavitel/docs/restore-swan-song",
          "sync(srd): restore Swan Song and align hamon/spin catalogs to SRD_DEV",
          "Merge pull request #128 from zoobavitel/fix/prod-media-serving",
          "Merge pull request #127 from zoobavitel/feature/npc-required-heritage-defaults",
          "Merge pull request #126 from zoobavitel/feature/close-friend-rival-fields",
          "Merge pull request #124 from zoobavitel/feature/avatar-crop",
          "Merge pull request #125 from zoobavitel/feature/campaign-roster-cards",
          "Merge pull request #123 from zoobavitel/feature/inventory-item-edit",
          "Fix prod SSE FD leak and guard action dots after XP spends."
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "drop stale urls.py duplicate-admin note"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "serve uploads in prod and reject Discord CDN links"
        ]
      },
      {
        "title": "Added",
        "items": [
          "default-check required heritage picks",
          "expose close friend and rival fields",
          "roster cards, HFTF tokens, and portrait multipart fixes",
          "add crop and zoom for profile picture"
        ]
      }
    ]
  },
  {
    "date": "2026-09-07",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "allow editing inventory items after creation",
          "upload portraits for PC, NPC, crew, faction, and user"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #122 from zoobavitel/feature/portrait-upload",
          "Merge pull request #121 from zoobavitel/fix/home-avatar-portrait-fallback",
          "Merge pull request #120 from zoobavitel/fix/home-avatar-portrait-fallback",
          "Merge pull request #119 from zoobavitel/feature/progression-planner"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "resolve avatars and fall back to PC portraits",
          "apply coin_grade from owned grade"
        ]
      },
      {
        "title": "Style",
        "items": [
          "wire inventory UI to HFTF theme tokens"
        ]
      }
    ]
  },
  {
    "date": "2026-09-05",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "compact clock grid and stop tick flicker"
        ]
      },
      {
        "title": "Added",
        "items": [
          "plan-mode queue with B→A grants"
        ]
      }
    ]
  },
  {
    "date": "2026-09-02",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #118 from zoobavitel/feature/srd-equipment-templates",
          "Merge pull request #117 from zoobavitel/cursor/plan-a-pending-advance-5176",
          "Sync standard abilities catalog to SRD_DEV."
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "drop archetype trigger picker from the XP panel",
          "rename Arcane Implements to Bizarre Implements"
        ]
      },
      {
        "title": "Added",
        "items": [
          "B→A reward grants two unique abilities plus one standard",
          "drop the 20 XP cap on manual awards",
          "show the signed-in username in the user menu drawer",
          "scope catalog per campaign and stop double-saving base kit",
          "sync SRD equipment TEMPLATEs from fixture",
          "Plan A fill-clear PendingAdvance and single-playbook cutover",
          "add loadout, inventory, and armor"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "stop apply-level-up hanging behind autosave write lock",
          "stable PendingAdvance index name + ESLint hook deps",
          "align Plan A tests and player loadout PATCH permission"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "align XP allocation suites with Plan A pending redeem",
          "cover resolveCrewFromCampaign helpers"
        ]
      }
    ]
  },
  {
    "date": "2026-09-01",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #115 from zoobavitel/fix/advance-autosave-revert",
          "Fix exhaustive-deps on allocation XP callbacks.",
          "Fix advance autosave reverting allocation-owned character state.",
          "Merge pull request #114 from zoobavitel/fix/stale-player-stress-sync"
        ]
      },
      {
        "title": "Added",
        "items": [
          "use the cracked-hand mark as the site favicon"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "run gunicorn gthread so SSE cannot starve the API",
          "keep server stress visible on a dirty PC tab"
        ]
      }
    ]
  },
  {
    "date": "2026-08-30",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #113 from zoobavitel/fix/playbook-ability-level-gate"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "expect seeded Spin/Hamon foundations"
        ]
      }
    ]
  },
  {
    "date": "2026-08-29",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "upsert Spin/Hamon abilities from SRD fixtures",
          "gate Spin/Hamon abilities by character level",
          "hide L1 ability add buttons when quota full",
          "keep Stand unique ability package on save"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #112 from zoobavitel/fix/custom-stand-ability-persist",
          "Merge pull request #111 from zoobavitel/fix/custom-stand-ability-persist",
          "Merge pull request #110 from zoobavitel/feature/reset-character-sheet"
        ]
      },
      {
        "title": "Added",
        "items": [
          "sync SRD_DEV rules + human PDF export"
        ]
      }
    ]
  },
  {
    "date": "2026-08-21",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "include missing CharacterSheet hook dependency"
        ]
      }
    ]
  },
  {
    "date": "2026-08-20",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "refresh generated patch notes"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "cover resist, unlock, NPC armor"
        ]
      }
    ]
  },
  {
    "date": "2026-08-19",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Coin Rolls exclude Durability",
          "innate stand dice + desperate tracks",
          "reset, clocks, roster, history UI"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "refresh generated patch notes"
        ]
      }
    ]
  },
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
          "ci(e2e): lower Playwright install step timeout to 5m"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "align smoke test navigation with playwright baseURL",
          "navigate smoke test via PLAYWRIGHT_BASE_URL",
          "resolve smoke URL relative to baseURL path"
        ]
      }
    ]
  }
];
