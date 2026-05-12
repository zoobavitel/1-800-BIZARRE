/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
  {
    "date": "2026-05-11",
    "version": null,
    "sections": [
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
        "title": "Added",
        "items": [
          "Stand recall row + stress button on Stand coin column",
          "stand coin sync, session XP pool, collapsible GM rosters"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "regenerate patch notes from git log",
          "regenerate patch notes from git log"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Session GM: quick NPC create, dark selects, inline faction",
          "Show NPC character/session history"
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
      },
      {
        "title": "Maintenance",
        "items": [
          "update patch notes for SPA routing utilities"
        ]
      },
      {
        "title": "Added",
        "items": [
          "implement SPA routing utilities and refactor navigation components"
        ]
      }
    ]
  },
  {
    "date": "2026-04-26",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "add position effect mapping for session actions"
        ]
      }
    ]
  },
  {
    "date": "2026-04-25",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "update patch notes and package-lock.json"
        ]
      }
    ]
  },
  {
    "date": "2026-04-24",
    "version": null,
    "sections": [
      {
        "title": "Maintenance",
        "items": [
          "update CI workflow and README for LXC deployment",
          "update package versions and enhance CI workflow"
        ]
      }
    ]
  },
  {
    "date": "2026-04-23",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "enhance SessionNPCInvolvement and Roll models with new fields"
        ]
      }
    ]
  },
  {
    "date": "2026-04-22",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "add CrewHistory model and related functionality",
          "improve character display and harm editor layout in CampaignManagement",
          "enhance user profile update and validation"
        ]
      },
      {
        "title": "Refactored",
        "items": [
          "replace line chart with scatter chart for session data visualization"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "update session date handling and UI"
        ]
      }
    ]
  },
  {
    "date": "2026-04-18",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #63 from zoobavitel/feature/campaign-delete-session-qol-npc-clock-scope",
          "Merge pull request #62 from zoobavitel/feature/campaign-delete-session-qol-npc-clock-scope",
          "Merge pull request #61 from zoobavitel/feature/sheet-updates",
          "Enhance campaign views and NPC sheet functionality",
          "Refactor character view creation process",
          "Update NPC involvement clock flags handling",
          "Add normalization function for NPC involvement clock flags"
        ]
      },
      {
        "title": "Added",
        "items": [
          "GM remove players and withdraw invites",
          "delete, session scheduling, NPC clock scope"
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
          "Align NPCSerializer and NPCSummarySerializer to compute level consistently from stand_coin_stats"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "on NPC delete land on blank character sheet, guard auto-save for nameless new NPCs",
          "remove default conflict clock on new NPC creation"
        ]
      }
    ]
  }
];
