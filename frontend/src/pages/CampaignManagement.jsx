import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  campaignAPI,
  characterAPI,
  factionAPI,
  npcAPI,
  sessionAPI,
  progressClockAPI,
  rollAPI,
  crewAPI,
} from "../features/character-sheet";
import {
  PositionStack,
  EffectShapes,
  HistoryBranchIcon,
} from "../components/position-effect/PositionEffectIndicators";
import { useAuth } from "../features/auth";

const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  content: { padding: "16px", maxWidth: "1000px", margin: "0 auto" },
  card: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "4px",
    padding: "16px",
    marginBottom: "12px",
  },
  lbl: {
    color: "#f87171",
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "4px",
    display: "block",
  },
  sectionLbl: {
    color: "#60a5fa",
    fontSize: "11px",
    fontWeight: "bold",
    marginBottom: "8px",
    marginTop: "16px",
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  inp: {
    background: "transparent",
    color: "#fff",
    border: "none",
    borderBottom: "1px solid #4b5563",
    padding: "4px 6px",
    width: "100%",
    fontFamily: "monospace",
    fontSize: "13px",
    outline: "none",
    boxSizing: "border-box",
  },
  select: {
    background: "#0d1117",
    color: "#fff",
    border: "1px solid #374151",
    borderRadius: "4px",
    padding: "4px 6px",
    fontFamily: "monospace",
    fontSize: "13px",
    outline: "none",
  },
  btn: {
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
  },
  btnPrimary: {
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "#7c3aed",
    color: "#fff",
  },
  btnDanger: {
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "#dc2626",
    color: "#fff",
  },
  btnGhost: {
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "#374151",
    color: "#d1d5db",
  },
  btnSuccess: {
    padding: "6px 14px",
    borderRadius: "4px",
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    fontFamily: "monospace",
    background: "#16a34a",
    color: "#fff",
  },
  emptyState: { textAlign: "center", padding: "48px 16px", color: "#6b7280" },
  badge: {
    fontSize: "10px",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontWeight: "bold",
    display: "inline-block",
  },
  divider: { borderTop: "1px solid #1f2937", margin: "12px 0" },
  err: {
    background: "#7f1d1d",
    border: "1px solid #b91c1c",
    borderRadius: "4px",
    padding: "8px 12px",
    fontSize: "12px",
    color: "#fca5a5",
    marginBottom: "12px",
  },
  row: { display: "flex", alignItems: "center", gap: "8px" },
  tag: {
    fontSize: "10px",
    padding: "1px 6px",
    borderRadius: "4px",
    fontFamily: "monospace",
  },
};

const PLAYBOOK_LABELS = {
  STAND: "Stand User",
  HAMON: "Hamon User",
  SPIN: "Spin User",
};
const PLAYBOOK_COLORS = { STAND: "#a78bfa", HAMON: "#fbbf24", SPIN: "#34d399" };

