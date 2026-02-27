/**
 * CharacterPage — page-level orchestration for the character sheet.
 * Handles API calls, data transformation, mode switching (Character / NPC),
 * and navigation chrome.  Delegates rendering to CharacterSheet.jsx.
 *
 * CHARACTER TABS: each open character gets a named tab in the top bar,
 * sorted alphabetically (unsaved "New Character" tabs always sort first).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    crew: payload.crew ?? '',
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
    playbook: payload.playbook ?? 'Stand',
    id: payload.id,
    inventory: payload.inventory ?? [],
    reputation_status: payload.reputation_status ?? {},
    selected_benefits: payload.selected_benefits ?? [],
    selected_detriments: payload.selected_detriments ?? [],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CharacterPage({ initialCharacterId = null }) {
  const { user } = useAuth();
  const [mode, setMode] = useState(MODES.CHARACTER);

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
    loadCharacters().then((front) => {
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
    const toSend = transformFrontendToBackend({ ...frontend, heritage: heritageValue });
    try {
      let saved;
      if (payload.id) {
        saved = await characterAPI.updateCharacter(payload.id, toSend);
      } else {
        saved = await characterAPI.createCharacter(toSend);
        if (saved.id && typeof window !== 'undefined') window.location.hash = `character/${saved.id}`;
      }
      const savedFrontend = transformBackendToFrontend(saved);
      updateActiveCharTab(savedFrontend.id, savedFrontend);
      await loadCharacters();
    } catch (err) {
      console.error('Save character failed:', err);
      throw err;
    }
  }, [traumas, heritages, loadCharacters, updateActiveCharTab]);

  const handleSwitchCharacter = useCallback((character) => {
    if (!character) {
      handleCreateNewCharacterTab();
      return;
    }
    openCharacterInTab(character);
  }, [handleCreateNewCharacterTab, openCharacterInTab]);

  // ── NPC logic ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== MODES.NPC) return;
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
  }, [mode, campaignId]);

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
  const sheetCharacter = activeCharTab?.character ?? createDefaultCharacter();
  const activeNpcTab = npcTabs.find(t => t.tabId === activeNpcTabId);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={PAGE_STYLES.page}>

      {/* ── Top bar ── */}
      <div style={PAGE_STYLES.modeBar}>
        <nav style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>

          <button type="button" onClick={() => setMode(MODES.CHARACTER)} style={PAGE_STYLES.modeBtn(mode === MODES.CHARACTER)}>
            CHARACTERS
          </button>
          <button type="button" onClick={() => setMode(MODES.NPC)} style={PAGE_STYLES.modeBtn(mode === MODES.NPC)}>
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
          ) : activeNpcTab ? (
            <NPCSheet
              key={activeNpcTab.tabId}
              npc={activeNpcTab.npc ?? undefined}
              onSave={handleSaveNpc}
              campaigns={campaigns}
            />
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
