/**
 * CharacterPage — page-level orchestration for the character sheet.
 * Handles API calls, data transformation, mode switching (Character / NPC),
 * and navigation chrome.  Delegates rendering to CharacterSheet.jsx.
 *
 * CHARACTER TABS: each open character gets a named tab in the top bar,
 * sorted alphabetically (unsaved "New Character" tabs always sort first).
 */
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  characterAPI,
  crewAPI,
  npcAPI,
  referenceAPI,
  campaignAPI,
  transformBackendToFrontend,
  transformFrontendToBackend,
  createDefaultCharacter,
  traumaObjectToIds,
  normalizeListResponse,
  resolveHeritagePkForSave,
  normalizeStashSlots,
  resolveStashAfterCharacterSave,
  isImageUploadPayload,
  normalizeHarmObject,
  EMPTY_HARM_SHAPE,
  normalizeCharacterInventory,
  resolveCharacterCampaignContext,
  isUserCampaignGmForCharacter,
  mergeAbilitiesPreferRicherCustoms,
  mergeServerOwnedCharacterFields,
} from "../features/character-sheet";
import {
  isCampaignSseHealthy,
  subscribeCampaignEvents,
} from "../features/character-sheet/services/campaignEvents";
import { useAuth } from "../features/auth";
import { CharacterSheetWrapper } from "./CharacterSheet";
import { characterHashFromIdAndName } from "../utils/spaNavigation";
import { NPCSheet } from "./NPCSheet";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";

const MODES = { CHARACTER: "character", NPC: "npc" };
/** Poll open character sheets + campaigns while the tab is visible (backup if SSE disconnects). */
const SHEET_SYNC_INTERVAL_MS = 30000;

/** Staff / creator / campaign GM may edit; campaign players view See-on NPCs read-only. */
function userCanEditNpcSheet(user, npc, campaigns) {
  if (!user?.id) return false;
  if (user.is_staff) return true;
  if (!npc?.id) return true;
  const creatorId = npc.creator ?? npc.creator_id;
  if (creatorId != null && Number(creatorId) === Number(user.id)) return true;
  const campaignId = npc.campaign ?? npc.campaign_id;
  if (campaignId == null) return false;
  const camp = (campaigns || []).find(
    (c) => Number(c.id) === Number(campaignId),
  );
  const gmId = camp?.gm?.id ?? camp?.gm;
  return gmId != null && Number(gmId) === Number(user.id);
}

function userIsNpcCampaignGm(user, npc, campaigns) {
  if (!user?.id) return false;
  if (user.is_staff) return true;
  const campaignId = npc?.campaign ?? npc?.campaign_id;
  if (campaignId == null) return false;
  const camp = (campaigns || []).find(
    (c) => Number(c.id) === Number(campaignId),
  );
  const gmId = camp?.gm?.id ?? camp?.gm;
  return gmId != null && Number(gmId) === Number(user.id);
}

/** Skip poll/SSE character merge while editing, saving, or in dirtyIntent window. */
function sheetTabIsProtected(meta) {
  return Boolean(meta?.dirtyIntent || meta?.isDirty || meta?.isSaving);
}

function fieldTouchesFromTabMeta(meta) {
  const touches = meta?.payload?._fieldTouches;
  return touches && typeof touches === "object" ? touches : {};
}

function applyServerOwnedSheetFields(tab, serverCharacter, meta) {
  if (!serverCharacter) return tab;
  return {
    ...tab,
    character: mergeServerOwnedCharacterFields(
      tab.character,
      serverCharacter,
      fieldTouchesFromTabMeta(meta),
    ),
  };
}

const PAGE_STYLES = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
    overflowX: "clip",
    maxWidth: "100vw",
    boxSizing: "border-box",
  },
  content: {
    padding: "16px",
    maxWidth: "1400px",
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
    minWidth: 0,
  },
  modeBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "1px solid #374151",
    flexWrap: "wrap",
    gap: "8px",
    width: "100%",
    maxWidth: "100%",
    boxSizing: "border-box",
    minWidth: 0,
  },
  modeBarLeft: {
    display: "flex",
    gap: "4px",
    alignItems: "center",
    flexWrap: "wrap",
    flex: "1 1 280px",
    minWidth: 0,
    maxWidth: "100%",
  },
  modeBarRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    flex: "1 1 220px",
    minWidth: 0,
    maxWidth: "100%",
    justifyContent: "flex-end",
  },
  modeSelect: {
    background: "#1f2937",
    color: "#9ca3af",
    border: "1px solid #4b5563",
    padding: "4px 8px",
    fontSize: "11px",
    fontFamily: "monospace",
    borderRadius: "4px",
    maxWidth: "100%",
    minWidth: 0,
    flex: "1 1 140px",
  },
  modeBtn: (active) => ({
    padding: "6px 12px",
    border: "1px solid #4b5563",
    borderRadius: "4px",
    background: active ? "#374151" : "transparent",
    color: active ? "#fff" : "#9ca3af",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "12px",
    flexShrink: 0,
  }),
};

const TAB_STYLES = {
  tab: (active) => ({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    borderRadius: "4px",
    background: active ? "#4b5563" : "#374151",
    color: active ? "#fff" : "#9ca3af",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "11px",
    border: "none",
    whiteSpace: "nowrap",
  }),
  close: {
    background: "none",
    border: "none",
    color: "#9ca3af",
    cursor: "pointer",
    fontSize: "13px",
    padding: "0 2px",
    lineHeight: 1,
    fontFamily: "monospace",
  },
  divider: {
    width: "1px",
    height: "20px",
    background: "#4b5563",
    margin: "0 4px",
    flexShrink: 0,
  },
  addBtn: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "11px",
    background: "#1f2937",
    color: "#9ca3af",
    border: "1px dashed #4b5563",
    cursor: "pointer",
    fontFamily: "monospace",
    whiteSpace: "nowrap",
  },
};

let nextTabId = 1;

// ---------------------------------------------------------------------------
// Character tab helpers
// ---------------------------------------------------------------------------

function charTabLabel(tab) {
  const name = tab.character?.name?.trim();
  return name || "New Character";
}

function sortCharTabs(tabs) {
  return [...tabs].sort((a, b) => {
    const aNew = !a.characterId;
    const bNew = !b.characterId;
    if (aNew !== bNew) return aNew ? -1 : 1;
    return charTabLabel(a).localeCompare(charTabLabel(b));
  });
}

