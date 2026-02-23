/**
 * Character page: learns from CharacterSheet.jsx layout and behavior.
 * Same structure (CHARACTER MODE / CREW MODE, current character bar, two-column sheet),
 * but updated: API-driven data, shared SRD constants, no hardcoded content.
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

// Match CharacterSheet.jsx page/chrome styles so the experience is consistent
const PAGE_STYLES = {
  page: { fontFamily: 'monospace', fontSize: '13px', background: '#000', color: '#fff', minHeight: '100vh' },
  topBar: {
    background: '#1f2937',
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #4b5563',
    position: 'sticky',
    top: 0,
    zIndex: 20,
  },
  content: { padding: '16px', maxWidth: '1400px', margin: '0 auto' },
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

export default function CharacterPage({ initialCharacterId = null, onBack }) {
  const [mode, setMode] = useState(MODES.CHARACTER);
  const [characters, setCharacters] = useState([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState(initialCharacterId ?? null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
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
  const [campaignId, setCampaignId] = useState(null);

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
  }, []);

  // When selected character id changes, load full character
  useEffect(() => {
    if (selectedCharacterId == null) {
      setSelectedCharacter(createDefaultCharacter());
      return;
    }
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
    setSelectedCharacter(createDefaultCharacter());
  }, []);

  const handleSwitchCharacter = useCallback((character) => {
    if (character?.id) {
      setSelectedCharacterId(character.id);
      setSelectedCharacter(character);
    }
  }, []);

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
      {/* Top bar: same style as CharacterSheet header — Back, 1(800)BIZARRE, mode tabs, errors */}
      <header style={PAGE_STYLES.topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {typeof onBack === 'function' && (
            <button
              type="button"
              onClick={onBack}
              style={{
                padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
                background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
              }}
            >
              ← Back to Home
            </button>
          )}
          <span style={{ fontSize: '18px', fontWeight: 'bold' }}>1(800) BIZARRE</span>
          <span style={{ color: '#6b7280' }}>—</span>
          <nav style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setMode(MODES.CHARACTER)}
              style={{
                padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
                background: mode === MODES.CHARACTER ? '#374151' : 'transparent',
                color: mode === MODES.CHARACTER ? '#fff' : '#9ca3af',
                cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
              }}
            >
              CHARACTERS
            </button>
            <button
              type="button"
              onClick={() => setMode(MODES.NPC)}
              style={{
                padding: '6px 12px', border: '1px solid #4b5563', borderRadius: '4px',
                background: mode === MODES.NPC ? '#374151' : 'transparent',
                color: mode === MODES.NPC ? '#fff' : '#9ca3af',
                cursor: 'pointer', fontFamily: 'monospace', fontSize: '12px',
              }}
            >
              NPCs
            </button>
          </nav>
        </div>
        {charactersError && (
          <span style={{ fontSize: '12px', color: '#fca5a5' }}>{charactersError}</span>
        )}
      </header>

      {/* Character mode: sheet has its own full layout (header + content) like CharacterSheet.jsx */}
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
