/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-04-18",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "delete, session scheduling, NPC clock scope"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #61 from zoobavitel/feature/sheet-updates",
          "Enhance campaign views and NPC sheet functionality",
          "Refactor character view creation process",
          "Update NPC involvement clock flags handling",
          "Add normalization function for NPC involvement clock flags"
        ]
      }
    ]
  },
  {
    "date": "2026-04-17",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Enhance NPC and Character models with inventory notes and campaign audit logging",
          "Merge pull request #60 from zoobavitel/release/1.0.1",
          "Fix review-thread issues for session NPC visibility toggles",
          "Release 1.0.1: NPC vulnerability visibility on PC sheets and account settings",
          "Enhance HomePage UI with user display name and avatar features",
          "Merge pull request #59 from zoobavitel/feature/npc-stand-coin-avatar-migration",
          "Address PR review accessibility feedback for NPC coin and user menu",
          "Fix auth service test import order for lint.",
          "Add avatar_url migration and NPC stand coin UI.",
          "uh"
        ]
      }
    ]
  },
  {
    "date": "2026-04-16",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Refactor HP budgeting logic in CharacterSerializer and related components to exclude required benefits and detriments. Update UI to reflect optional status for HP costs and values in AbilityBrowser, CharacterOptionsPage, and CharacterSheet.",
          "Update SRD documentation to clarify that every heritage starts with a base Heritage Point Value instead of a base HP value.",
          "Refactor FactionMode component to clarify GM campaign factions UI, rename to GmFactionsTool, and remove unused active mode state. Update UI text for better clarity on player character and faction distinctions.",
          "Refactor mode selection in CharacterSheet component to use buttons instead of a dropdown for improved accessibility and UI consistency. Update SRD documentation for clarity on mandatory detriments and their impact on HP.",
          "Update CharacterSheet component styles and header layout for improved UI",
          "Remove delete character button from CharacterPage component in MODES.NPC"
        ]
      }
    ]
  },
  {
    "date": "2026-04-15",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Track characters merge migrations (0040–0044) for deploy parity",
          "Merge pull request #57 from zoobavitel/cursor/ownership-visibility-perms-3143",
          "Fix permission test setup to exercise 403 path",
          "Enforce character ownership permissions and creator visibility",
          "Merge pull request #54 from zoobavitel/cursor/fix-postcss-startup-271c",
          "Add caveman always-on snippet to Cursor rules",
          "Sort patch notes newest-first in preview and full page",
          "Make standalone home stats panel span section width",
          "Remove duplicate sticky header from patch notes page",
          "Make home bar chart tooltip emphasize numeric counts",
          "Remove duplicate sticky header from licenses page",
          "Move home stats panel out of hero section",
          "Update home hero subtitle roundabout path copy",
          "Exclude blank New Character entries from PC stats",
          "Use home-style hamburger icon across all pages",
          "Show delete character action in NPC mode toolbar",
          "Add open character dropdown to NPC mode toolbar",
          "Allow NPC sheet to render at full page width",
          "Remove sticky header bar from search page",
          "Keep new character name field blank by default",
          "Guard unsaved new character drafts before navigation",
          "Set home hamburger bars to yellow red purple",
          "Use shared home-style navbar on all pages",
          "Define app shell surface tokens to prevent header bleed",
          "Reorder stripe palette to yellow-orange-red-purple",
          "Apply global HFTF palette across app shell",
          "Widen hero stats panel and remove session/crew rows",
          "Add divider between hero and lower sections",
          "Allow 127.0.0.1 frontend origin in CORS",
          "Fix auth API default for remote frontend hosts",
          "Fix formatting in contributing guidelines"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "define unsaved-character navigation guards"
        ]
      }
    ]
  },
  {
    "date": "2026-04-13",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #53 from zoobavitel/copilot/fix-character-center-alignment",
          "Update hero subtext on Home page",
          "Merge pull request #52 from zoobavitel/copilot/fix-game-rules-scroll-behavior",
          "Expand scroll-reset effect to cover all route params",
          "Reset window scroll position on page navigation",
          "Merge pull request #50 from zoobavitel/copilot/fix-character-sheet-ownership",
          "Merge pull request #51 from zoobavitel/copilot/add-edit-delete-buttons-home-faction-cards",
          "Add Edit & Delete buttons to Home page faction cards",
          "Merge pull request #49 from zoobavitel/copilot/remove-second-striped-bar-homepage",
          "Initial plan",
          "Restore footer top stripe; remove stripe-bar div after footer",
          "Remove striped border-image from site-footer top edge",
          "Remove top stripe-bar from homepage, keep the one below the footer",
          "Merge pull request #48 from zoobavitel/copilot/fix-persist-trauma-checkboxes",
          "Merge pull request #47 from zoobavitel/copilot/fix-load-characters-order",
          "Merge pull request #40 from zoobavitel/fix/trauma-checkbox-sync",
          "Initial plan",
          "Merge branch 'master' into fix/trauma-checkbox-sync",
          "Merge pull request #46 from zoobavitel/copilot/fix-patch-notes-display-issue",
          "Merge pull request #45 from zoobavitel/copilot/update-home-page-characters-section",
          "Merge pull request #44 from zoobavitel/copilot/apply-css-faction-section",
          "Add faction, camp-card, patch-notes, footer CSS to Home.css",
          "Merge pull request #43 from zoobavitel/copilot/update-ui-elements-styles",
          "Merge pull request #42 from zoobavitel/copilot/fix-incorrect-character-visibility",
          "Merge pull request #41 from zoobavitel/copilot/add-navigation-back-to-home"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "move scroll-to-top into currentPage effect to cover all navigation paths",
          "scroll to top on page nav; prompt before discarding unsaved character/NPC tabs",
          "sync perform_update ownership guard; strengthen ownership test",
          "address code review comments - strict null check, clearer guard comment",
          "prevent GM from claiming ownership of player character sheets",
          "restore patchNotes.js accidentally truncated by build in shallow clone",
          "resolve no-use-before-define lint error for loadCharacters",
          "move loadCharacters before useEffect to fix no-use-before-define",
          "move loadCharacters before useEffect to fix no-use-before-define",
          "deduplicate date key, hasOwnProperty guard, batch trauma name lookup",
          "add missing commas at lines 95 and 649",
          "make characters section reload on user change and clear on logout",
          "fetch full git history in deploy-github-pages so patch notes generate correctly",
          "use --p1-rgb token for semi-transparent purple rgba values",
          "apply mine filter in correct viewset files and make params composable",
          "filter home page to only show owned characters and NPCs"
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "wrap loadCharacters in useCallback and add it to effect deps"
        ]
      },
      {
        "title": "Added",
        "items": [
          "redesign homepage color palette with new design tokens",
          "make AppBar logo clickable to go home; fix nav-logo button background in hamburger drawer"
        ]
      }
    ]
  },
  {
    "date": "2026-04-11",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "persist trauma checkboxes after save/refetch",
          "remove global overflow-x hidden, rely on responsive layout fixes",
          "mobile layout responsiveness for CharacterSheet and NPCSheet",
          "add trauma reference data re-fetch fallback in handleSaveCharacter"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #39 from zoobavitel/copilot/fix-character-sheet-width-issues",
          "Merge pull request #36 from zoobavitel/copilot/remove-personal-information",
          "Merge pull request #38 from zoobavitel/copilot/fix-trauma-selections-save-issue",
          "Add edit button for custom abilities on character sheet"
        ]
      }
    ]
  },
  {
    "date": "2026-04-10",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #37 from zoobavitel/copilot/add-edit-character-abilities-button",
          "security: address code review feedback on PII removal",
          "security: remove PII, add gitleaks scanning, add SECURITY.md",
          "Merge pull request #35 from zoobavitel/copilot/discuss-npc-deletion-issues",
          "Merge pull request #33 from zoobavitel/copilot/remove-conflict-clocks-on-npc-creation",
          "Merge pull request #32 from zoobavitel/copilot/fix-npc-level-display",
          "Merge pull request #34 from zoobavitel/zoobavitel-patch-2",
          "Change pull request target branch to 'master'",
          "Align NPCSerializer and NPCSummarySerializer to compute level consistently from stand_coin_stats",
          "Add tests for NPCSummarySerializer level computation",
          "Fix NPC level display in campaign management to compute from stand_coin_stats",
          "Merge pull request #31 from zoobavitel/copilot/fix-alter-faction-unique-together",
          "Add missing Meta.unique_together to Faction model",
          "migrate",
          "Merge pull request #30 from zoobavitel/copilot/fix-characters-visibility-and-delete-npcs",
          "Merge pull request #29 from zoobavitel/copilot/add-crew-name-and-characteristics-again",
          "Merge pull request #28 from zoobavitel/copilot/add-delete-npc-button",
          "Merge pull request #27 from zoobavitel/copilot/fix-player-character-trauma-saving",
          "Merge pull request #26 from zoobavitel/copilot/fix-npc-sheet-refresh-issue-again",
          "Fix trauma not saving: resolve traumaChecks object to ID array before backend call",
          "Merge pull request #24 from zoobavitel/copilot/fix-npc-faction-dropdown",
          "Merge branch 'master' into copilot/fix-npc-faction-dropdown",
          "Merge pull request #25 from zoobavitel/copilot/fix-issue-with-em-dash",
          "Address review: simplify NPC.__str__ null check, add Unicode comments in test",
          "Fix EM dash 500: null-safe NPC.__str__, blank=True for relationships, regression tests",
          "Initial plan for em-dash 500 fix",
          "added merge migration",
          "Merge pull request #23 from zoobavitel/copilot/fix-npc-500-error-gm-locked-fields",
          "Add clarifying comment on ability ID in regression test",
          "Remove accidentally committed debug.log",
          "Fix 500 on NPC PUT: merge conflicting 0038 migrations, harden Character.save(), add regression tests",
          "Initial plan",
          "Create copilot-instructions.md file with initial content",
          "Merge pull request #21 from zoobavitel/copilot/add-heritage-and-user-types-to-npc",
          "Merge pull request #20 from zoobavitel/copilot/create-faction-for-npc",
          "Delete .github/workflows/black.yml",
          "Merge branch 'master' into copilot/create-faction-for-npc",
          "Merge pull request #22 from zoobavitel/copilot/inline-faction-creation-npc-sheet",
          "Add TypeScript dependency to package.json",
          "Address code review: bulk_create, consolidate heritage sync, use null for heritage",
          "Merge branch 'master' into copilot/create-faction-for-npc",
          "Add heritage, NPC type, and playbook abilities to NPC sheet",
          "Merge pull request #19 from zoobavitel/copilot/update-repo-name-variables",
          "Merge pull request #18 from zoobavitel/copilot/fix-vulnerability-clock-issue",
          "Replace all jojo-ttrpg-platform references with 1-800-BIZARRE",
          "Rename onClick param 'f' to 'newFilled' for clarity",
          "Add GitHub Actions workflow for Black autofix",
          "Merge pull request #17 from zoobavitel/copilot/fix-new-npc-button-functionality",
          "Merge pull request #16 from zoobavitel/copilot/fix-syntax-error-in-create-npc-py",
          "Fix curly apostrophe syntax error in create_npc.py",
          "Update Black action options in workflow",
          "Update source path in black.yml workflow",
          "Update Black workflow to use new configuration"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "on NPC delete land on blank character sheet, guard auto-save for nameless new NPCs",
          "remove default conflict clock on new NPC creation",
          "restrict homepage characters to own user, add NPC delete button",
          "update URL hash when saving/opening NPC so refresh restores the sheet",
          "prevent duplicate faction names per campaign (backend + frontend)",
          "parse campaign id to int on select change so factions populate",
          "update package-lock.json to include typescript 5.9.3 as direct dev dependency",
          "decouple vulnerability clock from conflict clocks on NPC page",
          "always open blank NPC tab when navigating to NPC page without specific ID"
        ]
      },
      {
        "title": "Added",
        "items": [
          "add crew management panel to campaign page and auto-assign crew on character assignment",
          "add Delete NPC button to NPC character sheet top bar",
          "inline faction creation & shared faction data in NPC Sheet"
        ]
      }
    ]
  },
  {
    "date": "2026-04-09",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Delete .github/workflows/prettier.yml",
          "Merge pull request #15 from zoobavitel/copilot/add-github-action-prettier",
          "dw",
          "prettier format",
          "Merge pull request #14 from zoobavitel/zoobavitel-patch-1",
          "Refactor CI/CD workflow for branch and deployment updates",
          "Merge pull request #13 from zoobavitel/feature/rules-srd-sections-ui"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "add explicit permissions to prettier workflow"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "add prettier formatting GitHub Action with config and scripts",
          "remove monolithic game-rules-srd.md"
        ]
      },
      {
        "title": "Added",
        "items": [
          "per-section SRD pages, split script, and rules nav layout"
        ]
      }
    ]
  },
  {
    "date": "2026-04-08",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Fix CI: stash_slots migration; coin readout height; patch notes",
          "Site stats API, stash slots & portrait uploads; sheet/home fixes"
        ]
      }
    ]
  },
  {
    "date": "2026-04-07",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #12 from zoobavitel/fix/character-delete-empty-response-and-home-errors",
          "Stop tracking backend/src/db.sqlite3 (local dev DB)",
          "Add hero Stand Coin, centered layout; update patch notes and db",
          "Merge pull request #11 from zoobavitel/fix/character-delete-empty-response-and-home-errors",
          "Merge remote-tracking branch 'origin/master' into fix/character-delete-empty-response-and-home-errors",
          "Merge pull request #10 from zoobavitel/feature/home-campaign-invites",
          "Merge pull request #9 from zoobavitel/cursor/srd-potency-doc-sync",
          "Merge pull request #8 from zoobavitel/feature/bizarrepoc-homepage"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "update patch notes and backend debug log",
          "update local db.sqlite3 snapshot",
          "refresh game-rules-srd and patch notes; update local db and debug log",
          "update database and log warnings"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "DELETE 204 empty body; Home delete shows errors"
        ]
      },
      {
        "title": "Documentation",
        "items": [
          "sync rules mirrors with SRD (potency removal, preemptive resistance)",
          "drop Power-vs-Durability potency ladder; expand skills preemptive resistance"
        ]
      }
    ]
  },
  {
    "date": "2026-04-05",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #7 from zoobavitel/feature/bizarrepoc-homepage"
        ]
      }
    ]
  }
];
