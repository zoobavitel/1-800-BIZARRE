/**
 * CharacterPage — page-level orchestration for the character sheet.
 * Handles API calls, data transformation, mode switching (Character / NPC),
 * and navigation chrome.  Delegates rendering to CharacterSheet.jsx.
 *
 * CHARACTER TABS: each open character gets a named tab in the top bar,
 * sorted alphabetically (unsaved "New Character" tabs always sort first).
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  characterAPI,
  npcAPI,
  referenceAPI,
  campaignAPI,
  transformBackendToFrontend,
  transformFrontendToBackend,
  createDefaultCharacter,
  traumaObjectToIds,
} from '../features/character-sheet';
import { useAuth } from '../features/auth';
import { CharacterSheetWrapper } from './CharacterSheet';
import { NPCSheet } from './NPCSheet';

const MODES = { CHARACTER: 'character', NPC: 'npc' };

const PAGE_STYLES = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1400px', margin: '0 auto' },
  modeBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', borderBottom: '1px solid #374151',
    flexWrap: 'wrap', gap: '6px',
  },
  modeBtn: (active) => ({
    padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
    background: active ? '#374151' : 'transparent',
    color: active ? '#fff' : '#9ca3af',
    cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
  }),
};

const TAB_STYLES = {
  tab: (active) => ({
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '4px 10px', borderRadius: '4px',
    background: active ? '#4b5563' : '#374151',
    color: active ? '#fff' : '#9ca3af',
    cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px',
    border: 'none', whiteSpace: 'nowrap',
  }),
  close: {
    background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer',
    fontSize: '13px', padding: '0 2px', lineHeight: 1, fontFamily: 'monospace',
  },
  divider: {
    width: '1px', height: '20px', background: '#4b5563', margin: '0 4px', flexShrink: 0,
  },
  addBtn: {
    padding: '4px 8px', borderRadius: '4px', fontSize: '11px',
    background: '#1f2937', color: '#9ca3af', border: '1px dashed #4b5563',
    cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap',
  },
};

let nextTabId = 1;

// ---------------------------------------------------------------------------
// Character tab helpers
// ---------------------------------------------------------------------------

function charTabLabel(tab) {
  const name = tab.character?.name?.trim();
  return name || 'New Character';
}

function sortCharTabs(tabs) {
  return [...tabs].sort((a, b) => {
    const aNew = !a.characterId;
    const bNew = !b.characterId;
    if (aNew !== bNew) return aNew ? -1 : 1;
    return charTabLabel(a).localeCompare(charTabLabel(b));
  });
}

// ---------------------------------------------------------------------------
// Payload normalizer
// ---------------------------------------------------------------------------

function normalizeSheetPayloadToFrontend(payload, traumasList = []) {
  const traumaIds = traumaObjectToIds(payload.trauma || {}, traumasList);
  const harm = payload.harm || {
    level3: [''], level2: ['', ''], level1: ['', ''],
  };
  const coinFilled = typeof payload.coinFilled === 'number' ? payload.coinFilled : 0;
  return {
    name: payload.name ?? '',
    standName: payload.standName ?? '',
    heritage: payload.heritage ?? 'Human',
    background: payload.background ?? '',
    look: payload.look ?? '',
    vice: payload.vice ?? '',
    viceDetails: payload.viceDetails ?? payload.vice_details ?? '',
    crew: payload.crew ?? '',
    crewId: payload.crewId ?? null,
    personal_crew_name: payload.personal_crew_name ?? '',
    actionRatings: payload.actionRatings ?? {},
    standStats: payload.standStats ?? {},
    stressFilled: typeof payload.stressFilled === 'number' ? payload.stressFilled : 0,
    trauma: traumaIds,
    armor: {
      armor: (payload.regularArmorUsed ?? 0) > 0,
      heavy: payload.specialArmorUsed === true,
      special: payload.specialArmorUsed === true,
    },
    harmEntries: {
      level3: Array.isArray(harm.level3) ? harm.level3 : [''],
      level2: Array.isArray(harm.level2) ? harm.level2 : ['', ''],
      level1: Array.isArray(harm.level1) ? harm.level1 : ['', ''],
    },
    coin: Array(4).fill(false).map((_, i) => i < coinFilled),
    stash: Array.isArray(payload.stash) ? payload.stash : Array(40).fill(false),
    healingClock: payload.healingClock ?? 0,
    xp: payload.xp ?? { insight: 0, prowess: 0, resolve: 0, heritage: 0, playbook: 0 },
    abilities: Array.isArray(payload.abilities) ? payload.abilities : [],
    clocks: Array.isArray(payload.clocks) ? payload.clocks : [],
    campaign: payload.campaign ?? null,
    playbook: payload.playbook ?? 'Stand',
    id: payload.id,
    inventory: payload.inventory ?? [],
    reputation_status: payload.reputation_status ?? {},
    selected_benefits: payload.selected_benefits ?? [],
    selected_detriments: payload.selected_detriments ?? [],
    image_url: payload.image_url ?? '',
    imageFile: payload.imageFile,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CharacterPage({ initialCharacterId = null, initialNpcId = null, preferNpcMode = false }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(
    preferNpcMode || initialNpcId != null ? MODES.NPC : MODES.CHARACTER
  );

  // ── Character list (used by the "Open character…" dropdown) ─────────────
  const [characters, setCharacters] = useState([]);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState(null);

  // ── Character tab state ──────────────────────────────────────────────────
  const [charTabs, setCharTabs] = useState([]);
  const [activeCharTabId, setActiveCharTabId] = useState(null);
  const charTabsInitialized = useRef(false);

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

  // ── Reference data ───────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      referenceAPI.getTraumas().catch(() => []),
      referenceAPI.getHeritages().catch(() => []),
      campaignAPI.getCampaigns().catch(() => []),
    ]).then(([t, h, c]) => {
      if (!cancelled) {
        setTraumas(t || []);
        setHeritages(h || []);
        setCampaigns(c || []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshCampaigns = useCallback(async () => {
    const [c, chars] = await Promise.all([
      campaignAPI.getCampaigns().catch(() => []),
      characterAPI.getCharacters().catch(() => []),
    ]);
    setCampaigns(c || []);
    const front = (chars || []).map(transformBackendToFrontend);
    setCharacters(front);
    const byId = new Map(front.map((x) => [x.id, x]));
    // Update all character tabs with fresh data (e.g. after campaign assign).
    // GM-owned list may omit player PCs; fetch by id when missing.
    setCharTabs((prev) => {
      void (async () => {
        const next = await Promise.all(
          prev.map(async (t) => {
            if (!t.characterId) return t;
            const updated = byId.get(t.characterId);
            if (updated) return { ...t, character: updated };
            try {
              const raw = await characterAPI.getCharacter(t.characterId);
              return { ...t, character: transformBackendToFrontend(raw) };
            } catch {
              return t;
            }
          })
        );
        setCharTabs(next);
      })();
      return prev;
    });
  }, []);

  // ── Load character list ──────────────────────────────────────────────────
  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    setCharactersError(null);
    try {
      const list = await characterAPI.getCharacters();
      const front = (list || []).map(transformBackendToFrontend);
      setCharacters(front);
      return front;
    } catch (err) {
      setCharactersError(err.message || 'Failed to load characters');
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
          const tab = { tabId: nextTabId++, characterId: found.id, character: found };
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
          // Fall through to blank sheet (e.g. no access or invalid id)
        }
      }
      const blank = { tabId: nextTabId++, characterId: null, character: createDefaultCharacter() };
      setCharTabs([blank]);
      setActiveCharTabId(blank.tabId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const tab = { tabId: nextTabId++, characterId: null, character: createDefaultCharacter() };
    setCharTabs((prev) => sortCharTabs([tab, ...prev]));
    setActiveCharTabId(tab.tabId);
  }, []);

  const handleCloseCharTab = useCallback((tabId) => {
    setCharTabs((prev) => {
      const filtered = prev.filter((t) => t.tabId !== tabId);
      if (filtered.length === 0) {
        const blank = { tabId: nextTabId++, characterId: null, character: createDefaultCharacter() };
        setActiveCharTabId(blank.tabId);
        return [blank];
      }
      if (activeCharTabId === tabId) {
        setActiveCharTabId(filtered[filtered.length - 1].tabId);
      }
      return filtered;
    });
  }, [activeCharTabId]);

  const updateActiveCharTab = useCallback((characterId, character) => {
    setCharTabs((prev) => {
      const updated = prev.map((t) =>
        t.tabId === activeCharTabId
          ? { ...t, characterId, character }
          : t
      );
      return sortCharTabs(updated);
    });
  }, [activeCharTabId]);

  const handleCrewNameUpdated = useCallback((crewName, crewId, characterId) => {
    setCharTabs((prev) =>
      prev.map((t) => {
        if (!t.character) return t;
        // Shared crew rename: update every open sheet that uses this crew (same campaign entity)
        if (crewId != null && t.character.crewId === crewId) {
          return { ...t, character: { ...t.character, crew: crewName, crewId } };
        }
        // Solo name or the tab that initiated the change
        if (characterId != null && t.characterId === characterId) {
          return {
            ...t,
            character: {
              ...t.character,
              crew: crewName,
              personal_crew_name: crewId == null ? crewName : '',
              ...(crewId != null ? { crewId } : {}),
            },
          };
        }
        return t;
      })
    );
    loadCharacters();
  }, [loadCharacters]);

  // ── Save character ───────────────────────────────────────────────────────
  const handleSaveCharacter = useCallback(async (payload) => {
    const frontend = normalizeSheetPayloadToFrontend(payload, traumas);
    let heritageValue = frontend.heritage;
    if (typeof heritageValue === 'string' && heritages.length) {
      const match = heritages.find((h) => (h.name || '').toLowerCase() === (heritageValue || '').toLowerCase());
      if (match) heritageValue = match.id;
    }
    if ((heritageValue == null || heritageValue === '') && heritages.length) {
      heritageValue = heritages[0].id;
    }
    // Backend rejects blank true_name; avoid hollow PUT if local name lagged behind loaded character
    let nameForSave = String(frontend.name ?? '').trim();
    if (!nameForSave) {
      if (payload.id) {
        const tab =
          charTabs.find(
            (t) => t.characterId === payload.id || t.character?.id === payload.id
          ) || charTabs.find((t) => t.tabId === activeCharTabId);
        nameForSave = String(tab?.character?.name ?? '').trim() || 'Unnamed';
      } else {
        nameForSave = 'Unnamed';
      }
    }
    const toSend = transformFrontendToBackend({
      ...frontend,
      name: nameForSave,
      heritage: heritageValue,
      campaign: payload.campaign ?? frontend.campaign,
    });
    const withFile = { ...toSend, ...(frontend.imageFile instanceof File ? { imageFile: frontend.imageFile } : {}) };
    try {
      let saved;
      if (payload.id) {
        saved = await characterAPI.updateCharacter(payload.id, withFile);
      } else {
        saved = await characterAPI.createCharacter(withFile);
        if (saved.id && typeof window !== 'undefined') window.location.hash = `character/${saved.id}`;
      }
      const savedFrontend = transformBackendToFrontend(saved);
      // Preserve crew from payload: backend has crew as read_only FK, so it returns '' when we send a string.
      // Without this merge, character.crew becomes '' after save, causing a perceived "change" and save loop.
      const merged = {
        ...savedFrontend,
        crew: payload.crew ?? savedFrontend.crew,
        crewId: payload.crewId ?? savedFrontend.crewId,
        image: savedFrontend.image,
        image_url: payload.image_url ?? savedFrontend.image_url,
        vice: payload.vice ?? savedFrontend.vice,
        viceDetails: payload.viceDetails ?? payload.vice_details ?? savedFrontend.viceDetails,
        personal_crew_name:
          payload.personal_crew_name ?? savedFrontend.personal_crew_name ?? '',
      };
      updateActiveCharTab(merged.id, merged);
      await loadCharacters();
    } catch (err) {
      console.error('Save character failed:', err);
      throw err;
    }
  }, [traumas, heritages, loadCharacters, updateActiveCharTab, charTabs, activeCharTabId]);

  const handleSwitchCharacter = useCallback((character) => {
    if (!character) {
      handleCreateNewCharacterTab();
      return;
    }
    openCharacterInTab(character);
  }, [handleCreateNewCharacterTab, openCharacterInTab]);

  // ── NPC logic: when initialNpcId is set (e.g. from #npcs/123), fetch and open that NPC
  useEffect(() => {
    if (initialNpcId == null || mode !== MODES.NPC) return;
    setNpcsLoading(true);
    npcAPI.getNPC(initialNpcId)
      .then((npc) => {
        if (!npc) return;
        npcTabsInitialized.current = true;
        const tab = { tabId: nextTabId++, npcId: npc.id, npc, label: npc.name || 'Unnamed' };
        setNpcTabs([tab]);
        setActiveNpcTabId(tab.tabId);
        npcAPI.getNPCs(campaignId).then((list) => setNpcs(list || [])).catch(() => setNpcs([]));
      })
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));
  }, [initialNpcId, mode, campaignId]);

  // ── NPC logic: normal load when no initialNpcId
  useEffect(() => {
    if (mode !== MODES.NPC || initialNpcId != null) return;
    setNpcsLoading(true);
    npcAPI.getNPCs(campaignId).then((list) => {
      const npcList = list || [];
      setNpcs(npcList);
      if (!npcTabsInitialized.current) {
        npcTabsInitialized.current = true;
        if (npcList.length > 0) {
          const tab = { tabId: nextTabId++, npcId: npcList[0].id, npc: npcList[0], label: npcList[0].name || 'Unnamed' };
          setNpcTabs([tab]);
          setActiveNpcTabId(tab.tabId);
        } else {
          const tab = { tabId: nextTabId++, npcId: null, npc: null, label: 'New NPC' };
          setNpcTabs([tab]);
          setActiveNpcTabId(tab.tabId);
        }
      }
    }).catch(() => setNpcs([])).finally(() => setNpcsLoading(false));
  }, [mode, campaignId, initialNpcId]);

  const handleSaveNpc = useCallback(async (npcData) => {
    try {
      let result;
      if (npcData.id) {
        result = await npcAPI.updateNPC(npcData.id, npcData);
      } else {
        result = await npcAPI.createNPC(npcData);
      }
      setNpcTabs(prev => prev.map(t =>
        t.tabId === activeNpcTabId
          ? { ...t, npcId: result.id, npc: result, label: result.name || 'Unnamed' }
          : t
      ));
      const list = await npcAPI.getNPCs(campaignId);
      setNpcs(list || []);
      return result;
    } catch (err) {
      console.error('Save NPC failed:', err);
      throw err;
    }
  }, [campaignId, activeNpcTabId]);

  const handleCreateNewNpcTab = useCallback(() => {
    const tab = { tabId: nextTabId++, npcId: null, npc: null, label: 'New NPC' };
    setNpcTabs(prev => [...prev, tab]);
    setActiveNpcTabId(tab.tabId);
  }, []);

  const handleCloseNpcTab = useCallback((tabId) => {
    setNpcTabs(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter(t => t.tabId !== tabId);
      if (activeNpcTabId === tabId) {
        setActiveNpcTabId(filtered[filtered.length - 1].tabId);
      }
      return filtered;
    });
  }, [activeNpcTabId]);

  const handleOpenExistingNpc = useCallback((npc) => {
    const existing = npcTabs.find(t => t.npcId === npc.id);
    if (existing) {
      setActiveNpcTabId(existing.tabId);
      return;
    }
    const tab = { tabId: nextTabId++, npcId: npc.id, npc, label: npc.name || 'Unnamed' };
    setNpcTabs(prev => [...prev, tab]);
    setActiveNpcTabId(tab.tabId);
  }, [npcTabs]);

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
  const activeNpcTab = npcTabs.find(t => t.tabId === activeNpcTabId);

  const handleDeleteActiveCharacter = useCallback(async () => {
    const id = activeCharTab?.characterId ?? activeCharTab?.character?.id;
    if (!id) {
      window.alert('This character is not saved yet. Close the tab to discard, or save first.');
      return;
    }
    if (!window.confirm('Delete this character permanently? This cannot be undone.')) return;
    setCharactersError(null);
    try {
      await characterAPI.deleteCharacter(id);
      setCharacters((prev) => prev.filter((c) => c.id !== id));
      setCharTabs((prev) => {
        const filtered = prev.filter((t) => (t.characterId ?? t.character?.id) !== id);
        if (filtered.length === 0) {
          const blank = { tabId: nextTabId++, characterId: null, character: createDefaultCharacter() };
          setActiveCharTabId(blank.tabId);
          if (typeof window !== 'undefined') window.location.hash = 'character';
          return [blank];
        }
        const nextActive = filtered.some((t) => t.tabId === activeCharTabId)
          ? activeCharTabId
          : filtered[filtered.length - 1].tabId;
        setActiveCharTabId(nextActive);
        const nextTab = filtered.find((t) => t.tabId === nextActive);
        const nextHashId = nextTab?.characterId ?? nextTab?.character?.id;
        if (typeof window !== 'undefined') {
          window.location.hash = nextHashId ? `character/${nextHashId}` : 'character';
        }
        return sortCharTabs(filtered);
      });
    } catch (e) {
      setCharactersError(e.message || 'Failed to delete character');
    }
  }, [activeCharTab, activeCharTabId]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={PAGE_STYLES.page}>

      {/* ── Top bar ── */}
      <div style={PAGE_STYLES.modeBar}>
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>

          <button
            type="button"
            onClick={() => {
              setMode(MODES.CHARACTER);
              const id = activeCharTab?.characterId ?? activeCharTab?.character?.id;
              if (typeof window !== 'undefined') window.location.hash = id ? `character/${id}` : 'character';
            }}
            style={PAGE_STYLES.modeBtn(mode === MODES.CHARACTER)}
          >
            CHARACTERS
          </button>
          <button
            type="button"
            onClick={() => {
              setMode(MODES.NPC);
              const id = activeNpcTab?.npcId ?? activeNpcTab?.npc?.id;
              if (typeof window !== 'undefined') window.location.hash = id ? `npcs/${id}` : 'npcs';
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
                  onClick={() => setActiveCharTabId(tab.tabId)}
                  style={TAB_STYLES.tab(tab.tabId === activeCharTabId)}
                >
                  <span>{charTabLabel(tab)}</span>
                  <span
                    style={TAB_STYLES.close}
                    title="Close tab"
                    onClick={(e) => { e.stopPropagation(); handleCloseCharTab(tab.tabId); }}
                  >
                    ×
                  </span>
                </button>
              ))}
              <button type="button" onClick={handleCreateNewCharacterTab} style={TAB_STYLES.addBtn}>
                + New Character
              </button>
            </>
          )}

          {/* ── NPC tabs ── */}
          {mode === MODES.NPC && npcTabs.length > 0 && (
            <>
              <div style={TAB_STYLES.divider} />
              {npcTabs.map(tab => (
                <button key={tab.tabId} type="button"
                  onClick={() => setActiveNpcTabId(tab.tabId)}
                  style={TAB_STYLES.tab(tab.tabId === activeNpcTabId)}>
                  <span>{tab.label}</span>
                  {npcTabs.length > 1 && (
                    <span style={TAB_STYLES.close}
                      onClick={e => { e.stopPropagation(); handleCloseNpcTab(tab.tabId); }}>
                      ×
                    </span>
                  )}
                </button>
              ))}
              <button type="button" onClick={handleCreateNewNpcTab} style={TAB_STYLES.addBtn}>
                + New NPC
              </button>
            </>
          )}
        </nav>

        {/* Right side: error banner + "Open…" dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {charactersError && (
            <span style={{ fontSize: '12px', color: '#fca5a5' }}>{charactersError}</span>
          )}

          {mode === MODES.CHARACTER && characters.length > 0 && (
            <>
              <select
                style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #4b5563', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace', borderRadius: '4px' }}
                value=""
                onChange={e => {
                  const char = characters.find(c => c.id === parseInt(e.target.value));
                  if (char) openCharacterInTab(char);
                }}>
                <option value="">Open character...</option>
                {characters.map(c => (
                  <option key={c.id} value={c.id}>{c.name || c.standName || 'Unnamed'}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleDeleteActiveCharacter}
                title="Delete the character open in the active tab (permanent)"
                style={{
                  background: '#450a0a',
                  color: '#fecaca',
                  border: '1px solid #991b1b',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Delete character
              </button>
            </>
          )}

          {mode === MODES.NPC && npcs.length > 0 && (
            <select
              style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #4b5563', padding: '4px 8px', fontSize: '11px', fontFamily: 'monospace', borderRadius: '4px' }}
              value=""
              onChange={e => {
                const npc = npcs.find(n => n.id === parseInt(e.target.value));
                if (npc) handleOpenExistingNpc(npc);
              }}>
              <option value="">Open NPC...</option>
              {npcs.map(n => <option key={n.id} value={n.id}>{n.name || 'Unnamed'}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── Character mode ── */}
      {mode === MODES.CHARACTER && (
        charactersLoading && charTabs.length === 0 ? (
          <div style={{ ...PAGE_STYLES.content, padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
            Loading characters...
          </div>
        ) : (
          <CharacterSheetWrapper
            key={activeCharTab?.tabId ?? 'new'}
            character={sheetCharacter}
            heritages={heritages}
            allCharacters={characters}
            campaigns={campaigns}
            isGM={campaigns?.find((c) => c.id === sheetCharacter?.campaign)?.gm?.id === user?.id}
            onSave={handleSaveCharacter}
            onCreateNew={handleCreateNewCharacterTab}
            onSwitchCharacter={handleSwitchCharacter}
            onCrewNameUpdated={handleCrewNameUpdated}
            onCampaignRefresh={refreshCampaigns}
          />
        )
      )}

      {/* ── NPC mode ── */}
      {mode === MODES.NPC && (
        <div style={PAGE_STYLES.content}>
          {npcsLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
              Loading NPCs...
            </div>
          ) : npcTabs.length > 0 ? (
            npcTabs.map((tab) => (
              <div
                key={tab.tabId}
                style={{ display: tab.tabId === activeNpcTabId ? 'block' : 'none' }}
              >
                <NPCSheet
                  npc={tab.npc ?? undefined}
                  onSave={handleSaveNpc}
                  campaigns={campaigns}
                />
              </div>
            ))
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
              Click "+ New NPC" to create one.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
