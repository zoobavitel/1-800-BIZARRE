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
  isImageUploadPayload,
} from "../features/character-sheet";
import { subscribeCampaignEvents } from "../features/character-sheet/services/campaignEvents";
import { useAuth } from "../features/auth";
import { CharacterSheetWrapper } from "./CharacterSheet";
import { NPCSheet } from "./NPCSheet";

const MODES = { CHARACTER: "character", NPC: "npc" };
/** Poll open character sheets + campaigns while the tab is visible (backup if SSE disconnects). */
const SHEET_SYNC_INTERVAL_MS = 12000;

const PAGE_STYLES = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "1400px", margin: "0 auto" },
  modeBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 16px",
    borderBottom: "1px solid #374151",
    flexWrap: "wrap",
    gap: "6px",
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
  const harm = payload.harm || {
    level3: [""],
    level2: ["", ""],
    level1: ["", ""],
  };
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
    crew: payload.crew ?? "",
    crewId: payload.crewId ?? null,
    personal_crew_name: payload.personal_crew_name ?? "",
    actionRatings: payload.actionRatings ?? {},
    standStats: payload.standStats ?? {},
    stressFilled:
      typeof payload.stressFilled === "number" ? payload.stressFilled : 0,
    trauma: traumaIds,
    armor: {
      armor: (payload.regularArmorUsed ?? 0) > 0,
      heavy: payload.specialArmorUsed === true,
      special: payload.specialArmorUsed === true,
    },
    harmEntries: {
      level3: Array.isArray(harm.level3) ? harm.level3 : [""],
      level2: Array.isArray(harm.level2) ? harm.level2 : ["", ""],
      level1: Array.isArray(harm.level1) ? harm.level1 : ["", ""],
    },
    coin: Array(4)
      .fill(false)
      .map((_, i) => i < coinFilled),
    stash: Array.isArray(payload.stash) ? payload.stash : Array(40).fill(false),
    healingClock: payload.healingClock ?? 0,
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
    id: payload.id,
    inventory: payload.inventory ?? [],
    reputation_status: payload.reputation_status ?? {},
    selected_benefits: payload.selected_benefits ?? [],
    selected_detriments: payload.selected_detriments ?? [],
    image_url: payload.image_url ?? "",
    imageFile: payload.imageFile,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CharacterPage({
  initialCharacterId = null,
  initialNpcId = null,
  preferNpcMode = false,
  onRegisterNavigationGuard = null,
}) {
  const { user } = useAuth();
  const [mode, setMode] = useState(
    preferNpcMode || initialNpcId != null ? MODES.NPC : MODES.CHARACTER,
  );

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
  /** Bumps when remote sync completes so CharacterSheet refetches session rolls. */
  const [sheetPollTick, setSheetPollTick] = useState(0);

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
        const next = await Promise.all(
          prev.map(async (t) => {
            if (!t.characterId) return t;
            try {
              const raw = await characterAPI.getCharacter(t.characterId);
              return { ...t, character: transformBackendToFrontend(raw) };
            } catch {
              const updated = byId.get(t.characterId);
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
        character: createDefaultCharacter(),
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
      if (tab && tab.characterId === null) {
        const meta = charTabUnsavedMeta[tabId];
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
      }
      setCharTabs((prev) => {
        const filtered = prev.filter((t) => t.tabId !== tabId);
        if (filtered.length === 0) {
          const blank = {
            tabId: nextTabId++,
            characterId: null,
            character: createDefaultCharacter(),
          };
          setActiveCharTabId(blank.tabId);
          return [blank];
        }
        if (activeCharTabId === tabId) {
          setActiveCharTabId(filtered[filtered.length - 1].tabId);
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

  // ── Save character ───────────────────────────────────────────────────────
  const handleSaveCharacter = useCallback(
    async (payload) => {
      // Ensure trauma reference data is available (mirrors heritage re-fetch fallback below).
      // If the /traumas/ API call failed during initial load, traumas = [] and
      // traumaObjectToIds would silently return [] — erasing all trauma selections.
      let traumaList = normalizeListResponse(traumas);
      if (!traumaList.length) {
        const raw = await referenceAPI.getTraumas().catch(() => null);
        traumaList = normalizeListResponse(raw);
        if (traumaList.length) setTraumas(traumaList);
      }
      const frontend = normalizeSheetPayloadToFrontend(payload, traumaList);
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
      const withFile = {
        ...toSend,
        ...(isImageUploadPayload(frontend.imageFile)
          ? { imageFile: frontend.imageFile }
          : {}),
      };
      try {
        let saved;
        if (payload.id) {
          saved = await characterAPI.updateCharacter(payload.id, withFile);
        } else {
          saved = await characterAPI.createCharacter(withFile);
          if (saved.id && typeof window !== "undefined")
            window.location.hash = `character/${saved.id}`;
        }
        let stashMerged = null;
        if (saved?.id && Array.isArray(frontend.stash)) {
          const crewPk =
            frontend.crewId != null && frontend.crewId !== ""
              ? parseInt(String(frontend.crewId), 10)
              : NaN;
          if (Number.isFinite(crewPk) && crewPk > 0) {
            try {
              const crewUpdated = await crewAPI.patchCrew(crewPk, {
                stash_slots: normalizeStashSlots(frontend.stash),
              });
              stashMerged = Array.isArray(crewUpdated?.stash_slots)
                ? normalizeStashSlots(crewUpdated.stash_slots)
                : normalizeStashSlots(frontend.stash);
            } catch (e) {
              console.error("Crew stash save failed:", e);
              stashMerged = normalizeStashSlots(frontend.stash);
            }
          }
        }
        const savedFrontend = transformBackendToFrontend(saved);
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
          crew: payload.crew ?? savedFrontend.crew,
          crewId: payload.crewId ?? savedFrontend.crewId,
          image: savedFrontend.image,
          image_url: payload.image_url ?? savedFrontend.image_url,
          vice: payload.vice ?? savedFrontend.vice,
          viceDetails:
            payload.viceDetails ??
            payload.vice_details ??
            savedFrontend.viceDetails,
          personal_crew_name:
            payload.personal_crew_name ??
            savedFrontend.personal_crew_name ??
            "",
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
          stash:
            stashMerged !== null
              ? stashMerged
              : normalizeStashSlots(
                  saved?.stash_slots ?? savedFrontend.stash ?? frontend.stash,
                ),
        };
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
      if (activeTab?.characterId == null && activeMeta?.isDirty) {
        const saveNow = window.confirm(
          "This new character has unsaved changes.\n\nPress OK to save now.\nPress Cancel for discard options.",
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
            "Discard this unsaved character and continue?\n\nPress OK to discard, or Cancel to stay here.",
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

  // ── NPC logic: when initialNpcId is set (e.g. from #npcs/123), fetch and open that NPC
  useEffect(() => {
    if (initialNpcId == null || mode !== MODES.NPC) return;
    setNpcsLoading(true);
    npcAPI
      .getNPC(initialNpcId)
      .then((npc) => {
        if (!npc) return;
        npcTabsInitialized.current = true;
        const tab = {
          tabId: nextTabId++,
          npcId: npc.id,
          npc,
          label: npc.name || "New NPC",
        };
        setNpcTabs([tab]);
        setActiveNpcTabId(tab.tabId);
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
          npcTabsInitialized.current = true;
          const tab = {
            tabId: nextTabId++,
            npcId: null,
            npc: null,
            label: "New NPC",
          };
          setNpcTabs([tab]);
          setActiveNpcTabId(tab.tabId);
        }
      })
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));
  }, [mode, campaignId, initialNpcId]);

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
      try {
        const nameTrim = String(npcData.name ?? "").trim();
        const payload = { ...npcData, name: nameTrim || "New NPC" };
        let result;
        if (payload.id) {
          result = await npcAPI.updateNPC(payload.id, payload);
        } else {
          result = await npcAPI.createNPC(payload);
        }
        setNpcTabs((prev) =>
          prev.map((t) =>
            t.tabId === activeNpcTabId
              ? {
                  ...t,
                  npcId: result.id,
                  npc: result,
                  label: result.name || "New NPC",
                }
              : t,
          ),
        );
        if (result.id && typeof window !== "undefined")
          window.location.hash = `npcs/${result.id}`;
        const list = await npcAPI.getNPCs(campaignId);
        setNpcs(list || []);
        return result;
      } catch (err) {
        console.error("Save NPC failed:", err);
        throw err;
      }
    },
    [campaignId, activeNpcTabId],
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
        if (prev.length <= 1) return prev;
        const filtered = prev.filter((t) => t.tabId !== tabId);
        if (activeNpcTabId === tabId) {
          setActiveNpcTabId(filtered[filtered.length - 1].tabId);
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

  const campaignIdForRealtime = useMemo(() => {
    const c = sheetCharacter?.campaign;
    const id = typeof c === "object" ? c?.id : c;
    if (id == null || id === "") return null;
    const n = typeof id === "number" ? id : parseInt(String(id), 10);
    return Number.isFinite(n) ? n : null;
  }, [sheetCharacter?.campaign]);

  useEffect(() => {
    if (mode !== MODES.CHARACTER || !campaignIdForRealtime) return undefined;
    return subscribeCampaignEvents(campaignIdForRealtime, {
      onUpdate: () => {
        void syncOpenSheetsFromServer();
      },
    });
  }, [mode, campaignIdForRealtime, syncOpenSheetsFromServer]);

  const activeNpcTab = npcTabs.find((t) => t.tabId === activeNpcTabId);

  const handleDeleteActiveCharacter = useCallback(async () => {
    const id = activeCharTab?.characterId ?? activeCharTab?.character?.id;
    if (!id) {
      window.alert(
        "This character is not saved yet. Close the tab to discard, or save first.",
      );
      return;
    }
    if (
      !window.confirm(
        "Delete this character permanently? This cannot be undone.",
      )
    )
      return;
    setCharactersError(null);
    try {
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
          if (typeof window !== "undefined") window.location.hash = "character";
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
            ? `character/${nextHashId}`
            : "character";
        }
        return sortCharTabs(filtered);
      });
    } catch (e) {
      setCharactersError(e.message || "Failed to delete character");
    }
  }, [activeCharTab, activeCharTabId]);

  const handleDeleteActiveNpc = useCallback(async () => {
    const id = activeNpcTab?.npcId ?? activeNpcTab?.npc?.id;
    if (!id) {
      window.alert(
        "This NPC is not saved yet. Close the tab to discard, or save first.",
      );
      return;
    }
    if (
      !window.confirm("Delete this NPC permanently? This cannot be undone.")
    )
      return;
    const filtered = npcTabs.filter((t) => (t.npcId ?? t.npc?.id) !== id);
    try {
      await npcAPI.deleteNPC(id);
      setNpcs((prev) => prev.filter((n) => n.id !== id));
      if (filtered.length === 0) {
        setNpcTabs([]);
        setActiveNpcTabId(null);
        seedEmptyCharacterTabs();
        setMode(MODES.CHARACTER);
        if (typeof window !== "undefined") window.location.hash = "character";
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
    } catch (e) {
      window.alert(e.message || "Failed to delete NPC");
    }
  }, [activeNpcTab, activeNpcTabId, npcTabs, seedEmptyCharacterTabs]);

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
      if (!isUnsavedCharacterDirty(tab)) {
        onContinue?.();
        return true;
      }
      const savePrompt =
        "This character tab has unsaved changes. Press OK to save before continuing, or Cancel to choose whether to discard changes.";
      if (allowSave && window.confirm(savePrompt)) {
        const saved = await saveActiveUnsavedCharacter();
        if (!saved) return false;
        onContinue?.();
        return true;
      }
      const discardConfirmed = window.confirm(
        discardMessage ||
          "Discard this unsaved character? Any changes will be lost.",
      );
      if (!discardConfirmed) return false;
      onContinue?.();
      return true;
    },
    [activeCharTabId, charTabs, saveActiveUnsavedCharacter],
  );

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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={PAGE_STYLES.page}>
      {/* ── Top bar ── */}
      <div style={PAGE_STYLES.modeBar}>
        <nav
          style={{
            display: "flex",
            gap: "4px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const hadCharTabs = charTabs.length > 0;
              const hashId = hadCharTabs
                ? activeCharTab?.characterId ?? activeCharTab?.character?.id
                : null;
              seedEmptyCharacterTabs();
              setMode(MODES.CHARACTER);
              if (typeof window !== "undefined") {
                window.location.hash = hashId
                  ? `character/${hashId}`
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

          {/* ── NPC tabs ── */}
          {mode === MODES.NPC && npcTabs.length > 0 && (
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
                  {npcTabs.length > 1 && (
                    <span
                      style={TAB_STYLES.close}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseNpcTab(tab.tabId);
                      }}
                    >
                      ×
                    </span>
                  )}
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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {charactersError && (
            <span style={{ fontSize: "12px", color: "#fca5a5" }}>
              {charactersError}
            </span>
          )}

          {mode === MODES.CHARACTER && (
            <>
              {characters.length > 0 && (
                <select
                  style={{
                    background: "#1f2937",
                    color: "#9ca3af",
                    border: "1px solid #4b5563",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    borderRadius: "4px",
                  }}
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
                style={{
                  background: "#1f2937",
                  color: "#9ca3af",
                  border: "1px solid #4b5563",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  borderRadius: "4px",
                }}
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
                  style={{
                    background: "#1f2937",
                    color: "#9ca3af",
                    border: "1px solid #4b5563",
                    padding: "4px 8px",
                    fontSize: "11px",
                    fontFamily: "monospace",
                    borderRadius: "4px",
                  }}
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
                          window.location.hash = `character/${char.id}`;
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
                style={{
                  background: "#1f2937",
                  color: "#9ca3af",
                  border: "1px solid #4b5563",
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontFamily: "monospace",
                  borderRadius: "4px",
                }}
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
        ) : (
          <CharacterSheetWrapper
            key={activeCharTab?.tabId ?? "new"}
            character={sheetCharacter}
            heritages={heritages}
            heritagesLoading={heritagesLoading}
            heritagesError={heritagesError}
            onRetryHeritages={loadReferenceData}
            allCharacters={characters}
            campaigns={campaigns}
            isGM={
              campaigns?.find((c) => c.id === sheetCharacter?.campaign)?.gm
                ?.id === user?.id
            }
            onSave={handleSaveCharacter}
            onCreateNew={handleCreateNewCharacterTab}
            onSwitchCharacter={handleSwitchCharacter}
            onCrewNameUpdated={handleCrewNameUpdated}
            onCampaignRefresh={refreshCampaigns}
            sessionDataPollTick={sheetPollTick}
            onDraftMetaChange={(meta) => {
              const tabId = activeCharTab?.tabId;
              if (tabId == null) return;
              setCharTabUnsavedMeta((prev) => ({
                ...prev,
                [tabId]: meta,
              }));
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
            npcTabs.map((tab) => (
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
                  isGM={true}
                  onFactionChange={refreshCampaigns}
                  onCampaignRefresh={refreshCampaigns}
                />
              </div>
            ))
          ) : (
            <div
              style={{ padding: "24px", textAlign: "center", color: "#9ca3af" }}
            >
              Click "+ New NPC" to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
