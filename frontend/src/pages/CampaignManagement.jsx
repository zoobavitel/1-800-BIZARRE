import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  campaignAPI,
  characterAPI,
  experienceTrackerAPI,
  factionAPI,
  npcAPI,
  sessionAPI,
  progressClockAPI,
  rollAPI,
  crewAPI,
  resolveMediaUrl,
} from "../features/character-sheet";
import { isGmManagedProgressClock } from "../features/character-sheet/utils/progressClockVisibility";
import { useAuth } from "../features/auth";
import { subscribeCampaignEvents } from "../features/character-sheet/services/campaignEvents";
import SessionGMManagementPanels from "../components/session/SessionGMManagementPanels";
import { buildRouteHref, handleSpaNavClick } from "../utils/spaNavigation";
import SessionXpAllocationTable from "../features/campaign-management/SessionXpAllocationTable";
import {
  buildSessionEndLivePreview,
  mergeEndLiveRowsWithScorecard,
  scorecardStatsByCharFromXpEntries,
  sumManualTrackXpForSession,
} from "../features/campaign-management/sessionEndLiveXpPreview";

const NPC_SESSION_RETURN_KEY = "hftf-npc-return-to-session";

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
  onOpenSession,
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
  const factionImageBlobPreview = useMemo(() => {
    if (!factionForm?.imageFile) return null;
    return URL.createObjectURL(factionForm.imageFile);
  }, [factionForm?.imageFile]);
  useEffect(() => {
    if (!factionImageBlobPreview) return undefined;
    return () => URL.revokeObjectURL(factionImageBlobPreview);
  }, [factionImageBlobPreview]);
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

  const handleRemovePlayerFromCampaign = async (userId, username) => {
    if (
      !window.confirm(
        `Remove ${username} from this campaign? Their character(s) will be unassigned from the campaign (and campaign crew, if any).`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await campaignAPI.removePlayer(campaign.id, userId);
      onRefresh();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleWithdrawInvitation = async (invitationId, username) => {
    if (
      !window.confirm(
        `Withdraw the pending invitation for ${username || "this user"}?`,
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await campaignAPI.withdrawInvitation(campaign.id, invitationId);
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
      visible_to_players: true,
      image: null,
      imageFile: null,
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
      visible_to_players: f.visible_to_players !== false,
      image: f.image || null,
      imageFile: null,
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

  const buildFactionSavePayload = () => {
    const f = factionForm;
    const payload = {
      name: f.name.trim(),
      faction_type: f.faction_type || "",
      level: Number(f.level) || 0,
      hold: f.hold === "strong" ? "strong" : "weak",
      reputation: Number(f.reputation) || 0,
      notes: f.notes || "",
      visible_to_players:
        f.visible_to_players !== undefined ? !!f.visible_to_players : true,
      campaign: campaign.id,
    };
    if (f.imageFile) {
      payload.imageFile = f.imageFile;
    }
    if (f.id && !f.imageFile && f.image == null) {
      payload.image = null;
    }
    return payload;
  };

  const handleFactionSave = async () => {
    setFactionError(null);
    if (!factionForm.name.trim()) {
      setFactionError("Name is required.");
      return;
    }
    try {
      if (factionForm.id) {
        await factionAPI.updateFaction(
          factionForm.id,
          buildFactionSavePayload(),
        );
      } else {
        await factionAPI.createFaction(buildFactionSavePayload());
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
      wanted_level: campaign?.wanted_stars ?? 0,
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
      // Wanted is campaign-wide + mirrored on every crew; character sheets read campaign.wanted_stars.
      if (isGM) {
        const targetWanted =
          Number.parseInt(String(crewForm.wanted_level ?? "0"), 10) || 0;
        try {
          await campaignAPI.patchCampaign(campaign.id, {
            wanted_stars: targetWanted,
          });
          const crews = campaign.crews || [];
          const needSyncIds = crews
            .filter(
              (c) => Number.parseInt(String(c.wanted_level ?? "0"), 10) !== targetWanted,
            )
            .map((c) => c.id)
            .filter(Boolean);
          if (needSyncIds.length > 0) {
            await Promise.allSettled(
              needSyncIds.map((cid) =>
                crewAPI.patchCrew(cid, { wanted_level: targetWanted }),
              ),
            );
          }
        } catch (syncErr) {
          setCrewError(syncErr.message || String(syncErr));
          onRefresh();
          return;
        }
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
            {isGM && typeof onOpenSession === "function" && (
              <CampaignSessionsPanel
                campaign={campaign}
                onOpenSession={onOpenSession}
                onRefresh={onRefresh}
              />
            )}
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
                          <a
                            href={buildRouteHref("character", { characterId: ch.id })}
                            onClick={(e) =>
                              handleSpaNavClick(e, () => onNavigateToCharacter(ch.id))
                            }
                            style={{
                              ...S.btn,
                              fontSize: "10px",
                              padding: "2px 6px",
                              background: "#1d4ed8",
                              color: "#93c5fd",
                            }}
                          >
                            View
                          </a>
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
                    <div
                      style={{
                        ...S.row,
                        marginBottom: "4px",
                        flexWrap: "wrap",
                        gap: "6px",
                      }}
                    >
                      <span style={{ fontWeight: "bold", color: "#d1d5db" }}>
                        {p.username}
                      </span>
                      <RoleBadge role="Player" />
                      {isGM && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRemovePlayerFromCampaign(p.id, p.username)
                          }
                          style={{
                            ...S.btn,
                            fontSize: "10px",
                            padding: "2px 8px",
                            background: "#7f1d1d",
                            color: "#fca5a5",
                          }}
                        >
                          Remove from campaign
                        </button>
                      )}
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
                            <a
                              href={buildRouteHref("character", { characterId: ch.id })}
                              onClick={(e) =>
                                handleSpaNavClick(e, () => onNavigateToCharacter(ch.id))
                              }
                              style={{
                                ...S.btn,
                                fontSize: "10px",
                                padding: "2px 6px",
                                background: "#1d4ed8",
                                color: "#93c5fd",
                              }}
                            >
                              View
                            </a>
                          )}
                          {((isGM && p.id !== campaign.gm?.id) ||
                            p.id === user?.id) && (
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
                  marginTop: "6px",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span>
                  {inv.invited_user?.username} (invited by{" "}
                  {inv.invited_by?.username})
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleWithdrawInvitation(
                      inv.id,
                      inv.invited_user?.username,
                    )
                  }
                  style={{
                    ...S.btn,
                    fontSize: "10px",
                    padding: "2px 8px",
                    background: "#78350f",
                    color: "#fcd34d",
                  }}
                >
                  Withdraw invitation
                </button>
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
            <div
              style={{
                color: "#6b7280",
                fontSize: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span>No NPCs assigned to this campaign.</span>
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
                      <a
                        href={buildRouteHref("npcs", { npcId: npc.id })}
                        onClick={(e) =>
                          handleSpaNavClick(e, () => onNavigateToNPC(npc.id))
                        }
                        style={{
                          ...S.btn,
                          fontSize: "10px",
                          padding: "2px 6px",
                          background: "#1d4ed8",
                          color: "#93c5fd",
                        }}
                      >
                        View
                      </a>
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
          {typeof onNavigateToNPC === "function" && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "8px",
              }}
            >
              <a
                href={buildRouteHref("npcs", { campaignId: campaign.id })}
                onClick={(e) =>
                  handleSpaNavClick(e, () =>
                    onNavigateToNPC(null, { campaignId: campaign.id }),
                  )
                }
                style={{
                  ...S.btn,
                  fontSize: "10px",
                  padding: "2px 6px",
                  background: "#15803d",
                  color: "#bbf7d0",
                  textDecoration: "none",
                }}
              >
                Create NPC for this campaign
              </a>
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
              Any player or the GM can create one — once it exists, every
              campaign member can edit the shared crew sheet.
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
          {!crewForm && (campaign.crews || []).length === 0 && (
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
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {f.image ? (
                    <img
                      src={resolveMediaUrl(f.image)}
                      alt=""
                      style={{
                        width: 40,
                        height: 40,
                        objectFit: "cover",
                        borderRadius: 4,
                        border: "1px solid #374151",
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
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
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "flex-start",
                  marginBottom: "10px",
                }}
              >
                {(factionImageBlobPreview || resolveMediaUrl(factionForm.image)) && (
                  <div style={{ flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "#9ca3af",
                        display: "block",
                        marginBottom: "4px",
                      }}
                    >
                      Preview
                    </span>
                    <img
                      src={
                        factionImageBlobPreview ||
                        resolveMediaUrl(factionForm.image)
                      }
                      alt=""
                      style={{
                        width: 96,
                        height: 96,
                        objectFit: "cover",
                        borderRadius: 6,
                        border: "1px solid #374151",
                        background: "#111",
                      }}
                    />
                  </div>
                )}
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#9ca3af",
                      display: "block",
                      marginBottom: "4px",
                    }}
                  >
                    Faction image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ fontSize: "11px", color: "#d1d5db", maxWidth: "100%" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      setFactionForm((p) => ({
                        ...p,
                        imageFile: file || null,
                      }));
                      e.target.value = "";
                    }}
                  />
                  {(factionForm.image || factionForm.imageFile) && (
                    <button
                      type="button"
                      onClick={() =>
                        setFactionForm((p) => ({
                          ...p,
                          image: null,
                          imageFile: null,
                        }))
                      }
                      style={{
                        ...S.btnGhost,
                        fontSize: "10px",
                        marginTop: "6px",
                        display: "block",
                      }}
                    >
                      Clear image (local)
                    </button>
                  )}
                </div>
              </div>
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

function ClockManager({
  clocks,
  setClocks,
  campaignId,
  sessionId,
  setError,
  campaignGmId = null,
}) {
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
        // Backend always sets created_by (including GM). Treat GM-created / NPC
        // clocks as GM-managed → visible_to_players (not visible_to_party).
        const isGMClock = isGmManagedProgressClock(clk, campaignGmId);
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
                    checked={
                      !!clk.visible_to_players || !!clk.visible_to_party
                    }
                    onChange={(e) =>
                      updateClock({
                        visible_to_players: e.target.checked,
                        // Party-share is for player-owned clocks; clear so GM
                        // mistoggles that only set visible_to_party get repaired.
                        visible_to_party: false,
                      })
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

// ---------------------------------------------------------------------------
// Session Records Modal (view session history: goals, rolls, events)
// ---------------------------------------------------------------------------

/** Primary label for dice row: Fortune uses GM (rolled_by), not vehicle character_id. */
function formatSessionRecordsRollSummary(r, showPositionEffect) {
  const rt = String(r.roll_type || "").toUpperCase();
  const diceStr = [].concat(r.results || []).join(", ");
  const outcomeStr = String(r.outcome || "").trim();
  const posEff =
    showPositionEffect && (r.position || r.effect)
      ? ` (${r.position || ""}, ${r.effect || ""})`
      : "";

  if (rt === "FORTUNE") {
    const gm = String(r.rolled_by_username || "").trim() || "GM";
    const label = String(r.fortune_public_label || r.goal_label || "").trim();
    const act = String(r.action_name || "").trim();
    const mid =
      label ||
      (act.toLowerCase() !== "fortune" ? act : "") ||
      "Fortune";
    const midSeg = mid && mid !== "Fortune" ? ` · ${mid}` : "";
    return `${gm} · GM Fortune${midSeg} · ${diceStr} → ${outcomeStr}${posEff}`;
  }

  if (rt === "CLEAR_STRESS") {
    const actor =
      String(r.rolled_by_username || "").trim() ||
      String(r.character_name || "").trim() ||
      String(r.character ?? "");
    const actionName = String(r.action_name || "").trim().toLowerCase();
    const act = actionName === "vice"
      ? "Downtime recovery (vice)"
      : actionName === "recover" || actionName === "recovery"
        ? "Recovery in play"
        : String(r.action_name || "").trim() || "Clear stress";
    return `${actor || "unknown"} · ${act} · ${diceStr} → ${outcomeStr}${posEff}`;
  }

  const actor =
    String(r.rolled_by_username || "").trim() ||
    String(r.character_name || "").trim() ||
    String(r.character ?? "");
  const action = String(r.action_name || "").trim() || "Roll";
  return `${actor || "unknown"} · ${action} · ${diceStr} → ${outcomeStr}${posEff}`;
}

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
              <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "6px" }}>
                Combat flow stays fiction-first. Relative Speed frames starting position;
                no fixed initiative track.
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
                    {formatSessionRecordsRollSummary(r, showPositionEffect)}
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

function campaignActiveSessionId(campaign) {
  const a = campaign?.active_session;
  if (a == null || a === "") return null;
  if (typeof a === "object" && a !== null) return a.id ?? null;
  const n = Number(a);
  return Number.isFinite(n) ? n : null;
}

/** `YYYY-MM-DD` vs local calendar start-of-today. */
function calendarDateStartsBeforeToday(isoDate) {
  if (!isoDate) return false;
  const p = String(isoDate).trim().split("-");
  if (p.length < 3) return false;
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  if (![y, m, d].every((n) => Number.isFinite(n))) return false;
  const anchor = new Date(y, m - 1, d);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  return anchor < startToday;
}

/** Calendar date shown before `·` on the campaign session list row. */
function sessionListPrimaryDate(session) {
  const raw = String(session?.status ?? "PLANNED").trim().toUpperCase();
  if (raw === "PLANNED" && session?.proposed_date) {
    const iso = String(session.proposed_date).trim();
    if (iso) {
      try {
        return new Date(`${iso}T12:00:00`).toLocaleDateString();
      } catch {
        /* fall through */
      }
    }
  }
  if (session?.session_date) {
    try {
      return new Date(session.session_date).toLocaleDateString();
    } catch {
      return "N/A";
    }
  }
  return "N/A";
}

/** Status phrase after `date ·` (Planned / In session / Ended, plus edge labels). */
function sessionListStatusCaption(session, campaignActiveSessionId) {
  const sid = Number(session?.id);
  const raw = String(session?.status ?? "PLANNED").trim().toUpperCase();

  const aidParsed = Number(campaignActiveSessionId);
  const aid =
    campaignActiveSessionId != null && Number.isFinite(aidParsed)
      ? aidParsed
      : null;

  const isCampaignLiveSlot =
    aid !== null && Number.isFinite(sid) && sid === aid;

  if (isCampaignLiveSlot) return "In session";

  // Backend sets COMPLETED and auto_encoded_xp_settled when live ends (see campaign PATCH).
  if (raw === "COMPLETED" || session?.auto_encoded_xp_settled) return "Ended";

  const anotherLive = aid !== null && Number.isFinite(sid) && sid !== aid;

  if (anotherLive) {
    if (raw === "ACTIVE") return "Not active";
    if (raw === "PLANNED") {
      if (calendarDateStartsBeforeToday(session?.proposed_date))
        return "Past · not active";
      // Still PLANNED but another episode is Live — distinguish real upcoming vs stale row.
      return session?.proposed_date ? "Planned" : "Not active";
    }
  }

  if (raw === "PLANNED") return "Planned";
  if (raw === "ACTIVE") return "In session";
  return raw;
}

/**
 * Session detail header: treat as ended when status is COMPLETED (matches session
 * list "Ended") or when the encoded session-end pass ran (GM ended live / cleared
 * active_session, or session was completed and settled on the server).
 */
function sessionIsEndedForManagementHeader(sess) {
  const raw = String(sess?.status ?? "PLANNED").trim().toUpperCase();
  if (raw === "COMPLETED") return true;
  return Boolean(sess?.auto_encoded_xp_settled);
}

// ---------------------------------------------------------------------------
// Sessions list + create + records modal (embedded in CampaignDetail)
// ---------------------------------------------------------------------------
function CampaignSessionsPanel({ campaign, onOpenSession, onRefresh }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [recordsModalSession, setRecordsModalSession] = useState(null);
  const [busySessionId, setBusySessionId] = useState(null);
  const [clearActiveModalSession, setClearActiveModalSession] = useState(null);
  const [clearActiveBusy, setClearActiveBusy] = useState(false);
  const [clearActiveSessionDetail, setClearActiveSessionDetail] = useState(null);
  const [clearActiveRolls, setClearActiveRolls] = useState([]);
  const [clearActiveClocks, setClearActiveClocks] = useState([]);
  const [clearActiveChars, setClearActiveChars] = useState([]);
  const [clearActiveCharsLoaded, setClearActiveCharsLoaded] = useState(false);
  const [clearActiveDataLoading, setClearActiveDataLoading] = useState(false);
  const [clearActiveManualXpByChar, setClearActiveManualXpByChar] = useState({});
  const [clearActiveManualReady, setClearActiveManualReady] = useState(false);

  const campaignLiveSlotId = campaignActiveSessionId(campaign);

  useEffect(() => {
    if (!campaign?.id) return;
    let cancelled = false;
    setLoading(true);
    sessionAPI
      .getSessions(campaign.id)
      .then((list) => {
        if (!cancelled) setSessions(list || []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setSessions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaign.id, campaignLiveSlotId]);

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
      onOpenSession(session);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const activeId = campaignActiveSessionId(campaign);

  const resetClearActiveModal = useCallback(() => {
    setClearActiveModalSession(null);
    setClearActiveSessionDetail(null);
    setClearActiveRolls([]);
    setClearActiveClocks([]);
    setClearActiveChars([]);
    setClearActiveCharsLoaded(false);
    setClearActiveManualXpByChar({});
    setClearActiveManualReady(false);
    setClearActiveDataLoading(false);
  }, []);

  useEffect(() => {
    if (!clearActiveModalSession?.id || !campaign?.id) return undefined;
    let cancelled = false;
    const sid = clearActiveModalSession.id;
    const fallbackRow = clearActiveModalSession;
    setClearActiveDataLoading(true);
    setClearActiveCharsLoaded(false);
    setClearActiveManualReady(false);
    Promise.all([
      sessionAPI.getSession(sid).catch(() => null),
      rollAPI.getRolls({ session: sid }).catch(() => []),
      progressClockAPI
        .getProgressClocks({ campaign: campaign.id, session: sid })
        .catch(() => []),
      characterAPI
        .getCharacters()
        .then((list) =>
          (list || []).filter((c) => Number(c.campaign) === Number(campaign.id)),
        )
        .catch(() => []),
    ]).then(([sess, rollsData, clocksData, charsData]) => {
      if (cancelled) return;
      setClearActiveSessionDetail(sess || fallbackRow);
      const rollList = Array.isArray(rollsData)
        ? rollsData
        : rollsData?.results || [];
      const clockList = Array.isArray(clocksData)
        ? clocksData
        : clocksData?.results || [];
      setClearActiveRolls(rollList);
      setClearActiveClocks(clockList);
      setClearActiveChars(charsData);
      setClearActiveCharsLoaded(true);
      setClearActiveDataLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clearActiveModalSession?.id, campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- row captured at start via fallbackRow

  useEffect(() => {
    if (!clearActiveModalSession?.id || !clearActiveCharsLoaded) return undefined;
    if (!clearActiveChars.length) {
      setClearActiveManualXpByChar({});
      setClearActiveManualReady(true);
      return undefined;
    }
    let cancelled = false;
    setClearActiveManualReady(false);
    const sid = clearActiveModalSession.id;
    (async () => {
      const pairs = await Promise.all(
        clearActiveChars.map(async (ch) => {
          const raw = await experienceTrackerAPI
            .list({ character: ch.id })
            .catch(() => []);
          const arr = Array.isArray(raw) ? raw : raw?.results || [];
          return [ch.id, sumManualTrackXpForSession(arr, sid)];
        }),
      );
      if (cancelled) return;
      setClearActiveManualXpByChar(Object.fromEntries(pairs));
      setClearActiveManualReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [clearActiveModalSession?.id, clearActiveChars, clearActiveCharsLoaded]);

  const clearActiveCampaignChars = useMemo(() => {
    const embedded = campaign?.campaign_characters;
    if (Array.isArray(embedded) && embedded.length) return embedded;
    return (clearActiveChars || []).map((c) => ({
      id: c.id,
      true_name: c.true_name,
      name: c.name,
      ...c,
    }));
  }, [campaign?.campaign_characters, clearActiveChars]);

  const clearActiveEndLivePreview = useMemo(
    () =>
      buildSessionEndLivePreview(
        clearActiveRolls,
        clearActiveCampaignChars,
        clearActiveClocks,
        clearActiveChars,
      ),
    [
      clearActiveRolls,
      clearActiveCampaignChars,
      clearActiveClocks,
      clearActiveChars,
    ],
  );

  const clearActiveRowsWithManual = useMemo(() => {
    return (clearActiveEndLivePreview.perPcRows || []).map((row) => {
      const manualSessionXp = clearActiveManualXpByChar[row.characterId] ?? 0;
      const totalSessionXpPreview =
        (row.developmentPoolXp || 0) +
        (row.totalEncodedPlaybookXp || 0) +
        manualSessionXp;
      return {
        ...row,
        manualSessionXp,
        totalSessionXpPreview,
      };
    });
  }, [clearActiveEndLivePreview.perPcRows, clearActiveManualXpByChar]);

  const clearActiveScorecardStatsByChar = useMemo(
    () =>
      scorecardStatsByCharFromXpEntries(clearActiveSessionDetail?.xp_entries),
    [clearActiveSessionDetail?.xp_entries],
  );

  const clearActiveRowsWithScorecard = useMemo(
    () =>
      mergeEndLiveRowsWithScorecard(
        clearActiveRowsWithManual,
        clearActiveScorecardStatsByChar,
        clearActiveSessionDetail?.auto_encoded_xp_settled,
      ),
    [
      clearActiveRowsWithManual,
      clearActiveScorecardStatsByChar,
      clearActiveSessionDetail?.auto_encoded_xp_settled,
    ],
  );

  const clearActivePreviewReady =
    !clearActiveDataLoading && clearActiveManualReady;

  const openClearActiveModal = (s) => {
    setError(null);
    setClearActiveDataLoading(true);
    setClearActiveCharsLoaded(false);
    setClearActiveManualReady(false);
    setClearActiveModalSession(s);
  };

  const runClearActiveFromList = async (skipEncodedXp) => {
    const s = clearActiveModalSession;
    if (
      !campaign?.id ||
      !s?.id ||
      activeId == null ||
      Number(activeId) !== Number(s.id)
    ) {
      return;
    }
    setClearActiveBusy(true);
    setBusySessionId(s.id);
    setError(null);
    try {
      await campaignAPI.patchCampaign(campaign.id, {
        active_session: null,
        skip_encoded_xp_settlement: skipEncodedXp === true,
      });
      resetClearActiveModal();
      onRefresh?.();
    } catch (e) {
      setError(e.message || "Could not end live session");
    } finally {
      setClearActiveBusy(false);
      setBusySessionId(null);
    }
  };

  const handleDeleteSession = async (s) => {
    const label = s.name || `Session ${s.id}`;
    if (
      !window.confirm(
        `Delete "${label}"? This removes the session and its tied records (e.g. rolls) where the server is configured to cascade. This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusySessionId(s.id);
    setError(null);
    try {
      await sessionAPI.deleteSession(s.id);
      setSessions((prev) => (prev || []).filter((x) => x.id !== s.id));
      onRefresh?.();
    } catch (e) {
      setError(e.message || "Could not delete session");
    } finally {
      setBusySessionId(null);
    }
  };

  const handleSetLiveFromList = async (s) => {
    if (sessionIsEndedForManagementHeader(s)) {
      setError("That session is ended. Reopen it from session detail first.");
      return;
    }
    setBusySessionId(s.id);
    setError(null);
    try {
      await campaignAPI.patchCampaign(campaign.id, { active_session: s.id });
      onRefresh?.();
    } catch (e) {
      setError(e.message || "Could not set live session");
    } finally {
      setBusySessionId(null);
    }
  };

  const handleMarkSessionEndedFromList = async (s, skipEncodedXp) => {
    const isRowLive =
      activeId != null && Number(activeId) === Number(s.id);
    if (isRowLive) {
      setError("Use Clear active to end the live session.");
      return;
    }
    if (sessionIsEndedForManagementHeader(s)) return;
    const label = s.name || `Session ${s.id}`;
    if (
      skipEncodedXp !== true &&
      !window.confirm(
        `Mark "${label}" ended and run the automatic encoded XP pass (STRUGGLE from the roll log) plus Development→pool where applicable?`,
      )
    ) {
      return;
    }
    if (
      skipEncodedXp === true &&
      !window.confirm(
        `Mark "${label}" ended without the auto session XP pass? (Pass marked settled; no STRUGGLE or Development→pool grant.)`,
      )
    ) {
      return;
    }
    setBusySessionId(s.id);
    setError(null);
    try {
      const updated = await sessionAPI.patchSession(s.id, {
        status: "COMPLETED",
        skip_encoded_xp_settlement: skipEncodedXp === true,
      });
      setSessions((prev) =>
        (prev || []).map((row) =>
          Number(row.id) === Number(s.id) ? { ...row, ...updated } : row,
        ),
      );
      onRefresh?.();
    } catch (e) {
      setError(e.message || "Could not mark session ended");
    } finally {
      setBusySessionId(null);
    }
  };

  return (
    <>
      {clearActiveModalSession && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-active-session-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !clearActiveBusy) {
              resetClearActiveModal();
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "88vh",
              overflow: "auto",
              background: "#111827",
              border: "1px solid #4b5563",
              borderRadius: "8px",
              padding: "20px",
              color: "#e5e7eb",
              fontSize: "13px",
              lineHeight: 1.45,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="clear-active-session-title"
              style={{ margin: "0 0 12px", fontSize: "18px", color: "#fff" }}
            >
              End live session?
            </h2>
            {error ? (
              <div style={{ ...S.err, marginBottom: "12px" }}>{error}</div>
            ) : null}
            <p style={{ margin: "0 0 8px", color: "#9ca3af", fontSize: "12px" }}>
              Session:{" "}
              <strong style={{ color: "#e5e7eb" }}>
                {clearActiveModalSession.name || `Session ${clearActiveModalSession.id}`}
              </strong>
            </p>
            <p style={{ margin: "0 0 12px", color: "#d1d5db" }}>
              You are clearing the campaign&apos;s live slot (character sheets, clocks,
              etc.). <strong>End &amp; apply encoded XP</strong> runs the one-time encoded{" "}
              pass (STRUGGLE from the roll log, capped per session) <strong>and</strong> banks each PC&apos;s{" "}
              <strong>Stand Development</strong> session XP into their{" "}
              <strong>session XP pool</strong>.{" "}
              <strong>End without encoded XP</strong> clears live only and marks the
              encoded pass settled without granting that automatic STRUGGLE XP or
              banking Development→pool from this action. Use manual XP for off-roll
              awards.{" "}
              <span style={{ color: "#9ca3af" }}>
                Durability affects armor/resist only, not XP.
              </span>
            </p>
            {clearActiveSessionDetail?.auto_encoded_xp_settled ? (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: "rgba(234, 179, 8, 0.12)",
                  border: "1px solid rgba(234, 179, 8, 0.45)",
                  color: "#fcd34d",
                  fontSize: "12px",
                }}
              >
                This session&apos;s encoded XP pass was already marked settled. Ending
                live will <strong>not</strong> apply additional automatic playbook XP
                from rolls or bank Development session XP again.
              </div>
            ) : null}
            {!clearActivePreviewReady ? (
              <div style={{ color: "#6b7280", marginBottom: "12px", fontSize: "12px" }}>
                Loading session summary…
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: "10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Session snapshot
                </div>
                <ul style={{ margin: "0 0 12px 18px", padding: 0, color: "#d1d5db" }}>
                  <li>
                    <strong>{clearActiveEndLivePreview.rollCount}</strong> roll
                    {clearActiveEndLivePreview.rollCount === 1 ? "" : "s"} logged on this
                    session
                    {clearActiveEndLivePreview.rollCount > 0 ? (
                      <span style={{ color: "#9ca3af" }}>
                        {" "}
                        (
                        {Object.entries(clearActiveEndLivePreview.byType)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")}
                        )
                      </span>
                    ) : null}
                    .
                  </li>
                  {clearActiveEndLivePreview.desperateCount > 0 ? (
                    <li>
                      <strong>{clearActiveEndLivePreview.desperateCount}</strong>{" "}
                      desperate-position roll
                      {clearActiveEndLivePreview.desperateCount === 1 ? "" : "s"} (desperate
                      action XP is applied when each roll is committed, not here).
                    </li>
                  ) : null}
                  <li>
                    Progress clocks in this session:{" "}
                    <strong>{clearActiveEndLivePreview.clockCount}</strong> tracked,{" "}
                    <strong>{clearActiveEndLivePreview.clocksCompleted}</strong> completed
                    (fiction / clocks are not auto-converted to XP).
                  </li>
                </ul>
                <div
                  style={{
                    marginBottom: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#9ca3af",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Per-PC XP preview (if you apply encoded pass)
                </div>
                {clearActiveRowsWithScorecard.length === 0 ? (
                  <div
                    style={{ color: "#9ca3af", marginBottom: "12px", fontSize: "12px" }}
                  >
                    No PCs in this campaign roster — nothing to preview.
                  </div>
                ) : (
                  <SessionXpAllocationTable rows={clearActiveRowsWithScorecard} />
                )}
                <p style={{ margin: "0 0 16px", fontSize: "11px", color: "#9ca3af" }}>
                  <strong>Total</strong> column = scorecard XP (BELIEFS / PLAYBOOK /
                  STRUGGLE → free pool) + Development end-session bonus (→ free
                  pool) + manual awards already on tracks. Allocate pool XP on
                  the character sheet.
                </p>
              </>
            )}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                disabled={clearActiveBusy}
                onClick={() => {
                  if (!clearActiveBusy) resetClearActiveModal();
                }}
                style={S.btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearActiveBusy || !clearActivePreviewReady}
                onClick={() => runClearActiveFromList(true)}
                style={S.btnGhost}
                title="Clears live session only; marks encoded pass done without granting automatic STRUGGLE XP."
              >
                {clearActiveBusy ? "…" : "End without encoded XP"}
              </button>
              <button
                type="button"
                disabled={clearActiveBusy || !clearActivePreviewReady}
                onClick={() => runClearActiveFromList(false)}
                style={S.btnPrimary}
                title="Clears live session and runs the automatic playbook XP pass (no-op if this session was already settled)."
              >
                {clearActiveBusy ? "…" : "End & apply encoded XP"}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && !clearActiveModalSession ? (
        <div style={{ ...S.err, marginTop: "12px" }}>{error}</div>
      ) : null}
      <div
        style={{
          marginTop: "14px",
          paddingTop: "14px",
          borderTop: "1px solid #374151",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            marginBottom: loading ? "0" : "10px",
          }}
        >
          <span style={{ ...S.sectionLbl, marginTop: 0, marginBottom: 0 }}>
            Sessions
          </span>
          <button
            onClick={handleCreateSession}
            style={S.btnSuccess}
            disabled={creating}
          >
            {creating ? "Creating..." : "+ New Session"}
          </button>
        </div>
        {loading ? (
          <div style={{ color: "#6b7280", padding: "12px 0" }}>
            Loading sessions...
          </div>
        ) : !sessions?.length ? (
          <div style={{ color: "#6b7280", padding: "8px 0" }}>
            No sessions yet. Create one to get started.
          </div>
        ) : (
          <div style={{ marginTop: "4px" }}>
            {sessions.map((s) => {
              const rowEnded = sessionIsEndedForManagementHeader(s);
              const rowLive =
                activeId != null && Number(activeId) === Number(s.id);
              return (
              <div
                key={s.id}
                style={{
                  background: "#0d1117",
                  border: "1px solid #374151",
                  borderRadius: "4px",
                  padding: "10px",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{ flex: 1, cursor: "pointer", minWidth: 0 }}
                    onClick={() => onOpenSession(s)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onOpenSession(s)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: "bold" }}>
                        {s.name || `Session ${s.id}`}
                      </span>
                      {activeId != null && Number(activeId) === Number(s.id) && (
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "#a7f3d0",
                            border: "1px solid #047857",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            background: "rgba(6, 95, 70, 0.25)",
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {sessionListPrimaryDate(s)} ·{" "}
                      {sessionListStatusCaption(s, activeId)}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecordsModalSession(s);
                      }}
                      style={{ ...S.btn, fontSize: "10px", padding: "4px 8px" }}
                    >
                      View records
                    </button>
                    {!rowEnded && !rowLive ? (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetLiveFromList(s);
                          }}
                          style={{ ...S.btnPrimary, fontSize: "10px", padding: "4px 8px" }}
                          disabled={busySessionId === s.id}
                          title="Point campaign live session at this episode."
                        >
                          {busySessionId === s.id ? "…" : "Set live"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkSessionEndedFromList(s, true);
                          }}
                          style={{ ...S.btnGhost, fontSize: "10px", padding: "4px 8px" }}
                          disabled={busySessionId === s.id}
                          title="Mark ended without the auto session XP pass."
                        >
                          {busySessionId === s.id ? "…" : "End skip XP"}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkSessionEndedFromList(s, false);
                          }}
                          style={{ ...S.btnGhost, fontSize: "10px", padding: "4px 8px" }}
                          disabled={busySessionId === s.id}
                          title="Mark ended and run the auto session XP pass (STRUGGLE + Development→pool)."
                        >
                          {busySessionId === s.id ? "…" : "End + XP"}
                        </button>
                      </>
                    ) : null}
                    {activeId != null && Number(activeId) === Number(s.id) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openClearActiveModal(s);
                        }}
                        style={{ ...S.btnGhost, fontSize: "10px", padding: "4px 8px" }}
                        disabled={
                          busySessionId === s.id ||
                          (clearActiveModalSession != null &&
                            Number(clearActiveModalSession.id) === Number(s.id))
                        }
                        title="End this live session for players: choose whether to apply the auto session XP pass (STRUGGLE + Development→pool), or skip it."
                      >
                        {busySessionId === s.id ? "…" : "Clear active"}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(s);
                      }}
                      style={{ ...S.btnDanger, fontSize: "10px", padding: "4px 8px" }}
                      disabled={busySessionId === s.id}
                    >
                      {busySessionId === s.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
      {recordsModalSession && (
        <SessionRecordsModal
          sessionId={recordsModalSession.id}
          sessionName={recordsModalSession.name}
          onClose={() => setRecordsModalSession(null)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Session Detail View (GM-only)
// ---------------------------------------------------------------------------
/** Poll session panel while tab visible (backup if SSE disconnects). Mirrors CharacterPage. */
const SESSION_PANEL_SYNC_INTERVAL_MS = 12000;

function SessionDetail({
  campaign,
  session,
  onBack,
  onRefresh,
  onNavigateToCharacter,
  onNavigateToNPC,
}) {
  const { user } = useAuth();
  const isGM = Number(campaign?.gm?.id) === Number(user?.id);
  const [sessionData, setSessionData] = useState(session);
  const [rolls, setRolls] = useState([]);
  const [clocks, setClocks] = useState([]);
  const [crews, setCrews] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [campaignNPCs, setCampaignNPCs] = useState([]);
  const [manualRoll, setManualRoll] = useState({
    rollKind: "ACTION",
    characterId: "",
    actionName: "skirmish",
    resistanceAttr: "resolve",
    viceNote: "",
    diceStr: "4,5",
    outcome: "FULL_SUCCESS",
  });
  const [manualRollSaving, setManualRollSaving] = useState(false);
  const [manualXp, setManualXp] = useState({
    characterId: "",
    track: "playbook",
    amount: 1,
    reason: "",
  });
  const [manualXpSaving, setManualXpSaving] = useState(false);
  const [fortuneDice, setFortuneDice] = useState(2);
  const [fortuneReason, setFortuneReason] = useState("");
  const [fortuneRolling, setFortuneRolling] = useState(false);
  const [error, setError] = useState(null);
  const [sessionDateInput, setSessionDateInput] = useState("");
  const [sessionTitleInput, setSessionTitleInput] = useState("");
  const [sessionTitleSaving, setSessionTitleSaving] = useState(false);
  const [endLiveModalOpen, setEndLiveModalOpen] = useState(false);
  const [endLiveBusy, setEndLiveBusy] = useState(false);
  const [sessionManualXpByChar, setSessionManualXpByChar] = useState({});
  const [sessionManualXpSyncReady, setSessionManualXpSyncReady] =
    useState(false);

  const refreshSessionCharacters = useCallback(async () => {
    if (!campaign?.id) return;
    try {
      const list = await characterAPI.getCharacters();
      const rows = Array.isArray(list)
        ? list.filter(
            (c) => Number(c?.campaign) === Number(campaign.id),
          )
        : [];
      setCharacters(rows);
    } catch {
      /* ignore */
    }
  }, [campaign?.id]);

  // Refetch every panel data source (session, rolls, clocks, crews, characters).
  // Used both for the initial mount/session-switch effect and for the realtime
  // campaign-events stream so any teammate's roll, clock tick, sheet save, or
  // XP toggle reflects here without a manual refresh.
  const refetchSessionPanel = useCallback(async () => {
    if (!session?.id) return;
    const sid = session.id;
    const cid = campaign?.id;
    await Promise.all([
      sessionAPI
        .getSession(sid)
        .then(setSessionData)
        .catch(() => setSessionData(session)),
      rollAPI
        .getRolls({ session: sid })
        .then(setRolls)
        .catch(() => setRolls([])),
      cid != null
        ? progressClockAPI
            .getProgressClocks({ campaign: cid, session: sid })
            .then(setClocks)
            .catch(() => setClocks([]))
        : Promise.resolve(),
      crewAPI
        .getCrews()
        .then((list) =>
          setCrews(
            cid != null
              ? list?.filter((c) => c.campaign === cid) || []
              : [],
          ),
        )
        .catch(() => setCrews([])),
      characterAPI
        .getCharacters()
        .then((list) =>
          setCharacters(
            cid != null
              ? list?.filter((c) => c.campaign === cid) || []
              : [],
          ),
        )
        .catch(() => setCharacters([])),
    ]);
  }, [session, campaign?.id]);

  useEffect(() => {
    refetchSessionPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, campaign?.id, campaign?.wanted_stars]);

  // Realtime: listen to campaign SSE stream and refetch this panel on any
  // backend-broadcast change (rolls, character saves, clocks). Coalesce bursts
  // through a short timer so a flurry of updates only triggers one refetch.
  useEffect(() => {
    if (!campaign?.id || !session?.id) return undefined;
    let pending = null;
    const schedule = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        refetchSessionPanel();
      }, 350);
    };
    const unsubscribe = subscribeCampaignEvents(campaign.id, {
      onUpdate: schedule,
    });
    return () => {
      if (pending) clearTimeout(pending);
      unsubscribe();
    };
  }, [campaign?.id, session?.id, refetchSessionPanel]);

  // Visibility backup: when tab becomes visible again, pull session panel state.
  useEffect(() => {
    if (!session?.id) return undefined;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void refetchSessionPanel();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [session?.id, refetchSessionPanel]);

  // Interval backup while SessionDetail mounted and document visible (complements SSE).
  useEffect(() => {
    if (!session?.id) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refetchSessionPanel();
    }, SESSION_PANEL_SYNC_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [session?.id, refetchSessionPanel]);

  // Refetch NPCs when the campaign payload is refreshed (e.g. new factions) or session
  // changes, so session faction dropdowns stay in sync with server `faction` fields.
  useEffect(() => {
    if (!campaign?.id) return;
    npcAPI
      .getNPCs(campaign.id)
      .then(setCampaignNPCs)
      .catch(() => setCampaignNPCs([]));
  }, [campaign, session?.id]);

  useEffect(() => {
    const raw = sessionData?.session_date;
    if (!raw) {
      setSessionDateInput("");
      return;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      setSessionDateInput("");
      return;
    }
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    setSessionDateInput(`${year}-${month}-${day}`);
  }, [sessionData?.id, sessionData?.session_date]);

  useEffect(() => {
    setSessionTitleInput(String(sessionData?.name ?? "").trim());
  }, [sessionData?.id, sessionData?.name]);

  const campaignChars =
    campaign?.campaign_characters ||
    characters.map((c) => ({ id: c.id, true_name: c.true_name, ...c }));

  const fortuneRolls = useMemo(
    () =>
      (rolls || []).filter(
        (r) => String(r.roll_type || "").toUpperCase() === "FORTUNE",
      ),
    [rolls],
  );

  const endLivePreview = useMemo(
    () => buildSessionEndLivePreview(rolls, campaignChars, clocks, characters),
    [rolls, campaignChars, clocks, characters],
  );

  const endLiveRowsWithManual = useMemo(() => {
    return (endLivePreview.perPcRows || []).map((row) => {
      const manualSessionXp = sessionManualXpByChar[row.characterId] ?? 0;
      const totalSessionXpPreview =
        (row.developmentPoolXp || 0) +
        (row.totalEncodedPlaybookXp || 0) +
        manualSessionXp;
      return {
        ...row,
        manualSessionXp,
        totalSessionXpPreview,
      };
    });
  }, [endLivePreview.perPcRows, sessionManualXpByChar]);

  const activeSessionId =
    campaign?.active_session?.id ?? campaign?.active_session ?? null;
  const isCurrentActiveSession =
    activeSessionId != null && Number(activeSessionId) === Number(session.id);

  const sessionEnded = sessionIsEndedForManagementHeader(sessionData);
  const sessionStatusUpper = String(sessionData?.status ?? "PLANNED")
    .trim()
    .toUpperCase();

  useEffect(() => {
    if (!session?.id) return;
    const needManual = endLiveModalOpen || !isCurrentActiveSession || isGM;
    if (!needManual) return;

    let cancelled = false;
    const sid = session.id;
    const chars = campaignChars || [];
    if (!chars.length) {
      setSessionManualXpByChar({});
      setSessionManualXpSyncReady(true);
      return;
    }
    setSessionManualXpSyncReady(false);
    (async () => {
      const pairs = await Promise.all(
        chars.map(async (ch) => {
          const raw = await experienceTrackerAPI
            .list({ character: ch.id })
            .catch(() => []);
          const arr = Array.isArray(raw) ? raw : raw?.results || [];
          return [ch.id, sumManualTrackXpForSession(arr, sid)];
        }),
      );
      if (cancelled) return;
      setSessionManualXpByChar(Object.fromEntries(pairs));
      setSessionManualXpSyncReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    endLiveModalOpen,
    isCurrentActiveSession,
    isGM,
    session?.id,
    campaignChars,
  ]);

  const sessionXpAllocationPanelMode = useMemo(() => {
    const roster = campaignChars || [];
    if (!roster.length) return "no_roster";
    if (!sessionManualXpSyncReady) return "loading";
    const rollList = rolls || [];
    if (
      rollList.length === 0 &&
      endLiveRowsWithManual.every((r) => !(Number(r.totalSessionXpPreview) > 0))
    ) {
      return "empty_session";
    }
    return "table";
  }, [campaignChars, sessionManualXpSyncReady, rolls, endLiveRowsWithManual]);

  const sessionXpEntriesSortedForScorecard = useMemo(() => {
    const raw = sessionData?.xp_entries;
    const list = Array.isArray(raw)
      ? raw
      : raw != null && Array.isArray(raw.results)
        ? raw.results
        : [];
    return [...list].sort(
      (a, b) =>
        new Date(b.session_date || 0) - new Date(a.session_date || 0),
    );
  }, [sessionData?.xp_entries]);

  /**
   * Per-PC scorecard stats derived from `ExperienceTracker` rows recorded
   * for this session (see scorecardStatsByCharFromXpEntries).
   */
  const sessionScorecardStatsByChar = useMemo(
    () => scorecardStatsByCharFromXpEntries(sessionData?.xp_entries),
    [sessionData?.xp_entries],
  );

  const endLiveRowsWithBeliefs = useMemo(
    () =>
      mergeEndLiveRowsWithScorecard(
        endLiveRowsWithManual,
        sessionScorecardStatsByChar,
        sessionData?.auto_encoded_xp_settled,
      ),
    [
      endLiveRowsWithManual,
      sessionScorecardStatsByChar,
      sessionData?.auto_encoded_xp_settled,
    ],
  );

  const pcXpRequirementsByCharacterForScorecard = useMemo(() => {
    const m = new Map();
    for (const row of sessionXpEntriesSortedForScorecard) {
      const cid = Number(row.character);
      if (!Number.isFinite(cid)) continue;
      const typeLbl = row.trigger_display || row.trigger || "XP";
      const desc = String(row.description || "").trim();
      const label = desc
        ? `${typeLbl} (+${row.xp_gained ?? 0}) — ${desc}`
        : `${typeLbl} (+${row.xp_gained ?? 0})`;
      const src = String(row.award_source || "AUTO").toUpperCase();
      const who =
        src === "AUTO"
          ? "Auto"
          : src === "GM"
            ? `GM${row.awarded_by_username ? ` (${row.awarded_by_username})` : ""}`
            : `Self${row.awarded_by_username ? ` (${row.awarded_by_username})` : ""}`;
      const sessLbl = row.session_name
        ? row.session_name
        : row.session
          ? `session ${row.session}`
          : "out of session";
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid).push({
        id: row.id,
        label,
        who,
        source: src,
        sessionLabel: sessLbl,
      });
    }
    return m;
  }, [sessionXpEntriesSortedForScorecard]);

  const [scorecardXpDeleteBusy, setScorecardXpDeleteBusy] = useState(null);
  const [scorecardXpDeleteError, setScorecardXpDeleteError] = useState(null);
  // Inline scorecard "By PC — requirements logged" audit list can grow long
  // mid-session; keep it collapsible so the rest of the GM panel stays scannable.
  const [scorecardReqLoggedCollapsed, setScorecardReqLoggedCollapsed] =
    useState(false);
  const handleScorecardDeleteXp = useCallback(
    async (entryId) => {
      if (!entryId) return;
      setScorecardXpDeleteError(null);
      setScorecardXpDeleteBusy(entryId);
      try {
        await experienceTrackerAPI.remove(entryId);
        if (typeof onRefresh === "function") onRefresh();
      } catch (err) {
        setScorecardXpDeleteError(err?.message || "Could not delete XP entry.");
      } finally {
        setScorecardXpDeleteBusy(null);
      }
    },
    [onRefresh],
  );

  const charDisplayNameByIdScorecard = useMemo(() => {
    const m = new Map();
    for (const ch of campaignChars || []) {
      const cid = Number(ch?.id);
      if (!Number.isFinite(cid)) continue;
      const full =
        (characters || []).find((c) => Number(c?.id) === cid) || ch;
      m.set(cid, full.true_name || full.name || `PC ${cid}`);
    }
    return m;
  }, [campaignChars, characters]);

  const scorecardHasAnyTrackerLines = useMemo(
    () =>
      (campaignChars || []).some((ch) => {
        const lines = pcXpRequirementsByCharacterForScorecard.get(Number(ch.id));
        return lines?.length > 0;
      }),
    [campaignChars, pcXpRequirementsByCharacterForScorecard],
  );

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

  const runEndLiveSession = async (skipEncodedXp) => {
    if (!isCurrentActiveSession) return;
    setEndLiveBusy(true);
    setError(null);
    try {
      await campaignAPI.patchCampaign(campaign.id, {
        active_session: null,
        skip_encoded_xp_settlement: skipEncodedXp === true,
      });
      setEndLiveModalOpen(false);
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setEndLiveBusy(false);
    }
  };

  const handleSaveSessionDate = async () => {
    setError(null);
    if (!sessionDateInput) {
      setError("Pick a session date first.");
      return;
    }
    const endedNow = sessionIsEndedForManagementHeader(sessionData);
    const stUp = String(sessionData?.status ?? "PLANNED").trim().toUpperCase();
    const settled = Boolean(sessionData?.auto_encoded_xp_settled);
    if (isGM && endedNow) {
      const needReopenFields =
        stUp === "COMPLETED" || (stUp === "PLANNED" && settled);
      if (needReopenFields) {
        const ok = window.confirm(
          "Save this date and reopen the episode for play? Planned status clears the encoded-XP-settled flag so a future end-live can run automatic STRUGGLE settlement again unless you choose skip.",
        );
        if (!ok) return;
      }
    }
    try {
      const [yearStr, monthStr, dayStr] = sessionDateInput.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const day = Number(dayStr);
      const value = new Date(year, month - 1, day, 12, 0, 0, 0).toISOString();
      const payload = { session_date: value };
      if (isGM && endedNow) {
        if (stUp === "COMPLETED") {
          payload.status = "PLANNED";
          payload.auto_encoded_xp_settled = false;
        } else if (settled) {
          payload.auto_encoded_xp_settled = false;
        }
      }
      const updated = await sessionAPI.patchSession(session.id, payload);
      setSessionData((prev) => ({ ...prev, ...updated }));
      onRefresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaveSessionTitle = async () => {
    if (!isGM) return;
    setError(null);
    const name = String(sessionTitleInput ?? "").trim();
    if (!name) {
      setError("Session title cannot be empty.");
      return;
    }
    if (name.length > 200) {
      setError("Session title must be 200 characters or less.");
      return;
    }
    if (name === String(sessionData?.name ?? "").trim()) return;
    setSessionTitleSaving(true);
    try {
      const updated = await sessionAPI.patchSession(session.id, { name });
      setSessionData((prev) => ({ ...prev, ...updated }));
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSessionTitleSaving(false);
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
    const kind = String(manualRoll.rollKind || "ACTION").toUpperCase();
    const base = {
      character: cid,
      session: session.id,
      dice_pool: results.length,
      results,
      outcome: manualRoll.outcome,
      position: sessionData?.default_position || "risky",
      effect: sessionData?.default_effect || "standard",
    };
    try {
      if (kind === "RESISTANCE") {
        await rollAPI.createRoll({
          ...base,
          roll_type: "RESISTANCE",
          action_name: (manualRoll.resistanceAttr || "resolve").toLowerCase(),
          description: "Manual / offline resistance (GM)",
        });
      } else if (kind === "CLEAR_STRESS" || kind === "CLEAR_STRESS_IN_PLAY") {
        const note = String(manualRoll.viceNote || "").trim();
        const inPlayRecovery = kind === "CLEAR_STRESS_IN_PLAY";
        await rollAPI.createRoll({
          ...base,
          roll_type: "CLEAR_STRESS",
          action_name: inPlayRecovery ? "recover" : "vice",
          description: note
            ? inPlayRecovery
              ? `Manual recovery in play (offline dice, GM). ${note}`
              : `Manual vice (offline dice, GM). ${note}`
            : inPlayRecovery
              ? "Manual recovery in play (offline dice, GM)"
              : "Manual vice (offline dice, GM)",
        });
      } else {
        await rollAPI.createRoll({
          ...base,
          roll_type: "ACTION",
          action_name: (manualRoll.actionName || "action").toLowerCase(),
          description: "Manual / offline action (GM)",
        });
      }
      const next = await rollAPI.getRolls({ session: session.id });
      setRolls(next || []);
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setManualRollSaving(false);
    }
  };

  const handleManualXpGrant = async () => {
    const cid = parseInt(manualXp.characterId, 10);
    if (!cid) {
      setError("Choose a character for the XP award.");
      return;
    }
    let amt = parseInt(String(manualXp.amount), 10);
    if (!Number.isFinite(amt)) amt = 1;
    amt = Math.min(20, Math.max(1, amt));
    const reason = String(manualXp.reason || "").trim();
    if (reason.length < 3) {
      setError(
        "Enter at least 3 characters describing why this XP is awarded (e.g. desperate offline roll).",
      );
      return;
    }
    const track = String(manualXp.track || "playbook").toLowerCase();
    setManualXpSaving(true);
    setError(null);
    try {
      await characterAPI.addXP(cid, {
        xp_type: track,
        amount: amt,
        reason,
        session_id: session.id,
      });
      characterAPI
        .getCharacters()
        .then((list) =>
          setCharacters(
            list?.filter((c) => c.campaign === campaign.id) || [],
          ),
        )
        .catch(() => {});
      try {
        const freshSession = await sessionAPI.getSession(session.id);
        setSessionData(freshSession);
      } catch {
        /* session list still refreshed via onRefresh */
      }
      onRefresh();
    } catch (e) {
      setError(e.message || "Could not add XP.");
    } finally {
      setManualXpSaving(false);
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
      const reason = String(fortuneReason || "").trim();
      await characterAPI.rollAction(firstChar.id, {
        roll_type: "FORTUNE",
        action: "Fortune",
        session_id: session.id,
        dice_pool: fortuneDice,
        goal_label: reason,
        fortune_public_label: reason,
      });
      rollAPI
        .getRolls({ session: session.id })
        .then(setRolls)
        .catch(() => {});
      if (reason) setFortuneReason("");
      onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setFortuneRolling(false);
    }
  };

  const handleDeleteFortuneRoll = async (rollId) => {
    if (!rollId) return;
    const ok = window.confirm("Remove this fortune roll record?");
    if (!ok) return;
    try {
      await rollAPI.deleteRoll(rollId);
      setRolls((prev) => (prev || []).filter((r) => r.id !== rollId));
      onRefresh();
    } catch (e) {
      setError(e.message || "Failed to remove roll record.");
    }
  };

  return (
    <div>
      <button onClick={onBack} style={{ ...S.btnGhost, marginBottom: "12px" }}>
        {"< Back to Campaign"}
      </button>
      {error && <div style={S.err}>{error}</div>}

      {endLiveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="end-live-session-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !endLiveBusy) {
              setEndLiveModalOpen(false);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "520px",
              maxHeight: "88vh",
              overflow: "auto",
              background: "#111827",
              border: "1px solid #4b5563",
              borderRadius: "8px",
              padding: "20px",
              color: "#e5e7eb",
              fontSize: "13px",
              lineHeight: 1.45,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2
              id="end-live-session-title"
              style={{ margin: "0 0 12px", fontSize: "18px", color: "#fff" }}
            >
              End live session?
            </h2>
            <p style={{ margin: "0 0 12px", color: "#d1d5db" }}>
              Review this session before you stop live character sheets for the
              campaign. <strong>End &amp; apply encoded XP</strong> runs the
              one-time encoded STRUGGLE pass (vice / trauma signals from the
              roll log, capped per session){" "}
              <strong>and</strong> banks each PC&apos;s{" "}
              <strong>Stand Development</strong> session XP into their{" "}
              <strong>session XP pool</strong> on the character sheet (players
              allocate pool XP to tracks). Use manual XP for anything not
              inferred from rolls (entanglements, brawls, etc.).{" "}
              <span style={{ color: "#9ca3af" }}>
                Durability affects armor/resist only, not XP.
              </span>
            </p>
            {sessionData?.auto_encoded_xp_settled ? (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  background: "rgba(234, 179, 8, 0.12)",
                  border: "1px solid rgba(234, 179, 8, 0.45)",
                  color: "#fcd34d",
                  fontSize: "12px",
                }}
              >
                This session&apos;s encoded XP pass was already marked settled.
                Ending live will <strong>not</strong> apply additional automatic
                STRUGGLE XP from rolls or bank Development session XP again.
              </div>
            ) : null}
            <div
              style={{
                marginBottom: "10px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Session snapshot
            </div>
            <ul style={{ margin: "0 0 12px 18px", padding: 0, color: "#d1d5db" }}>
              <li>
                <strong>{endLivePreview.rollCount}</strong> roll
                {endLivePreview.rollCount === 1 ? "" : "s"} logged on this session
                {endLivePreview.rollCount > 0 ? (
                  <span style={{ color: "#9ca3af" }}>
                    {" "}
                    (
                    {Object.entries(endLivePreview.byType)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                    )
                  </span>
                ) : null}
                .
              </li>
              {endLivePreview.desperateCount > 0 ? (
                <li>
                  <strong>{endLivePreview.desperateCount}</strong> desperate-position
                  roll{endLivePreview.desperateCount === 1 ? "" : "s"} (desperate
                  action XP is applied when each roll is committed, not here).
                </li>
              ) : null}
              <li>
                Progress clocks in this session:{" "}
                <strong>{endLivePreview.clockCount}</strong> tracked,{" "}
                <strong>{endLivePreview.clocksCompleted}</strong> completed (fiction
                / clocks are not auto-converted to XP).
              </li>
            </ul>
            <div
              style={{
                marginBottom: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Per-PC XP preview (if you apply encoded pass)
            </div>
            {endLiveRowsWithManual.length === 0 ? (
              <div style={{ color: "#9ca3af", marginBottom: "12px", fontSize: "12px" }}>
                No PCs in this campaign roster — nothing to preview.
              </div>
            ) : (
              <SessionXpAllocationTable rows={endLiveRowsWithBeliefs} />
            )}
            <p style={{ margin: "0 0 16px", fontSize: "11px", color: "#9ca3af" }}>
              <strong>Total</strong> column = scorecard XP (BELIEFS / PLAYBOOK /
              STRUGGLE → free pool) + Development end-session bonus (→ free pool) +
              manual awards logged this session (already on tracks). Allocate pool
              XP on the character sheet.
            </p>
            {endLiveRowsWithManual.length > 0 ? (
              <div
                style={{
                  marginBottom: "14px",
                  paddingTop: "12px",
                  borderTop: "1px solid #374151",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginBottom: "6px",
                    fontWeight: "bold",
                  }}
                >
                  By PC — requirements logged (experience tracker)
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    lineHeight: 1.45,
                  }}
                >
                  {scorecardHasAnyTrackerLines ? (
                    (campaignChars || []).map((ch) => {
                      const cid = Number(ch.id);
                      const lines =
                        pcXpRequirementsByCharacterForScorecard.get(cid);
                      if (!lines?.length) return null;
                      const title =
                        charDisplayNameByIdScorecard.get(cid) ||
                        ch.true_name ||
                        ch.name ||
                        `PC ${cid}`;
                      return (
                        <div
                          key={`endlive-xp-req-${cid}`}
                          style={{ marginBottom: "8px" }}
                        >
                          <div
                            style={{
                              color: "#d1d5db",
                              fontWeight: 600,
                              marginBottom: "4px",
                            }}
                          >
                            {title}
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              padding: 0,
                              listStyle: "none",
                              color: "#9ca3af",
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                          >
                            {lines.map((entry, i) => {
                              const busy =
                                scorecardXpDeleteBusy === entry.id;
                              return (
                                <li
                                  key={`endlive-${cid}-${entry.id ?? i}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 6,
                                    background: "#0b1220",
                                    border: "1px solid #1f2937",
                                    borderRadius: 3,
                                    padding: "3px 6px",
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: "#d1d5db" }}>
                                      {entry.label}
                                    </div>
                                    <div
                                      style={{
                                        color: "#6b7280",
                                        fontSize: 9,
                                        marginTop: 1,
                                      }}
                                    >
                                      {entry.who} · {entry.sessionLabel}
                                    </div>
                                  </div>
                                  {entry.id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleScorecardDeleteXp(entry.id)
                                      }
                                      disabled={busy}
                                      aria-label="Delete XP entry"
                                      title="Delete this XP record"
                                      style={{
                                        flexShrink: 0,
                                        width: 18,
                                        height: 18,
                                        borderRadius: 3,
                                        border: "1px solid #7f1d1d",
                                        background: busy
                                          ? "#374151"
                                          : "#1f2937",
                                        color: "#fca5a5",
                                        cursor: busy
                                          ? "not-allowed"
                                          : "pointer",
                                        fontSize: 11,
                                        lineHeight: 1,
                                        padding: 0,
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })
                  ) : (
                    <span>
                      No tracker rows for this session yet. Auto awards (e.g.
                      desperate rolls, heritage on rolls) and manual grants show
                      here once the backend logs them.
                    </span>
                  )}
                </div>
                {scorecardXpDeleteError && (
                  <div
                    style={{
                      color: "#fca5a5",
                      fontSize: 10,
                      marginTop: 4,
                    }}
                  >
                    {scorecardXpDeleteError}
                  </div>
                )}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                disabled={endLiveBusy}
                onClick={() => {
                  if (!endLiveBusy) setEndLiveModalOpen(false);
                }}
                style={S.btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={endLiveBusy}
                onClick={() => runEndLiveSession(true)}
                style={S.btnGhost}
                title="Clears live session only; marks encoded pass done without granting automatic STRUGGLE XP."
              >
                {endLiveBusy ? "…" : "End without encoded XP"}
              </button>
              <button
                type="button"
                disabled={endLiveBusy}
                onClick={() => runEndLiveSession(false)}
                style={S.btnPrimary}
                title="Clears live session and runs the automatic playbook XP pass (no-op if this session was already settled)."
              >
                {endLiveBusy ? "…" : "End & apply encoded XP"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.card}>
        {isGM ? (
          <div style={{ marginBottom: "10px" }}>
            <div style={{ ...S.sectionLbl, marginBottom: "6px" }}>
              Session title (editable)
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
                type="text"
                value={sessionTitleInput}
                onChange={(e) => setSessionTitleInput(e.target.value)}
                maxLength={200}
                style={{
                  flex: "1 1 220px",
                  minWidth: "160px",
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
                onClick={handleSaveSessionTitle}
                disabled={sessionTitleSaving}
                style={S.btnGhost}
              >
                {sessionTitleSaving ? "…" : "Save title"}
              </button>
            </div>
          </div>
        ) : (
          <span style={S.sectionLbl}>
            Session: {sessionData?.name || session?.name || "Unnamed"}
          </span>
        )}
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
              {isGM ? (
                <button
                  type="button"
                  onClick={() => setEndLiveModalOpen(true)}
                  style={S.btnGhost}
                  title="Opens a confirmation with a session tally. You can end live with or without the one-time auto session XP pass."
                >
                  End live session
                </button>
              ) : null}
              {isGM ? (
                <div
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    fontSize: "11px",
                    color: "#9ca3af",
                    lineHeight: 1.45,
                    maxWidth: "560px",
                  }}
                >
                  Opens a confirmation: review rolls / clocks, then end live{" "}
                  <strong>with</strong> or <strong>without</strong> automatic encoded
                  STRUGGLE XP plus Development→session pool. Use manual XP for
                  off-roll awards to tracks (including playbook-specific end-of-session
                  marks on the sheet).
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    marginTop: "4px",
                    fontSize: "11px",
                    color: "#6b7280",
                    lineHeight: 1.45,
                    maxWidth: "560px",
                  }}
                >
                  Live session is active; only the GM can end live or change the
                  campaign slot.
                </div>
              )}
            </>
          ) : sessionEnded ? (
            <>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#d1d5db",
                  border: "1px solid #6b7280",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  background: "rgba(75, 85, 99, 0.35)",
                }}
              >
                Ended
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "#9ca3af",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  lineHeight: 1.45,
                  maxWidth: "560px",
                }}
              >
                {sessionStatusUpper === "COMPLETED"
                  ? "Rolls frozen — episode marked complete."
                  : "Live cleared for character sheets. Rolls frozen on this episode until you go live again."}
              </span>
              {isGM && sessionStatusUpper !== "COMPLETED" ? (
                <button
                  type="button"
                  onClick={handleSetActiveSession}
                  style={S.btnGhost}
                  title="Point campaign live session at this episode again. Auto session XP pass is already settled for this slot."
                >
                  Set as current session (enable for players)
                </button>
              ) : null}
            </>
          ) : isGM ? (
            <button
              type="button"
              onClick={handleSetActiveSession}
              style={S.btnPrimary}
            >
              Set as current session (enable for players)
            </button>
          ) : (
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              Only the GM can enable this session for players.
            </span>
          )}
        </div>
        {!isCurrentActiveSession || isGM ? (
          <div
            style={{
              width: "100%",
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #374151",
            }}
          >
            <div
              style={{
                marginBottom: "8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#9ca3af",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {sessionEnded
                ? "Session XP allocation (read-only)"
                : isCurrentActiveSession
                  ? "Session XP allocation (live preview — before XP is applied)"
                  : "Session XP allocation (preview — before XP is applied)"}
            </div>
            {!sessionEnded ? (
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  lineHeight: 1.45,
                }}
              >
                {isCurrentActiveSession ? (
                  <>
                    While this episode is live, the table updates from rolls and
                    trackers as they come in. Auto session XP (STRUGGLE from vice /
                    trauma) and Development→pool settlement still run only when you
                    end live (or mark complete) with the usual options.
                  </>
                ) : (
                  <>
                    This episode is not marked ended; the table is a running preview
                    from rolls and trackers. Auto session XP (STRUGGLE from vice /
                    trauma) and Development→pool settlement finalize when you end
                    live (or mark complete) with the usual options.
                  </>
                )}
              </div>
            ) : null}
            {sessionData?.auto_encoded_xp_settled ? (
              <div
                style={{
                  marginBottom: "8px",
                  fontSize: "11px",
                  color: "#9ca3af",
                  lineHeight: 1.45,
                }}
              >
                Auto session XP pass was already settled for this session; table
                still reflects the roll log and current character Development→pool
                preview (for reference).
              </div>
            ) : null}
            {sessionXpAllocationPanelMode === "no_roster" ? (
              <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "4px" }}>
                No PCs in this campaign roster.
              </div>
            ) : null}
            {sessionXpAllocationPanelMode === "loading" ? (
              <div style={{ color: "#6b7280", fontSize: "12px", marginBottom: "4px" }}>
                Loading session XP summary…
              </div>
            ) : null}
            {sessionXpAllocationPanelMode === "empty_session" ? (
              <div style={{ color: "#9ca3af", fontSize: "12px", marginBottom: "4px" }}>
                No rolls logged and no session XP (auto STRUGGLE, Development→pool,
                or manual track awards) recorded for this session.
              </div>
            ) : null}
            {sessionXpAllocationPanelMode === "table" ? (
              <>
                <SessionXpAllocationTable rows={endLiveRowsWithBeliefs} />
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                  <strong>Total</strong> = every XP record logged this session
                  (Beliefs/Playbook/Struggle toggles + heritage / vice / trauma /
                  desperate-roll auto + manual GM track grants + dev-pool entry on
                  settle) <em>plus</em> the encoded STRUGGLE XP the end-live settle
                  would still add on top (only while not yet settled).
                </p>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "10px",
                    color: "#6b7280",
                    lineHeight: 1.45,
                  }}
                >
                  <strong style={{ color: "#9ca3af" }}>BELIEFS</strong> = expressed
                  beliefs/drives/heritage/background ·{" "}
                  <strong style={{ color: "#9ca3af" }}>PLAYBOOK</strong> =
                  playbook-specific end-of-session marks (experience-tracker toggles;
                  no roll-log auto for this column) ·{" "}
                  <strong style={{ color: "#9ca3af" }}>STRUGGLE</strong> = vice
                  overindulgence, trauma, or entanglements. Each capped at 2
                  XP/session. The headline number in each column is the
                  experience-tracker XP recorded for that trigger (the same rows
                  shown in &quot;By PC — requirements logged&quot; below — delete a
                  row to roll it back). The &quot;(auto N)&quot; hint on STRUGGLE is
                  the count of pre-settle roll signals (vice-overindulgence /
                  vice-failure / new trauma) that the end-live encoded pass will
                  still apply on top, capped to the remaining 2/session.{" "}
                  <strong>Manual→tracks</strong> is the separate ledger of{" "}
                  <code>MANUAL</code>-trigger track grants ([insight]/[prowess]/[resolve]/[heritage]/[playbook])
                  added via the character sheet&apos;s <em>Add XP</em> action — never
                  double-counted with the trigger toggles.
                </p>
              </>
            ) : null}
            {(sessionXpAllocationPanelMode === "table" ||
              sessionXpAllocationPanelMode === "empty_session") &&
            (campaignChars || []).length > 0 ? (
              <div
                style={{
                  marginTop:
                    sessionXpAllocationPanelMode === "table" ? "14px" : "10px",
                  paddingTop:
                    sessionXpAllocationPanelMode === "table" ? "12px" : "0",
                  borderTop:
                    sessionXpAllocationPanelMode === "table"
                      ? "1px solid #374151"
                      : "none",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    setScorecardReqLoggedCollapsed((v) => !v)
                  }
                  aria-expanded={!scorecardReqLoggedCollapsed}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "11px",
                    color: "#9ca3af",
                    marginBottom: "6px",
                    fontWeight: "bold",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-block",
                      width: 10,
                      color: "#6b7280",
                    }}
                  >
                    {scorecardReqLoggedCollapsed ? "▸" : "▾"}
                  </span>
                  By PC — requirements logged (experience tracker)
                  {scorecardReqLoggedCollapsed &&
                  scorecardHasAnyTrackerLines ? (
                    <span
                      style={{
                        color: "#6b7280",
                        fontWeight: 400,
                        fontSize: 10,
                      }}
                    >
                      (hidden — click to show)
                    </span>
                  ) : null}
                </button>
                <div
                  hidden={scorecardReqLoggedCollapsed}
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    marginBottom: "4px",
                    lineHeight: 1.45,
                  }}
                >
                  {scorecardHasAnyTrackerLines ? (
                    (campaignChars || []).map((ch) => {
                      const cid = Number(ch.id);
                      const lines =
                        pcXpRequirementsByCharacterForScorecard.get(cid);
                      if (!lines?.length) return null;
                      const title =
                        charDisplayNameByIdScorecard.get(cid) ||
                        ch.true_name ||
                        ch.name ||
                        `PC ${cid}`;
                      return (
                        <div
                          key={`scorecard-xp-req-${cid}`}
                          style={{ marginBottom: "8px" }}
                        >
                          <div
                            style={{
                              color: "#d1d5db",
                              fontWeight: 600,
                              marginBottom: "4px",
                            }}
                          >
                            {title}
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              padding: 0,
                              listStyle: "none",
                              color: "#9ca3af",
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                          >
                            {lines.map((entry, i) => {
                              const busy =
                                scorecardXpDeleteBusy === entry.id;
                              return (
                                <li
                                  key={`${cid}-${entry.id ?? i}`}
                                  style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    justifyContent: "space-between",
                                    gap: 6,
                                    background: "#0b1220",
                                    border: "1px solid #1f2937",
                                    borderRadius: 3,
                                    padding: "3px 6px",
                                  }}
                                >
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ color: "#d1d5db" }}>
                                      {entry.label}
                                    </div>
                                    <div
                                      style={{
                                        color: "#6b7280",
                                        fontSize: 9,
                                        marginTop: 1,
                                      }}
                                    >
                                      {entry.who} · {entry.sessionLabel}
                                    </div>
                                  </div>
                                  {entry.id && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleScorecardDeleteXp(entry.id)
                                      }
                                      disabled={busy}
                                      aria-label="Delete XP entry"
                                      title="Delete this XP record"
                                      style={{
                                        flexShrink: 0,
                                        width: 18,
                                        height: 18,
                                        borderRadius: 3,
                                        border: "1px solid #7f1d1d",
                                        background: busy
                                          ? "#374151"
                                          : "#1f2937",
                                        color: "#fca5a5",
                                        cursor: busy
                                          ? "not-allowed"
                                          : "pointer",
                                        fontSize: 11,
                                        lineHeight: 1,
                                        padding: 0,
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })
                  ) : (
                    <span>
                      No tracker rows for this session yet. Auto awards (e.g.
                      desperate rolls, heritage on rolls) and manual grants show
                      here once the backend logs them.
                    </span>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #374151",
          }}
        >
          <div style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "6px" }}>
            Session date (editable)
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
              value={sessionDateInput}
              onChange={(e) => setSessionDateInput(e.target.value)}
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
              onClick={handleSaveSessionDate}
              style={S.btnGhost}
            >
              Save date
            </button>
          </div>
          <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "6px" }}>
            Created at:{" "}
            {sessionData?.session_date
              ? new Date(sessionData.session_date).toLocaleString()
              : "—"}
          </div>
          {isGM && sessionEnded ? (
            <p
              style={{
                fontSize: "10px",
                color: "#9ca3af",
                marginTop: "8px",
                lineHeight: 1.45,
                maxWidth: "560px",
              }}
            >
              <strong>Save date</strong> on an ended episode also reopens it to{" "}
              <strong>planned</strong> (clears encoded-XP settled) so you can set it
              live again. You will be asked to confirm. A later end-live can apply
              automatic STRUGGLE encoded XP again unless you choose skip.
            </p>
          ) : null}
        </div>
      </div>

      <SessionGMManagementPanels
        S={S}
        session={session}
        sessionData={sessionData}
        setSessionData={setSessionData}
        campaign={campaign}
        crews={crews}
        campaignNPCs={campaignNPCs}
        characters={characters}
        clocks={clocks}
        onRefresh={onRefresh}
        setError={setError}
        onNavigateToCharacter={onNavigateToCharacter}
        onNavigateToNPC={onNavigateToNPC}
        rolls={rolls}
        manualRoll={manualRoll}
        setManualRoll={setManualRoll}
        manualRollSaving={manualRollSaving}
        onManualRollCreate={handleManualRollCreate}
        manualXp={manualXp}
        setManualXp={setManualXp}
        manualXpSaving={manualXpSaving}
        onManualXpGrant={handleManualXpGrant}
        onSessionCharactersRefresh={refreshSessionCharacters}
        onSessionPanelRefresh={refetchSessionPanel}
        user={user}
      />

      {/* Goals */}
      <GoalsEditor sessionData={sessionData} onSave={handleUpdateSession} />

      {/* Fortune rolls */}
      <div style={S.card}>
        <span style={S.sectionLbl}>Fortune Rolls</span>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "8px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "11px" }}>Goal / reason:</span>
          <input
            type="text"
            style={{ ...S.inp, width: "260px", maxWidth: "100%" }}
            value={fortuneReason}
            onChange={(e) => setFortuneReason(e.target.value)}
            placeholder="Why this fortune roll is being made"
          />
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
        <div
          style={{
            marginTop: "14px",
            paddingTop: "12px",
            borderTop: "1px solid #374151",
          }}
        >
          <span
            style={{
              ...S.sectionLbl,
              marginTop: 0,
              display: "block",
              marginBottom: "8px",
            }}
          >
            Fortune roll history
          </span>
          {fortuneRolls.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#6b7280" }}>
              No fortune rolls this session yet.
            </div>
          ) : (
            <div
              style={{
                maxHeight: 220,
                overflowY: "auto",
                border: "1px solid #374151",
                borderRadius: 6,
                background: "#0d1117",
                padding: "8px 10px",
              }}
            >
              {fortuneRolls.map((r) => {
                const when = r.timestamp
                  ? new Date(r.timestamp).toLocaleString()
                  : "—";
                const dice = [].concat(r.results || []).join(", ") || "—";
                const oc = String(r.outcome || "").replace(/_/g, " ") || "—";
                const actor =
                  (r.rolled_by_username && String(r.rolled_by_username).trim()) ||
                  "GM";
                const label = String(
                  r.fortune_public_label || r.goal_label || r.action_name || "",
                ).trim();
                return (
                  <div
                    key={r.id}
                    style={{
                      fontSize: "11px",
                      padding: "6px 0",
                      borderBottom: "1px solid #1f2937",
                      color: "#d1d5db",
                    }}
                  >
                    <div style={{ color: "#9ca3af", fontSize: "10px" }}>
                      {when}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <div>
                        <span style={{ color: "#e5e7eb" }}>{actor}</span>
                        <span style={{ color: "#6b7280" }}> · GM Fortune</span>
                        {label ? (
                          <span style={{ color: "#a78bfa" }}>
                            {" "}
                            · {label}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteFortuneRoll(r.id)}
                        style={{
                          ...S.btnDanger,
                          fontSize: 10,
                          padding: "2px 8px",
                          background: "#3f1d1d",
                          color: "#fca5a5",
                        }}
                        title="Remove this fortune record"
                      >
                        Remove
                      </button>
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span>{dice}</span>
                      <span style={{ color: "#6b7280" }}> → </span>
                      <span>{oc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Clocks */}
      <ClockManager
        clocks={clocks}
        setClocks={setClocks}
        campaignId={campaign.id}
        sessionId={session.id}
        setError={setError}
        campaignGmId={campaign?.gm?.id ?? campaign?.gm ?? null}
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
/**
 * QA: reload on `#campaigns/:campaignId/session/:sessionId` keeps SessionDetail;
 * Back to Campaign → `#campaigns/:campaignId`; bare `#campaigns` / `#campaigns/:id`
 * unchanged; NPC return still restores session + hash catches up via sync call.
 */
export default function CampaignManagement({
  initialCampaignId = null,
  initialFactionId = null,
  initialSessionId = null,
  onNavigateToCharacter,
  onNavigateToNPC,
  onCampaignRouteSync,
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
  const [sessionView, setSessionView] = useState(null); // null | 'detail'
  const [selectedSession, setSelectedSession] = useState(null);

  const campaignRouteSyncRef = useRef(onCampaignRouteSync);
  campaignRouteSyncRef.current = onCampaignRouteSync;

  const sessionBelongsToCampaign = useCallback((sessionRow, campaignId) => {
    if (sessionRow == null || campaignId == null) return false;
    const sc =
      sessionRow.campaign?.id ?? sessionRow.campaign ?? campaignId ?? null;
    return Number(sc) === Number(campaignId);
  }, []);

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

  useEffect(() => {
    if (selectedCampaignId == null || campaigns.length === 0) return;
    let cancelled = false;
    const raw = window.sessionStorage.getItem(NPC_SESSION_RETURN_KEY);
    if (!raw) return;

    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      window.sessionStorage.removeItem(NPC_SESSION_RETURN_KEY);
      return;
    }

    const campaignId = Number(parsed?.campaignId);
    const sessionId = Number(parsed?.sessionId);
    if (!Number.isFinite(campaignId) || !Number.isFinite(sessionId)) {
      window.sessionStorage.removeItem(NPC_SESSION_RETURN_KEY);
      return;
    }
    if (campaignId !== Number(selectedCampaignId)) {
      window.sessionStorage.removeItem(NPC_SESSION_RETURN_KEY);
      return;
    }

    // One-shot restore: consume immediately so stale entries cannot re-open later.
    window.sessionStorage.removeItem(NPC_SESSION_RETURN_KEY);
    const selected = campaigns.find((c) => c.id === selectedCampaignId);

    const restore = async () => {
      const embedded = (selected?.sessions || []).find(
        (s) => Number(s?.id) === sessionId,
      );
      if (!cancelled && embedded) {
        if (!sessionBelongsToCampaign(embedded, selectedCampaignId)) return;
        setSelectedSession(embedded);
        setSessionView("detail");
        campaignRouteSyncRef.current?.({ sessionId });
        return;
      }
      try {
        const fetched = await sessionAPI.getSession(sessionId);
        const ok =
          !cancelled &&
          fetched?.id &&
          Number(fetched.id) === sessionId &&
          sessionBelongsToCampaign(fetched, selectedCampaignId);
        if (ok) {
          setSelectedSession(fetched);
          setSessionView("detail");
          campaignRouteSyncRef.current?.({ sessionId });
        }
      } catch {
        // Ignore: landing on campaign detail is safer than forcing bad session state.
      }
    };
    restore();

    return () => {
      cancelled = true;
    };
  }, [campaigns, selectedCampaignId, sessionBelongsToCampaign]);

  useEffect(() => {
    const want =
      initialSessionId != null && Number.isFinite(Number(initialSessionId))
        ? Number(initialSessionId)
        : null;

    if (want == null) {
      setSessionView(null);
      setSelectedSession(null);
      return;
    }

    if (selectedCampaignId == null) return;

    let cancelled = false;
    const sync = campaignRouteSyncRef.current;

    const run = async () => {
      const camp = campaigns.find((c) => c.id === selectedCampaignId);
      const embedded = (camp?.sessions || []).find(
        (s) => Number(s?.id) === want,
      );
      if (embedded) {
        if (!sessionBelongsToCampaign(embedded, selectedCampaignId)) {
          if (!cancelled) sync?.({ sessionId: null });
          return;
        }
        if (!cancelled) {
          setSelectedSession(embedded);
          setSessionView("detail");
        }
        return;
      }
      try {
        const fetched = await sessionAPI.getSession(want);
        const ok =
          fetched?.id &&
          Number(fetched.id) === want &&
          sessionBelongsToCampaign(fetched, selectedCampaignId);
        if (!cancelled && ok) {
          setSelectedSession(fetched);
          setSessionView("detail");
        } else if (!cancelled) {
          sync?.({ sessionId: null });
        }
      } catch {
        if (!cancelled) sync?.({ sessionId: null });
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [
    initialSessionId,
    selectedCampaignId,
    campaigns,
    sessionBelongsToCampaign,
  ]);

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
              setSessionView(null);
              setSelectedSession(null);
              campaignRouteSyncRef.current?.({ sessionId: null });
            }}
            onRefresh={refreshSelected}
            onNavigateToCharacter={onNavigateToCharacter}
            onNavigateToNPC={(npcId, opts) => {
              if (npcId != null && selectedCampaign?.id && selectedSession?.id) {
                window.sessionStorage.setItem(
                  NPC_SESSION_RETURN_KEY,
                  JSON.stringify({
                    campaignId: selectedCampaign.id,
                    sessionId: selectedSession.id,
                  }),
                );
              }
              onNavigateToNPC?.(npcId, opts);
            }}
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
            onOpenSession={(session) => {
              setSelectedSession(session);
              setSessionView("detail");
              if (session?.id != null) {
                campaignRouteSyncRef.current?.({ sessionId: session.id });
              }
            }}
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