function isUnsavedCharacterDirty(tab) {
  if (!tab || tab.characterId != null) return false;
  const character = tab.character || {};
  const textFields = [
    character.name,
    character.standName,
    character.background,
    character.look,
    character.vice,
    character.viceDetails,
    character.closeFriend,
    character.rival,
    character.crew,
    character.personal_crew_name,
    character.playbook,
    character.image_url,
  ];
  if (textFields.some((value) => String(value ?? "").trim().length > 0)) {
    return true;
  }
  if (Array.isArray(character.abilities) && character.abilities.length > 0) {
    return true;
  }
  if (Array.isArray(character.clocks) && character.clocks.length > 0) return true;
  if (Array.isArray(character.coin) && character.coin.some(Boolean)) return true;
  if (Array.isArray(character.stash) && character.stash.some(Boolean)) return true;
  if ((character.actionRatings && Object.keys(character.actionRatings).length > 0) ||
      (character.standStats && Object.keys(character.standStats).length > 0)) {
    return true;
  }
  if (typeof character.stressFilled === "number" && character.stressFilled > 0) {
    return true;
  }
  if (typeof character.healingClock === "number" && character.healingClock > 0) {
    return true;
  }
  if (Array.isArray(character.trauma) && character.trauma.length > 0) return true;
  if (
    character.armor &&
    (character.armor.armor || character.armor.heavy || character.armor.special)
  ) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Payload normalizer
// ---------------------------------------------------------------------------

function normalizeSheetPayloadToFrontend(payload, traumasList = []) {
  const traumaIds = traumaObjectToIds(payload.trauma || {}, traumasList);
  const harm = normalizeHarmObject(
    payload.harm || payload.harmEntries || EMPTY_HARM_SHAPE,
  );
  const coinFilled =
    typeof payload.coinFilled === "number" &&
    Number.isFinite(payload.coinFilled)
      ? payload.coinFilled
      : Array.isArray(payload.coin)
        ? payload.coin.filter(Boolean).length
        : 0;
  return {
    name: payload.name ?? "",
    standName: payload.standName ?? "",
    heritage: payload.heritage ?? null,
    background: payload.background ?? "",
    look: payload.look ?? "",
    vice: payload.vice ?? "",
    viceDetails: payload.viceDetails ?? payload.vice_details ?? "",
    closeFriend: payload.closeFriend ?? payload.close_friend ?? "",
    rival: payload.rival ?? "",
    fed_today:
      typeof payload.fed_today === "boolean" ? payload.fed_today : null,
    disguised_as_human:
      typeof payload.disguised_as_human === "boolean"
        ? payload.disguised_as_human
        : null,
    crew: payload.crew ?? "",
    crewId: payload.crewId ?? null,
    personal_crew_name: payload.personal_crew_name ?? "",
    actionRatings: payload.actionRatings ?? {},
    standStats: payload.standStats ?? {},
    stressFilled:
      typeof payload.stressFilled === "number" ? payload.stressFilled : 0,
    trauma: traumaIds,
    standArmorUsed: Math.max(0, Math.floor(Number(payload.standArmorUsed) || 0)),
    hasPhysicalArmorItem: !!payload.hasPhysicalArmorItem,
    physicalArmorBonusCharges: Math.min(
      6,
      Math.max(0, Math.floor(Number(payload.physicalArmorBonusCharges) || 0)),
    ),
    physicalArmorUsed: Math.min(
      6,
      Math.max(0, Math.floor(Number(payload.physicalArmorUsed) || 0)),
    ),
    armor: {
      armor: false,
      heavy: false,
      special: false,
    },
    harmEntries: harm,
    harm,
    coin: Array(4)
      .fill(false)
      .map((_, i) => i < coinFilled),
    stash: Array.isArray(payload.stash) ? payload.stash : Array(40).fill(false),
    healingClock: payload.healingClock ?? 0,
    unallocatedXp: Math.max(
      0,
      Math.floor(Number(payload.unallocatedXp) || 0),
    ),
    xp: payload.xp ?? {
      insight: 0,
      prowess: 0,
      resolve: 0,
      heritage: 0,
      playbook: 0,
    },
    abilities: Array.isArray(payload.abilities) ? payload.abilities : [],
    clocks: Array.isArray(payload.clocks) ? payload.clocks : [],
    campaign: payload.campaign ?? null,
    playbook: payload.playbook ?? "Stand",
    secondaryPlaybook: payload.secondaryPlaybook ?? "",
    playbookXpArchetypes: Array.isArray(payload.playbookXpArchetypes)
      ? payload.playbookXpArchetypes
      : [],
    standType: payload.standType ?? "",
    standTypeCustom: payload.standTypeCustom ?? "",
    standForms: Array.isArray(payload.standForms) ? payload.standForms : [],
    standConsciousness: payload.standConsciousness ?? "",
    id: payload.id,
    inventory: payload.inventory ?? [],
    reputation_status: payload.reputation_status ?? {},
    // Must pass through — dropping these makes autosave PATCH empty maps / blank notes,
    // then hydrate snaps the −/+ standing controls (and notes) back after a flicker.
    sheetNotes: payload.sheetNotes ?? payload.sheet_notes ?? "",
    npcStanding: (() => {
      const raw = payload.npcStanding ?? payload.npc_standing ?? {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
      const out = {};
      for (const [k, v] of Object.entries(raw)) {
        const sk = String(k).trim();
        if (!sk || !/^\d+$/.test(sk)) continue;
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        out[sk] = Math.max(-3, Math.min(3, Math.trunc(n)));
      }
      return out;
    })(),
    selected_benefits: payload.selected_benefits ?? [],
    selected_detriments: payload.selected_detriments ?? [],
    image_url: payload.image_url ?? "",
    imageFile: payload.imageFile,
    image: Object.prototype.hasOwnProperty.call(payload || {}, "image")
      ? payload.image
      : undefined,
  };
}

function mergeRequiredHeritageSelections(frontendPayload, heritageList) {
  const heritageId = Number(frontendPayload?.heritage);
  if (!Number.isFinite(heritageId)) return null;
  const heritage = (heritageList || []).find((h) => Number(h?.id) === heritageId);
  if (!heritage) return null;

  const requiredBenefits = (heritage.benefits || [])
    .filter((b) => b?.required)
    .map((b) => b.id);
  const requiredDetriments = (heritage.detriments || [])
    .filter((d) => d?.required)
    .map((d) => d.id);

  const currentBenefits = Array.isArray(frontendPayload.selected_benefits)
    ? frontendPayload.selected_benefits
    : [];
  const currentDetriments = Array.isArray(frontendPayload.selected_detriments)
    ? frontendPayload.selected_detriments
    : [];

  return {
    ...frontendPayload,
    selected_benefits: [...new Set([...requiredBenefits, ...currentBenefits])],
    selected_detriments: [...new Set([...requiredDetriments, ...currentDetriments])],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function seedBlankCharacter(campaignId = null) {
  const n = Number(campaignId);
  return createDefaultCharacter(
    Number.isFinite(n) && n > 0 ? { campaign: n } : {},
  );
}

export default function CharacterPage({
  initialCharacterId = null,
  initialNewCampaignId = null,
  initialNpcId = null,
  initialNpcCampaignId = null,
  preferNpcMode = false,
  onRegisterNavigationGuard = null,
}) {
  const { user } = useAuth();
  // Hash route (#character vs #npcs) owns mode — never open NPC mode solely
  // because a leftover initialNpcId prop remains from a prior #npcs visit.
  const [mode, setMode] = useState(() =>
    preferNpcMode ? MODES.NPC : MODES.CHARACTER,
  );

  // Keep sheet mode aligned with #character vs #npcs without remounting the page.
  useEffect(() => {
    setMode(preferNpcMode ? MODES.NPC : MODES.CHARACTER);
  }, [preferNpcMode]);

  // ── Character list (used by the "Open character…" dropdown) ─────────────
  const [characters, setCharacters] = useState([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState(null);

  // ── Character tab state ──────────────────────────────────────────────────
  const [charTabs, setCharTabs] = useState([]);
  const [activeCharTabId, setActiveCharTabId] = useState(null);
  const [charTabUnsavedMeta, setCharTabUnsavedMeta] = useState({});
  const charTabsInitialized = useRef(false);
  const charTabsRef = useRef(charTabs);
  const charTabUnsavedMetaRef = useRef(charTabUnsavedMeta);
  const sheetSseUnsubRef = useRef(null);
  /** Bumps when remote sync completes so CharacterSheet refetches session rolls. */
  const [sheetPollTick, setSheetPollTick] = useState(0);
  const [sheetRealtimeReason, setSheetRealtimeReason] = useState("");
  const SHEET_ABORT_SSE_REASONS = useMemo(
    () =>
      new Set(["character", "experience_tracker", "pending_advance"]),
    [],
  );
  const [sheetResetEpoch, setSheetResetEpoch] = useState(0);

  // ── NPC state ───────────────────────────────────────────────────────────
  const [npcs, setNpcs] = useState([]);
  const [npcsLoading, setNpcsLoading] = useState(false);
  const [campaignId] = useState(null);
  const [npcTabs, setNpcTabs] = useState([]);
  const [activeNpcTabId, setActiveNpcTabId] = useState(null);
  const npcTabsInitialized = useRef(false);

  const [campaigns, setCampaigns] = useState([]);
  const [traumas, setTraumas] = useState([]);
  const [heritages, setHeritages] = useState([]);
  const [heritagesLoading, setHeritagesLoading] = useState(true);
  const [heritagesError, setHeritagesError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteConfirmBusy, setDeleteConfirmBusy] = useState(false);
  const referenceDataLoadSeqRef = useRef(0);

  const loadReferenceData = useCallback(async () => {
    const seq = ++referenceDataLoadSeqRef.current;
    setHeritagesLoading(true);
    setHeritagesError(null);
    let heritageFetchFailed = false;
    try {
      const [t, h, c] = await Promise.all([
        referenceAPI.getTraumas().catch(() => null),
        referenceAPI.getHeritages().catch(() => {
          heritageFetchFailed = true;
          return null;
        }),
        campaignAPI.getCampaigns().catch(() => null),
      ]);
      if (seq !== referenceDataLoadSeqRef.current) return;
      setTraumas(normalizeListResponse(t));
      const hList = normalizeListResponse(h);
      setHeritages(hList);
      setCampaigns(normalizeListResponse(c));
      if (heritageFetchFailed) {
        setHeritagesError(
          "Could not load heritages. Check your connection and try again.",
        );
      } else if (!hList.length) {
        console.warn(
          "No heritages in the server database. On the API host run: python manage.py migrate (seeds an empty DB) or loaddata characters/fixtures/srd_heritages.json",
        );
        setHeritagesError(
          "No heritages available. Try Retry, or ask the game host to check the server.",
        );
      } else {
        setHeritagesError(null);
      }
    } catch (e) {
      if (seq !== referenceDataLoadSeqRef.current) return;
      setHeritagesError(e?.message || "Failed to load reference data.");
      setTraumas([]);
      setHeritages([]);
      setCampaigns([]);
    } finally {
      if (seq === referenceDataLoadSeqRef.current) {
        setHeritagesLoading(false);
      }
    }
  }, []);

  // ── Reference data ───────────────────────────────────────────────────────
  useEffect(() => {
    loadReferenceData();
    return () => {
      referenceDataLoadSeqRef.current += 1;
    };
  }, [loadReferenceData]);

  useEffect(() => {
    charTabsRef.current = charTabs;
  }, [charTabs]);

  useEffect(() => {
    charTabUnsavedMetaRef.current = charTabUnsavedMeta;
  }, [charTabUnsavedMeta]);

  /**
   * Refresh campaigns list and merge full character detail into every open tab (GM edits, session P/E, etc.).
   * Always GET /characters/:id/ per open PC so stats stay aligned with the server.
   */
  const syncOpenSheetsFromServer = useCallback(async () => {
    const [c, chars] = await Promise.all([
      campaignAPI.getCampaigns().catch(() => []),
      characterAPI.getCharacters({ mine: true }).catch(() => []),
    ]);
    setCampaigns(c || []);
    const front = (chars || []).map(transformBackendToFrontend);
    setCharacters(front);
    const byId = new Map(front.map((x) => [x.id, x]));
    setCharTabs((prev) => {
      void (async () => {
        const metaSnap = charTabUnsavedMetaRef.current || {};
        const next = await Promise.all(
          prev.map(async (t) => {
            if (!t.characterId) return t;
            // Protect local draft (XP/inventory/clocks) while editing, saving,
            // or in the dirtyIntent window — but still overlay server stress/
            // trauma so a clock edit cannot hide roll/GM stress (incapacitated
            // actions key off server filled count).
            const metaAtStart = metaSnap[t.tabId];
            if (sheetTabIsProtected(metaAtStart)) {
              return applyServerOwnedSheetFields(
                t,
                byId.get(t.characterId),
                metaAtStart,
              );
            }
            try {
              const raw = await characterAPI.getCharacter(t.characterId);
              const transformed = transformBackendToFrontend(raw);
              // Re-check after await: allocate/deallocate or edits may have
              // marked dirty while the GET was in flight; applying a stale
              // snapshot would wipe free-pool XP / track ticks via hydrate.
              const metaAfter = (charTabUnsavedMetaRef.current || {})[t.tabId];
              if (sheetTabIsProtected(metaAfter)) {
                return applyServerOwnedSheetFields(t, transformed, metaAfter);
              }
              return { ...t, character: transformed };
            } catch {
              const metaAfter = (charTabUnsavedMetaRef.current || {})[t.tabId];
              const updated = byId.get(t.characterId);
              if (sheetTabIsProtected(metaAfter)) {
                return applyServerOwnedSheetFields(t, updated, metaAfter);
              }
              if (updated) return { ...t, character: updated };
              return t;
            }
          }),
        );
        setCharTabs(next);
        setSheetPollTick((x) => x + 1);
      })();
      return prev;
    });
  }, []);

  const refreshCampaigns = syncOpenSheetsFromServer;

  // While the document is hidden, skip network sync; on focus, pull full sheet + campaign state.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      const tabs = charTabsRef.current;
      if (!tabs.some((t) => t.characterId)) return;
      void syncOpenSheetsFromServer();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [syncOpenSheetsFromServer]);

  // Periodic sync while Character mode has at least one saved PC open (complements SSE).
  useEffect(() => {
    if (mode !== MODES.CHARACTER) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isCampaignSseHealthy(sheetSseUnsubRef.current)) return;
      const tabs = charTabsRef.current;
      if (!tabs.some((t) => t.characterId)) return;
      void syncOpenSheetsFromServer();
    }, SHEET_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [mode, syncOpenSheetsFromServer]);

  // ── Load character list ──────────────────────────────────────────────────
  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    setCharactersError(null);
    try {
      const list = await characterAPI.getCharacters({ mine: true });
      const front = (list || []).map(transformBackendToFrontend);
      setCharacters(front);
      return front;
    } catch (err) {
      setCharactersError(err.message || "Failed to load characters");
      setCharacters([]);
      return [];
    } finally {
      setCharactersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCharacters().then(async (front) => {
      if (charTabsInitialized.current) return;
      charTabsInitialized.current = true;

      if (initialCharacterId) {
        const found = front.find((c) => c.id === initialCharacterId);
        if (found) {
          const tab = {
            tabId: nextTabId++,
            characterId: found.id,
            character: found,
          };
          setCharTabs([tab]);
          setActiveCharTabId(tab.tabId);
          return;
        }
        try {
          const raw = await characterAPI.getCharacter(initialCharacterId);
          const ch = transformBackendToFrontend(raw);
          const tab = { tabId: nextTabId++, characterId: ch.id, character: ch };
          setCharTabs([tab]);
          setActiveCharTabId(tab.tabId);
          return;
        } catch {
          // Fall through (e.g. no access or invalid id)
        }
      }
      // #npcs mounts a fresh CharacterPage with preferNpcMode — do not seed a PC
      // tab until the user opens CHARACTERS (avoids phantom "New Character" /
      // autosave when they only wanted NPCs).
      if (preferNpcMode) {
        setCharTabs([]);
        setActiveCharTabId(null);
        return;
      }
      const blank = {
        tabId: nextTabId++,
        characterId: null,
        character: seedBlankCharacter(initialNewCampaignId),
      };
      setCharTabs([blank]);
      setActiveCharTabId(blank.tabId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** When charTabs was left empty (NPC-first mount), add one blank tab before showing PC mode. */
  const seedEmptyCharacterTabs = useCallback(() => {
    setCharTabs((prev) => {
      if (prev.length > 0) return prev;
      const blank = {
        tabId: nextTabId++,
        characterId: null,
        character: createDefaultCharacter(),
      };
      setActiveCharTabId(blank.tabId);
      return [blank];
    });
  }, []);

  // ── Character tab handlers ───────────────────────────────────────────────

  const openCharacterInTab = useCallback((character) => {
    setCharTabs((prev) => {
      const existing = prev.find((t) => t.characterId === character.id);
      if (existing) {
        setActiveCharTabId(existing.tabId);
        return prev;
      }
      const tab = { tabId: nextTabId++, characterId: character.id, character };
      const sorted = sortCharTabs([...prev, tab]);
      setActiveCharTabId(tab.tabId);
      return sorted;
    });
  }, []);

  const handleCreateNewCharacterTab = useCallback(() => {
    const tab = {
      tabId: nextTabId++,
      characterId: null,
      character: createDefaultCharacter(),
    };
    setCharTabs((prev) => sortCharTabs([tab, ...prev]));
    setActiveCharTabId(tab.tabId);
  }, []);

  const handleCloseCharTab = useCallback(
    (tabId) => {
      const tab = charTabs.find((t) => t.tabId === tabId);
      const meta = charTabUnsavedMeta[tabId];
      if (tab && tab.characterId === null) {
        if (meta?.isDirty) {
          if (
            !window.confirm(
              "Discard this unsaved character and close the tab?\n\nPress OK to discard, or Cancel to stay here.",
            )
          )
            return;
        } else if (
          !window.confirm(
            "Discard this unsaved character? Any changes will be lost.",
          )
        )
          return;
      } else if (
        tab?.characterId != null &&
        (meta?.isDirty || meta?.isSaving)
      ) {
        const savingNote = meta?.isSaving
          ? "\n\nA save may still be finishing; leaving now can lose edits if the server has not stored them yet."
          : "";
        if (
          !window.confirm(
            "Close this tab and discard unsaved changes to this character?" +
              savingNote +
              "\n\nPress OK to discard, or Cancel to stay here.",
          )
        )
          return;
      }
      setCharTabs((prev) => {
        const filtered = prev.filter((t) => t.tabId !== tabId);
        if (filtered.length === 0) {
          setActiveCharTabId(null);
          if (typeof window !== "undefined") {
            window.location.hash = "character";
          }
          return [];
        }
        if (activeCharTabId === tabId) {
          const next = filtered[filtered.length - 1];
          setActiveCharTabId(next.tabId);
          const nextId = next.characterId ?? next.character?.id;
          if (typeof window !== "undefined") {
            window.location.hash = nextId
              ? characterHashFromIdAndName(nextId, next.character?.name)
              : "character";
          }
        }
        return filtered;
      });
      setCharTabUnsavedMeta((prev) => {
        const next = { ...prev };
        delete next[tabId];
        return next;
      });
    },
    [activeCharTabId, charTabs, charTabUnsavedMeta],
  );

  const updateActiveCharTab = useCallback(
    (characterId, character) => {
      setCharTabs((prev) => {
        const updated = prev.map((t) =>
          t.tabId === activeCharTabId ? { ...t, characterId, character } : t,
        );
        return sortCharTabs(updated);
      });
    },
    [activeCharTabId],
  );

  const handleCrewNameUpdated = useCallback(
    (crewName, crewId, characterId) => {
      setCharTabs((prev) =>
        prev.map((t) => {
          if (!t.character) return t;
          // Shared crew rename: update every open sheet that uses this crew (same campaign entity)
          if (crewId != null && t.character.crewId === crewId) {
            return {
              ...t,
              character: { ...t.character, crew: crewName, crewId },
            };
          }
          // Solo name or the tab that initiated the change
          if (characterId != null && t.characterId === characterId) {
            return {
              ...t,
              character: {
                ...t.character,
                crew: crewName,
                personal_crew_name: crewId == null ? crewName : "",
                ...(crewId != null ? { crewId } : {}),
              },
            };
          }
          return t;
        }),
      );
      loadCharacters();
    },
    [loadCharacters],
  );

  const handleCharacterReloaded = useCallback(
    (fe) => {
      const tabId = activeCharTabId;
      if (tabId == null || !fe?.id) return;
      setCharTabs((prev) =>
        prev.map((t) => (t.tabId === tabId ? { ...t, character: fe } : t)),
      );
      setCharacters((prev) => prev.map((c) => (c.id === fe.id ? fe : c)));
      const cleared = {
        payload: null,
        isNewCharacter: false,
        isDirty: false,
        isSaving: false,
        dirtyIntent: false,
      };
      charTabUnsavedMetaRef.current = {
        ...(charTabUnsavedMetaRef.current || {}),
        [tabId]: cleared,
      };
      setCharTabUnsavedMeta((prev) => ({ ...prev, [tabId]: cleared }));
      setSheetResetEpoch((n) => n + 1);
    },
    [activeCharTabId],
  );

  // ── Save character ───────────────────────────────────────────────────────
  const handleSaveCharacter = useCallback(
    async (payload, options = {}) => {
      // Ensure trauma reference data is available (mirrors heritage re-fetch fallback below).
      // If the /traumas/ API call failed during initial load, traumas = [] and
      // traumaObjectToIds would silently return [] — erasing all trauma selections.
      let traumaList = normalizeListResponse(traumas);
      if (!traumaList.length) {
        const raw = await referenceAPI.getTraumas().catch(() => null);
        traumaList = normalizeListResponse(raw);
        if (traumaList.length) setTraumas(traumaList);
      }
      const markedTraumaKeys = Object.entries(payload.trauma || {})
        .filter(([, checked]) => checked)
        .map(([k]) => k);
      const traumaIds = traumaObjectToIds(payload.trauma || {}, traumaList);
      if (markedTraumaKeys.length > 0 && traumaIds.length === 0) {
        throw new Error(
          "Could not resolve trauma conditions for save. Refresh the page and try again.",
        );
      }
      const frontend = normalizeSheetPayloadToFrontend(payload, traumaList);
      frontend.trauma = traumaIds;
      let heritageList = normalizeListResponse(heritages);
      if (!heritageList.length) {
        const raw = await referenceAPI.getHeritages().catch(() => null);
        heritageList = normalizeListResponse(raw);
        if (heritageList.length) setHeritages(heritageList);
      }
      const heritageValue = resolveHeritagePkForSave(
        frontend.heritage,
        heritageList,
      );
      // Backend rejects blank true_name; avoid hollow PUT if local name lagged behind loaded character
      let nameForSave = String(frontend.name ?? "").trim();
      if (!nameForSave) {
        if (payload.id) {
          const tab =
            charTabs.find(
              (t) =>
                t.characterId === payload.id || t.character?.id === payload.id,
            ) || charTabs.find((t) => t.tabId === activeCharTabId);
          nameForSave =
            String(tab?.character?.name ?? "").trim() || "New Character";
        } else {
          nameForSave = "New Character";
        }
      }
      const toSend = transformFrontendToBackend({
        ...frontend,
        name: nameForSave,
        heritage: heritageValue,
        campaign: payload.campaign ?? frontend.campaign,
      });
      // Server-owned fields: only include when the sheet marked them touched this draft.
      // Untouched omit lets concurrent roll/GM stress survive the PATCH.
      const touches = payload._fieldTouches || {};
      if (!touches.stress) {
        delete toSend.stress;
      }
      if (!touches.trauma) {
        delete toSend.trauma;
      }
      if (!touches.coin) {
        delete toSend.coin_boxes;
      }
      if (!touches.stash) {
        delete toSend.stash_slots;
      }
      const withFile = {
        ...toSend,
        ...(isImageUploadPayload(frontend.imageFile)
          ? { imageFile: frontend.imageFile }
          : {}),
      };
      const saveOnce = async (savePayload, requestOptions = {}) => {
        // Existing characters must PATCH (partial). PUT was wiping omitted server-owned fields.
        if (payload.id)
          return characterAPI.patchCharacter(payload.id, savePayload, requestOptions);
        return characterAPI.createCharacter(savePayload);
      };
      try {
        let saved;
        try {
          saved = await saveOnce(withFile, options);
        } catch (err) {
          const msg = String(err?.message || "");
          const needsRequiredSelections =
            /Missing required benefits|Missing required detriments/i.test(msg);
          if (!needsRequiredSelections) throw err;

          const repairedFrontend = mergeRequiredHeritageSelections(
            frontend,
            heritageList,
          );
          if (!repairedFrontend) throw err;

          const repairedBackend = transformFrontendToBackend({
            ...repairedFrontend,
            heritage: heritageValue,
            campaign: payload.campaign ?? frontend.campaign,
          });
          if (!touches.stress) {
            delete repairedBackend.stress;
          }
          if (!touches.trauma) {
            delete repairedBackend.trauma;
          }
          if (!touches.coin) {
            delete repairedBackend.coin_boxes;
          }
          if (!touches.stash) {
            delete repairedBackend.stash_slots;
          }
          const repairedWithFile = {
            ...repairedBackend,
            ...(isImageUploadPayload(frontend.imageFile)
              ? { imageFile: frontend.imageFile }
              : {}),
          };
          saved = await saveOnce(repairedWithFile, options);
        }
        if (
          saved?.rejected_fields &&
          typeof saved.rejected_fields === "object" &&
          Object.keys(saved.rejected_fields).length > 0
        ) {
          console.warn(
            "Sheet save: server rejected authoritative fields (stale autosave)",
            saved.rejected_fields,
          );
        }
        // Aborted by a newer local edit — do not write tab character (stale echo).
        if (options?.signal?.aborted) {
          const abortErr = new Error("Save aborted");
          abortErr.name = "AbortError";
          throw abortErr;
        }
        if (!payload.id && saved.id && typeof window !== "undefined")
          window.location.hash = characterHashFromIdAndName(
            saved.id,
            saved.true_name || frontend.name,
          );
        const savedFrontend = transformBackendToFrontend(saved);
        let stashMerged = null;
        if (touches.stash && saved?.id && Array.isArray(frontend.stash)) {
          const crewPk =
            frontend.crewId != null && frontend.crewId !== ""
              ? parseInt(String(frontend.crewId), 10)
              : NaN;
          if (Number.isFinite(crewPk) && crewPk > 0) {
            const localStash = normalizeStashSlots(frontend.stash);
            // User emptied stash while touch set → allow wipe (do not skip).
            try {
              const crewUpdated = await crewAPI.patchCrew(crewPk, {
                stash_slots: localStash,
              });
              stashMerged = Array.isArray(crewUpdated?.stash_slots)
                ? normalizeStashSlots(crewUpdated.stash_slots)
                : localStash;
            } catch (e) {
              console.error("Crew stash save failed:", e);
              // Keep parent draft dirty: fail the save so CharacterSheet retains
              // stash field-touch and does not hydrate over local grid.
              const err = new Error(
                e?.message || "Crew stash save failed — try again",
              );
              err.cause = e;
              throw err;
            }
          }
        }
        const serverEchoesFullHarm =
          saved &&
          Object.prototype.hasOwnProperty.call(saved, "harm_level1_slot2_used");
        const mergedHarm = serverEchoesFullHarm
          ? normalizeHarmObject(savedFrontend.harm)
          : normalizeHarmObject({
              ...EMPTY_HARM_SHAPE,
              ...savedFrontend.harm,
              ...frontend.harm,
            });
        const traumaFromPayload =
          payload.trauma &&
          typeof payload.trauma === "object" &&
          !Array.isArray(payload.trauma)
            ? {
                ...createDefaultCharacter().trauma,
                ...payload.trauma,
              }
            : null;
        // Preserve crew from payload: backend has crew as read_only FK, so it returns '' when we send a string.
        // Without this merge, character.crew becomes '' after save, causing a perceived "change" and save loop.
        const merged = {
          ...savedFrontend,
          // Prefer the draft we just sent for chargen placements — a late older
          // PATCH echo must not snap action dots / Stand Coin back.
          actionRatings:
            frontend.actionRatings ?? savedFrontend.actionRatings,
          standStats: frontend.standStats ?? savedFrontend.standStats,
          crew: payload.crew ?? savedFrontend.crew,
          crewId: payload.crewId ?? savedFrontend.crewId,
          image: savedFrontend.image,
          image_url: isImageUploadPayload(payload.imageFile)
            ? savedFrontend.image_url || ""
            : (payload.image_url ?? savedFrontend.image_url),
          vice: payload.vice ?? savedFrontend.vice,
          viceDetails:
            payload.viceDetails ??
            payload.vice_details ??
            savedFrontend.viceDetails,
          closeFriend:
            payload.closeFriend ??
            payload.close_friend ??
            savedFrontend.closeFriend,
          rival: payload.rival ?? savedFrontend.rival,
          personal_crew_name:
            payload.personal_crew_name ??
            savedFrontend.personal_crew_name ??
            "",
          harm: mergedHarm,
          harmEntries: mergedHarm,
          // If API omits coin_boxes on the response, normalizeCoinBoxes(undefined) is all false and the sheet reverts.
          // Prefer the payload we just saved when the server did not echo coin_boxes (undefined). null is a valid echo.
          coin:
            saved && Object.prototype.hasOwnProperty.call(saved, "coin_boxes")
              ? savedFrontend.coin
              : (frontend.coin ?? savedFrontend.coin),
          // Same class of bug as coin: if trauma_details is omitted on PUT/POST body, checkboxes would clear after save.
          trauma:
            saved && Object.prototype.hasOwnProperty.call(saved, "trauma_details")
              ? savedFrontend.trauma
              : (traumaFromPayload ?? savedFrontend.trauma),
          // Stress omitted from PATCH when untouched: trust the server echo so a
          // stale local count cannot hide roll/GM marks. When the player did
          // touch stress (trauma-clear), prefer the draft so a lagged echo
          // cannot refill the track to 9.
          stressFilled: !touches.stress
            ? savedFrontend.stressFilled
            : typeof payload.stressFilled === "number"
              ? Math.max(0, Math.floor(payload.stressFilled))
              : savedFrontend.stressFilled,
          playbookXpArchetypes:
            saved &&
            Object.prototype.hasOwnProperty.call(saved, "playbook_xp_archetypes")
              ? savedFrontend.playbookXpArchetypes
              : (frontend.playbookXpArchetypes ??
                payload.playbookXpArchetypes ??
                savedFrontend.playbookXpArchetypes),
          // Same class of bug as coin: empty character stash_slots must not beat crew effective_stash_slots.
          stash: resolveStashAfterCharacterSave({
            stashMerged,
            savedFrontend,
            frontend,
          }),
          // Prefer payload ∪ echo so a weak/partial PATCH response cannot blank local rows.
          inventory: (() => {
            const fromPayload = normalizeCharacterInventory(
              frontend.inventory ?? payload.inventory,
            );
            const fromServer = normalizeCharacterInventory(
              savedFrontend.inventory,
            );
            const touchesInv = payload._fieldTouches?.inventory;
            if (touchesInv) return fromPayload;
            if (
              saved &&
              Object.prototype.hasOwnProperty.call(saved, "inventory") &&
              fromServer.length > 0 &&
              fromPayload.length === 0
            ) {
              return fromServer;
            }
            if (fromPayload.length > 0) return fromPayload;
            return fromServer.length > 0 ? fromServer : fromPayload;
          })(),
          sheetNotes: (() => {
            const fromPayload =
              payload.sheetNotes ?? frontend.sheetNotes ?? "";
            if (
              saved &&
              Object.prototype.hasOwnProperty.call(saved, "background_note2")
            ) {
              const echoed = savedFrontend.sheetNotes ?? "";
              // Empty echo with non-empty payload → keep payload (weak echo).
              if (!String(echoed).trim() && String(fromPayload).trim()) {
                return fromPayload;
              }
              return echoed;
            }
            return fromPayload || savedFrontend.sheetNotes || "";
          })(),
          // Same class as notes/inventory: empty npc_standing echo must not wipe local −/+ edits.
          npcStanding: (() => {
            const fromPayload =
              frontend.npcStanding ??
              payload.npcStanding ??
              payload.npc_standing ??
              {};
            const fromServer = savedFrontend.npcStanding ?? {};
            const payloadKeys = Object.keys(fromPayload || {});
            const serverKeys = Object.keys(fromServer || {});
            if (
              saved &&
              Object.prototype.hasOwnProperty.call(saved, "npc_standing")
            ) {
              if (serverKeys.length === 0 && payloadKeys.length > 0) {
                return { ...fromPayload };
              }
              return { ...fromServer };
            }
            return payloadKeys.length > 0
              ? { ...fromPayload }
              : { ...fromServer };
          })(),
          // Prefer richer payload customs when echo lost/weakened the unique package.
          abilities: mergeAbilitiesPreferRicherCustoms(
            Array.isArray(frontend.abilities) ? frontend.abilities : [],
            Array.isArray(savedFrontend.abilities)
              ? savedFrontend.abilities
              : [],
            { emptyPreferredClearsCustoms: true },
          ),
        };
        if (options?.signal?.aborted) {
          const abortErr = new Error("Save aborted");
          abortErr.name = "AbortError";
          throw abortErr;
        }
        updateActiveCharTab(merged.id, merged);
        await loadCharacters();
      } catch (err) {
        console.error("Save character failed:", err);
        throw err;
      }
    },
    [
      traumas,
      heritages,
      loadCharacters,
      updateActiveCharTab,
      charTabs,
      activeCharTabId,
    ],
  );

  const handleSwitchCharacter = useCallback(
    async (character) => {
      if (!(mode === MODES.CHARACTER)) return;
      const activeTab = charTabs.find((t) => t.tabId === activeCharTabId);
      const activeMeta =
        activeCharTabId != null ? charTabUnsavedMeta[activeCharTabId] : null;
      if (activeMeta?.isDirty || activeMeta?.isSaving) {
        const isNew = activeTab?.characterId == null;
        const saveNow = window.confirm(
          isNew
            ? "This new character has unsaved changes.\n\nPress OK to save now.\nPress Cancel for discard options."
            : "This character has unsaved changes.\n\nPress OK to save now.\nPress Cancel for discard options.",
        );
        if (saveNow) {
          try {
            await handleSaveCharacter(activeMeta.payload);
          } catch {
            window.alert("Couldn't save the character. Please fix errors and try again.");
            return;
          }
        } else if (
          !window.confirm(
            isNew
              ? "Discard this unsaved character and continue?\n\nPress OK to discard, or Cancel to stay here."
              : "Discard unsaved changes and continue?\n\nPress OK to discard, or Cancel to stay here.",
          )
        ) {
          return;
        }
      }
      if (!character) {
        handleCreateNewCharacterTab();
        return;
      }
      openCharacterInTab(character);
    },
    [
      mode,
      charTabs,
      activeCharTabId,
      charTabUnsavedMeta,
      handleSaveCharacter,
      handleCreateNewCharacterTab,
      openCharacterInTab,
    ],
  );

  // ── NPC logic: when initialNpcId is set (e.g. from #npcs/123), fetch and open/focus that NPC
  useEffect(() => {
    if (initialNpcId == null || mode !== MODES.NPC) return;
    setNpcsLoading(true);
    npcAPI
      .getNPC(initialNpcId)
      .then((npc) => {
        if (!npc) return;
        npcTabsInitialized.current = true;
        setNpcTabs((prev) => {
          const existing = prev.find((t) => t.npcId === npc.id);
          if (existing) {
            setActiveNpcTabId(existing.tabId);
            return prev;
          }
          const tab = {
            tabId: nextTabId++,
            npcId: npc.id,
            npc,
            label: npc.name || "New NPC",
          };
          setActiveNpcTabId(tab.tabId);
          return [...prev, tab];
        });
        npcAPI
          .getNPCs(campaignId)
          .then((list) => setNpcs(list || []))
          .catch(() => setNpcs([]));
      })
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));
  }, [initialNpcId, mode, campaignId]);

  // ── NPC logic: normal load when no initialNpcId
  useEffect(() => {
    if (mode !== MODES.NPC || initialNpcId != null) return;
    setNpcsLoading(true);
    npcAPI
      .getNPCs(campaignId)
      .then((list) => {
        const npcList = list || [];
        setNpcs(npcList);
        if (!npcTabsInitialized.current) {
          const seededCampaign =
            initialNpcCampaignId != null ? initialNpcCampaignId : null;
          npcTabsInitialized.current = true;
          const tab = {
            tabId: nextTabId++,
            npcId: null,
            npc: seededCampaign ? { campaign: seededCampaign } : null,
            label: "New NPC",
          };
          setNpcTabs([tab]);
          setActiveNpcTabId(tab.tabId);
        }
      })
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));
  }, [mode, campaignId, initialNpcId, initialNpcCampaignId]);

  // NPC list for the toolbar "Open NPC…" while in character mode (no loading gate).
  useEffect(() => {
    if (mode !== MODES.CHARACTER) return;
    npcAPI
      .getNPCs(campaignId)
      .then((list) => setNpcs(list || []))
      .catch(() => {});
  }, [mode, campaignId]);

  const handleSaveNpc = useCallback(
    async (npcData) => {
      if (!userCanEditNpcSheet(user, npcData, campaigns)) {
        const err = new Error("You do not have permission to edit this NPC.");
        console.error("Save NPC refused:", err);
        throw err;
      }
      try {
        const nameTrim = String(npcData.name ?? "").trim();
        const payload = { ...npcData, name: nameTrim || "New NPC" };
        let result;
        if (payload.id) {
          result = await npcAPI.updateNPC(payload.id, payload);
        } else {
          result = await npcAPI.createNPC(payload);
        }
        // Bind save to the tab that owns this NPC id — never the current active
        // tab. Hidden sheets keep debounced autosaves; using activeNpcTabId
        // here clobbered newly opened tabs and rewrote the hash (duplicate
        // labels / wrong sheet).
        let savedOntoTabId = null;
        setNpcTabs((prev) => {
          const target =
            payload.id != null
              ? prev.find(
                  (t) =>
                    Number(t.npcId) === Number(payload.id) ||
                    Number(t.npc?.id) === Number(payload.id),
                )
              : prev.find(
                  (t) => t.tabId === activeNpcTabId && t.npcId == null,
                );
          if (!target) return prev;
          savedOntoTabId = target.tabId;
          return prev.map((t) =>
            t.tabId === target.tabId
              ? {
                  ...t,
                  npcId: result.id,
                  npc: result,
                  label: result.name || "New NPC",
                }
              : t,
          );
        });
        if (
          savedOntoTabId != null &&
          savedOntoTabId === activeNpcTabId &&
          result.id &&
          typeof window !== "undefined"
        ) {
          window.location.hash = `npcs/${result.id}`;
        }
        const list = await npcAPI.getNPCs(campaignId);
        setNpcs(list || []);
        return result;
      } catch (err) {
        console.error("Save NPC failed:", err);
        throw err;
      }
    },
    [campaignId, activeNpcTabId, user, campaigns],
  );

  const handleCreateNewNpcTab = useCallback(() => {
    const tab = {
      tabId: nextTabId++,
      npcId: null,
      npc: null,
      label: "New NPC",
    };
    setNpcTabs((prev) => [...prev, tab]);
    setActiveNpcTabId(tab.tabId);
  }, []);

  const handleCloseNpcTab = useCallback(
    (tabId) => {
      const tab = npcTabs.find((t) => t.tabId === tabId);
      if (tab && tab.npcId === null) {
        if (
          !window.confirm("Discard this unsaved NPC? Any changes will be lost.")
        ) {
          return;
        }
      }
      setNpcTabs((prev) => {
        const filtered = prev.filter((t) => t.tabId !== tabId);
        if (filtered.length === 0) {
          setActiveNpcTabId(null);
          if (typeof window !== "undefined") window.location.hash = "npcs";
          return [];
        }
        if (activeNpcTabId === tabId) {
          const next = filtered[filtered.length - 1];
          setActiveNpcTabId(next.tabId);
          const nextId = next.npcId ?? next.npc?.id;
          if (typeof window !== "undefined") {
            window.location.hash = nextId ? `npcs/${nextId}` : "npcs";
          }
        }
        return filtered;
      });
    },
    [activeNpcTabId, npcTabs],
  );

  const handleOpenExistingNpc = useCallback(
    (npc) => {
      const existing = npcTabs.find((t) => t.npcId === npc.id);
      if (existing) {
        setActiveNpcTabId(existing.tabId);
        if (typeof window !== "undefined")
          window.location.hash = `npcs/${npc.id}`;
        return;
      }
      const tab = {
        tabId: nextTabId++,
        npcId: npc.id,
        npc,
        label: npc.name || "New NPC",
      };
      setNpcTabs((prev) => [...prev, tab]);
      setActiveNpcTabId(tab.tabId);
      if (typeof window !== "undefined")
        window.location.hash = `npcs/${npc.id}`;
    },
    [npcTabs],
  );

  // ── Derived values ───────────────────────────────────────────────────────
  const activeCharTab = charTabs.find((t) => t.tabId === activeCharTabId);
  // Ensure `id` is present for autosave PUT when tab has characterId but character object lagged (e.g. race).
  const sheetCharacter = useMemo(() => {
    const base = activeCharTab?.character ?? createDefaultCharacter();
    const tid = activeCharTab?.characterId;
    if (tid != null && base.id == null) {
      return { ...base, id: tid };
    }
    return base;
  }, [activeCharTab]);

  const sheetCampaignContext = useMemo(
    () => resolveCharacterCampaignContext(sheetCharacter, campaigns),
    [sheetCharacter, campaigns],
  );

  const campaignIdForRealtime = sheetCampaignContext.campaignId;

  const sheetCharacterIsGM = useMemo(
    () =>
      isUserCampaignGmForCharacter(user, {
        campaignRecord: sheetCampaignContext.campaignRecord,
        campaignId: sheetCampaignContext.campaignId,
      }),
    [user, sheetCampaignContext],
  );

  useEffect(() => {
    if (mode !== MODES.CHARACTER || !campaignIdForRealtime) {
      sheetSseUnsubRef.current = null;
      return undefined;
    }
    const unsub = subscribeCampaignEvents(campaignIdForRealtime, {
      onUpdate: (reason) => {
        const r = String(reason || "update");
        if (SHEET_ABORT_SSE_REASONS.has(r)) {
          setSheetRealtimeReason(r);
        }
        void syncOpenSheetsFromServer();
      },
    });
    sheetSseUnsubRef.current = unsub;
    return () => {
      sheetSseUnsubRef.current = null;
      unsub();
    };
  }, [
    mode,
    campaignIdForRealtime,
    syncOpenSheetsFromServer,
    SHEET_ABORT_SSE_REASONS,
  ]);

  useEffect(() => {
    if (mode !== MODES.CHARACTER) {
      document.title = "1(800)BIZARRE";
      return;
    }
    const id = sheetCharacter?.id;
    if (id == null || id === "") {
      document.title = "1(800)BIZARRE";
      return;
    }
    const disp =
      String(sheetCharacter?.name || "").trim() || `Character ${id}`;
    document.title = `${disp} — Character`;
  }, [mode, sheetCharacter?.id, sheetCharacter?.name]);

  useEffect(() => {
    if (mode !== MODES.CHARACTER) return;
    const id = sheetCharacter?.id;
    if (id == null || id === "") return;
    if (typeof window === "undefined") return;
    const next = characterHashFromIdAndName(id, sheetCharacter?.name);
    const cur = window.location.hash.replace(/^#/, "");
    if (cur === next) return;
    const url = new URL(window.location.href);
    url.hash = next;
    window.history.replaceState(null, "", url.toString());
  }, [mode, sheetCharacter?.id, sheetCharacter?.name]);

  const activeNpcTab = npcTabs.find((t) => t.tabId === activeNpcTabId);

  const handleDeleteActiveCharacter = useCallback(() => {
    const id = activeCharTab?.characterId ?? activeCharTab?.character?.id;
    if (!id) {
      window.alert(
        "This character is not saved yet. Close the tab to discard, or save first.",
      );
      return;
    }
    const name =
      activeCharTab?.character?.name ||
      activeCharTab?.character?.standName ||
      `Character ${id}`;
    setDeleteConfirm({
      kind: "character",
      id,
      message: `Delete character “${name}” permanently? This cannot be undone.`,
    });
  }, [activeCharTab]);

  const handleDeleteActiveNpc = useCallback(() => {
    const id = activeNpcTab?.npcId ?? activeNpcTab?.npc?.id;
    if (!id) {
      window.alert(
        "This NPC is not saved yet. Close the tab to discard, or save first.",
      );
      return;
    }
    const name =
      activeNpcTab?.npc?.name ||
      activeNpcTab?.npc?.stand_name ||
      `NPC ${id}`;
    setDeleteConfirm({
      kind: "npc",
      id,
      message: `Delete NPC “${name}” permanently? This cannot be undone.`,
    });
  }, [activeNpcTab]);

  const handleConfirmEntityDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const pending = deleteConfirm;
    setDeleteConfirmBusy(true);
    try {
      if (pending.kind === "character") {
        const id = pending.id;
        setCharactersError(null);
        await characterAPI.deleteCharacter(id);
        setCharacters((prev) => prev.filter((c) => c.id !== id));
        setCharTabs((prev) => {
          const filtered = prev.filter(
            (t) => (t.characterId ?? t.character?.id) !== id,
          );
          if (filtered.length === 0) {
            const blank = {
              tabId: nextTabId++,
              characterId: null,
              character: createDefaultCharacter(),
            };
            setActiveCharTabId(blank.tabId);
            if (typeof window !== "undefined")
              window.location.hash = "character";
            return [blank];
          }
          const nextActive = filtered.some((t) => t.tabId === activeCharTabId)
            ? activeCharTabId
            : filtered[filtered.length - 1].tabId;
          setActiveCharTabId(nextActive);
          const nextTab = filtered.find((t) => t.tabId === nextActive);
          const nextHashId = nextTab?.characterId ?? nextTab?.character?.id;
          if (typeof window !== "undefined") {
            window.location.hash = nextHashId
              ? characterHashFromIdAndName(
                  nextHashId,
                  nextTab?.character?.name,
                )
              : "character";
          }
          return sortCharTabs(filtered);
        });
        setDeleteConfirm(null);
        return;
      }
      if (pending.kind === "npc") {
        const id = pending.id;
        const filtered = npcTabs.filter((t) => (t.npcId ?? t.npc?.id) !== id);
        await npcAPI.deleteNPC(id);
        setNpcs((prev) => prev.filter((n) => n.id !== id));
        setDeleteConfirm(null);
        if (filtered.length === 0) {
          setNpcTabs([]);
          setActiveNpcTabId(null);
          seedEmptyCharacterTabs();
          setMode(MODES.CHARACTER);
          if (typeof window !== "undefined")
            window.location.hash = "character";
          return;
        }
        const nextActive = filtered.some((t) => t.tabId === activeNpcTabId)
          ? activeNpcTabId
          : filtered[filtered.length - 1].tabId;
        setNpcTabs(filtered);
        setActiveNpcTabId(nextActive);
        const nextTab = filtered.find((t) => t.tabId === nextActive);
        const nextHashId = nextTab?.npcId ?? nextTab?.npc?.id;
        if (typeof window !== "undefined") {
          window.location.hash = nextHashId ? `npcs/${nextHashId}` : "npcs";
        }
      }
    } catch (e) {
      if (pending.kind === "character") {
        setCharactersError(e.message || "Failed to delete character");
      } else {
        window.alert(e.message || "Failed to delete NPC");
      }
    } finally {
      setDeleteConfirmBusy(false);
    }
  }, [
    deleteConfirm,
    activeCharTabId,
    activeNpcTabId,
    npcTabs,
    seedEmptyCharacterTabs,
  ]);
  const saveActiveUnsavedCharacter = useCallback(async () => {
    const tab = charTabs.find((t) => t.tabId === activeCharTabId);
    if (!isUnsavedCharacterDirty(tab)) return true;
    try {
      await handleSaveCharacter(tab.character || createDefaultCharacter());
      return true;
    } catch (error) {
      console.error("Auto-save for unsaved character failed:", error);
      window.alert(
        "Could not save this unsaved character. Please save manually before navigating away.",
      );
      return false;
    }
  }, [activeCharTabId, charTabs, handleSaveCharacter]);

  const guardUnsavedCharacterNavigation = useCallback(
    async (onContinue, options = {}) => {
      const { allowSave = true, discardMessage } = options;
      const tab = charTabs.find((t) => t.tabId === activeCharTabId);
      const meta = activeCharTabId != null ? charTabUnsavedMeta[activeCharTabId] : null;
      const hasDraft =
        !!meta?.isDirty || !!meta?.isSaving || isUnsavedCharacterDirty(tab);
      if (!hasDraft) {
        onContinue?.();
        return true;
      }
      const isNew = tab?.characterId == null;
      const savePrompt = isNew
        ? "This new character has unsaved changes. Press OK to save before continuing, or Cancel to choose whether to discard changes."
        : "This character has unsaved changes. Press OK to save before continuing, or Cancel to stay or discard.";
      if (allowSave && window.confirm(savePrompt)) {
        try {
          if (isNew) {
            const saved = await saveActiveUnsavedCharacter();
            if (!saved) return false;
          } else {
            await handleSaveCharacter(meta?.payload || tab?.character);
          }
          onContinue?.();
          return true;
        } catch {
          window.alert("Save failed. Fix errors or stay on the page.");
          return false;
        }
      }
      const discardConfirmed = window.confirm(
        discardMessage ||
          (isNew
            ? "Discard this unsaved character? Any changes will be lost."
            : "Discard unsaved changes?"),
      );
      if (!discardConfirmed) return false;
      onContinue?.();
      return true;
    },
    [
      activeCharTabId,
      charTabs,
      charTabUnsavedMeta,
      saveActiveUnsavedCharacter,
      handleSaveCharacter,
    ],
  );

  useEffect(() => {
    if (!onRegisterNavigationGuard) return undefined;
    const runGuard = async () => {
      if (mode !== MODES.CHARACTER) return true;
      const meta =
        activeCharTabId != null ? charTabUnsavedMeta[activeCharTabId] : null;
      const tab = charTabs.find((t) => t.tabId === activeCharTabId);
      const hasDraft =
        !!meta?.isDirty || !!meta?.isSaving || isUnsavedCharacterDirty(tab);
      if (!hasDraft) return true;
      const isNew = tab?.characterId == null;
      const savePrompt = isNew
        ? "Save the new character before leaving this app section?\n\nOK — save and go.\nCancel — stay or discard."
        : "Save character changes before leaving this app section?\n\nOK — save and go.\nCancel — stay or discard.";
      if (window.confirm(savePrompt)) {
        try {
          if (isNew) {
            const ok = await saveActiveUnsavedCharacter();
            if (!ok) return false;
          } else {
            await handleSaveCharacter(meta?.payload || tab?.character);
          }
          return true;
        } catch {
          window.alert("Save failed.");
          return false;
        }
      }
      return window.confirm(
        isNew
          ? "Leave without saving? This new character will be lost if you have not saved."
          : "Leave without saving your latest edits?",
      );
    };
    onRegisterNavigationGuard(() => runGuard());
    return () => onRegisterNavigationGuard(null);
  }, [
    onRegisterNavigationGuard,
    mode,
    activeCharTabId,
    charTabUnsavedMeta,
    charTabs,
    saveActiveUnsavedCharacter,
    handleSaveCharacter,
  ]);

  useEffect(() => {
    const needsGuard = Object.values(charTabUnsavedMeta).some(
      (m) => m?.isDirty || m?.isSaving,
    );
    if (!needsGuard || typeof window === "undefined") return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [charTabUnsavedMeta]);

  const handleOpenNpcFromCharacterToolbar = useCallback(
    (npc) => {
      void guardUnsavedCharacterNavigation(() => {
        const path =
          (typeof window !== "undefined" && window.location.hash.slice(1)) || "";
        const onNpcRoute = path === "npcs" || path.startsWith("npcs/");
        if (onNpcRoute) {
          setMode(MODES.NPC);
          handleOpenExistingNpc(npc);
          return;
        }
        if (typeof window !== "undefined") {
          window.location.hash = `npcs/${npc.id}`;
        }
      });
    },
    [guardUnsavedCharacterNavigation, handleOpenExistingNpc],
  );

  const handleOpenNpcFromNpcSheet = useCallback(
    (targetNpc) => {
      if (!targetNpc?.id) return;
      const fromList = npcs.find((n) => Number(n.id) === Number(targetNpc.id));
      handleOpenExistingNpc(fromList || targetNpc);
    },
    [npcs, handleOpenExistingNpc],
  );

  const handleOpenCharacterFromNpcSheet = useCallback(
    (targetChar) => {
      if (!targetChar?.id) return;
      void (async () => {
        try {
          const fromList = characters.find(
            (c) => Number(c.id) === Number(targetChar.id),
          );
          let front = fromList;
          if (!front) {
            const raw = await characterAPI.getCharacter(targetChar.id);
            front = transformBackendToFrontend(raw);
          }
          setMode(MODES.CHARACTER);
          openCharacterInTab(front);
          if (typeof window !== "undefined") {
            window.location.hash = characterHashFromIdAndName(
              front.id,
              front.name || front.true_name || front.alias,
            );
          }
        } catch (err) {
          console.error("Open character from NPC contacts failed:", err);
        }
      })();
    },
    [characters, openCharacterInTab],
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={PAGE_STYLES.page}>
      {/* ── Top bar ── */}
      <div style={PAGE_STYLES.modeBar} className="character-page-mode-bar">
        <nav style={PAGE_STYLES.modeBarLeft}>
          <button
            type="button"
            onClick={() => {
              const hashId =
                charTabs.length > 0
                  ? activeCharTab?.characterId ?? activeCharTab?.character?.id
                  : null;
              setMode(MODES.CHARACTER);
              if (typeof window !== "undefined") {
                window.location.hash = hashId
                  ? characterHashFromIdAndName(
                      hashId,
                      activeCharTab?.character?.name,
                    )
                  : "character";
              }
            }}
            style={PAGE_STYLES.modeBtn(mode === MODES.CHARACTER)}
          >
            CHARACTERS
          </button>
          <button
            type="button"
            onClick={() => {
              void guardUnsavedCharacterNavigation(() => {
                setMode(MODES.NPC);
                const id = activeNpcTab?.npcId ?? activeNpcTab?.npc?.id;
                if (typeof window !== "undefined")
                  window.location.hash = id ? `npcs/${id}` : "npcs";
              });
            }}
            style={PAGE_STYLES.modeBtn(mode === MODES.NPC)}
          >
            NPCs
          </button>

          {/* ── Character tabs ── */}
          {mode === MODES.CHARACTER && charTabs.length > 0 && (
            <>
              <div style={TAB_STYLES.divider} />
              {charTabs.map((tab) => (
                <button
                  key={tab.tabId}
                  type="button"
                  onClick={() => {
                    if (tab.tabId === activeCharTabId) return;
                    void guardUnsavedCharacterNavigation(() =>
                      setActiveCharTabId(tab.tabId),
                    );
                  }}
                  style={TAB_STYLES.tab(tab.tabId === activeCharTabId)}
                >
                  <span>{charTabLabel(tab)}</span>
                  <span
                    style={TAB_STYLES.close}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseCharTab(tab.tabId);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  void guardUnsavedCharacterNavigation(() =>
                    handleCreateNewCharacterTab(),
                  );
                }}
                style={TAB_STYLES.addBtn}
              >
                + New Character
              </button>
            </>
          )}

          {/* ── NPC tabs (+ New NPC always in NPC mode so empty list can create first tab) ── */}
          {mode === MODES.NPC && (
            <>
              <div style={TAB_STYLES.divider} />
              {npcTabs.map((tab) => (
                <button
                  key={tab.tabId}
                  type="button"
                  onClick={() => setActiveNpcTabId(tab.tabId)}
                  style={TAB_STYLES.tab(tab.tabId === activeNpcTabId)}
                >
                  <span>{tab.label}</span>
                  <span
                    style={TAB_STYLES.close}
                    title="Close tab"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseNpcTab(tab.tabId);
                    }}
                  >
                    ×
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={handleCreateNewNpcTab}
                style={TAB_STYLES.addBtn}
              >
                + New NPC
              </button>
            </>
          )}
        </nav>

        {/* Right side: error banner + "Open…" dropdowns */}
        <div style={PAGE_STYLES.modeBarRight}>
          {charactersError && (
            <span style={{ fontSize: "12px", color: "#fca5a5" }}>
              {charactersError}
            </span>
          )}

          {mode === MODES.CHARACTER && (
            <>
              {characters.length > 0 && (
                <select
                  style={PAGE_STYLES.modeSelect}
                  value=""
                  onChange={(e) => {
                    const char = characters.find(
                      (c) => c.id === parseInt(e.target.value, 10),
                    );
                    if (char) {
                      void guardUnsavedCharacterNavigation(() =>
                        openCharacterInTab(char),
                      );
                    }
                  }}
                >
                  <option value="">Open character...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.standName || "New Character"}
                    </option>
                  ))}
                </select>
              )}
              <select
                style={PAGE_STYLES.modeSelect}
                value=""
                onChange={(e) => {
                  const npc = npcs.find(
                    (n) => n.id === parseInt(e.target.value, 10),
                  );
                  if (npc) handleOpenNpcFromCharacterToolbar(npc);
                }}
              >
                <option value="">Open NPC...</option>
                {npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name || "New NPC"}
                  </option>
                ))}
              </select>
              {characters.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteActiveCharacter}
                  title="Delete the character open in the active tab (permanent)"
                  style={{
                    background: "#450a0a",
                    color: "#fecaca",
                    border: "1px solid #991b1b",
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    borderRadius: "4px",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  Delete character
                </button>
              )}
            </>
          )}

          {mode === MODES.NPC && (
            <>
              {characters.length > 0 && (
                <select
                  style={PAGE_STYLES.modeSelect}
                  value=""
                  onChange={(e) => {
                    const char = characters.find(
                      (c) => c.id === parseInt(e.target.value),
                    );
                    if (char) {
                      void guardUnsavedCharacterNavigation(() => {
                        setMode(MODES.CHARACTER);
                        openCharacterInTab(char);
                        if (typeof window !== "undefined") {
                          window.location.hash = characterHashFromIdAndName(
                          char.id,
                          char.name,
                        );
                        }
                      });
                    }
                  }}
                >
                  <option value="">Open character...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.standName || "New Character"}
                    </option>
                  ))}
                </select>
              )}
              <select
                style={PAGE_STYLES.modeSelect}
                value=""
                onChange={(e) => {
                  const npc = npcs.find(
                    (n) => n.id === parseInt(e.target.value),
                  );
                  if (npc) handleOpenExistingNpc(npc);
                }}
              >
                <option value="">Open NPC...</option>
                {npcs.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name || "New NPC"}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDeleteActiveNpc}
                title="Delete the NPC open in the active tab (permanent)"
                style={{
                  background: "#450a0a",
                  color: "#fecaca",
                  border: "1px solid #991b1b",
                  padding: "4px 10px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  borderRadius: "4px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Delete NPC
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Character mode ── */}
      {mode === MODES.CHARACTER &&
        (charactersLoading && charTabs.length === 0 ? (
          <div
            style={{
              ...PAGE_STYLES.content,
              padding: "24px",
              textAlign: "center",
              color: "#9ca3af",
            }}
          >
            Loading characters...
          </div>
        ) : charTabs.length === 0 ? (
          <div
            style={{
              ...PAGE_STYLES.content,
              padding: "32px 24px",
              maxWidth: 420,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: "#e5e7eb",
                marginBottom: "8px",
                fontFamily: "monospace",
              }}
            >
              Choose a character to view
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#9ca3af",
                marginBottom: "16px",
                lineHeight: 1.45,
              }}
            >
              Open an existing character, or start a new blank sheet.
            </div>
            {characters.length > 0 ? (
              <select
                aria-label="Choose character to view"
                style={{
                  ...PAGE_STYLES.modeSelect,
                  width: "100%",
                  marginBottom: "10px",
                  color: "#e5e7eb",
                }}
                value=""
                onChange={(e) => {
                  const id = parseInt(e.target.value, 10);
                  e.target.value = "";
                  if (!Number.isFinite(id)) return;
                  const char = characters.find((c) => Number(c.id) === id);
                  if (!char) return;
                  openCharacterInTab(char);
                  if (typeof window !== "undefined") {
                    window.location.hash = characterHashFromIdAndName(
                      char.id,
                      char.name,
                    );
                  }
                }}
              >
                <option value="">Select character…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.standName || `Character #${c.id}`}
                  </option>
                ))}
              </select>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  color: "#6b7280",
                  marginBottom: "10px",
                }}
              >
                No saved characters yet.
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                handleCreateNewCharacterTab();
                if (typeof window !== "undefined") {
                  window.location.hash = "character";
                }
              }}
              style={{
                ...PAGE_STYLES.modeSelect,
                width: "100%",
                cursor: "pointer",
                borderStyle: "dashed",
                color: "#93c5fd",
                borderColor: "#1d4ed8",
              }}
            >
              + New Character
            </button>
          </div>
        ) : (
          <CharacterSheetWrapper
            key={`${activeCharTab?.tabId ?? "new"}-${sheetResetEpoch}`}
            character={sheetCharacter}
            sheetDraftIsDirty={
              activeCharTabId != null &&
              sheetTabIsProtected(charTabUnsavedMeta[activeCharTabId])
            }
            heritages={heritages}
            heritagesLoading={heritagesLoading}
            heritagesError={heritagesError}
            onRetryHeritages={loadReferenceData}
            allCharacters={characters}
            campaigns={campaigns}
            isGM={sheetCharacterIsGM}
            onSave={handleSaveCharacter}
            onCreateNew={handleCreateNewCharacterTab}
            onSwitchCharacter={handleSwitchCharacter}
            onCrewNameUpdated={handleCrewNameUpdated}
            onCampaignRefresh={refreshCampaigns}
            onCharacterReloaded={handleCharacterReloaded}
            sessionDataPollTick={sheetPollTick}
            sheetRealtimeReason={sheetRealtimeReason}
            onSheetRealtimeReasonHandled={() => setSheetRealtimeReason("")}
            onDraftMetaChange={(meta) => {
              const tabId = activeCharTab?.tabId;
              if (tabId == null) return;
              // Sync ref immediately so poll/SSE protect sees dirtyIntent
              // before React re-renders (edit→meta same-tick race).
              charTabUnsavedMetaRef.current = {
                ...(charTabUnsavedMetaRef.current || {}),
                [tabId]: meta,
              };
              setCharTabUnsavedMeta((prev) => ({
                ...prev,
                [tabId]: meta,
              }));
            }}
            onCharacterXpSync={(patch) => {
              const tabId = activeCharTabId;
              if (tabId == null || !patch) return;
              setCharTabs((prev) =>
                prev.map((t) => {
                  if (t.tabId !== tabId || !t.character) return t;
                  return {
                    ...t,
                    character: {
                      ...t.character,
                      ...(patch.xp ? { xp: patch.xp } : {}),
                      ...(typeof patch.unallocatedXp === "number"
                        ? { unallocatedXp: patch.unallocatedXp }
                        : {}),
                      ...(patch.actionRatings
                        ? { actionRatings: patch.actionRatings }
                        : {}),
                      ...(patch.standStats
                        ? { standStats: patch.standStats }
                        : {}),
                      ...(typeof patch.actionDiceGained === "number"
                        ? { actionDiceGained: patch.actionDiceGained }
                        : {}),
                    },
                  };
                }),
              );
            }}
            onCharacterStressTraumaSync={(patch) => {
              const tabId = activeCharTabId;
              if (tabId == null || !patch) return;
              setCharTabs((prev) =>
                prev.map((t) => {
                  if (t.tabId !== tabId || !t.character) return t;
                  return {
                    ...t,
                    character: {
                      ...t.character,
                      ...(typeof patch.stressFilled === "number"
                        ? { stressFilled: patch.stressFilled }
                        : {}),
                      ...(patch.trauma ? { trauma: patch.trauma } : {}),
                    },
                  };
                }),
              );
            }}
          />
        ))}

      {/* ── NPC mode ── */}
      {mode === MODES.NPC && (
        <div style={{ width: "100%" }}>
          {npcsLoading ? (
            <div
              style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}
            >
              Loading NPCs...
            </div>
          ) : npcTabs.length > 0 ? (
            npcTabs.map((tab) => {
              const canEditNpc = userCanEditNpcSheet(
                user,
                tab.npc,
                campaigns,
              );
              const isNpcGm = userIsNpcCampaignGm(
                user,
                tab.npc,
                campaigns,
              );
              return (
              <div
                key={tab.tabId}
                style={{
                  display: tab.tabId === activeNpcTabId ? "block" : "none",
                }}
              >
                <NPCSheet
                  npc={tab.npc ?? undefined}
                  onSave={handleSaveNpc}
                  campaigns={campaigns}
                  allNpcs={npcs}
                  isGM={isNpcGm}
                  readOnly={!canEditNpc}
                  onFactionChange={refreshCampaigns}
                  onCampaignRefresh={refreshCampaigns}
                  onOpenNpc={handleOpenNpcFromNpcSheet}
                  onOpenCharacter={handleOpenCharacterFromNpcSheet}
                  onCreateCharacter={() => {
                    void guardUnsavedCharacterNavigation(() => {
                      setMode(MODES.CHARACTER);
                      handleCreateNewCharacterTab();
                      if (typeof window !== "undefined") {
                        window.location.hash = "character";
                      }
                    });
                  }}
                />
              </div>
              );
            })
          ) : (
            <div
              style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}
            >
              Click "+ New NPC" to create one.
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteModal
        open={Boolean(deleteConfirm)}
        message={deleteConfirm?.message || ""}
        busy={deleteConfirmBusy}
        onCancel={() => {
          if (!deleteConfirmBusy) setDeleteConfirm(null);
        }}
        onConfirm={handleConfirmEntityDelete}
      />
    </div>
  );
}
