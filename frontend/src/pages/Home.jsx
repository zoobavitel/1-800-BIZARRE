import React, { useState, useEffect, useMemo, useCallback } from "react";
import "../styles/Home.css";
import {
  characterAPI,
  campaignAPI,
  factionAPI,
  npcAPI,
  crewAPI,
  siteStatsAPI,
  transformBackendToFrontend,
} from "../features/character-sheet";
import { useAuth } from "../features/auth";
import { PATCH_NOTES } from "../data/patchNotes";
import {
  flattenPatchNotesPreview,
  sortPatchNotesEntries,
} from "../utils/patchNotesPreview";
import {
  buildSessionsByMonth,
  buildBarChartRows,
} from "../utils/homeChartData";
import HomeSessionLineChart from "../components/home/HomeSessionLineChart";
import HomeStatsBarChart from "../components/home/HomeStatsBarChart";
import HomeStandCoin from "../components/home/HomeStandCoin";

function tierRoman(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const map = ["I", "II", "III", "IV", "V", "VI"];
  return map[Math.min(n - 1, map.length - 1)] || String(n);
}

function holdLabel(hold) {
  if (!hold) return "—";
  return hold.charAt(0).toUpperCase() + hold.slice(1);
}

function factionStatusClass(rep) {
  const r = Number(rep);
  if (r <= -4) return "f-status-war";
  if (r < 0) return "f-status-hostile";
  if (r === 0) return "f-status-neutral";
  if (r >= 2) return "f-status-allied";
  return "f-status-neutral";
}

function factionStatusLabel(rep) {
  const r = Number(rep);
  if (r <= -4) return "WAR";
  if (r < 0) return "Hostile";
  if (r === 0) return "Neutral";
  if (r >= 2) return "Allied";
  return "Friendly";
}

function isPlaceholderNewCharacter(character) {
  if (!character) return false;
  const name = String(character.name || "").trim().toLowerCase();
  if (name !== "new character") return false;

  const hasStandName = String(character.standName || "").trim() !== "";
  const hasHeritage = character.heritage != null && String(character.heritage) !== "";
  const hasBackground = String(character.background || "").trim() !== "";
  const hasLook = String(character.look || "").trim() !== "";
  const hasVice = String(character.vice || "").trim() !== "";
  const hasCrew = String(character.crew || "").trim() !== "";
  const hasAbilities = Array.isArray(character.abilities) && character.abilities.length > 0;
  const hasClocks = Array.isArray(character.clocks) && character.clocks.length > 0;
  const hasActionDots = Object.values(character.actionRatings || {}).some(
    (v) => Number(v) > 0,
  );
  const hasStress = Number(character.stressFilled || 0) > 0;
  const hasXp = Object.values(character.xp || {}).some((v) => Number(v) > 0);

  return !(
    hasStandName ||
    hasHeritage ||
    hasBackground ||
    hasLook ||
    hasVice ||
    hasCrew ||
    hasAbilities ||
    hasClocks ||
    hasActionDots ||
    hasStress ||
    hasXp
  );
}

function getUserDisplayName(person) {
  const username = person?.username;
  return typeof username === "string" && username.trim()
    ? username.trim()
    : "Unknown";
}

function getUserAvatarSrc(person) {
  const profile = person?.profile;
  const avatar = typeof profile?.avatar === "string" ? profile.avatar.trim() : "";
  if (avatar) return avatar;
  const avatarUrl =
    typeof profile?.avatar_url === "string" ? profile.avatar_url.trim() : "";
  return avatarUrl || null;
}

