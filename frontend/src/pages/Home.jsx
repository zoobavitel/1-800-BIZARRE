import React, { useState, useEffect, useMemo } from 'react';
import '../styles/Home.css';
import {
  characterAPI,
  campaignAPI,
  npcAPI,
  crewAPI,
  transformBackendToFrontend,
} from '../features/character-sheet';
import { useAuth } from '../features/auth';
import { PATCH_NOTES } from '../data/patchNotes';
import { flattenPatchNotesPreview } from '../utils/patchNotesPreview';
import { buildSessionsByMonth, buildBarChartRows } from '../utils/homeChartData';
import HomeSessionLineChart from '../components/home/HomeSessionLineChart';
import HomeStatsBarChart from '../components/home/HomeStatsBarChart';

function tierRoman(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return '—';
  const map = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  return map[Math.min(n - 1, map.length - 1)] || String(n);
}

function holdLabel(hold) {
  if (!hold) return '—';
  return hold.charAt(0).toUpperCase() + hold.slice(1);
}

function factionStatusClass(rep) {
  const r = Number(rep);
  if (r <= -4) return 'f-status-war';
  if (r < 0) return 'f-status-hostile';
  if (r === 0) return 'f-status-neutral';
  if (r >= 2) return 'f-status-allied';
  return 'f-status-neutral';
}

function factionStatusLabel(rep) {
  const r = Number(rep);
  if (r <= -4) return 'WAR';
  if (r < 0) return 'Hostile';
  if (r === 0) return 'Neutral';
  if (r >= 2) return 'Allied';
  return 'Friendly';
}

