/**
 * Auto-generated from git log. Do not edit manually.
 * Run: node frontend/scripts/generatePatchNotes.js
 */
export const PATCH_NOTES = [
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
          "campaign/session Rep edits, peer visibility, home NPC links",
          "toggle NPC clock visibility from Campaign Management"
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
          "Merge pull request #179 from zoobavitel/chore/dedupe-resistance-stress-dead-dice-rolling",
          "Merge pull request #178 from zoobavitel/feature/campaign-shell-pc-columns",
          "Merge pull request #177 from zoobavitel/feature/campaign-roster-ui-parity",
          "Merge pull request #176 from zoobavitel/feature/campaign-roster-ui-parity",
          "Align campaign/session roster expands with full-width expand-slot parity.",
          "Merge pull request #175 from zoobavitel/fix/session-faction-npc-count",
          "Remove unused CampaignManagement imports after roster extract.",
          "Clarify campaign roster NPC strip drag and expand actions.",
          "Replace campaign roster UI with session-style token panels.",
          "Fix session faction cards showing wrong NPC counts.",
          "Remove downtime phase logic from Train.",
          "Allow repeat downtime Train on same track per phase.",
          "Keep Train button label when track already trained.",
          "Fix crew-linked stash disappearing on autosave.",
          "Fix Train phase lock when no completed session exists.",
          "Add change-password flow for logged-in users."
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "dedupe resistance stress cost, remove dead dice-rolling"
        ]
      },
      {
        "title": "Added",
        "items": [
          "per-PC shell columns and own-character Harm edits",
          "fill campaign PC expand tabs",
          "sheet fixes, per-NPC visibility, overlay expand, home undo delete",
          "player access, PC Info, campaign shell ledgers"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "allow training multiple tracks per downtime phase",
          "crew stash hydrate, train lock, and member crew access",
          "scale gunicorn pool and lighten SSE poll load"
        ]
      }
    ]
  },
  {
    "date": "2026-09-28",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #167 from zoobavitel/feature/session-npc-photo-cards"
        ]
      },
      {
        "title": "Added",
        "items": [
          "choose add-existing or create NPC from dashed tile",
          "NPC expand popover, XP/Scorecard unify, help tips"
        ]
      }
    ]
  },
  {
    "date": "2026-09-24",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #166 from zoobavitel/feature/session-npc-photo-cards"
        ]
      }
    ]
  },
  {
    "date": "2026-09-23",
    "version": null,
    "sections": [
      {
        "title": "Fixed",
        "items": [
          "flip Assist UI to helper-initiated flow"
        ]
      },
      {
        "title": "Added",
        "items": [
          "tuck XP help into ? bubble",
          "allow Heritage downtime Train (house rule)",
          "PC expand panels, token faces, roster polish",
          "downtime Train buttons for XP tracks"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "refresh patch notes after train+session commits"
        ]
      },
      {
        "title": "Other",
        "items": [
          "merge: bring sheet Train XP onto session-npc-photo-cards"
        ]
      }
    ]
  },
  {
    "date": "2026-09-22",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "Manual XP column, ledger collapse, inventory picker, roster grid",
          "server-derived completion and soft-dismiss",
          "move crew description under name, upgrades into abilities",
          "split CREW MODE identity and factions",
          "move crew portrait beside CREW NAME",
          "faction reputation card grid for all campaign factions",
          "per-field GM visibility for tier, hold, rep, notes, NPCs",
          "crew portrait upload crop and clear parity",
          "inline faction editor replaces NPC grid in panel",
          "allow_character_assignment toggle and hide GM roster card by default",
          "crew portrait upload crop and clear parity",
          "move SESSION and CLOCKS to left column",
          "B→A standard picks use AbilityPickerPopover",
          "align Assist UI to same-crew SRD rule"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #165 from zoobavitel/feature/crew-portrait-upload-crop",
          "merge(master): resolve crew portrait PR conflicts with #164",
          "Merge pull request #164 from zoobavitel/feature/campaign-ui-polish-chat",
          "Merge pull request #163 from zoobavitel/feature/sheet-session-clocks-left-column",
          "Merge pull request #162 from zoobavitel/feature/ba-standard-ability-picker",
          "Merge pull request #161 from zoobavitel/fix/character-npc-mode-flicker",
          "Merge branch 'feature/ba-standard-ability-picker' into feature/sheet-session-clocks-left-column"
        ]
      },
      {
        "title": "Maintenance",
        "items": [
          "refresh patch notes for crew portrait crop",
          "refresh patchNotes for campaign UI polish branch"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "enlarge SESSION Wanted label and stars",
          "stop progress-clock tile remount on create",
          "wrap CLOCKS in S.card like STRESS",
          "toggle crew portrait editor on thumb click",
          "enlarge crew portrait beside CREW NAME",
          "stop crew portrait on faction reputation rows",
          "hide redacted faction status, notes, and NPC count on cards",
          "honor per-field visibility on sheet and home cards",
          "stop PC/NPC sheet flicker from stale npc route id",
          "SSE-safe refetch and clock create stability"
        ]
      }
    ]
  },
  {
    "date": "2026-09-21",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #160 from zoobavitel/feature/teamwork-assist-and-clock-fix",
          "Merge pull request #159 from zoobavitel/fix/coin-stash-autosave"
        ]
      }
    ]
  },
  {
    "date": "2026-09-15",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #158 from zoobavitel/fix/perf-dice-roll-debug"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "gate coin and stash PATCH on field touch",
          "eliminate N+1 queries on session roll list"
        ]
      }
    ]
  },
  {
    "date": "2026-09-14",
    "version": null,
    "sections": [
      {
        "title": "Other",
        "items": [
          "Merge pull request #157 from zoobavitel/feature/home-faction-token-cards",
          "Merge pull request #156 from zoobavitel/feature/favicon-visible",
          "Merge pull request #155 from zoobavitel/fix/plan-button-active-session",
          "Merge pull request #154 from zoobavitel/fix/plan-button-active-session",
          "Merge pull request #153 from zoobavitel/fix/npc-image-save",
          "Merge pull request #152 from zoobavitel/feature/xp-respec-mode"
        ]
      },
      {
        "title": "Added",
        "items": [
          "faction image URLs and active-campaign preview",
          "restyle faction cards as dark HFTF token grid",
          "responsive character/NPC card grid preview",
          "larger portraits; keep tabs across mode switch"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "replace favicon with white-background cracked-hand mark",
          "keep Plan mid-session; map BIZARRE to attune",
          "clear stale NPC portrait selections",
          "retain saved NPC portrait source",
          "persist portrait uploads and raise size cap",
          "harden CharacterSheet respec gating for frontend CI path",
          "ignore stale respec status responses",
          "reset history loading on empty character",
          "clear CharacterSheet build warnings"
        ]
      },
      {
        "title": "Tests",
        "items": [
          "cover NPC portrait state fallbacks",
          "cover account avatar size validation",
          "update stale campaign image size assertion"
        ]
      }
    ]
  },
  {
    "date": "2026-09-13",
    "version": null,
    "sections": [
      {
        "title": "Added",
        "items": [
          "add Plan-mode respec and direct XP spends",
          "show characters and NPCs as responsive token cards",
          "full-bleed portraits on PC, NPC, and faction cards",
          "use campaign image as full-bleed card background"
        ]
      },
      {
        "title": "Other",
        "items": [
          "Merge pull request #151 from zoobavitel/feature/home-character-token-grid"
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
          "Merge pull request #132 from zoobavitel/feature/remove-character-bar"
        ]
      },
      {
        "title": "Added",
        "items": [
          "sort and collapse campaign/character lists",
          "red→green wedge colors on NPC and GM clocks",
          "rename lair carriage upgrade to garage",
          "move level/XP under portrait, drop character bar"
        ]
      },
      {
        "title": "Fixed",
        "items": [
          "let GM lower PC Stand Coin grades"
        ]
      }
    ]
  }
];