function PlaybookTag({ playbook }) {
  return (
    <span
      style={{
        ...S.tag,
        background: PLAYBOOK_COLORS[playbook] || "#4b5563",
        color: "#000",
      }}
    >
      {PLAYBOOK_LABELS[playbook] || playbook}
    </span>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      style={{
        ...S.badge,
        background: active ? "#064e3b" : "#7f1d1d",
        color: active ? "#6ee7b7" : "#fca5a5",
      }}
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function RoleBadge({ role }) {
  return (
    <span
      style={{
        ...S.badge,
        background: role === "GM" ? "#7c3aed" : "#1e40af",
        color: "#fff",
      }}
    >
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Invitation banner shown at the top of the list view
// ---------------------------------------------------------------------------
function PendingInvitations({ invitations, onAccept, onDecline }) {
  if (!invitations.length) return null;
  return (
    <div style={{ ...S.card, border: "1px solid #fbbf24" }}>
      <span style={{ ...S.lbl, color: "#fbbf24" }}>PENDING INVITATIONS</span>
      {invitations.map((inv) => (
        <div
          key={inv.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "6px 0",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <div>
            <span style={{ fontWeight: "bold" }}>{inv.campaign_name}</span>
            <span
              style={{ color: "#9ca3af", fontSize: "11px", marginLeft: "8px" }}
            >
              from {inv.invited_by?.username}
            </span>
          </div>
          <div style={S.row}>
            <button onClick={() => onAccept(inv.id)} style={S.btnSuccess}>
              Accept
            </button>
            <button onClick={() => onDecline(inv.id)} style={S.btnGhost}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign Detail View
// ---------------------------------------------------------------------------
function CampaignDetail({
  campaign,
  isGM,
  user,
  onBack,
  onRefresh,
  onManageSessions,
  onNavigateToCharacter,
  onNavigateToNPC,
  onCampaignDeleted,
  initialFactionId = null,
}) {
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteError, setInviteError] = useState(null);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [invitableUsers, setInvitableUsers] = useState([]);
  const [myCharacters, setMyCharacters] = useState([]);
  const [allNPCs, setAllNPCs] = useState([]);
  const [factionForm, setFactionForm] = useState(null);
  const [factionError, setFactionError] = useState(null);
  const [crewForm, setCrewForm] = useState(null);
  const [crewError, setCrewError] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [assignNpcId, setAssignNpcId] = useState("");

  const factionEditFiredRef = useRef(false);
  useEffect(() => {
    if (
      initialFactionId &&
      campaign &&
      Array.isArray(campaign.factions) &&
      !factionForm &&
      !factionEditFiredRef.current
    ) {
      const f = campaign.factions.find((fac) => fac.id === initialFactionId);
      if (f) {
        factionEditFiredRef.current = true;
        startFactionEdit(f);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFactionId, campaign]);

  useEffect(() => {
    characterAPI
      .getCharacters()
      .then(setMyCharacters)
      .catch(() => setMyCharacters([]));
    if (isGM) {
      npcAPI
        .getNPCs()
        .then(setAllNPCs)
        .catch(() => setAllNPCs([]));
    }
  }, [isGM]);

  useEffect(() => {
    if (isGM && campaign?.id) {
      campaignAPI
        .getInvitableUsers(campaign.id)
        .then(setInvitableUsers)
        .catch(() => setInvitableUsers([]));
    }
  }, [isGM, campaign?.id]);

  const availableToAssign = isGM
    ? myCharacters.filter(
        (ch) =>
          ch.id &&
          ch.campaign !== campaign?.id &&
          ch.campaign?.id !== campaign?.id,
      )
    : myCharacters.filter((ch) => !ch.campaign && ch.id);
  const npcsThatCanBeAdded = allNPCs.filter((n) => !n.campaign);
  const campaignNPCs = allNPCs.filter(
    (n) => n.campaign === campaign?.id || n.campaign?.id === campaign?.id,
  );

  const handleInvite = async () => {
    setInviteError(null);
    setInviteSuccess(null);
    if (!inviteUsername.trim()) return;
    try {
      await campaignAPI.invitePlayer(campaign.id, inviteUsername.trim());
      setInviteSuccess(`Invitation sent to ${inviteUsername.trim()}`);
      setInviteUsername("");
      onRefresh();
      campaignAPI
        .getInvitableUsers(campaign.id)
        .then(setInvitableUsers)
        .catch(() => setInvitableUsers([]));
    } catch (err) {
      setInviteError(err.message);
    }
  };

  const handleToggleActive = async () => {
    setActionError(null);
    try {
      if (campaign.is_active) {
        await campaignAPI.deactivateCampaign(campaign.id);
      } else {
        await campaignAPI.activateCampaign(campaign.id);
      }
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDeleteCampaign = async () => {
    if (
      !window.confirm(
        `Permanently delete "${campaign.name}"? Sessions, clocks, and other campaign data will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await campaignAPI.deleteCampaign(campaign.id);
      onCampaignDeleted?.();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAssignCharacter = async (characterId) => {
    setActionError(null);
    try {
      await campaignAPI.assignCharacter(campaign.id, characterId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUnassignCharacter = async (characterId) => {
    setActionError(null);
    try {
      await campaignAPI.unassignCharacter(campaign.id, characterId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleAssignNPC = async () => {
    if (!assignNpcId) return;
    setActionError(null);
    try {
      await npcAPI.patchNPC(assignNpcId, { campaign: campaign.id });
      onRefresh();
      setAssignNpcId("");
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUnassignNPC = async (npcId) => {
    setActionError(null);
    try {
      await npcAPI.patchNPC(npcId, { campaign: null });
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleShowcaseNpc = async (npcId) => {
    setActionError(null);
    try {
      await campaignAPI.showcaseNpc(campaign.id, npcId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleToggleShowClocks = async (showcasedId, showClocks) => {
    setActionError(null);
    try {
      await campaignAPI.patchShowcasedNpc(showcasedId, {
        show_clocks_to_party: showClocks,
      });
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleUnshowcaseNpc = async (showcasedId) => {
    setActionError(null);
    try {
      await campaignAPI.deleteShowcasedNpc(showcasedId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const showcasedNpcIds = (campaign.showcased_npcs || [])
    .map((s) => s.npc?.id)
    .filter(Boolean);

  const startFactionCreate = () =>
    setFactionForm({
      name: "",
      faction_type: "",
      level: 0,
      hold: "weak",
      reputation: 0,
      notes: "",
    });
  const startFactionEdit = (f) =>
    setFactionForm({
      id: f.id,
      name: f.name,
      faction_type: f.faction_type || "",
      level: f.level,
      hold: f.hold,
      reputation: f.reputation,
      notes: f.notes || "",
      npcs: f.npcs || [],
    });

  const [factionAddNpcId, setFactionAddNpcId] = useState("");
  const handleAddNpcToFaction = async () => {
    if (!factionAddNpcId || !factionForm?.id) return;
    setFactionError(null);
    const npcId = parseInt(factionAddNpcId, 10);
    const npc = campaignNPCs.find((n) => n.id === npcId);
    try {
      await npcAPI.patchNPC(factionAddNpcId, { faction: factionForm.id });
      setFactionAddNpcId("");
      setFactionForm((p) => ({
        ...p,
        npcs: [...(p.npcs || []), npc || { id: npcId, name: "NPC" }].filter(
          (n, i, a) => a.findIndex((x) => x.id === n.id) === i,
        ),
      }));
      onRefresh();
    } catch (err) {
      setFactionError(err.message);
    }
  };
  const handleRemoveNpcFromFaction = async (npcId) => {
    setFactionError(null);
    try {
      await npcAPI.patchNPC(npcId, { faction: null });
      setFactionForm((p) => ({
        ...p,
        npcs: (p.npcs || []).filter((n) => n.id !== npcId),
      }));
      onRefresh();
    } catch (err) {
      setFactionError(err.message);
    }
  };

  const handleFactionSave = async () => {
    setFactionError(null);
    if (!factionForm.name.trim()) {
      setFactionError("Name is required.");
      return;
    }
    try {
      if (factionForm.id) {
        await factionAPI.updateFaction(factionForm.id, {
          ...factionForm,
          campaign: campaign.id,
        });
      } else {
        await factionAPI.createFaction({
          ...factionForm,
          campaign: campaign.id,
        });
      }
      setFactionForm(null);
      onRefresh();
    } catch (err) {
      setFactionError(err.message);
    }
  };

  const handleFactionDelete = async (factionId) => {
    try {
      await factionAPI.deleteFaction(factionId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startCrewCreate = () =>
    setCrewForm({
      name: "",
      description: "",
      level: 0,
      hold: "weak",
      rep: 0,
      wanted_level: 0,
      coin: 0,
    });
  const startCrewEdit = (c) =>
    setCrewForm({
      id: c.id,
      name: c.name,
      description: c.description || "",
      level: c.level,
      hold: c.hold,
      rep: c.rep,
      wanted_level: c.wanted_level,
      coin: c.coin,
    });

  const handleCrewSave = async () => {
    setCrewError(null);
    if (!crewForm.name.trim()) {
      setCrewError("Crew name is required.");
      return;
    }
    try {
      if (crewForm.id) {
        await crewAPI.patchCrew(crewForm.id, {
          name: crewForm.name,
          description: crewForm.description,
          level: crewForm.level,
          hold: crewForm.hold,
          rep: crewForm.rep,
          wanted_level: crewForm.wanted_level,
          coin: crewForm.coin,
        });
      } else {
        await crewAPI.createCrew({
          ...crewForm,
          campaign: campaign.id,
        });
      }
      setCrewForm(null);
      onRefresh();
    } catch (err) {
      setCrewError(err.message);
    }
  };

  const handleCrewDelete = async (crewId) => {
    try {
      await crewAPI.deleteCrew(crewId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const startCampaignEdit = () =>
    setEditForm({
      name: campaign.name,
      description: campaign.description || "",
    });

  const handleCampaignEditSave = async () => {
    if (!editForm.name.trim()) return;
    try {
      await campaignAPI.updateCampaign(campaign.id, editForm);
      setEditForm(null);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  return (
    <div>
      {/* Back button */}
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: "12px" }}>
        {"< Back to Campaigns"}
      </button>

      {actionError && <div style={S.err}>{actionError}</div>}

      {/* Header */}
      <div style={{ ...S.card, border: "1px solid #4b5563" }}>
        {editForm ? (
          <>
            <span style={S.lbl}>EDIT CAMPAIGN</span>
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>Name</span>
              <input
                style={S.inp}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, name: e.target.value }))
                }
                autoFocus
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                Description
              </span>
              <textarea
                style={{
                  ...S.inp,
                  height: "60px",
                  resize: "vertical",
                  border: "1px solid #374151",
                  background: "#0d1117",
                  padding: "6px",
                }}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
            <div style={S.row}>
              <button onClick={handleCampaignEditSave} style={S.btnPrimary}>
                Save
              </button>
              <button onClick={() => setEditForm(null)} style={S.btnGhost}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    marginBottom: "4px",
                  }}
                >
                  {campaign.name}
                </div>
                {campaign.description && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#9ca3af",
                      marginBottom: "6px",
                    }}
                  >
                    {campaign.description}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <StatusBadge active={campaign.is_active} />
                  <RoleBadge role={isGM ? "GM" : "Player"} />
                  <span style={{ fontSize: "11px", color: "#6b7280" }}>
                    GM: {campaign.gm?.username} | Started{" "}
                    {campaign.created_at
                      ? new Date(campaign.created_at).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              </div>
              {isGM && (
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button onClick={onManageSessions} style={S.btnPrimary}>
                    Manage Sessions
                  </button>
                  <button onClick={startCampaignEdit} style={S.btnGhost}>
                    Edit
                  </button>
                  <button
                    onClick={handleToggleActive}
                    style={campaign.is_active ? S.btnDanger : S.btnSuccess}
                  >
                    {campaign.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button onClick={handleDeleteCampaign} style={S.btnDanger}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Players & Characters */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Players &amp; Characters</span>
        {(campaign.campaign_characters || []).length === 0 &&
        (campaign.players || []).length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "12px" }}>
            No players have joined yet.
          </div>
        ) : (
          <>
            {/* Show GM (and GM's assigned character when they have one) */}
            {(() => {
              const gmChars = (campaign.campaign_characters || []).filter(
                (ch) => ch.user_id === campaign.gm?.id,
              );
              return (
                <div
                  style={{
                    padding: "6px 0",
                    borderBottom: "1px solid #1f2937",
                  }}
                >
                  <div style={S.row}>
                    <span style={{ fontWeight: "bold", color: "#d1d5db" }}>
                      {campaign.gm?.username}
                    </span>
                    <RoleBadge role="GM" />
                  </div>
                  {gmChars.length > 0 &&
                    gmChars.map((ch) => (
                      <div
                        key={ch.id}
                        style={{
                          paddingLeft: "12px",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          marginTop: "2px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ color: "#9ca3af" }}>PC:</span>
                        <span style={{ color: "#e5e7eb" }}>
                          {ch.true_name || ch.alias || "Unnamed"}
                        </span>
                        {ch.stand_name && (
                          <span style={{ color: "#9ca3af" }}>
                            Stand: {ch.stand_name}
                          </span>
                        )}
                        <PlaybookTag playbook={ch.playbook} />
                        {ch.heritage_name && (
                          <span
                            style={{
                              ...S.tag,
                              background: "#374151",
                              color: "#9ca3af",
                            }}
                          >
                            {ch.heritage_name}
                          </span>
                        )}
                        {typeof onNavigateToCharacter === "function" && (
                          <button
                            onClick={() => onNavigateToCharacter(ch.id)}
                            style={{
                              ...S.btn,
                              fontSize: "10px",
                              padding: "2px 6px",
                              background: "#1d4ed8",
                              color: "#93c5fd",
                            }}
                          >
                            View
                          </button>
                        )}
                        {user?.id === campaign.gm?.id && (
                          <button
                            onClick={() => handleUnassignCharacter(ch.id)}
                            style={{
                              ...S.btn,
                              fontSize: "10px",
                              padding: "2px 6px",
                              background: "#7f1d1d",
                              color: "#fca5a5",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              );
            })()}
            {/* Group characters by user */}
            {(() => {
              const playerMap = {};
              (campaign.players || []).forEach((p) => {
                playerMap[p.id] = { ...p, characters: [] };
              });
              (campaign.campaign_characters || []).forEach((ch) => {
                if (!playerMap[ch.user_id])
                  playerMap[ch.user_id] = {
                    id: ch.user_id,
                    username: ch.username,
                    characters: [],
                  };
                playerMap[ch.user_id].characters.push(ch);
              });
              return Object.values(playerMap)
                .filter((p) => p.id !== campaign.gm?.id)
                .map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: "6px 0",
                      borderBottom: "1px solid #1f2937",
                    }}
                  >
                    <div style={{ ...S.row, marginBottom: "4px" }}>
                      <span style={{ fontWeight: "bold", color: "#d1d5db" }}>
                        {p.username}
                      </span>
                      <RoleBadge role="Player" />
                    </div>
                    {p.characters.length === 0 ? (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "#6b7280",
                          paddingLeft: "12px",
                        }}
                      >
                        No character assigned
                      </div>
                    ) : (
                      p.characters.map((ch) => (
                        <div
                          key={ch.id}
                          style={{
                            paddingLeft: "12px",
                            fontSize: "12px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "2px",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ color: "#e5e7eb" }}>
                            {ch.true_name || ch.alias || "Unnamed"}
                          </span>
                          {ch.stand_name && (
                            <span style={{ color: "#9ca3af" }}>
                              Stand: {ch.stand_name}
                            </span>
                          )}
                          <PlaybookTag playbook={ch.playbook} />
                          {ch.heritage_name && (
                            <span
                              style={{
                                ...S.tag,
                                background: "#374151",
                                color: "#9ca3af",
                              }}
                            >
                              {ch.heritage_name}
                            </span>
                          )}
                          {typeof onNavigateToCharacter === "function" && (
                            <button
                              onClick={() => onNavigateToCharacter(ch.id)}
                              style={{
                                ...S.btn,
                                fontSize: "10px",
                                padding: "2px 6px",
                                background: "#1d4ed8",
                                color: "#93c5fd",
                              }}
                            >
                              View
                            </button>
                          )}
                          {p.id === user?.id && (
                            <button
                              onClick={() => handleUnassignCharacter(ch.id)}
                              style={{
                                ...S.btn,
                                fontSize: "10px",
                                padding: "2px 6px",
                                background: "#7f1d1d",
                                color: "#fca5a5",
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                ));
            })()}
          </>
        )}

        {/* Pending invitations (GM view) */}
        {isGM && (campaign.pending_invitations || []).length > 0 && (
          <>
            <div style={{ ...S.divider }} />
            <span
              style={{ fontSize: "11px", color: "#fbbf24", fontWeight: "bold" }}
            >
              PENDING INVITATIONS
            </span>
            {campaign.pending_invitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  fontSize: "12px",
                  color: "#9ca3af",
                  paddingLeft: "12px",
                  marginTop: "2px",
                }}
              >
                {inv.invited_user?.username} (invited by{" "}
                {inv.invited_by?.username})
              </div>
            ))}
          </>
        )}
      </div>

      {/* Invite Player (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Invite Player</span>
          {inviteError && (
            <div style={{ ...S.err, marginBottom: "8px" }}>{inviteError}</div>
          )}
          {inviteSuccess && (
            <div
              style={{
                background: "#064e3b",
                border: "1px solid #059669",
                borderRadius: "4px",
                padding: "8px 12px",
                fontSize: "12px",
                color: "#6ee7b7",
                marginBottom: "8px",
              }}
            >
              {inviteSuccess}
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              style={{ ...S.inp, flex: 1 }}
              value={inviteUsername}
              onChange={(e) => setInviteUsername(e.target.value)}
              placeholder="Enter username"
              onKeyDown={(e) => e.key === "Enter" && handleInvite()}
            />
            <button onClick={handleInvite} style={S.btnPrimary}>
              Invite
            </button>
          </div>
          {invitableUsers.length > 0 && (
            <>
              <span
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  marginTop: "12px",
                  display: "block",
                }}
              >
                Or select from registered users
              </span>
              <select
                style={{ ...S.select, marginTop: "6px", flex: 1 }}
                value=""
                onChange={(e) => {
                  const u = invitableUsers.find(
                    (u) => String(u.id) === e.target.value,
                  );
                  if (u) setInviteUsername(u.username);
                  e.target.value = "";
                }}
              >
                <option value="" disabled>
                  Select a user to invite...
                </option>
                {invitableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      )}

      {/* Assign Character (GM or player who is in the campaign) */}
      {(isGM || campaign.players?.some((p) => p.id === user?.id)) &&
        availableToAssign.length > 0 && (
          <div style={S.card}>
            <span style={S.sectionLbl}>Assign a Character</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <select
                style={{ ...S.select, flex: 1 }}
                defaultValue=""
                onChange={(e) =>
                  e.target.value &&
                  handleAssignCharacter(parseInt(e.target.value, 10))
                }
              >
                <option value="" disabled>
                  Select a character...
                </option>
                {availableToAssign.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.true_name || ch.alias || `Character #${ch.id}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

      {/* NPCs (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Campaign NPCs</span>
          {(campaign.campaign_npcs || []).length === 0 ? (
            <div style={{ color: "#6b7280", fontSize: "12px" }}>
              No NPCs assigned to this campaign.
            </div>
          ) : (
            (campaign.campaign_npcs || []).map((npc) => (
              <div
                key={npc.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "4px 0",
                  borderBottom: "1px solid #1f2937",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ color: "#e5e7eb", fontWeight: "bold" }}>
                    {npc.name}
                  </span>
                  <span style={{ color: "#6b7280" }}>Lv.{npc.level}</span>
                  {npc.stand_name && (
                    <span style={{ color: "#9ca3af" }}>
                      Stand: {npc.stand_name}
                    </span>
                  )}
                  <PlaybookTag playbook={npc.playbook} />
                  {npc.heritage_name && (
                    <span
                      style={{
                        ...S.tag,
                        background: "#374151",
                        color: "#9ca3af",
                      }}
                    >
                      {npc.heritage_name}
                    </span>
                  )}
                  {typeof onNavigateToNPC === "function" && (
                    <>
                      <button
                        onClick={() => onNavigateToNPC(npc.id)}
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#1d4ed8",
                          color: "#93c5fd",
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}#npcs/${npc.id}`;
                          navigator.clipboard?.writeText(url);
                          alert("Link copied to clipboard");
                        }}
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#374151",
                          color: "#9ca3af",
                        }}
                        title="Copy link"
                      >
                        Link
                      </button>
                    </>
                  )}
                  {!showcasedNpcIds.includes(npc.id) && (
                    <button
                      onClick={() => handleShowcaseNpc(npc.id)}
                      style={{
                        ...S.btn,
                        fontSize: "10px",
                        padding: "2px 6px",
                        background: "#7c3aed",
                        color: "#c4b5fd",
                      }}
                    >
                      Showcase
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleUnassignNPC(npc.id)}
                  style={{
                    ...S.btn,
                    fontSize: "10px",
                    padding: "2px 6px",
                    background: "#374151",
                    color: "#9ca3af",
                  }}
                >
                  Remove
                </button>
              </div>
            ))
          )}
          {npcsThatCanBeAdded.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "8px",
                alignItems: "center",
              }}
            >
              <select
                style={{ ...S.select, flex: 1 }}
                value={assignNpcId}
                onChange={(e) => setAssignNpcId(e.target.value)}
              >
                <option value="">Add an NPC...</option>
                {npcsThatCanBeAdded.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} (Lv.{n.level})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignNPC}
                style={S.btnPrimary}
                disabled={!assignNpcId}
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Showcased NPCs (GM only) — opposition in Entanglement/All-Out-Brawl; GM can share clocks with party */}
      {isGM && (campaign.showcased_npcs || []).length > 0 && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Showcased NPCs</span>
          <div
            style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px" }}
          >
            Share NPC clocks with the party when enabled.
          </div>
          {(campaign.showcased_npcs || []).map((sn) => (
            <div
              key={sn.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid #1f2937",
                flexWrap: "wrap",
                gap: "8px",
              }}
            >
              <div>
                <span style={{ fontWeight: "bold", color: "#e5e7eb" }}>
                  {sn.npc?.name || "NPC"}
                </span>
                {sn.npc?.stand_name && (
                  <span style={{ color: "#9ca3af", marginLeft: "6px" }}>
                    Stand: {sn.npc.stand_name}
                  </span>
                )}
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "#9ca3af",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sn.show_clocks_to_party || false}
                    onChange={(e) =>
                      handleToggleShowClocks(sn.id, e.target.checked)
                    }
                  />
                  <span>Show clocks to party</span>
                </label>
                <button
                  onClick={() => handleUnshowcaseNpc(sn.id)}
                  style={{
                    ...S.btn,
                    fontSize: "10px",
                    padding: "2px 6px",
                    background: "#374151",
                    color: "#9ca3af",
                  }}
                >
                  Remove from showcase
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Crews (GM and campaign players) */}
      {(isGM || campaign.players?.some((p) => p.id === user?.id)) && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Crew</span>
          {(campaign.crews || []).length === 0 && !crewForm && (
            <div
              style={{
                color: "#6b7280",
                fontSize: "12px",
                marginBottom: "8px",
              }}
            >
              No crew created yet.{" "}
              {isGM && "Create one to share stats with all characters."}
            </div>
          )}
          {(campaign.crews || []).map((c) => {
            const isCrewMember = (c.members || []).some(
              (m) => m.user_id === user?.id,
            );
            const canEdit = isGM || isCrewMember;
            return (
              <div
                key={c.id}
                style={{ padding: "8px 0", borderBottom: "1px solid #1f2937" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <span style={{ fontWeight: "bold", color: "#e5e7eb" }}>
                      {c.name}
                    </span>
                    {c.proposed_name && (
                      <span
                        style={{
                          color: "#f59e0b",
                          fontSize: "11px",
                          marginLeft: "8px",
                        }}
                      >
                        (proposed: {c.proposed_name})
                      </span>
                    )}
                  </div>
                  <div style={S.row}>
                    {canEdit && (
                      <button
                        onClick={() => startCrewEdit(c)}
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#374151",
                          color: "#d1d5db",
                        }}
                      >
                        Edit
                      </button>
                    )}
                    {isGM && (
                      <button
                        onClick={() => handleCrewDelete(c.id)}
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#7f1d1d",
                          color: "#fca5a5",
                        }}
                      >
                        Del
                      </button>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginTop: "4px",
                    flexWrap: "wrap",
                  }}
                >
                  <span>Tier {c.level}</span>
                  <span>Hold: {c.hold === "strong" ? "Strong" : "Weak"}</span>
                  <span>Rep: {c.rep}</span>
                  <span>Coin: {c.coin}</span>
                  <span>Wanted: {c.wanted_level}</span>
                  <span>XP: {c.xp}</span>
                </div>
                {c.description && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      marginTop: "4px",
                    }}
                  >
                    {c.description}
                  </div>
                )}
                {(c.members || []).length > 0 && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#6b7280",
                      marginTop: "4px",
                    }}
                  >
                    Members:{" "}
                    {(c.members || [])
                      .map((m) => m.true_name || m.alias || `#${m.id}`)
                      .join(", ")}
                  </div>
                )}
              </div>
            );
          })}

          {/* Crew form */}
          {crewForm && (
            <div
              style={{
                border: "1px solid #7c3aed",
                borderRadius: "4px",
                padding: "12px",
                marginTop: "8px",
                background: "#0d1117",
              }}
            >
              <span style={S.lbl}>
                {crewForm.id ? "EDIT CREW" : "CREATE CREW"}
              </span>
              {crewError && (
                <div style={{ ...S.err, marginBottom: "8px" }}>{crewError}</div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Name
                  </span>
                  <input
                    style={S.inp}
                    value={crewForm.name}
                    onChange={(e) =>
                      setCrewForm((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="Crew name"
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Tier
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={crewForm.level}
                    onChange={(e) =>
                      setCrewForm((p) => ({
                        ...p,
                        level: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Hold
                  </span>
                  <select
                    style={S.select}
                    value={crewForm.hold}
                    onChange={(e) =>
                      setCrewForm((p) => ({ ...p, hold: e.target.value }))
                    }
                  >
                    <option value="weak">Weak</option>
                    <option value="strong">Strong</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Rep
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={crewForm.rep}
                    onChange={(e) =>
                      setCrewForm((p) => ({
                        ...p,
                        rep: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Coin
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={crewForm.coin}
                    onChange={(e) =>
                      setCrewForm((p) => ({
                        ...p,
                        coin: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Wanted Level
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={crewForm.wanted_level}
                    onChange={(e) =>
                      setCrewForm((p) => ({
                        ...p,
                        wanted_level: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Description
                </span>
                <textarea
                  style={{
                    ...S.inp,
                    height: "50px",
                    resize: "vertical",
                    border: "1px solid #374151",
                    background: "#0d1117",
                    padding: "6px",
                  }}
                  value={crewForm.description}
                  onChange={(e) =>
                    setCrewForm((p) => ({ ...p, description: e.target.value }))
                  }
                />
              </div>
              <div style={S.row}>
                <button onClick={handleCrewSave} style={S.btnPrimary}>
                  Save
                </button>
                <button
                  onClick={() => {
                    setCrewForm(null);
                    setCrewError(null);
                  }}
                  style={S.btnGhost}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {isGM && !crewForm && (
            <button
              onClick={startCrewCreate}
              style={{ ...S.btnPrimary, marginTop: "8px" }}
            >
              + New Crew
            </button>
          )}
        </div>
      )}

      {/* Factions (GM only) */}
      {isGM && (
        <div style={S.card}>
          <span style={S.sectionLbl}>Factions</span>
          {(campaign.factions || []).length === 0 && !factionForm && (
            <div
              style={{
                color: "#6b7280",
                fontSize: "12px",
                marginBottom: "8px",
              }}
            >
              No factions created yet.
            </div>
          )}
          {(campaign.factions || []).map((f) => (
            <div
              key={f.id}
              style={{ padding: "8px 0", borderBottom: "1px solid #1f2937" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span style={{ fontWeight: "bold", color: "#e5e7eb" }}>
                    {f.name}
                  </span>
                  {f.faction_type && (
                    <span
                      style={{
                        color: "#6b7280",
                        fontSize: "11px",
                        marginLeft: "8px",
                      }}
                    >
                      ({f.faction_type})
                    </span>
                  )}
                </div>
                <div style={S.row}>
                  <button
                    onClick={() => startFactionEdit(f)}
                    style={{
                      ...S.btn,
                      fontSize: "10px",
                      padding: "2px 6px",
                      background: "#374151",
                      color: "#d1d5db",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleFactionDelete(f.id)}
                    style={{
                      ...S.btn,
                      fontSize: "10px",
                      padding: "2px 6px",
                      background: "#7f1d1d",
                      color: "#fca5a5",
                    }}
                  >
                    Del
                  </button>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  marginTop: "4px",
                }}
              >
                <span>Tier {f.level}</span>
                <span>Hold: {f.hold === "strong" ? "Strong" : "Weak"}</span>
                <span>Rep: {f.reputation}</span>
              </div>
              {(f.npcs || []).length > 0 && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7280",
                    marginTop: "4px",
                  }}
                >
                  NPCs:{" "}
                  {(f.npcs || [])
                    .map((n) => n.name || n.stand_name || `#${n.id}`)
                    .join(", ")}
                </div>
              )}
              {f.notes && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6b7280",
                    marginTop: "4px",
                  }}
                >
                  {f.notes}
                </div>
              )}
            </div>
          ))}

          {/* Faction form */}
          {factionForm && (
            <div
              style={{
                border: "1px solid #7c3aed",
                borderRadius: "4px",
                padding: "12px",
                marginTop: "8px",
                background: "#0d1117",
              }}
            >
              <span style={S.lbl}>
                {factionForm.id ? "EDIT FACTION" : "CREATE FACTION"}
              </span>
              {factionError && (
                <div style={{ ...S.err, marginBottom: "8px" }}>
                  {factionError}
                </div>
              )}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Name
                  </span>
                  <input
                    style={S.inp}
                    value={factionForm.name}
                    onChange={(e) =>
                      setFactionForm((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Type
                  </span>
                  <input
                    style={S.inp}
                    value={factionForm.faction_type}
                    onChange={(e) =>
                      setFactionForm((p) => ({
                        ...p,
                        faction_type: e.target.value,
                      }))
                    }
                    placeholder="e.g. Criminal Syndicate"
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Tier
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={factionForm.level}
                    onChange={(e) =>
                      setFactionForm((p) => ({
                        ...p,
                        level: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Hold
                  </span>
                  <select
                    style={S.select}
                    value={factionForm.hold}
                    onChange={(e) =>
                      setFactionForm((p) => ({ ...p, hold: e.target.value }))
                    }
                  >
                    <option value="weak">Weak</option>
                    <option value="strong">Strong</option>
                  </select>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                    Reputation
                  </span>
                  <input
                    style={{ ...S.inp, width: "80px" }}
                    type="number"
                    value={factionForm.reputation}
                    onChange={(e) =>
                      setFactionForm((p) => ({
                        ...p,
                        reputation: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                  Notes
                </span>
                <textarea
                  style={{
                    ...S.inp,
                    height: "50px",
                    resize: "vertical",
                    border: "1px solid #374151",
                    background: "#0d1117",
                    padding: "6px",
                  }}
                  value={factionForm.notes}
                  onChange={(e) =>
                    setFactionForm((p) => ({ ...p, notes: e.target.value }))
                  }
                />
              </div>
              {factionForm.id && (
                <div
                  style={{
                    marginBottom: "12px",
                    padding: "8px",
                    background: "#0d1117",
                    borderRadius: "4px",
                    border: "1px solid #374151",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "6px",
                    }}
                  >
                    NPCs in this faction
                  </span>
                  {(factionForm.npcs || []).map((n) => (
                    <div
                      key={n.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0",
                        fontSize: "12px",
                      }}
                    >
                      <span>{n.name || n.stand_name || `NPC ${n.id}`}</span>
                      <button
                        onClick={() => handleRemoveNpcFromFaction(n.id)}
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#7f1d1d",
                          color: "#fca5a5",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "8px",
                      alignItems: "center",
                    }}
                  >
                    <select
                      style={{ ...S.select, flex: 1 }}
                      value={factionAddNpcId}
                      onChange={(e) => setFactionAddNpcId(e.target.value)}
                    >
                      <option value="">Add an NPC...</option>
                      {campaignNPCs
                        .filter(
                          (n) =>
                            !(factionForm.npcs || []).some(
                              (fn) => fn.id === n.id,
                            ),
                        )
                        .map((n) => (
                          <option key={n.id} value={n.id}>
                            {n.name || n.stand_name || `NPC ${n.id}`}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleAddNpcToFaction}
                      style={S.btnPrimary}
                      disabled={!factionAddNpcId}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
              <div style={S.row}>
                <button onClick={handleFactionSave} style={S.btnPrimary}>
                  Save
                </button>
                <button
                  onClick={() => {
                    setFactionForm(null);
                    setFactionError(null);
                    setFactionAddNpcId("");
                  }}
                  style={S.btnGhost}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {!factionForm && (
            <button
              onClick={startFactionCreate}
              style={{ ...S.btnPrimary, marginTop: "8px" }}
            >
              + New Faction
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const CLOCK_SEGMENT_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const CLOCK_TYPE_OPTIONS = [
  { value: "CUSTOM", label: "Custom" },
  { value: "DANGER", label: "Danger" },
  { value: "MISSION", label: "Mission" },
  { value: "RACING", label: "Racing" },
  { value: "LINKED", label: "Linked" },
  { value: "TUG_OF_WAR", label: "Tug-of-War" },
  { value: "PROJECT", label: "Long-term Project" },
  { value: "HEALING", label: "Healing" },
  { value: "NPC_OPPONENT", label: "NPC Opponent" },
  { value: "COUNTDOWN", label: "Countdown" },
];

function ClockManager({ clocks, setClocks, campaignId, sessionId, setError }) {
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSegments, setCreateSegments] = useState(4);
  const [createType, setCreateType] = useState("CUSTOM");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      await progressClockAPI.createProgressClock({
        campaign: campaignId,
        session: sessionId,
        name: createName.trim() || "New Clock",
        clock_type: createType,
        max_segments: createSegments,
      });
      const list = await progressClockAPI.getProgressClocks({
        campaign: campaignId,
        session: sessionId,
      });
      setClocks(list || []);
      setCreateName("");
      setCreateSegments(4);
      setCreateType("CUSTOM");
      setShowCreate(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={S.card}>
      <span style={S.sectionLbl}>Clocks</span>
      <div style={{ marginBottom: "8px" }}>
        {!showCreate ? (
          <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>
            + New Clock
          </button>
        ) : (
          <div
            style={{
              background: "#0d1117",
              padding: "12px",
              borderRadius: "4px",
              border: "1px solid #374151",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Name
              </span>
              <input
                style={S.inp}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Clock name"
              />
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Segments
              </span>
              <select
                style={S.select}
                value={createSegments}
                onChange={(e) =>
                  setCreateSegments(parseInt(e.target.value, 10))
                }
              >
                {CLOCK_SEGMENT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} segments
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Type
              </span>
              <select
                style={S.select}
                value={createType}
                onChange={(e) => setCreateType(e.target.value)}
              >
                {CLOCK_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleCreate}
                style={S.btnPrimary}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateName("");
                }}
                style={S.btnGhost}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {clocks.map((clk) => {
        const isGMClock = clk.created_by == null;
        const updateClock = (patch) =>
          progressClockAPI
            .updateProgressClock(clk.id, patch)
            .then(() =>
              setClocks((p) =>
                p.map((c) => (c.id === clk.id ? { ...c, ...patch } : c)),
              ),
            );
        const tick = (delta) => {
          const next = Math.max(
            0,
            Math.min(clk.max_segments, (clk.filled_segments || 0) + delta),
          );
          updateClock({ filled_segments: next });
        };
        return (
          <div
            key={clk.id}
            style={{
              padding: "8px 0",
              borderBottom: "1px solid #1f2937",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "10px",
                  color: "#6b7280",
                  background: isGMClock ? "#374151" : "#1e3a5f",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                {isGMClock ? "GM" : "Player"}
              </span>
              <span>
                {clk.name} ({clk.filled_segments}/{clk.max_segments})
              </span>
              <button
                onClick={() => tick(-1)}
                style={{ ...S.btnGhost, padding: "2px 6px", fontSize: "11px" }}
              >
                -
              </button>
              <button
                onClick={() => tick(1)}
                style={{ ...S.btnGhost, padding: "2px 6px", fontSize: "11px" }}
              >
                +
              </button>
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {isGMClock ? (
                <label style={{ fontSize: "11px" }}>
                  <input
                    type="checkbox"
                    checked={clk.visible_to_players}
                    onChange={(e) =>
                      updateClock({ visible_to_players: e.target.checked })
                    }
                  />
                  Visible to players
                </label>
              ) : (
                <label style={{ fontSize: "11px" }}>
                  <input
                    type="checkbox"
                    checked={clk.visible_to_party}
                    onChange={(e) =>
                      updateClock({ visible_to_party: e.target.checked })
                    }
                  />
                  Visible to party
                </label>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DiceHistoryRow({
  roll,
  showPositionEffect,
  onPatch,
  onGrantXP,
  isGM,
}) {
  const [editing, setEditing] = useState(false);
  const [pos, setPos] = useState(roll.position || "risky");
  const [eff, setEff] = useState(roll.effect || "standard");
  const handleSave = () => {
    onPatch(roll.id, { position: pos, effect: eff });
    setEditing(false);
  };
  const isDesperate =
    roll.position === "desperate" && roll.roll_type === "ACTION";
  const canGrantXP = isGM && isDesperate && !roll.xp_awarded && onGrantXP;
  return (
    <div
      style={{
        padding: "6px 0",
        borderBottom: "1px solid #1f2937",
        fontSize: "12px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        ...(isDesperate
          ? {
              background: "rgba(249, 115, 22, 0.08)",
              margin: "0 -8px",
              padding: "6px 8px",
              borderLeft: "3px solid #f97316",
            }
          : {}),
      }}
    >
      {isDesperate && (
        <span style={{ ...S.badge, background: "#f97316", color: "#000" }}>
          Desperate
        </span>
      )}
      {roll.xp_awarded && (
        <span style={{ ...S.badge, background: "#16a34a", color: "#fff" }}>
          +1 XP
        </span>
      )}
      <span style={{ fontWeight: "bold" }}>
        {roll.character_name || roll.character}
      </span>
      <span>·</span>
      <span>{roll.action_name}</span>
      <span>·</span>
      <span>{[].concat(roll.results || []).join(", ")}</span>
      <span>→</span>
      <span>{roll.outcome}</span>
      {showPositionEffect &&
        (editing ? (
          <>
            <select
              style={S.select}
              value={pos}
              onChange={(e) => setPos(e.target.value)}
            >
              <option value="controlled">Controlled</option>
              <option value="risky">Risky</option>
              <option value="desperate">Desperate</option>
            </select>
            <select
              style={S.select}
              value={eff}
              onChange={(e) => setEff(e.target.value)}
            >
              <option value="limited">Limited</option>
              <option value="standard">Standard</option>
              <option value="extreme">Extreme</option>
            </select>
            <button
              onClick={handleSave}
              style={{ ...S.btn, fontSize: "10px", padding: "2px 6px" }}
            >
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{ ...S.btn, fontSize: "10px", padding: "2px 6px" }}
            >
              Cancel
            </button>
          </>
        ) : (
          <span style={{ color: "#9ca3af", marginLeft: "8px" }}>
            ({roll.position || "—"}, {roll.effect || "—"})
            <button
              onClick={() => setEditing(true)}
              style={{
                marginLeft: "4px",
                background: "none",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: "10px",
              }}
            >
              Edit
            </button>
          </span>
        ))}
      {canGrantXP && (
        <button
          onClick={() => onGrantXP(roll.id)}
          style={{
            ...S.btnSuccess,
            fontSize: "10px",
            padding: "2px 8px",
            marginLeft: "auto",
          }}
        >
          Grant XP
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Records Modal (view session history: goals, rolls, events)
// ---------------------------------------------------------------------------
function SessionRecordsModal({ sessionId, sessionName, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPositionEffect, setShowPositionEffect] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    sessionAPI
      .getSession(sessionId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [sessionId]);
  if (!sessionId) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#111827",
          border: "1px solid #374151",
          borderRadius: "8px",
          padding: "20px",
          maxWidth: "500px",
          maxHeight: "80vh",
          overflow: "auto",
          width: "90%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <span style={{ fontWeight: "bold", color: "#a78bfa" }}>
            Session: {sessionName || data?.name || "Records"}
          </span>
          <button
            onClick={onClose}
            style={{ ...S.btn, background: "#374151", color: "#9ca3af" }}
          >
            ✕
          </button>
        </div>
        {loading ? (
          <div style={{ color: "#6b7280" }}>Loading...</div>
        ) : !data ? (
          <div style={{ color: "#f87171" }}>
            Failed to load session records.
          </div>
        ) : (
          <>
            {data.objective && (
              <div style={{ marginBottom: "12px" }}>
                <span style={S.lbl}>Objective</span>
                <div style={{ fontSize: "12px", color: "#d1d5db" }}>
                  {data.objective}
                </div>
              </div>
            )}
            {data.proposed_score_target && (
              <div style={{ marginBottom: "12px" }}>
                <span style={S.lbl}>Proposed score</span>
                <div style={{ fontSize: "12px", color: "#d1d5db" }}>
                  {data.proposed_score_target}:{" "}
                  {data.proposed_score_description || ""}
                </div>
              </div>
            )}
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "4px",
                }}
              >
                <span style={S.lbl}>Dice rolls</span>
                <label style={{ fontSize: "11px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={showPositionEffect}
                    onChange={(e) => setShowPositionEffect(e.target.checked)}
                  />{" "}
                  Position & effect
                </label>
              </div>
              {(data.rolls || []).length === 0 ? (
                <div style={{ fontSize: "11px", color: "#6b7280" }}>
                  No rolls.
                </div>
              ) : (
                (data.rolls || []).slice(0, 20).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      fontSize: "11px",
                      padding: "4px 0",
                      borderBottom: "1px solid #1f2937",
                    }}
                  >
                    {r.character_name || r.character} · {r.action_name} ·{" "}
                    {[].concat(r.results || []).join(", ")} → {r.outcome || ""}
                    {showPositionEffect && (r.position || r.effect) && (
                      <span
                        style={{ color: "#6b7280", marginLeft: "6px" }}
                      >{`(${r.position || ""}, ${r.effect || ""})`}</span>
                    )}
                  </div>
                ))
              )}
            </div>
            {(data.events || []).length > 0 && (
              <div style={{ marginBottom: "10px" }}>
                <span style={S.lbl}>Events</span>
                {(data.events || []).length > 0 &&
                  (data.events || []).map((e) => (
                    <div
                      key={e.id}
                      style={{
                        fontSize: "11px",
                        padding: "4px 0",
                        borderBottom: "1px solid #1f2937",
                      }}
                    >
                      {e.event_type}
                    </div>
                  ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session List View
// ---------------------------------------------------------------------------
function SessionList({ campaign, onBack, onSelectSession, onRefresh }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [recordsModalSession, setRecordsModalSession] = useState(null);

  useEffect(() => {
    sessionAPI
      .getSessions(campaign.id)
      .then(setSessions)
      .catch((e) => {
        setError(e.message);
        setSessions([]);
      })
      .finally(() => setLoading(false));
  }, [campaign.id]);

  const handleCreateSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const session = await sessionAPI.createSession({
        campaign: campaign.id,
        name: `Session ${(sessions?.length || 0) + 1}`,
        status: "PLANNED",
      });
      setSessions((prev) => [session, ...(prev || [])]);
      onSelectSession(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: "12px" }}>
        {"< Back to Campaign"}
      </button>
      {error && <div style={S.err}>{error}</div>}
      <div style={{ ...S.card, border: "1px solid #4b5563" }}>
        <span style={S.sectionLbl}>Sessions</span>
        <button
          onClick={handleCreateSession}
          style={S.btnSuccess}
          disabled={creating}
        >
          {creating ? "Creating..." : "+ New Session"}
        </button>
        {loading ? (
          <div style={{ color: "#6b7280", padding: "16px" }}>
            Loading sessions...
          </div>
        ) : !sessions?.length ? (
          <div style={{ color: "#6b7280", padding: "16px" }}>
            No sessions yet. Create one to get started.
          </div>
        ) : (
          <div style={{ marginTop: "12px" }}>
            {sessions.map((s) => (
              <div key={s.id} style={{ ...S.card, marginBottom: "8px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div
                    style={{ flex: 1, cursor: "pointer" }}
                    onClick={() => onSelectSession(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onSelectSession(s)}
                  >
                    <div style={{ fontWeight: "bold" }}>
                      {s.name || `Session ${s.id}`}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {s.session_date
                        ? new Date(s.session_date).toLocaleDateString()
                        : "N/A"}
                      {s.proposed_date
                        ? ` · Planned ${new Date(`${s.proposed_date}T12:00:00`).toLocaleDateString()}`
                        : ""}{" "}
                      · {s.status || "PLANNED"}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecordsModalSession(s);
                    }}
                    style={{ ...S.btn, fontSize: "10px", padding: "4px 8px" }}
                  >
                    View records
                  </button>
                </div>
              </div>
            ))}
            {recordsModalSession && (
              <SessionRecordsModal
                sessionId={recordsModalSession.id}
                sessionName={recordsModalSession.name}
                onClose={() => setRecordsModalSession(null)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session Detail View (GM-only)
// ---------------------------------------------------------------------------
function SessionDetail({ campaign, session, onBack, onRefresh }) {
  const [sessionData, setSessionData] = useState(session);
  const [rolls, setRolls] = useState([]);
  const [clocks, setClocks] = useState([]);
  const [crews, setCrews] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [campaignNPCs, setCampaignNPCs] = useState([]);
  const [showPositionEffect, setShowPositionEffect] = useState(false);
  const [showDiceHistoryPanel, setShowDiceHistoryPanel] = useState(false);
  const [manualRoll, setManualRoll] = useState({
    characterId: "",
    actionName: "skirmish",
    diceStr: "4,5",
    outcome: "FULL_SUCCESS",
  });
  const [manualRollSaving, setManualRollSaving] = useState(false);
  const [fortuneDice, setFortuneDice] = useState(2);
  const [fortuneRolling, setFortuneRolling] = useState(false);
  const [error, setError] = useState(null);
  const [wantedStars, setWantedStars] = useState(campaign?.wanted_stars ?? 0);
  const [proposedDateInput, setProposedDateInput] = useState("");

  useEffect(() => {
    if (!session?.id) return;
    sessionAPI
      .getSession(session.id)
      .then(setSessionData)
      .catch(() => setSessionData(session));
    rollAPI
      .getRolls({ session: session.id })
      .then(setRolls)
      .catch(() => setRolls([]));
    progressClockAPI
      .getProgressClocks({ campaign: campaign.id, session: session.id })
      .then(setClocks)
      .catch(() => setClocks([]));
    crewAPI
      .getCrews()
      .then((list) =>
        setCrews(list?.filter((c) => c.campaign === campaign.id) || []),
      )
      .catch(() => setCrews([]));
    characterAPI
      .getCharacters()
      .then((list) =>
        setCharacters(list?.filter((c) => c.campaign === campaign.id) || []),
      )
      .catch(() => setCharacters([]));
    npcAPI
      .getNPCs(campaign.id)
      .then(setCampaignNPCs)
      .catch(() => setCampaignNPCs([]));
    setWantedStars(campaign?.wanted_stars ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, campaign?.id, campaign?.wanted_stars]);

  useEffect(() => {
    const p = sessionData?.proposed_date;
    if (p == null || p === "") {
      setProposedDateInput("");
    } else {
      setProposedDateInput(
        typeof p === "string" ? p.slice(0, 10) : "",
      );
    }
  }, [sessionData?.id, sessionData?.proposed_date]);

  const campaignChars =
    campaign?.campaign_characters ||
    characters.map((c) => ({ id: c.id, true_name: c.true_name, ...c }));

  const desperateRollCount = useMemo(
    () =>
      rolls.filter(
        (r) =>
          (r.roll_type || "") === "ACTION" &&
          (r.position || "").toLowerCase() === "desperate",
      ).length,
    [rolls],
  );

  const lastRollByCharacter = useMemo(() => {
    const m = {};
    (rolls || []).forEach((r) => {
      const cid = r.character;
      if (cid != null && m[cid] == null) m[cid] = r;
    });
    return m;
  }, [rolls]);

  const handleWantedStars = async (stars) => {
    setWantedStars(stars);
    try {
      await campaignAPI.patchCampaign(campaign.id, { wanted_stars: stars });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSetActiveSession = async () => {
    try {
      await campaignAPI.patchCampaign(campaign.id, {
        active_session: session.id,
      });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const activeSessionId =
    campaign?.active_session?.id ?? campaign?.active_session ?? null;
  const isCurrentActiveSession =
    activeSessionId != null && Number(activeSessionId) === Number(session.id);

  const handleClearActiveSession = async () => {
    if (!isCurrentActiveSession) return;
    try {
      await campaignAPI.patchCampaign(campaign.id, { active_session: null });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaveProposedDate = async () => {
    setError(null);
    try {
      const value = proposedDateInput.trim() || null;
      const updated = await sessionAPI.patchSession(session.id, {
        proposed_date: value,
      });
      setSessionData((prev) => ({ ...prev, ...updated }));
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleClearProposedDate = async () => {
    setError(null);
    try {
      const updated = await sessionAPI.patchSession(session.id, {
        proposed_date: null,
      });
      setProposedDateInput("");
      setSessionData((prev) => ({ ...prev, ...updated }));
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePatchCharacterHarm = async (charId, harmData) => {
    try {
      await characterAPI.patchCharacter(charId, harmData);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleUpdateSession = async (data) => {
    try {
      const updated = await sessionAPI.patchSession(session.id, data);
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handlePatchRoll = async (rollId, data) => {
    try {
      await rollAPI.patchRoll(rollId, data);
      setRolls((prev) =>
        prev.map((r) => (r.id === rollId ? { ...r, ...data } : r)),
      );
    } catch (e) {
      setError(e.message);
    }
  };

  const handleGrantXP = async (rollId) => {
    try {
      await rollAPI.grantXP(rollId);
      setRolls((prev) =>
        prev.map((r) => (r.id === rollId ? { ...r, xp_awarded: true } : r)),
      );
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleManualRollCreate = async () => {
    const cid = parseInt(manualRoll.characterId, 10);
    if (!cid) {
      setError("Choose a character for the manual roll.");
      return;
    }
    const results = manualRoll.diceStr
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 6);
    if (results.length === 0) {
      setError("Enter dice results as numbers 1–6 (e.g. 4, 5).");
      return;
    }
    setManualRollSaving(true);
    setError(null);
    try {
      await rollAPI.createRoll({
        character: cid,
        session: session.id,
        roll_type: "ACTION",
        action_name: (manualRoll.actionName || "action").toLowerCase(),
        position: sessionData?.default_position || "risky",
        effect: sessionData?.default_effect || "standard",
        dice_pool: results.length,
        results,
        outcome: manualRoll.outcome,
        description: "Manual / offline dice (GM)",
      });
      const next = await rollAPI.getRolls({ session: session.id });
      setRolls(next || []);
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setManualRollSaving(false);
    }
  };

  const handleFortuneRoll = async () => {
    setFortuneRolling(true);
    setError(null);
    const firstChar = campaignChars[0] || characters[0];
    if (!firstChar?.id) {
      setError("No character in campaign to roll fortune.");
      setFortuneRolling(false);
      return;
    }
    try {
      await characterAPI.rollAction(firstChar.id, {
        roll_type: "FORTUNE",
        action: "Fortune",
        session_id: session.id,
        dice_pool: fortuneDice,
      });
      rollAPI
        .getRolls({ session: session.id })
        .then(setRolls)
        .catch(() => {});
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setFortuneRolling(false);
    }
  };

  const npcInvolvements = sessionData?.npc_involvements || [];
  const invByNpc = Object.fromEntries(
    (npcInvolvements || []).map((i) => [i.npc, i]),
  );
  const toggleNpcInvolved = async (npcId) => {
    const inv = invByNpc[npcId];
    const next = inv
      ? npcInvolvements.filter((i) => i.npc !== npcId)
      : [
          ...npcInvolvements,
          {
            npc: npcId,
            show_clocks_to_players: false,
            show_vulnerability_clock_to_players: false,
          },
        ];
    try {
      const updated = await sessionAPI.patchSession(session.id, {
        npc_involvements: next,
      });
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };
  const toggleShowClocks = async (npcId) => {
    const inv = invByNpc[npcId];
    if (!inv) return;
    const next = npcInvolvements.map((i) => {
      if (i.npc !== npcId) return i;
      const showClocks = !i.show_clocks_to_players;
      return {
        ...i,
        show_clocks_to_players: showClocks,
        show_vulnerability_clock_to_players: showClocks
          ? true
          : i.show_vulnerability_clock_to_players ?? false,
      };
    });
    try {
      const updated = await sessionAPI.patchSession(session.id, {
        npc_involvements: next,
      });
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };
  const toggleShowVulnerabilityClock = async (npcId) => {
    const inv = invByNpc[npcId];
    if (!inv) return;
    const next = npcInvolvements.map((i) =>
      i.npc === npcId
        ? {
            ...i,
            show_vulnerability_clock_to_players:
              i.show_clocks_to_players
                ? true
                : !(i.show_vulnerability_clock_to_players ?? false),
            show_clocks_to_players: i.show_clocks_to_players ?? false,
          }
        : i,
    );
    try {
      const updated = await sessionAPI.patchSession(session.id, {
        npc_involvements: next,
      });
      setSessionData(updated);
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };
  const isVulnerabilityVisibleToPlayers = (inv) =>
    !!inv?.show_clocks_to_players || !!inv?.show_vulnerability_clock_to_players;

  const [coinEdits, setCoinEdits] = useState({});
  const handleCrewCoinChange = async (crewId, coin) => {
    const val = parseInt(coin, 10) || 0;
    try {
      await crewAPI.patchCrew(crewId, { coin: val });
      setCrews((prev) =>
        prev.map((c) => (c.id === crewId ? { ...c, coin: val } : c)),
      );
      setCoinEdits((p) => {
        const n = { ...p };
        delete n[crewId];
        return n;
      });
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: "12px" }}>
        {"< Back to Sessions"}
      </button>
      {error && <div style={S.err}>{error}</div>}

      <div style={S.card}>
        <span style={S.sectionLbl}>
          Session: {sessionData?.name || session?.name || "Unnamed"}
        </span>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            alignItems: "center",
            marginTop: "8px",
          }}
        >
          {isCurrentActiveSession ? (
            <>
              <span style={{ fontSize: "12px", color: "#a78bfa" }}>
                This session is live for players (character sheets).
              </span>
              <button
                type="button"
                onClick={handleClearActiveSession}
                style={S.btnGhost}
              >
                Clear as current session
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSetActiveSession}
              style={S.btnPrimary}
            >
              Set as current session (enable for players)
            </button>
          )}
        </div>
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #374151",
          }}
        >
          <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "6px" }}>
            Proposed session date (when you plan to play)
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
            }}
          >
            <input
              type="date"
              value={proposedDateInput}
              onChange={(e) => setProposedDateInput(e.target.value)}
              style={{
                fontFamily: "monospace",
                fontSize: "12px",
                background: "#0d1117",
                color: "#fff",
                border: "1px solid #374151",
                borderRadius: "4px",
                padding: "6px 8px",
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={handleSaveProposedDate}
              style={S.btnGhost}
            >
              Save date
            </button>
            {(sessionData?.proposed_date || proposedDateInput) && (
              <button
                type="button"
                onClick={handleClearProposedDate}
                style={{ ...S.btnGhost, fontSize: "11px" }}
              >
                Clear date
              </button>
            )}
          </div>
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}>
            Record created:{" "}
            {sessionData?.session_date
              ? new Date(sessionData.session_date).toLocaleString()
              : "—"}
          </div>
        </div>
      </div>

      {/* Position & Effect + dice history toggle (GM control) */}
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <span style={S.sectionLbl}>
            Position & Effect (Player Visibility)
          </span>
          <button
            type="button"
            onClick={() => setShowDiceHistoryPanel((x) => !x)}
            title={
              showDiceHistoryPanel ? "Hide dice history" : "Show dice history"
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: showDiceHistoryPanel ? "#312e81" : "#1f2937",
              border: "1px solid #4b5563",
              borderRadius: 6,
              padding: "6px 10px",
              cursor: "pointer",
              color: "#e5e7eb",
              fontSize: 11,
            }}
          >
            <HistoryBranchIcon size={16} />
            Dice history
          </button>
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={sessionData?.show_position_effect_to_players !== false}
            onChange={(e) =>
              handleUpdateSession({
                show_position_effect_to_players: e.target.checked,
              })
            }
          />
          <span>
            Show position & effect to players on their character sheets
          </span>
        </label>
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginTop: "12px",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <span
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Default position
            </span>
            <select
              style={S.select}
              value={sessionData?.default_position || "risky"}
              onChange={(e) =>
                handleUpdateSession({ default_position: e.target.value })
              }
            >
              <option value="controlled">Controlled</option>
              <option value="risky">Risky</option>
              <option value="desperate">Desperate</option>
            </select>
          </div>
          <div>
            <span
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Default effect
            </span>
            <select
              style={S.select}
              value={sessionData?.default_effect || "standard"}
              onChange={(e) =>
                handleUpdateSession({ default_effect: e.target.value })
              }
            >
              <option value="limited">Limited</option>
              <option value="standard">Standard</option>
              <option value="extreme">Extreme</option>
            </select>
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <span
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                display: "block",
                marginBottom: "4px",
              }}
            >
              Roll goal label (players see in roll pool)
            </span>
            <input
              style={{ ...S.inp, width: "100%", maxWidth: 360 }}
              value={sessionData?.roll_goal_label ?? ""}
              onChange={(e) =>
                setSessionData((p) => ({
                  ...p,
                  roll_goal_label: e.target.value,
                }))
              }
              onBlur={(e) =>
                handleUpdateSession({ roll_goal_label: e.target.value })
              }
              placeholder="e.g. Quietly open the service door"
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginTop: "12px",
          }}
        >
          <PositionStack
            activePosition={sessionData?.default_position || "risky"}
            readOnly
          />
          <EffectShapes
            activeEffect={sessionData?.default_effect || "standard"}
            readOnly
          />
        </div>

        {showDiceHistoryPanel && (
          <div
            style={{
              marginTop: "14px",
              padding: "12px",
              background: "#0d1117",
              borderRadius: "8px",
              border: "1px solid #374151",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "#9ca3af",
                marginBottom: "8px",
              }}
            >
              Desperate action rolls this session:{" "}
              <span style={{ color: "#f97316", fontWeight: "bold" }}>
                {desperateRollCount}
              </span>
            </div>
            <label
              style={{
                fontSize: "11px",
                marginBottom: "8px",
                display: "block",
              }}
            >
              <input
                type="checkbox"
                checked={showPositionEffect}
                onChange={(e) => setShowPositionEffect(e.target.checked)}
              />{" "}
              Show position & effect on rows
            </label>
            {rolls.length === 0 ? (
              <div style={{ color: "#6b7280", fontSize: "12px" }}>
                No rolls for this session.
              </div>
            ) : (
              rolls.map((r) => (
                <DiceHistoryRow
                  key={r.id}
                  roll={r}
                  showPositionEffect={showPositionEffect}
                  onPatch={handlePatchRoll}
                  onGrantXP={handleGrantXP}
                  isGM
                />
              ))
            )}
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #1f2937",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "#a78bfa",
                  fontWeight: "bold",
                  display: "block",
                  marginBottom: "8px",
                }}
              >
                Manual roll (offline dice)
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  alignItems: "flex-end",
                  fontSize: "11px",
                }}
              >
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    Character
                  </span>
                  <select
                    style={S.select}
                    value={manualRoll.characterId}
                    onChange={(e) =>
                      setManualRoll((p) => ({
                        ...p,
                        characterId: e.target.value,
                      }))
                    }
                  >
                    <option value="">—</option>
                    {campaignChars.map((ch) => (
                      <option key={ch.id} value={ch.id}>
                        {ch.true_name || ch.name || `PC ${ch.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    Action
                  </span>
                  <input
                    style={{ ...S.inp, width: 100 }}
                    value={manualRoll.actionName}
                    onChange={(e) =>
                      setManualRoll((p) => ({
                        ...p,
                        actionName: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    Dice (1–6)
                  </span>
                  <input
                    style={{ ...S.inp, width: 90 }}
                    value={manualRoll.diceStr}
                    onChange={(e) =>
                      setManualRoll((p) => ({ ...p, diceStr: e.target.value }))
                    }
                    placeholder="4, 5"
                  />
                </div>
                <div>
                  <span
                    style={{
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "2px",
                    }}
                  >
                    Outcome
                  </span>
                  <select
                    style={S.select}
                    value={manualRoll.outcome}
                    onChange={(e) =>
                      setManualRoll((p) => ({ ...p, outcome: e.target.value }))
                    }
                  >
                    <option value="CRITICAL_SUCCESS">Critical</option>
                    <option value="FULL_SUCCESS">Full</option>
                    <option value="PARTIAL_SUCCESS">Partial</option>
                    <option value="FAILURE">Failure</option>
                    <option value="BOTCH">Botch</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleManualRollCreate}
                  style={S.btnPrimary}
                  disabled={manualRollSaving}
                >
                  {manualRollSaving ? "Saving..." : "Add manual roll"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* GM visibility: last roll line per PC (v1 snapshot) */}
      <div style={S.card}>
        <span style={S.sectionLbl}>
          Player dice pools (last committed roll)
        </span>
        <p
          style={{
            fontSize: "11px",
            color: "#6b7280",
            marginTop: "4px",
            marginBottom: "8px",
          }}
        >
          Full pool sources are stored on each roll&apos;s description. This
          list shows the most recent roll per character in this session.
        </p>
        {campaignChars.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: "12px" }}>
            No characters in campaign.
          </div>
        ) : (
          campaignChars.map((ch) => {
            const lr = lastRollByCharacter[ch.id];
            return (
              <div
                key={ch.id}
                style={{
                  fontSize: "12px",
                  padding: "6px 0",
                  borderBottom: "1px solid #1f2937",
                }}
              >
                <strong style={{ color: "#e5e7eb" }}>
                  {ch.true_name || ch.name}
                </strong>
                {lr ? (
                  <span style={{ color: "#9ca3af" }}>
                    {" "}
                    — {lr.action_name} ·{" "}
                    {[].concat(lr.results || []).join(", ")} → {lr.outcome}
                    {(lr.description || "").trim() ? (
                      <span style={{ color: "#6b7280" }}>
                        {" "}
                        · {(lr.description || "").slice(0, 140)}
                        {(lr.description || "").length > 140 ? "…" : ""}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span style={{ color: "#6b7280" }}> — No rolls yet.</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Wanted level */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Wanted Level</span>
        <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => handleWantedStars(n)}
              style={{
                ...S.btn,
                background: n <= wantedStars ? "#fbbf24" : "#374151",
                color: n <= wantedStars ? "#000" : "#9ca3af",
                width: "28px",
                height: "28px",
                padding: 0,
              }}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      {/* Harm for players */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Harm for Players</span>
        {campaignChars.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No characters in campaign.</div>
        ) : (
          campaignChars.map((ch) => (
            <HarmEditor
              key={ch.id}
              character={ch}
              onSave={(data) => handlePatchCharacterHarm(ch.id, data)}
            />
          ))
        )}
      </div>

      {/* Goals */}
      <GoalsEditor sessionData={sessionData} onSave={handleUpdateSession} />

      {/* NPCs used */}
      <div style={S.card}>
        <span style={S.sectionLbl}>NPCs Used</span>
        {campaignNPCs.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No NPCs in campaign.</div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            {campaignNPCs.map((npc) => {
              const inv = invByNpc[npc.id];
              const inSession = !!inv;
              return (
                <div
                  key={npc.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={inSession}
                      onChange={() => toggleNpcInvolved(npc.id)}
                    />
                    <span>{npc.name || npc.true_name || `NPC ${npc.id}`}</span>
                  </label>
                  {inSession && (
                    <>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: "pointer",
                          fontSize: "12px",
                          color: "#9ca3af",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!inv.show_clocks_to_players}
                          onChange={() => toggleShowClocks(npc.id)}
                        />
                        <span>Show clocks to players</span>
                      </label>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: inv.show_clocks_to_players
                            ? "not-allowed"
                            : "pointer",
                          fontSize: "12px",
                          color: "#9ca3af",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isVulnerabilityVisibleToPlayers(inv)}
                          disabled={!!inv.show_clocks_to_players}
                          onChange={() => toggleShowVulnerabilityClock(npc.id)}
                        />
                        <span>Show vulnerability to players</span>
                      </label>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Coin (crew-level) */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Coin</span>
        {crews.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No crews in campaign.</div>
        ) : (
          crews.map((crew) => (
            <div
              key={crew.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <span style={{ minWidth: "120px" }}>
                {crew.name || `Crew ${crew.id}`}
              </span>
              <input
                type="number"
                style={{ ...S.inp, width: "60px" }}
                value={
                  coinEdits[crew.id] !== undefined
                    ? coinEdits[crew.id]
                    : (crew.coin ?? 0)
                }
                onChange={(e) =>
                  setCoinEdits((p) => ({ ...p, [crew.id]: e.target.value }))
                }
                onBlur={(e) => handleCrewCoinChange(crew.id, e.target.value)}
              />
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>coin</span>
            </div>
          ))
        )}
      </div>

      {/* Fortune rolls */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Fortune Rolls</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
          }}
        >
          <span style={{ fontSize: "11px" }}>Dice pool:</span>
          <select
            style={S.select}
            value={fortuneDice}
            onChange={(e) => setFortuneDice(parseInt(e.target.value, 10))}
          >
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}d
              </option>
            ))}
          </select>
          <button
            onClick={handleFortuneRoll}
            style={S.btnPrimary}
            disabled={fortuneRolling || !campaignChars?.length}
          >
            {fortuneRolling ? "Rolling..." : "Roll Fortune"}
          </button>
        </div>
      </div>

      {/* Clocks */}
      <ClockManager
        clocks={clocks}
        setClocks={setClocks}
        campaignId={campaign.id}
        sessionId={session.id}
        setError={setError}
      />
    </div>
  );
}

function GoalsEditor({ sessionData, onSave }) {
  const [form, setForm] = useState({
    objective: "",
    proposed_score_target: "",
    proposed_score_description: "",
  });
  useEffect(() => {
    setForm({
      objective: sessionData?.objective || "",
      proposed_score_target: sessionData?.proposed_score_target || "",
      proposed_score_description: sessionData?.proposed_score_description || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionData?.id]);
  return (
    <div style={S.card}>
      <span style={S.sectionLbl}>Goals / Items</span>
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>Objective</span>
        <textarea
          style={{
            ...S.inp,
            height: "50px",
            border: "1px solid #374151",
            padding: "6px",
          }}
          value={form.objective}
          onChange={(e) =>
            setForm((p) => ({ ...p, objective: e.target.value }))
          }
        />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
          Proposed score target
        </span>
        <input
          style={S.inp}
          value={form.proposed_score_target}
          onChange={(e) =>
            setForm((p) => ({ ...p, proposed_score_target: e.target.value }))
          }
        />
      </div>
      <div style={{ marginBottom: "8px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>
          Proposed score description
        </span>
        <textarea
          style={{
            ...S.inp,
            height: "40px",
            border: "1px solid #374151",
            padding: "6px",
          }}
          value={form.proposed_score_description}
          onChange={(e) =>
            setForm((p) => ({
              ...p,
              proposed_score_description: e.target.value,
            }))
          }
        />
      </div>
      <button onClick={() => onSave(form)} style={S.btnPrimary}>
        Save goals
      </button>
    </div>
  );
}

function HarmEditor({ character, onSave }) {
  const [harm, setHarm] = useState({
    harm_level1_used: character.harm_level1_used ?? false,
    harm_level1_name: character.harm_level1_name || "",
    harm_level1_slot2_used: character.harm_level1_slot2_used ?? false,
    harm_level1_slot2_name: character.harm_level1_slot2_name || "",
    harm_level2_used: character.harm_level2_used ?? false,
    harm_level2_name: character.harm_level2_name || "",
    harm_level2_slot2_used: character.harm_level2_slot2_used ?? false,
    harm_level2_slot2_name: character.harm_level2_slot2_name || "",
    harm_level3_used: character.harm_level3_used ?? false,
    harm_level3_name: character.harm_level3_name || "",
    harm_level4_used: character.harm_level4_used ?? false,
    harm_level4_name: character.harm_level4_name || "",
  });
  useEffect(() => {
    setHarm({
      harm_level1_used: character.harm_level1_used ?? false,
      harm_level1_name: character.harm_level1_name || "",
      harm_level1_slot2_used: character.harm_level1_slot2_used ?? false,
      harm_level1_slot2_name: character.harm_level1_slot2_name || "",
      harm_level2_used: character.harm_level2_used ?? false,
      harm_level2_name: character.harm_level2_name || "",
      harm_level2_slot2_used: character.harm_level2_slot2_used ?? false,
      harm_level2_slot2_name: character.harm_level2_slot2_name || "",
      harm_level3_used: character.harm_level3_used ?? false,
      harm_level3_name: character.harm_level3_name || "",
      harm_level4_used: character.harm_level4_used ?? false,
      harm_level4_name: character.harm_level4_name || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);
  const save = () => onSave(harm);
  const renderSlot = (usedKey, nameKey, levelLabel) => (
    <div
      key={usedKey}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginTop: "4px",
      }}
    >
      <input
        type="checkbox"
        checked={harm[usedKey]}
        onChange={(e) =>
          setHarm((p) => ({ ...p, [usedKey]: e.target.checked }))
        }
      />
      <input
        style={{ ...S.inp, flex: 1, maxWidth: "200px" }}
        placeholder={levelLabel}
        value={harm[nameKey]}
        onChange={(e) => setHarm((p) => ({ ...p, [nameKey]: e.target.value }))}
      />
    </div>
  );
  return (
    <div style={{ padding: "8px 0", borderBottom: "1px solid #1f2937" }}>
      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
        {character.true_name || character.alias || "Unnamed"}
      </div>
      {/* Level 1: 2 slots */}
      {renderSlot(
        "harm_level1_used",
        "harm_level1_name",
        "Level 1 harm (slot 1)",
      )}
      {renderSlot(
        "harm_level1_slot2_used",
        "harm_level1_slot2_name",
        "Level 1 harm (slot 2)",
      )}
      {/* Level 2: 2 slots */}
      {renderSlot(
        "harm_level2_used",
        "harm_level2_name",
        "Level 2 harm (slot 1)",
      )}
      {renderSlot(
        "harm_level2_slot2_used",
        "harm_level2_slot2_name",
        "Level 2 harm (slot 2)",
      )}
      {/* Level 3: 1 slot */}
      {renderSlot("harm_level3_used", "harm_level3_name", "Level 3 harm")}
      {/* Level 4: 1 slot */}
      {renderSlot("harm_level4_used", "harm_level4_name", "Level 4 harm")}
      <button
        onClick={save}
        style={{ ...S.btn, marginTop: "6px", fontSize: "10px" }}
      >
        Save harm
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export default function CampaignManagement({
  initialCampaignId = null,
  initialFactionId = null,
  onNavigateToCharacter,
  onNavigateToNPC,
  onCampaignSelect,
}) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [selectedCampaignId, setSelectedCampaignId] =
    useState(initialCampaignId);
  const [sessionView, setSessionView] = useState(null); // null | 'list' | 'detail'
  const [selectedSession, setSelectedSession] = useState(null);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, invs] = await Promise.all([
        campaignAPI.getCampaigns(),
        campaignAPI.getInvitations().catch(() => []),
      ]);
      setCampaigns(list || []);
      setInvitations(invs || []);
    } catch (err) {
      setError(err.message || "Failed to load campaigns");
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (initialCampaignId == null) {
      setSelectedCampaignId(null);
    } else if (
      campaigns.length > 0 &&
      campaigns.some((c) => c.id === initialCampaignId)
    ) {
      setSelectedCampaignId(initialCampaignId);
    }
  }, [initialCampaignId, campaigns]);

  const startCreate = () => {
    setEditing("new");
    setForm({ name: "", description: "" });
  };

  const cancelEdit = () => {
    setEditing(null);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    try {
      if (editing === "new") {
        await campaignAPI.createCampaign(form);
      } else {
        await campaignAPI.updateCampaign(editing, form);
      }
      setEditing(null);
      await loadCampaigns();
    } catch (err) {
      setError(err.message || "Save failed");
    }
  };

  const handleAcceptInvitation = async (id) => {
    try {
      await campaignAPI.acceptInvitation(id);
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeclineInvitation = async (id) => {
    try {
      await campaignAPI.declineInvitation(id);
      await loadCampaigns();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);

  // Refresh a single campaign in-place
  const refreshSelected = async () => {
    if (!selectedCampaignId) return;
    try {
      const fresh = await campaignAPI.getCampaign(selectedCampaignId);
      setCampaigns((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    } catch {
      await loadCampaigns();
    }
  };

  // ---- Session detail view ----
  if (selectedCampaign && sessionView === "detail" && selectedSession) {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <SessionDetail
            campaign={selectedCampaign}
            session={selectedSession}
            onBack={() => {
              setSessionView("list");
              setSelectedSession(null);
            }}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    );
  }

  // ---- Session list view ----
  if (selectedCampaign && sessionView === "list") {
    return (
      <div style={S.page}>
        <div style={S.content}>
          <SessionList
            campaign={selectedCampaign}
            onBack={() => setSessionView(null)}
            onSelectSession={(session) => {
              setSelectedSession(session);
              setSessionView("detail");
            }}
            onRefresh={refreshSelected}
          />
        </div>
      </div>
    );
  }

  // ---- Campaign detail view ----
  if (selectedCampaign) {
    const isGM = selectedCampaign.gm?.id === user?.id;
    return (
      <div style={S.page}>
        <div style={S.content}>
          <CampaignDetail
            campaign={selectedCampaign}
            isGM={isGM}
            user={user}
            onBack={() => window.history.back()}
            onRefresh={refreshSelected}
            onManageSessions={() => setSessionView("list")}
            onNavigateToCharacter={onNavigateToCharacter}
            onNavigateToNPC={onNavigateToNPC}
            initialFactionId={initialFactionId}
            onCampaignDeleted={async () => {
              setSelectedCampaignId(null);
              setSessionView(null);
              setSelectedSession(null);
              onCampaignSelect?.(null);
              await loadCampaigns();
            }}
          />
        </div>
      </div>
    );
  }

  // ---- List view ----
  return (
    <div style={S.page}>
      <div style={S.content}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: "14px",
          }}
        >
          <button onClick={startCreate} style={S.btnSuccess}>
            + New Campaign
          </button>
        </div>

        {error && <div style={S.err}>{error}</div>}

        <PendingInvitations
          invitations={invitations}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
        />

        {editing != null && (
          <div style={{ ...S.card, border: "1px solid #7c3aed" }}>
            <span style={S.lbl}>CREATE CAMPAIGN</span>
            <div style={{ marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>Name</span>
              <input
                style={S.inp}
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Campaign name"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                Description
              </span>
              <textarea
                style={{
                  ...S.inp,
                  height: "60px",
                  resize: "vertical",
                  border: "1px solid #374151",
                  background: "#0d1117",
                  padding: "6px",
                }}
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleSave} style={S.btnPrimary}>
                Save
              </button>
              <button onClick={cancelEdit} style={S.btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={S.emptyState}>Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div style={S.emptyState}>
            <div style={{ fontSize: "16px", marginBottom: "8px" }}>
              No campaigns yet
            </div>
            <div style={{ fontSize: "12px", marginBottom: "16px" }}>
              Create one to start organizing your sessions, NPCs, and factions.
            </div>
            <button
              onClick={startCreate}
              style={{ ...S.btnPrimary, fontSize: "13px" }}
            >
              + Create Your First Campaign
            </button>
          </div>
        ) : (
          campaigns.map((c) => {
            const isGM = c.gm?.id === user?.id;
            const charCount = (c.campaign_characters || []).length;
            const playerCount = (c.players || []).length;
            return (
              <div
                key={c.id}
                style={{ ...S.card, cursor: "pointer" }}
                onClick={() => {
                  setSelectedCampaignId(c.id);
                  onCampaignSelect?.(c.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) =>
                  e.key === "Enter" &&
                  (setSelectedCampaignId(c.id), onCampaignSelect?.(c.id))
                }
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "14px",
                        marginBottom: "4px",
                      }}
                    >
                      {c.name || "Unnamed Campaign"}
                    </div>
                    {c.description && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#9ca3af",
                          marginBottom: "6px",
                        }}
                      >
                        {c.description}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <StatusBadge active={c.is_active !== false} />
                      <RoleBadge role={isGM ? "GM" : "Player"} />
                      <span style={{ fontSize: "11px", color: "#6b7280" }}>
                        {playerCount} player{playerCount !== 1 ? "s" : ""} |{" "}
                        {charCount} character{charCount !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#4b5563",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.created_at
                      ? new Date(c.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