const HomePage = ({
  onToggleMenu,
  onSearch,
  onOpenAccountMenu,
  menuOpen = false,
  onNavigateToCharacter,
  onNavigateToCampaign,
  onNavigateToRules,
  onNavigateToPatchNotes,
  onNavigateToLicenses,
  onNavigateToNPC,
}) => {
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [npcs, setNpcs] = useState([]);
  const [npcsLoading, setNpcsLoading] = useState(true);
  const [crewCount, setCrewCount] = useState(0);

  useEffect(() => {
    loadCharacters();
  }, []);

  useEffect(() => {
    if (!user) {
      setCampaigns([]);
      setCampaignsLoading(false);
      setNpcs([]);
      setNpcsLoading(false);
      setCrewCount(0);
      return;
    }
    setCampaignsLoading(true);
    campaignAPI
      .getCampaigns()
      .then((list) => setCampaigns(Array.isArray(list) ? list : []))
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));

    setNpcsLoading(true);
    npcAPI
      .getNPCs()
      .then((list) => setNpcs(Array.isArray(list) ? list : []))
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));

    crewAPI
      .getCrews()
      .then((list) => setCrewCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setCrewCount(0));
  }, [user]);

  const loadCharacters = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendCharacters = await characterAPI.getCharacters();
      const frontendCharacters = (backendCharacters || []).map(transformBackendToFrontend);
      setCharacters(frontendCharacters);
    } catch (err) {
      console.error('Failed to load characters:', err);
      setError(err.message);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  };

  const patchRows = useMemo(() => flattenPatchNotesPreview(PATCH_NOTES, 7), []);

  const heroStats = useMemo(() => {
    const activeCampaigns = (campaigns || []).filter((c) => c.is_active !== false).length;
    const sessionCount = (campaigns || []).reduce(
      (acc, c) => acc + (Array.isArray(c.sessions) ? c.sessions.length : 0),
      0
    );
    const pcCount = characters.length;
    const npcCount = npcs.length;
    return {
      activeCampaigns,
      sessionCount,
      crewCount,
      pcCount,
      npcCount,
    };
  }, [campaigns, characters.length, npcs.length, crewCount]);

  const sessionsByMonth = useMemo(() => buildSessionsByMonth(campaigns), [campaigns]);
  const barChartRows = useMemo(() => buildBarChartRows(heroStats), [heroStats]);
  const chartsLoading = loading || campaignsLoading || npcsLoading;

  const primaryCampaignForFactions = useMemo(() => {
    const withF = (campaigns || []).find((c) => Array.isArray(c.factions) && c.factions.length);
    return withF || (campaigns || [])[0] || null;
  }, [campaigns]);

  const handleCreateCharacter = () => {
    if (typeof onNavigateToCharacter === 'function') onNavigateToCharacter(null);
  };

  const handleEditCharacter = (character) => {
    if (typeof onNavigateToCharacter === 'function' && character?.id) onNavigateToCharacter(character.id);
  };

  const handleDeleteCharacter = async (characterId) => {
    try {
      await characterAPI.deleteCharacter(characterId);
      setCharacters((prev) => prev.filter((char) => char.id !== characterId));
    } catch (err) {
      console.error('Failed to delete character:', err);
      setCharacters((prev) => prev.filter((char) => char.id !== characterId));
    }
  };

  const handleManageCampaign = (campaignId) => {
    if (typeof onNavigateToCampaign === 'function') onNavigateToCampaign(campaignId);
  };

  const handleEditNpc = (npcId) => {
    if (typeof onNavigateToNPC === 'function' && npcId) onNavigateToNPC(npcId);
  };

  const openRules = () => {
    if (typeof onNavigateToRules === 'function') onNavigateToRules();
  };

  return (
    <div className="home-poc">
      <div className="stripe-bar">
        <span />
        <span />
        <span />
        <span />
      </div>

      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <button
              type="button"
              className={`hamburger${menuOpen ? ' open' : ''}`}
              onClick={onToggleMenu}
              aria-label="Open menu"
            >
              <span />
              <span />
              <span />
            </button>
            <a href="#/" className="logo" onClick={(e) => e.preventDefault()}>
              1(800)BIZARRE
            </a>
          </div>
          <div className="header-right">
            <button type="button" className="header-btn" onClick={onSearch}>
              Search
            </button>
            <div className="account-wrapper">
              <button type="button" className="header-btn" onClick={onOpenAccountMenu}>
                Account
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="vhs-badge fade-up d1">Now Playing</div>
            <h1 className="hero-title fade-up d2">
              1(800)
              <br />
              <span className="accent">BIZARRE</span>
            </h1>
            <div className="hero-cta fade-up d3">
              <button type="button" className="btn btn-primary" onClick={handleCreateCharacter}>
                + Create Character
              </button>
              <button type="button" className="btn btn-secondary" onClick={openRules}>
                Game Rules
              </button>
            </div>
          </div>
          <div className="hero-art fade-up d3">
            <div className="hero-art-ghost">VOL.1</div>
            <div className="hero-art-stripes">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="hero-stats">
              <div className="hero-stats-title">Live Stats</div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">
                  <span className="hero-stat-dot hero-stat-dot-green" />
                  Campaigns
                </span>
                <span className="hero-stat-value">{heroStats.activeCampaigns} active</span>
              </div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">
                  <span className="hero-stat-dot hero-stat-dot-amber" />
                  Sessions
                </span>
                <span className="hero-stat-value">{heroStats.sessionCount} played</span>
              </div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">
                  <span className="hero-stat-dot hero-stat-dot-purple" />
                  Crews
                </span>
                <span className="hero-stat-value">{heroStats.crewCount} formed</span>
              </div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">
                  <span className="hero-stat-dot hero-stat-dot-orange" />
                  PCs / NPCs
                </span>
                <span className="hero-stat-value">
                  {heroStats.pcCount} / {heroStats.npcCount}
                </span>
              </div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">Top Ability</span>
                <span className="hero-stat-value highlight">—</span>
              </div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">Luckiest</span>
                <span className="hero-stat-value highlight">—</span>
              </div>
            </div>
            <HomeSessionLineChart data={sessionsByMonth} loading={chartsLoading} />
            <HomeStatsBarChart data={barChartRows} loading={chartsLoading} />
            <div className="hero-art-label">
              <div className="hero-art-label-title">STAND USERS</div>
              <div className="hero-art-label-sub">A Bizarre Adventure TTRPG</div>
            </div>
          </div>
        </div>
      </section>

      <section className="split">
        <div className="split-left">
          <div className="split-label">Player</div>
          <div className="split-action-bar">
            <div className="split-title">Your Characters</div>
            <button type="button" className="split-btn" onClick={handleCreateCharacter}>
              + New
            </button>
          </div>

          {loading ? (
            <p className="home-muted">Loading characters…</p>
          ) : error ? (
            <p className="home-error">
              {error}{' '}
              <button type="button" className="split-btn" onClick={loadCharacters}>
                Retry
              </button>
            </p>
          ) : (
            characters.map((character) => (
              <div key={character.id} className="p-card" role="presentation">
                <div className="p-card-stripe" />
                <div className="p-card-body">
                  <div className="p-card-info">
                    <div className="p-card-name">{character.name || '—'}</div>
                    <div className="p-card-stand">「{character.standName || '—'}」</div>
                    <div className="p-card-tags">
                      <span className="p-tag">{character.heritageName || character.heritage || '—'}</span>
                      <span className="p-tag">{character.playbook || '—'}</span>
                      <span className="p-tag">Lv {character.level ?? '—'}</span>
                    </div>
                  </div>
                  <div className="p-card-actions">
                    <button
                      type="button"
                      className="p-card-btn p-card-btn-primary"
                      onClick={() => handleEditCharacter(character)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="p-card-btn"
                      onClick={() => handleDeleteCharacter(character.id)}
                      aria-label="Delete character"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}

          {!loading && !error && characters.length === 0 && (
            <p className="home-muted">No characters yet.</p>
          )}

          <div className="split-divider">
            <div className="split-divider-bar" />
            <span className="split-divider-label">Your NPCs</span>
            <div className="split-divider-bar" />
          </div>
          <div className="split-npc-row">
            <div className="split-label">Game Master</div>
            <button type="button" className="split-btn split-btn-purple" onClick={() => onNavigateToNPC?.(null)}>
              + New NPC
            </button>
          </div>

          {npcsLoading ? (
            <p className="home-muted">Loading NPCs…</p>
          ) : npcs.length === 0 ? (
            <p className="home-muted">No NPCs yet.</p>
          ) : (
            npcs.slice(0, 8).map((npc) => (
              <div key={npc.id} className="npc-card" role="presentation">
                <div className="npc-card-stripe" />
                <div className="npc-card-body">
                  <div className="npc-card-info">
                    <div className="npc-card-name">{npc.name || '—'}</div>
                    <div className="npc-card-stand">「{npc.stand_name || '—'}」</div>
                    <div className="npc-card-meta">
                      <span>Lv {npc.level ?? '—'}</span>
                      <span>·</span>
                      <span>{npc.role || 'NPC'}</span>
                    </div>
                  </div>
                  <div className="p-card-actions">
                    <button
                      type="button"
                      className="p-card-btn p-card-btn-primary p-card-btn-npc"
                      onClick={() => handleEditNpc(npc.id)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="split-right">
          <div className="split-label">Campaigns</div>
          <div className="split-action-bar">
            <div className="split-title">Your Campaigns</div>
            <button type="button" className="split-btn" onClick={() => onNavigateToCampaign?.(null)}>
              + New Campaign
            </button>
          </div>

          {campaignsLoading ? (
            <p className="home-muted-dark">Loading campaigns…</p>
          ) : campaigns.length === 0 ? (
            <p className="home-muted-dark">No campaigns yet.</p>
          ) : (
            campaigns.map((campaign) => {
              const isGm = user && campaign.gm?.id === user.id;
              const role = isGm ? 'GM' : 'Player';
              const playerCount = Array.isArray(campaign.players) ? campaign.players.length : 0;
              const myChar = (campaign.campaign_characters || []).find((cc) => cc.user_id === user?.id);
              const playingAs = myChar?.true_name || null;
              const sessionCount = Array.isArray(campaign.sessions) ? campaign.sessions.length : 0;
              const live = campaign.active_session_detail;
              const inactive = campaign.is_active === false;

              return (
                <div
                  key={campaign.id}
                  className={`g-card${inactive ? ' g-card-inactive' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleManageCampaign(campaign.id)}
                  onKeyDown={(e) => e.key === 'Enter' && handleManageCampaign(campaign.id)}
                >
                  <div className="g-card-header">
                    <div className="g-card-name">{campaign.name || '—'}</div>
                    <div className="g-card-badges">
                      <span className={`g-badge ${inactive ? 'g-badge-inactive' : 'g-badge-active'}`}>
                        {inactive ? 'Inactive' : 'Active'}
                      </span>
                      <span className={`g-badge ${isGm ? 'g-badge-gm' : 'g-badge-player'}`}>{role}</span>
                    </div>
                  </div>
                  <div className="g-card-desc">{campaign.description || '—'}</div>
                  <div className="g-card-stats">
                    <span>
                      Players
                      <span className="g-card-stat-val">{playerCount}</span>
                    </span>
                    <span>
                      Sessions
                      <span className="g-card-stat-val">{sessionCount}</span>
                    </span>
                    {playingAs && (
                      <span>
                        Playing as
                        <span className="g-card-stat-val g-card-stat-accent">{playingAs}</span>
                      </span>
                    )}
                  </div>
                  {live && !inactive && (
                    <div className="g-session-live">
                      {live.name ? `Session: ${live.name}` : 'Session active'} — open campaign to join
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="split-divider">
            <div className="split-divider-bar" />
            <span className="split-divider-label">Your Factions</span>
            <div className="split-divider-bar" />
          </div>
          <div className="split-npc-row">
            <div>
              {primaryCampaignForFactions ? (
                <div className="split-label">{primaryCampaignForFactions.name}</div>
              ) : (
                <div className="split-label">Factions</div>
              )}
            </div>
            <button type="button" className="split-btn split-btn-amber" onClick={() => onNavigateToCampaign?.(null)}>
              + New Faction
            </button>
          </div>

          {!primaryCampaignForFactions || !Array.isArray(primaryCampaignForFactions.factions) ? (
            <p className="home-muted-dark">No factions yet.</p>
          ) : (
            primaryCampaignForFactions.factions.map((f) => (
              <div key={f.id} className="f-card" role="presentation">
                <div className="f-card-info">
                  <div className="f-card-name">{f.name}</div>
                  <div className="f-card-meta">
                    <span>
                      Tier
                      <span className="f-card-meta-val"> {tierRoman(f.level)}</span>
                    </span>
                    <span>
                      Hold
                      <span className="f-card-meta-val"> {holdLabel(f.hold)}</span>
                    </span>
                    <span>
                      Rep
                      <span className="f-card-meta-val">
                        {' '}
                        {(f.reputation ?? 0) > 0 ? '+' : ''}
                        {f.reputation ?? 0}
                      </span>
                    </span>
                  </div>
                </div>
                <div className={`f-card-status ${factionStatusClass(f.reputation)}`}>
                  {factionStatusLabel(f.reputation)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="quick-strip">
        <button type="button" className="qa" onClick={handleCreateCharacter}>
          <div className="qa-icon">+</div>
          <div className="qa-title">Create Character</div>
          <div className="qa-desc">Build your next Stand user.</div>
          <div className="qa-arrow">→</div>
        </button>
        <button type="button" className="qa" onClick={() => onNavigateToCampaign?.(null)}>
          <div className="qa-icon">☆</div>
          <div className="qa-title">Join Campaign</div>
          <div className="qa-desc">Find other bizarre individuals.</div>
          <div className="qa-arrow">→</div>
        </button>
        <button type="button" className="qa" onClick={openRules}>
          <div className="qa-icon">♦</div>
          <div className="qa-title">Game Rules</div>
          <div className="qa-desc">Master the SRD mechanics.</div>
          <div className="qa-arrow">→</div>
        </button>
        <button type="button" className="qa" onClick={() => onNavigateToCampaign?.(null)}>
          <div className="qa-icon">✎</div>
          <div className="qa-title">Create Campaign</div>
          <div className="qa-desc">Run your own bizarre adventure.</div>
          <div className="qa-arrow">→</div>
        </button>
      </div>

      <section className="patch-section">
        <div className="patch-header">
          <span className="patch-header-title">Recent Changes</span>
          <button type="button" className="patch-header-link" onClick={() => onNavigateToPatchNotes?.()}>
            View all patch notes →
          </button>
        </div>
        <div className="patch-list">
          {patchRows.map((row, i) => (
            <div key={`${row.date}-${i}`} className="patch-entry">
              <div className="patch-date">{row.date}</div>
              <div className="patch-cat">{row.cat}</div>
              <div className="patch-text">{row.text}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-inner">
          <span>
            1(800)BIZARRE © {new Date().getFullYear()} — Based on Blades in the Dark by John Harper (CC BY 3.0)
          </span>
          <div className="footer-links">
            <button type="button" className="footer-link" onClick={() => onNavigateToLicenses?.()}>
              Licenses
            </button>
            <button type="button" className="footer-link" onClick={() => onNavigateToPatchNotes?.()}>
              Patch Notes
            </button>
            <button
              type="button"
              className="footer-link"
              onClick={() => {
                window.location.href = 'mailto:?subject=1(800)BIZARRE%20error%20report';
              }}
            >
              Report Error
            </button>
          </div>
        </div>
      </footer>

      <div className="stripe-bar">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
};

export default HomePage;
