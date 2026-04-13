/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-04-11",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #38 from zoobavitel/copilot/fix-trauma-selections-save-issue",
          "Add edit button for custom abilities on character sheet"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "add trauma reference data re-fetch fallback in handleSaveCharacter"
        ]
      }
    ]
  },
  {
    "date": "2026-04-10",
    "date": "2026-04-13",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "redesign homepage color palette with new design tokens"
        ]
      }
    ]
  },
  {
    "date": "2026-04-11",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #37 from zoobavitel/copilot/add-edit-character-abilities-button",
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
          "Merge pull request #39 from zoobavitel/copilot/fix-character-sheet-width-issues",
          "Merge pull request #36 from zoobavitel/copilot/remove-personal-information"
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
  },
  {
    "date": "2026-04-04",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "update dependencies and enhance HomePage with new charts",
          "update database and enhance frontend styles"
        ]
      }
    ]
  },
  {
    "date": "2026-04-03",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #6 from zoobavitel/feature/realtime-sheet-sync"
        ]
      },
      {
        "title": "Added",
        "items": [
          "implement campaign events streaming and enhance character page synchronization"
        ]
      }
    ]
  },
  {
    "date": "2026-04-01",
    "version": null,
    "sections": [
      {
        "title": "Refactored",
        "items": [
          "update patch notes and improve character page logic",
          "update patch notes and enhance character page logic"
        ]
      },
      {
        "title": "Added",
        "items": [
          "add coin boxes and stash slots to character and crew models",
          "add resolveHeritagePkForSave function and enhance character page"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #5 from zoobavitel/fix/character-sheet-heritage-save",
          "Merge pull request #4 from zoobavitel/fix/character-sheet-heritage-save",
          "ci: use Node 24 action runtimes (checkout v5, setup-node v5, setup-python v6)",
          "Merge pull request #3 from zoobavitel/fix/character-sheet-heritage-save",
          "Enhance CI and integration tests",
          "Merge pull request #2 from zoobavitel/fix/ci-migration-and-frontend-tests",
          "Update patch notes with recent changes",
          "Refactor heritage handling in character sheet and API transformation",
          "Update README to include new subagent documentation for feature branches",
          "Update README to include new subagent documentation for feature branches",
          "Update character serializers to accept heritage display names and enhance error handling",
          "Update README and enhance error handling in authentication views",
          "Enhance CI/CD workflow for frontend and backend testing"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "enhance heritage loading and error handling",
          "update database seeding logic and enhance heritage error handling",
          "improve heritage error message on CharacterPage",
          "resolve heritage PK before save and improve heritages load UX"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "restore backend/src/db.sqlite3 to match master (drop stray migrate diff)"
        ]
      }
    ]
  },
  {
    "date": "2026-03-31",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update production settings and deployment configurations",
          "Enhance CI configuration and update production settings"
        ]
      }
    ]
  },
  {
    "date": "2026-03-27",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update character management features and enhance logging"
        ]
      }
    ]
  },
  {
    "date": "2026-03-26",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Enhance SKILL.md with integration test instructions for ngrok",
          "Update debug.log with additional warning entries and refresh db.sqlite3",
          "Update debug.log with additional warning entries for crew and NPC actions",
          "ci(frontend): run lint from root (script lives in workspace root)",
          "ci(integration): install deps with root npm ci (workspace lockfile)",
          "Enhance character management features and update logging",
          "Update database and enhance character management features",
          "Update database and enhance character management features",
          "Update agent descriptions and enhance character management features",
          "Update database and logging features",
          "Update database, logging, and character management features"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "store hashed passwords in example_campaign fixture",
          "align jack_rice fixture with Character/Stand schema",
          "resolve characters test module clash and npm cache path"
        ]
      }
    ]
  },
  {
    "date": "2026-03-25",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Refactor agent rules and enhance character management features",
          "Update logging and backup procedures; enhance character update handling"
        ]
      }
    ]
  },
  {
    "date": "2026-03-23",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update database and log files; enhance character model and API interactions"
        ]
      }
    ]
  },
  {
    "date": "2026-03-18",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update database and log files; enhance character model and campaign management features",
          "Update database and log files; enhance character model and UI",
          "Update database and log files; enhance character sheet UI"
        ]
      },
      {
        "title": "Added",
        "items": [
          "Enhance NPC and session management with new features",
          "Enhance character and session management with XP tracking and new features"
        ]
      }
    ]
  },
  {
    "date": "2026-03-17",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Enhance user profile and character management with new fields and features"
        ]
      }
    ]
  },
  {
    "date": "2026-02-27",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Enhance NPC management with faction integration and campaign filtering",
          "Implement ClockManager component for enhanced campaign clock management",
          "Update character sheet to include heritage benefits and detriments",
          "Enhance character sheet and campaign management with new features",
          "Add Session Records Modal and enhance session management in CampaignManagement",
          "Add Roll and RollHistory models for session tracking; update character heritage handling in frontend",
          "Introduce showcased NPCs and progress clocks for enhanced gameplay mechanics",
          "Update development scripts and enhance character options in frontend"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Update database and log files; add warnings for bad requests",
          "Update LoginForm and SignupForm components; refactor styles and structure"
        ]
      }
    ]
  },
  {
    "date": "2026-02-26",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Enhance campaign navigation and management in frontend",
          "Refactor Home component layout and enhance header styling",
          "Enhance AbilityBrowser and Home components with heritage functionality",
          "Enhance campaign management features and UI",
          "Enhance character models and serializers with new features"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Enhance LoginForm with design tokens and animations",
          "Update database and debug logs; refactor CharacterPage tab management",
          "Update character heritage, benefits, and detriments fixtures"
        ]
      }
    ]
  },
  {
    "date": "2026-02-24",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Update CampaignSerializer and enhance frontend navigation",
          "Refactor HamburgerMenu and update CharacterPage structure",
          "Integrate react-burger-menu for enhanced navigation",
          "Update settings and documentation for ngrok integration",
          "Enhance API base URL handling for ngrok and local development"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "Add new log entry for file change monitoring"
        ]
      }
    ]
  },
  {
    "date": "2026-02-23",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Improve server URL handling in authentication forms and API services",
          "Enhance authentication forms and API integration",
          "Update dependencies and enhance character serialization",
          "Add CurrentUserView and enhance user authentication flow",
          "Introduce faction management and enhance campaign integration"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "Update dependencies and modify package configurations",
          "Add additional log entry for file change monitoring",
          "Refine deploy script and update documentation for GitHub Pages",
          "Update CI/CD workflow and homepage URL"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "Update homepage URL and modify deploy script in package.json"
        ]
      },
      {
        "title": "Other",
        "items": [
          "update"
        ]
      }
    ]
  },
  {
    "date": "2025-07-21",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Update debug log with additional info and clean up binary cache files",
          "Clean up cache files",
          "Clean up cache files and debug log"
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "Update project branding from JoJo TTRPG to 1-800-BIZARRE across documentation and codebase"
        ]
      }
    ]
  },
  {
    "date": "2025-07-15",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Add harm clock max parameter to NPC creation and update NPC model for configurable harm clock",
          "Implement NPC creation command and enhance NPC mechanics with new attributes"
        ]
      }
    ]
  },
  {
    "date": "2025-07-14",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Enhance character management and UI with new features",
          "Remove deprecated files and components to streamline the codebase"
        ]
      }
    ]
  },
  {
    "date": "2025-07-13",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "Update package dependencies and remove unused files"
        ]
      },
      {
        "title": "Added",
        "items": [
          "Update frontend and backend dependencies, enhance session management, and refine character models"
        ]
      }
    ]
  },
  {
    "date": "2025-07-07",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Implement session and faction management models"
        ]
      }
    ]
  },
  {
    "date": "2025-07-03",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Update backend documentation and character creation logic",
          "Remove deprecated files and components for a cleaner codebase"
        ]
      }
    ]
  },
  {
    "date": "2025-06-17",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Add attribute rolling functionality with inline result display",
          "Enhance Clock component with customizable color and click handling"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Refactor code structure and remove redundant sections for improved readability and maintainability"
        ]
      }
    ]
  },
  {
    "date": "2025-06-11",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Add Account Settings page and integrate user profile management",
          "Add production deployment scripts and checklist"
          "remove global overflow-x hidden, rely on responsive layout fixes"
        ]
      }
    ]
  }
];