function getInitials(text) {
  const cleaned = typeof text === "string" ? text.trim() : "";
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
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
  const [siteStats, setSiteStats] = useState(null);

  const loadCharacters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const backendCharacters = await characterAPI.getCharacters({ mine: true });
      const frontendCharacters = (backendCharacters || []).map(
        transformBackendToFrontend,
      );
      setCharacters(frontendCharacters);
    } catch (err) {
      console.error("Failed to load characters:", err);
      setError(err.message);
      setCharacters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setCharacters([]);
      setLoading(false);
      setError(null);
      return;
    }
    loadCharacters();
  }, [user, loadCharacters]);

  useEffect(() => {
    if (!user) {
      setSiteStats(null);
      return undefined;
    }
    let cancelled = false;
    siteStatsAPI
      .getSiteStats()
      .then((data) => {
        if (!cancelled && data && typeof data === "object") setSiteStats(data);
      })
      .catch(() => {
        if (!cancelled) setSiteStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
      .getNPCs(undefined, { mine: true })
      .then((list) => setNpcs(Array.isArray(list) ? list : []))
      .catch(() => setNpcs([]))
      .finally(() => setNpcsLoading(false));

    crewAPI
      .getCrews()
      .then((list) => setCrewCount(Array.isArray(list) ? list.length : 0))
      .catch(() => setCrewCount(0));
  }, [user]);

  const patchRows = useMemo(
    () => flattenPatchNotesPreview(sortPatchNotesEntries(PATCH_NOTES), 7),
    [],
  );

  const heroStats = useMemo(() => {
    const activeCampaigns = (campaigns || []).filter(
      (c) => c.is_active !== false,
    ).length;
    const sessionCount = (campaigns || []).reduce(
      (acc, c) => acc + (Array.isArray(c.sessions) ? c.sessions.length : 0),
      0,
    );
    const pcCount = characters.filter((c) => !isPlaceholderNewCharacter(c)).length;
    const npcCount = npcs.length;
    return {
      activeCampaigns,
      sessionCount,
      crewCount,
      pcCount,
      npcCount,
    };
  }, [campaigns, characters, npcs.length, crewCount]);

  const sessionsByMonth = useMemo(
    () => buildSessionsByMonth(campaigns),
    [campaigns],
  );
  const barChartRows = useMemo(() => buildBarChartRows(heroStats), [heroStats]);
  const chartsLoading = loading || campaignsLoading || npcsLoading;

  const playbookLine = useMemo(() => {
    const pc = siteStats?.playbook_counts;
    if (!pc) return "—";
    return `Stand ${pc.STAND ?? 0} · Hamon ${pc.HAMON ?? 0} · Spin ${pc.SPIN ?? 0}`;
  }, [siteStats]);

  const topHeritagesLine = useMemo(() => {
    const list = siteStats?.top_heritages;
    if (!Array.isArray(list) || list.length === 0) return "—";
    return list.map((h) => `${h.name} (${h.count})`).join(", ");
  }, [siteStats]);

  const primaryCampaignForFactions = useMemo(() => {
    const withF = (campaigns || []).find(
      (c) => Array.isArray(c.factions) && c.factions.length,
    );
    return withF || (campaigns || [])[0] || null;
  }, [campaigns]);

  const handleCreateCharacter = () => {
    if (typeof onNavigateToCharacter === "function")
      onNavigateToCharacter(null);
  };

  const handleEditCharacter = (character) => {
    if (typeof onNavigateToCharacter === "function" && character?.id)
      onNavigateToCharacter(character.id);
  };

  const handleDeleteCharacter = async (characterId) => {
    try {
      await characterAPI.deleteCharacter(characterId);
      setCharacters((prev) => prev.filter((char) => char.id !== characterId));
    } catch (err) {
      console.error("Failed to delete character:", err);
      setError(err.message || "Failed to delete character");
    }
  };

  const handleManageCampaign = (campaignId) => {
    if (typeof onNavigateToCampaign === "function")
      onNavigateToCampaign(campaignId);
  };

  const handleEditNpc = (npcId) => {
    if (typeof onNavigateToNPC === "function" && npcId) onNavigateToNPC(npcId);
  };

  const handleDeleteNpc = async (npcId) => {
    try {
      await npcAPI.deleteNPC(npcId);
      setNpcs((prev) => prev.filter((npc) => npc.id !== npcId));
    } catch (err) {
      console.error("Failed to delete NPC:", err);
    }
  };

  const handleDeleteFaction = async (factionId) => {
    if (!window.confirm("Delete this faction?")) return;
    try {
      await factionAPI.deleteFaction(factionId);
      setCampaignsLoading(true);
      campaignAPI
        .getCampaigns()
        .then((list) => setCampaigns(Array.isArray(list) ? list : []))
        .catch(() => setCampaigns([]))
        .finally(() => setCampaignsLoading(false));
    } catch (err) {
      console.error("Failed to delete faction:", err);
    }
  };

  const openRules = () => {
    if (typeof onNavigateToRules === "function") onNavigateToRules();
  };

  return (
    <div className="home-poc">
      <header className="site-header">
        <div className="header-inner">
          <div className="header-left">
            <button
              type="button"
              className={`hamburger${menuOpen ? " open" : ""}`}
              onClick={onToggleMenu}
              aria-label="Open menu"
            >
              <span />
              <span />
              <span />
            </button>
            <a href="#/" className="logo" onClick={(e) => e.preventDefault()}>
              <span className="logo-part1">1(800)</span>
              <span className="logo-part2">BIZARRE</span>
            </a>
          </div>
          <div className="header-right">
            <button
              type="button"
              className="header-btn header-btn-ghost"
              onClick={onSearch}
            >
              Search
            </button>
            <div className="account-wrapper">
              <button
                type="button"
                className="header-btn header-btn-fill"
                onClick={onOpenAccountMenu}
              >
                Account
              </button>
            </div>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-text">
            <div className="vhs-badge fade-up d1">A Bizarre Adventure TTRPG</div>
            <h1 className="hero-title fade-up d2">
              <span className="hero-title-stand">STAND</span>
              <br />
              <span className="accent">PROUD.</span>
            </h1>
            <div className="hero-pills fade-up d2">
              <span className="pill pill-stand">Stand</span>
              <span className="pill pill-hamon">Hamon</span>
              <span className="pill pill-spin">Spin</span>
            </div>
            <p className="hero-subtext fade-up d2">
              Fate is truly a very long, roundabout path...
            </p>
            <div className="hero-cta fade-up d3">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateCharacter}
              >
                + Create Character
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={openRules}
              >
                Game Rules
              </button>
            </div>
          </div>
          <div className="hero-coin-column fade-up d3">
            <HomeStandCoin />
          </div>
        </div>
      </section>

      <section className="split">
        <div className="split-left">
          <div className="split-label">Player</div>
          <div className="split-action-bar">
            <div className="split-title">Your Characters</div>
            <button
              type="button"
              className="split-btn"
              onClick={handleCreateCharacter}
            >
              + New
            </button>
          </div>

          {loading ? (
            <p className="home-muted">Loading characters…</p>
          ) : error ? (
            <p className="home-error">
              {error}{" "}
              <button
                type="button"
                className="split-btn"
                onClick={loadCharacters}
              >
                Retry
              </button>
            </p>
          ) : (
            characters.map((character) => (
              <div key={character.id} className="p-card" role="presentation">
                <div className="p-card-stripe" />
                <div className="p-card-body">
                  <div className="p-card-info">
                    <div className="p-card-name">{character.name || "—"}</div>
                    <div className="p-card-stand">
                      「{character.standName || "—"}」
                    </div>
                    <div className="p-card-tags">
                      <span className="p-tag">
                        {character.heritageName || character.heritage || "—"}
                      </span>
                      <span className="p-tag">{character.playbook || "—"}</span>
                      <span className="p-tag">Lv {character.level ?? "—"}</span>
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
                      className="p-card-btn p-card-btn-delete"
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
            <button
              type="button"
              className="split-btn split-btn-purple"
              onClick={() => onNavigateToNPC?.(null)}
            >
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
                    <div className="npc-card-name">{npc.name || "—"}</div>
                    <div className="npc-card-stand">
                      「{npc.stand_name || "—"}」
                    </div>
                    <div className="npc-card-meta">
                      <span>Lv {npc.level ?? "—"}</span>
                      <span>·</span>
                      <span>{npc.role || "NPC"}</span>
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
                    <button
                      type="button"
                      className="p-card-btn p-card-btn-delete"
                      onClick={() => handleDeleteNpc(npc.id)}
                      aria-label="Delete NPC"
                    >
                      ×
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
            <button
              type="button"
              className="split-btn"
              onClick={() => onNavigateToCampaign?.(null)}
            >
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
              const playerCount = Array.isArray(campaign.players)
                ? campaign.players.length
                : 0;
              const players = Array.isArray(campaign.players) ? campaign.players : [];
              const gmName = getUserDisplayName(campaign.gm);
              const gmAvatarSrc = getUserAvatarSrc(campaign.gm);
              const myChar = (campaign.campaign_characters || []).find(
                (cc) => cc.user_id === user?.id,
              );
              const playingAs = myChar?.true_name || null;
              const sessionCount = Array.isArray(campaign.sessions)
                ? campaign.sessions.length
                : 0;
              const visiblePlayers = players.slice(0, 5);
              const extraPlayers = Math.max(players.length - visiblePlayers.length, 0);
              const live = campaign.active_session_detail;
              const inactive = campaign.is_active === false;

              return (
                <div
                  key={campaign.id}
                  className={`g-card${inactive ? " g-card-inactive" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleManageCampaign(campaign.id)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleManageCampaign(campaign.id)
                  }
                >
                  <div className="g-card-header">
                    <div className="g-card-name">{campaign.name || "—"}</div>
                    <div className="g-card-badges">
                      <span
                        className={`g-badge ${inactive ? "g-badge-inactive" : "g-badge-active"}`}
                      >
                        {inactive ? "Inactive" : "Active"}
                      </span>
                    </div>
                  </div>
                  <div className="g-card-gm-row">
                    <span className="g-card-gm-label">GM</span>
                    <div className={`g-card-gm-chip${isGm ? " is-self" : ""}`}>
                      <span className="g-card-user-avatar" aria-hidden="true">
                        {gmAvatarSrc ? (
                          <img src={gmAvatarSrc} alt="" />
                        ) : (
                          getInitials(gmName)
                        )}
                      </span>
                      <span className="g-card-user-name">{gmName}</span>
                    </div>
                  </div>
                  <div className="g-card-desc">
                    {campaign.description || "—"}
                  </div>
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
                        <span className="g-card-stat-val g-card-stat-accent">
                          {playingAs}
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="g-card-player-list">
                    {visiblePlayers.length === 0 ? (
                      <span className="g-card-player-empty">No players yet</span>
                    ) : (
                      visiblePlayers.map((player) => {
                        const playerName = getUserDisplayName(player);
                        const playerAvatarSrc = getUserAvatarSrc(player);
                        return (
                          <span key={player.id || playerName} className="g-card-player-chip">
                            <span className="g-card-user-avatar" aria-hidden="true">
                              {playerAvatarSrc ? (
                                <img src={playerAvatarSrc} alt="" />
                              ) : (
                                getInitials(playerName)
                              )}
                            </span>
                            <span className="g-card-user-name">{playerName}</span>
                          </span>
                        );
                      })
                    )}
                    {extraPlayers > 0 && (
                      <span className="g-card-player-chip g-card-player-chip-more">
                        +{extraPlayers} more
                      </span>
                    )}
                  </div>
                  {live && !inactive && (
                    <div className="g-session-live">
                      {live.name ? `Session: ${live.name}` : "Session active"} —
                      open campaign to join
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
                <div className="split-label">
                  {primaryCampaignForFactions.name}
                </div>
              ) : (
                <div className="split-label">Factions</div>
              )}
            </div>
            <button
              type="button"
              className="split-btn split-btn-amber"
              onClick={() => onNavigateToCampaign?.(null)}
            >
              + New Faction
            </button>
          </div>

          {!primaryCampaignForFactions ||
          !Array.isArray(primaryCampaignForFactions.factions) ? (
            <p className="home-muted-dark">No factions yet.</p>
          ) : (
            primaryCampaignForFactions.factions.map((f) => (
              <div key={f.id} className="f-card" role="presentation">
                <div className="f-card-info">
                  <div className="f-card-name">{f.name}</div>
                  <div className="f-card-meta">
                    <span>
                      Tier
                      <span className="f-card-meta-val">
                        {" "}
                        {tierRoman(f.level)}
                      </span>
                    </span>
                    <span>
                      Hold
                      <span className="f-card-meta-val">
                        {" "}
                        {holdLabel(f.hold)}
                      </span>
                    </span>
                    <span>
                      Rep
                      <span className="f-card-meta-val">
                        {" "}
                        {(f.reputation ?? 0) > 0 ? "+" : ""}
                        {f.reputation ?? 0}
                      </span>
                    </span>
                  </div>
                </div>
                <div className="f-card-right">
                  <div
                    className={`f-card-status ${factionStatusClass(f.reputation)}`}
                  >
                    {factionStatusLabel(f.reputation)}
                  </div>
                  <div className="f-card-actions">
                    <button
                      type="button"
                      className="f-card-btn f-card-btn-edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToCampaign?.(
                          primaryCampaignForFactions.id,
                          { factionId: f.id },
                        );
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="f-card-btn f-card-btn-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFaction(f.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
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
        <button
          type="button"
          className="qa"
          onClick={() => onNavigateToCampaign?.(null)}
        >
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
        <button
          type="button"
          className="qa"
          onClick={() => onNavigateToCampaign?.(null)}
        >
          <div className="qa-icon">✎</div>
          <div className="qa-title">Create Campaign</div>
          <div className="qa-desc">Run your own bizarre adventure.</div>
          <div className="qa-arrow">→</div>
        </button>
      </div>

      <section className="home-stats-section">
        <div className="home-stats-inner">
          <div className="hero-art fade-up d3">
            <div className="hero-art-ghost">VOL.1</div>
            <div className="hero-stats">
              <div className="hero-stats-title">Live Stats</div>
              <div className="hero-stat-row">
                <span className="hero-stat-label">
                  <span className="hero-stat-dot hero-stat-dot-green" />
                  Campaigns
                </span>
                <span className="hero-stat-value">
                  {heroStats.activeCampaigns} active
                </span>
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
              <div className="hero-stat-row hero-stat-row-tall">
                <span className="hero-stat-label">Stand / Hamon / Spin</span>
                <span className="hero-stat-value hero-stat-value-compact">
                  {playbookLine}
                </span>
              </div>
              <div className="hero-stat-row hero-stat-row-tall">
                <span className="hero-stat-label">Top heritages</span>
                <span className="hero-stat-value hero-stat-value-compact">
                  {topHeritagesLine}
                </span>
              </div>
            </div>
            <HomeSessionLineChart
              data={sessionsByMonth}
              loading={chartsLoading}
            />
            <HomeStatsBarChart data={barChartRows} loading={chartsLoading} />
            <div className="hero-art-label">
              <div className="hero-art-label-title">STAND USERS</div>
              <div className="hero-art-label-sub">
                A Bizarre Adventure TTRPG
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="patch-section">
        <div className="patch-header">
          <span className="patch-header-title">Recent Changes</span>
          <button
            type="button"
            className="patch-header-link"
            onClick={() => onNavigateToPatchNotes?.()}
          >
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
            <span className="footer-logo">1(800)BIZARRE</span>
            <span className="footer-copyright">
              © {new Date().getFullYear()} — Based on Blades in the Dark by
              John Harper (CC BY 3.0)
            </span>
          </span>
          <div className="footer-links">
            <button
              type="button"
              className="footer-link"
              onClick={() => onNavigateToLicenses?.()}
            >
              Licenses
            </button>
            <button
              type="button"
              className="footer-link"
              onClick={() => onNavigateToPatchNotes?.()}
            >
              Patch Notes
            </button>
            <button
              type="button"
              className="footer-link"
              onClick={() => {
                window.location.href =
                  "mailto:?subject=1(800)BIZARRE%20error%20report";
              }}
            >
              Report Error
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default HomePage;
