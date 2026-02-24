/**
 * CharacterPage — page-level orchestration for the character sheet.
 * Handles API calls, data transformation, mode switching (Character / NPC),
 * and navigation chrome.  Delegates rendering to CharacterSheet.jsx.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  characterAPI,
  npcAPI,
  referenceAPI,
  transformBackendToFrontend,
  transformFrontendToBackend,
  createDefaultCharacter,
  traumaObjectToIds,
} from '../features/character-sheet';
import { CharacterSheetWrapper } from './CharacterSheet';
import { NPCSheet } from './NPCSheet';

const MODES = { CHARACTER: 'character', NPC: 'npc' };

const PAGE_STYLES = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  content: { padding: '16px', maxWidth: '1400px', margin: '0 auto' },
  modeBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 16px', borderBottom: '1px solid #374151',
  },
  modeBtn: (active) => ({
    padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
    background: active ? '#374151' : 'transparent',
    color: active ? '#fff' : '#9ca3af',
    cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
  }),
};

/** Normalize save payload from CharacterSheet to the shape expected by transformFrontendToBackend */
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
  };
}

export default function CharacterPage({ initialCharacterId = null }) {
  const [mode, setMode] = useState(MODES.CHARACTER);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(initialCharacterId ?? null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [draftNewCharacter, setDraftNewCharacter] = useState(null);
  const [charactersLoading, setCharactersLoading] = useState(true);
  const [charactersError, setCharactersError] = useState(null);

  // When navigating from Home (create vs edit), sync selected id
  useEffect(() => {
    setSelectedCharacterId(initialCharacterId ?? null);
  }, [initialCharacterId]);

  const [npcs, setNpcs] = useState([]);
  const [selectedNpcId, setSelectedNpcId] = useState(null);
  const [selectedNpc, setSelectedNpc] = useState(null);
  const [npcsLoading, setNpcsLoading] = useState(false);
  const [campaignId] = useState(null); // setCampaignId reserved for future campaign filter

  const [traumas, setTraumas] = useState([]);
  const [heritages, setHeritages] = useState([]);

  // Load reference data (traumas for save, heritages for create)
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      referenceAPI.getTraumas().catch(() => []),
      referenceAPI.getHeritages().catch(() => []),
    ]).then(([t, h]) => {
      if (!cancelled) {
        setTraumas(t || []);
        setHeritages(h || []);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Load character list
  const loadCharacters = useCallback(async () => {
    setCharactersLoading(true);
    setCharactersError(null);
    try {
      const list = await characterAPI.getCharacters();
      const front = (list || []).map(transformBackendToFrontend);
      setCharacters(front);
      if (selectedCharacterId && !front.some((c) => c.id === selectedCharacterId)) {
        setSelectedCharacterId(null);
        setSelectedCharacter(null);
      }
    } catch (err) {
      setCharactersError(err.message || 'Failed to load characters');
      setCharacters([]);
    } finally {
      setCharactersLoading(false);
    }
  }, [selectedCharacterId]);

  useEffect(() => {
    loadCharacters();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  // When selected character id changes, load full character (don't overwrite when switching to "new" — handlers set selectedCharacter)
  useEffect(() => {
    if (selectedCharacterId == null) return;
    let cancelled = false;
    characterAPI.getCharacter(selectedCharacterId).then((raw) => {
      if (!cancelled) setSelectedCharacter(transformBackendToFrontend(raw));
    }).catch(() => {
      if (!cancelled) setSelectedCharacter(null);
    });
    return () => { cancelled = true; };
  }, [selectedCharacterId]);

  // Load NPCs when in NPC mode (optionally filter by campaign)
  useEffect(() => {
    if (mode !== MODES.NPC) return;
    setNpcsLoading(true);
    npcAPI.getNPCs(campaignId).then((list) => {
      setNpcs(list || []);
      if (selectedNpcId && !(list || []).some((n) => n.id === selectedNpcId)) {
        setSelectedNpcId(null);
        setSelectedNpc(null);
      }
    }).catch(() => setNpcs([])).finally(() => setNpcsLoading(false));
  }, [mode, campaignId, selectedNpcId]);

  const handleSaveCharacter = useCallback(async (payload) => {
    const frontend = normalizeSheetPayloadToFrontend(payload, traumas);
    let heritageValue = frontend.heritage;
    if (typeof heritageValue === 'string' && heritages.length) {
      const match = heritages.find((h) => (h.name || '').toLowerCase() === (heritageValue || '').toLowerCase());
      if (match) heritageValue = match.id;
    }
    const toSend = transformFrontendToBackend({ ...frontend, heritage: heritageValue });
    try {
      if (payload.id) {
        await characterAPI.updateCharacter(payload.id, toSend);
      } else {
        const created = await characterAPI.createCharacter(toSend);
        setSelectedCharacterId(created.id);
        setSelectedCharacter(transformBackendToFrontend(created));
        if (created.id && typeof window !== 'undefined') window.location.hash = `character/${created.id}`;
      }
      await loadCharacters();
    } catch (err) {
      console.error('Save character failed:', err);
      throw err;
    }
  }, [traumas, heritages, loadCharacters]);

  const handleCreateNewCharacter = useCallback(() => {
    setSelectedCharacterId(null);
    setSelectedCharacter(draftNewCharacter ?? createDefaultCharacter());
  }, [draftNewCharacter]);

  const handleSwitchCharacter = useCallback((character) => {
    const current = selectedCharacter ?? createDefaultCharacter();
    if (character == null) {
      setSelectedCharacterId(null);
      setSelectedCharacter(draftNewCharacter ?? createDefaultCharacter());
      return;
    }
    if (character?.id) {
      if (!current.id) setDraftNewCharacter(current);
      setSelectedCharacterId(character.id);
      setSelectedCharacter(character);
    }
  }, [draftNewCharacter, selectedCharacter]);

  const handleSaveNpc = useCallback(async (npcData) => {
    try {
      if (npcData.id) {
        await npcAPI.updateNPC(npcData.id, npcData);
      } else {
        const created = await npcAPI.createNPC(npcData);
        setSelectedNpcId(created.id);
        setSelectedNpc(created);
      }
      const list = await npcAPI.getNPCs(campaignId);
      setNpcs(list || []);
    } catch (err) {
      console.error('Save NPC failed:', err);
      throw err;
    }
  }, [campaignId]);

  const handleCreateNewNpc = useCallback(() => {
    setSelectedNpcId(null);
    setSelectedNpc(null);
  }, []);

  const handleSwitchNpc = useCallback((npc) => {
    setSelectedNpcId(npc?.id ?? null);
    setSelectedNpc(npc ?? null);
  }, []);

  const sheetCharacter = selectedCharacter ?? createDefaultCharacter();

  return (
    <div style={PAGE_STYLES.page}>
      {/* Mode tabs */}
      <div style={PAGE_STYLES.modeBar}>
        <nav style={{ display: 'flex', gap: '4px' }}>
          <button type="button" onClick={() => setMode(MODES.CHARACTER)} style={PAGE_STYLES.modeBtn(mode === MODES.CHARACTER)}>
            CHARACTERS
          </button>
          <button type="button" onClick={() => setMode(MODES.NPC)} style={PAGE_STYLES.modeBtn(mode === MODES.NPC)}>
            NPCs
          </button>
        </nav>
        {charactersError && (
          <span style={{ fontSize: '12px', color: '#fca5a5' }}>{charactersError}</span>
        )}
      </div>

      {/* Character mode */}
      {mode === MODES.CHARACTER && (
        charactersLoading ? (
          <div style={{ ...PAGE_STYLES.content, padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
            Loading characters…
          </div>
        ) : (
          <CharacterSheetWrapper
            key={sheetCharacter?.id ?? 'new'}
            character={sheetCharacter}
            allCharacters={characters}
            onSave={handleSaveCharacter}
            onCreateNew={handleCreateNewCharacter}
            onSwitchCharacter={handleSwitchCharacter}
          />
        )
      )}

      {/* NPC mode: same content wrapper as CharacterSheet uses */}
      {mode === MODES.NPC && (
        <div style={PAGE_STYLES.content}>
          {npcsLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>
              Loading NPCs…
            </div>
          ) : (
            <NPCSheet
              npc={selectedNpc ?? undefined}
              allNPCs={npcs}
              onSave={handleSaveNpc}
              onCreateNew={handleCreateNewNpc}
              onSwitchNPC={handleSwitchNpc}
            />
          )}
        </div>
      )}
    </div>
  );
}
