import React, { useEffect, useMemo, useRef, useState } from "react";
import { factionAPI } from "../../features/character-sheet";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import { getCharacterPortraitSrc } from "../../utils/homeAvatar";
import HomeCardThumb from "../home/HomeCardThumb";
import CampaignFactionEditor from "./CampaignFactionEditor";
import {
  SessionFactionToken,
  SessionNpcToken,
  SessionPcToken,
} from "../session/SessionTokenFaces";
import {
  NO_FACTION_DROP_KEY,
  groupCampaignNpcsByFaction,
} from "../session/sessionShellUi";
import "../../styles/Home.css";
import "../../styles/SessionTokenCards.css";

const expandPanelChrome = {
  marginTop: 8,
  padding: 12,
  background: "#0d1117",
  border: "1px solid #4338ca",
  borderRadius: 8,
  position: "relative",
};

function RoleBadge({ role }) {
  const isGm = role === "GM";
  return (
    <span
      style={{
        fontSize: 10,
        padding: "2px 8px",
        borderRadius: 9999,
        fontWeight: "bold",
        display: "inline-block",
        background: isGm ? "#78350f" : "var(--accent)",
        color: "#fff",
      }}
    >
      {role}
    </span>
  );
}

function buildCharacterMeta(campaign, isGM) {
  const campaignCharacters = campaign?.campaign_characters || [];
  const gmId = campaign?.gm?.id;
  const charMetaById = new Map();
  const seenRemovePlayer = new Set();

  const addMeta = (character, user, role) => {
    if (!character?.id) return;
    let showRemovePlayer = false;
    if (
      isGM &&
      role === "Player" &&
      user?.id != null &&
      user.id !== gmId &&
      !seenRemovePlayer.has(user.id)
    ) {
      seenRemovePlayer.add(user.id);
      showRemovePlayer = true;
    }
    charMetaById.set(character.id, { user, role, showRemovePlayer });
  };

  campaignCharacters.forEach((ch) => {
    const role = ch.user_id === gmId ? "GM" : "Player";
    const user =
      role === "GM"
        ? campaign.gm
        : (campaign.players || []).find((p) => p.id === ch.user_id) || {
            id: ch.user_id,
            username: ch.username,
          };
    addMeta(ch, user, role);
  });

  return { charMetaById, campaignCharacters };
}

export default function CampaignRosterPanels({
  campaign,
  isGM,
  user,
  S,
  inviteUsername,
  setInviteUsername,
  invitableUsers,
  inviteError,
  inviteSuccess,
  onInvite,
  dragOverFactionKey,
  setDragOverFactionKey,
  onNpcFactionDrop,
  onNavigateToNPC,
  onNavigateToCharacter,
  onUnassignNPC,
  onMoveNpcToFaction,
  onUnassignCharacter,
  onRemovePlayerFromCampaign,
  onWithdrawInvitation,
  onAssignNPCById,
  factionForm,
  setFactionForm,
  factionError,
  factionImagePreview,
  factionPreviewError,
  setFactionPreviewError,
  factionCropOpen,
  setFactionCropOpen,
  startFactionEdit,
  startFactionCreate,
  cancelFactionForm,
  handleFactionSave,
  handleFactionDelete,
  handleAddNpcToFaction,
  handleRemoveNpcFromFaction,
  factionAddNpcId,
  setFactionAddNpcId,
  campaignNPCs,
  npcsThatCanBeAdded,
  crewForm,
  crewError,
  startCrewCreate,
  startCrewEdit,
  handleCrewSave,
  handleCrewDelete,
  setCrewForm,
  setCrewError,
  onRefresh,
}) {
  const [npcRosterCollapsed, setNpcRosterCollapsed] = useState(false);
  const [playerRosterCollapsed, setPlayerRosterCollapsed] = useState(false);
  const [expandedFactionId, setExpandedFactionId] = useState(null);
  const [expandedPcId, setExpandedPcId] = useState(null);
  const [expandedNpcId, setExpandedNpcId] = useState(null);
  const [pcRosterFilter, setPcRosterFilter] = useState("");
  const [addNpcChooserOpen, setAddNpcChooserOpen] = useState(false);
  const [quickFactionName, setQuickFactionName] = useState("");
  const [quickFactionBusy, setQuickFactionBusy] = useState(false);
  const [npcDragging, setNpcDragging] = useState(false);
  const [collapsedCrewIds, setCollapsedCrewIds] = useState({});
  const addNpcChooserRef = useRef(null);

  const { factionGroups, unaffiliated } = useMemo(
    () => groupCampaignNpcsByFaction(campaign),
    [campaign],
  );

  const { charMetaById, campaignCharacters } = useMemo(
    () => buildCharacterMeta(campaign, isGM),
    [campaign, isGM],
  );

  useEffect(() => {
    if (!addNpcChooserOpen) return undefined;
    const onDoc = (e) => {
      if (addNpcChooserRef.current?.contains(e.target)) return;
      setAddNpcChooserOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setAddNpcChooserOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [addNpcChooserOpen]);

  const toggleFactionExpand = (faction) => {
    const fid = faction.id;
    if (expandedFactionId === fid) {
      setExpandedFactionId(null);
      if (factionForm?.id === fid) cancelFactionForm();
      return;
    }
    setExpandedFactionId(fid);
    setExpandedNpcId(null);
    setExpandedPcId(null);
    startFactionEdit(faction);
  };

  const togglePcExpand = (characterId) => {
    setExpandedPcId((prev) => (prev === characterId ? null : characterId));
    setExpandedFactionId(null);
    setExpandedNpcId(null);
  };

  const clearNpcDrag = () => {
    setNpcDragging(false);
    setDragOverFactionKey(null);
  };

  const handleQuickCreateFaction = async () => {
    const name = quickFactionName.trim();
    if (!name || !campaign?.id || quickFactionBusy) return;
    setQuickFactionBusy(true);
    try {
      await factionAPI.createFaction({
        name,
        faction_type: "",
        level: 0,
        hold: "weak",
        reputation: 0,
        notes: "",
        visible_to_players: true,
        players_see_tier: true,
        players_see_hold: true,
        players_see_reputation: true,
        players_see_notes: true,
        players_see_npcs: true,
        campaign: campaign.id,
      });
      setQuickFactionName("");
      onRefresh?.();
    } catch {
      /* parent actionError if wired later */
    } finally {
      setQuickFactionBusy(false);
    }
  };

  const canManageCrew =
    isGM || (campaign.players || []).some((p) => p.id === user?.id);

  const filterQ = pcRosterFilter.trim().toLowerCase();
  const pcEntries = (campaignCharacters || [])
    .map((ch) => {
      const name = ch.true_name || ch.alias || ch.name || `PC ${ch.id}`;
      const standName = ch.stand_name || ch.stand?.name || "";
      return { ch, name, standName };
    })
    .filter(({ name, standName }) => {
      if (!filterQ) return true;
      return (
        String(name).toLowerCase().includes(filterQ) ||
        String(standName).toLowerCase().includes(filterQ)
      );
    })
    .sort((a, b) =>
      String(a.name).localeCompare(String(b.name), undefined, {
        sensitivity: "base",
      }),
    );

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isGM ? "1fr 1fr" : "1fr",
          gap: 16,
          marginBottom: 12,
          alignItems: "start",
        }}
      >
        {isGM ? (
          <div style={{ ...S.card, marginBottom: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <span style={{ ...S.sectionLbl, marginBottom: 0, marginTop: 16 }}>
                Factions &amp; NPCs
              </span>
              <button
                type="button"
                onClick={() => setNpcRosterCollapsed((v) => !v)}
                style={{
                  ...S.btnGhost,
                  fontSize: 10,
                  padding: "2px 8px",
                  flexShrink: 0,
                }}
                title={
                  npcRosterCollapsed
                    ? "Expand factions & NPCs"
                    : "Collapse factions & NPCs"
                }
              >
                {npcRosterCollapsed ? "Expand" : "Collapse"}
              </button>
            </div>
            {!npcRosterCollapsed ? (
              <>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-muted)",
                    marginTop: 10,
                    marginBottom: 4,
                  }}
                >
                  Drag NPCs between factions. Counts reflect all campaign NPCs.
                </div>
                <div
                  className="home-poc session-roster-tokens"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    marginTop: 10,
                  }}
                >
                  <div className="home-faction-grid">
                    {factionGroups.map(({ faction, npcs }) => {
                      const dropKey = String(faction.id);
                      const isExpanded = expandedFactionId === faction.id;
                      const isEditing = factionForm?.id === faction.id;
                      return (
                        <div
                          className="session-roster-cell"
                          key={`faction-${faction.id}`}
                        >
                          <SessionFactionToken
                            faction={faction}
                            npcList={npcs}
                            isExpanded={isExpanded}
                            isDragOver={dragOverFactionKey === dropKey}
                            dropKey={dropKey}
                            onToggleExpand={() => toggleFactionExpand(faction)}
                            onNpcThumbClick={(npc) => {
                              setExpandedNpcId(npc.id);
                              setExpandedPcId(null);
                            }}
                            onAddNpc={() => startFactionEdit(faction)}
                            onDragOver={() => setDragOverFactionKey(dropKey)}
                            onDragLeave={() =>
                              setDragOverFactionKey((k) =>
                                k === dropKey ? null : k,
                              )
                            }
                            onDrop={(e) => onNpcFactionDrop(e, dropKey)}
                            onNpcDragBegin={() => setNpcDragging(true)}
                            onNpcDragEnd={clearNpcDrag}
                          />
                          {isExpanded && isEditing ? (
                            <div
                              id={`faction-editor-${faction.id}`}
                              className="session-faction-expand-panel"
                              style={expandPanelChrome}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "flex-end",
                                  gap: 8,
                                  marginBottom: 8,
                                }}
                              >
                                <button
                                  type="button"
                                  style={{ ...S.btnGhost, fontSize: 10 }}
                                  onClick={() => startFactionEdit(faction)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  style={{
                                    ...S.btn,
                                    fontSize: 10,
                                    background: "#7f1d1d",
                                    color: "#fca5a5",
                                  }}
                                  onClick={() => handleFactionDelete(faction)}
                                >
                                  Del
                                </button>
                              </div>
                              <CampaignFactionEditor
                                factionForm={factionForm}
                                setFactionForm={setFactionForm}
                                factionError={factionError}
                                factionImagePreview={factionImagePreview}
                                factionPreviewError={factionPreviewError}
                                setFactionPreviewError={setFactionPreviewError}
                                factionCropOpen={factionCropOpen}
                                setFactionCropOpen={setFactionCropOpen}
                                campaignNPCs={campaignNPCs}
                                factionAddNpcId={factionAddNpcId}
                                setFactionAddNpcId={setFactionAddNpcId}
                                onSave={handleFactionSave}
                                onCancel={cancelFactionForm}
                                onAddNpc={handleAddNpcToFaction}
                                onRemoveNpc={handleRemoveNpcFromFaction}
                                embedded
                                S={S}
                              />
                            </div>
                          ) : null}
                          {expandedNpcId &&
                          npcs.some((n) => n.id === expandedNpcId) ? (
                            <NpcCampaignExpandPanel
                              npc={npcs.find((n) => n.id === expandedNpcId)}
                              S={S}
                              onNavigateToNPC={onNavigateToNPC}
                              onLeaveFaction={() =>
                                onMoveNpcToFaction(expandedNpcId, null)
                              }
                              onRemoveFromCampaign={() =>
                                onUnassignNPC(expandedNpcId)
                              }
                              onClose={() => setExpandedNpcId(null)}
                            />
                          ) : null}
                        </div>
                      );
                    })}

                    <div
                      className="f-card session-make-faction-tile"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        padding: 10,
                        minHeight: 120,
                        borderStyle: "dashed",
                        cursor: "default",
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                      role="group"
                      aria-label="Make a faction"
                    >
                      <div className="f-card-name" style={{ fontSize: 13 }}>
                        Make a faction
                      </div>
                      <input
                        type="text"
                        value={quickFactionName}
                        onChange={(e) => setQuickFactionName(e.target.value)}
                        placeholder="Faction name"
                        style={{
                          ...S.inp,
                          width: "100%",
                          boxSizing: "border-box",
                          fontSize: 11,
                        }}
                        disabled={quickFactionBusy || !campaign?.id}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleQuickCreateFaction();
                          }
                        }}
                      />
                      <button
                        type="button"
                        style={{
                          ...S.btnPrimary,
                          fontSize: 11,
                          alignSelf: "stretch",
                        }}
                        onClick={handleQuickCreateFaction}
                        disabled={
                          quickFactionBusy ||
                          !campaign?.id ||
                          !quickFactionName.trim()
                        }
                      >
                        {quickFactionBusy ? "Working…" : "Create faction"}
                      </button>
                      <button
                        type="button"
                        style={{
                          ...S.btnGhost,
                          fontSize: 10,
                          alignSelf: "stretch",
                        }}
                        onClick={() => {
                          startFactionCreate();
                          if (quickFactionName.trim()) {
                            setFactionForm((p) => ({
                              ...(p || {}),
                              name: quickFactionName.trim(),
                            }));
                          }
                        }}
                      >
                        Full editor…
                      </button>
                    </div>

                    <div
                      ref={addNpcChooserRef}
                      className="session-add-npc-chooser"
                      style={{ position: "relative", minWidth: 0 }}
                    >
                      <button
                        type="button"
                        className="f-card session-add-npc-tile"
                        onClick={() => setAddNpcChooserOpen((o) => !o)}
                        aria-expanded={addNpcChooserOpen}
                        aria-haspopup="menu"
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          padding: 10,
                          minHeight: 120,
                          borderStyle: "dashed",
                          cursor: "pointer",
                          justifyContent: "center",
                          alignItems: "center",
                          textAlign: "center",
                        }}
                      >
                        <span
                          style={{ fontSize: 22, color: "#6b7280", lineHeight: 1 }}
                        >
                          +
                        </span>
                        <span
                          style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.3 }}
                        >
                          Add NPC to campaign
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            color: "#6b7280",
                            lineHeight: 1.35,
                          }}
                        >
                          Existing or create new
                        </span>
                      </button>
                      {addNpcChooserOpen ? (
                        <div
                          role="menu"
                          className="session-add-npc-chooser-menu"
                          style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            display: "flex",
                            flexDirection: "column",
                            gap: 2,
                            padding: 6,
                            background: "#111827",
                            border: "1px solid #4b5563",
                            borderRadius: 6,
                            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
                          }}
                        >
                          {npcsThatCanBeAdded.length === 0 ? (
                            <div
                              style={{
                                fontSize: 10,
                                color: "#6b7280",
                                padding: "6px 8px",
                              }}
                            >
                              No unassigned NPCs — create one instead.
                            </div>
                          ) : (
                            npcsThatCanBeAdded.map((n) => (
                              <button
                                key={n.id}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  onAssignNPCById(n.id);
                                  setAddNpcChooserOpen(false);
                                }}
                                style={{
                                  ...S.btnGhost,
                                  width: "100%",
                                  textAlign: "left",
                                  fontSize: 11,
                                  padding: "8px 10px",
                                  border: "1px solid transparent",
                                  borderRadius: 4,
                                }}
                              >
                                {n.name} (Lv.{n.level})
                              </button>
                            ))
                          )}
                          {typeof onNavigateToNPC === "function" ? (
                            <a
                              href={buildRouteHref("npcs", {
                                campaignId: campaign.id,
                              })}
                              role="menuitem"
                              onClick={(e) => {
                                handleSpaNavClick(e, () =>
                                  onNavigateToNPC(null, {
                                    campaignId: campaign.id,
                                  }),
                                );
                                setAddNpcChooserOpen(false);
                              }}
                              style={{
                                ...S.btnGhost,
                                width: "100%",
                                textAlign: "left",
                                fontSize: 11,
                                padding: "8px 10px",
                                border: "1px solid transparent",
                                borderRadius: 4,
                                textDecoration: "none",
                                color: "#86efac",
                              }}
                            >
                              Create NPC
                            </a>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {unaffiliated.length > 0 ? (
                    <div
                      style={{ display: "flex", flexDirection: "column", gap: 10 }}
                    >
                      <span
                        style={{ ...S.sectionLbl, marginBottom: 0, fontSize: 11 }}
                      >
                        No faction ({unaffiliated.length} NPC
                        {unaffiliated.length === 1 ? "" : "s"})
                      </span>
                      <div className="home-card-grid">
                        {unaffiliated.map((npc) => (
                          <div
                            className="session-roster-cell"
                            key={`unaffiliated-${npc.id}`}
                          >
                            <SessionNpcToken
                              npc={npc}
                              selected={expandedNpcId === npc.id}
                              draggable
                              sourceFactionKey={NO_FACTION_DROP_KEY}
                              onOpen={() => setExpandedNpcId(npc.id)}
                              onDragBegin={() => setNpcDragging(true)}
                              onDragEnd={clearNpcDrag}
                            />
                            {expandedNpcId === npc.id ? (
                              <NpcCampaignExpandPanel
                                npc={npc}
                                S={S}
                                onNavigateToNPC={onNavigateToNPC}
                                onLeaveFaction={null}
                                onRemoveFromCampaign={() =>
                                  onUnassignNPC(npc.id)
                                }
                                onClose={() => setExpandedNpcId(null)}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {npcDragging ? (
                    <div
                      className={`session-unassign-drop${
                        dragOverFactionKey === NO_FACTION_DROP_KEY
                          ? " session-token-drag-over"
                          : ""
                      }`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDragOverFactionKey(NO_FACTION_DROP_KEY);
                      }}
                      onDragLeave={() =>
                        setDragOverFactionKey((k) =>
                          k === NO_FACTION_DROP_KEY ? null : k,
                        )
                      }
                      onDrop={(e) => onNpcFactionDrop(e, NO_FACTION_DROP_KEY)}
                    >
                      Drop to leave faction
                    </div>
                  ) : null}
                </div>

                {factionForm && !factionForm.id ? (
                  <div style={{ marginTop: 12 }}>
                    <CampaignFactionEditor
                      factionForm={factionForm}
                      setFactionForm={setFactionForm}
                      factionError={factionError}
                      factionImagePreview={factionImagePreview}
                      factionPreviewError={factionPreviewError}
                      setFactionPreviewError={setFactionPreviewError}
                      factionCropOpen={factionCropOpen}
                      setFactionCropOpen={setFactionCropOpen}
                      campaignNPCs={campaignNPCs}
                      factionAddNpcId={factionAddNpcId}
                      setFactionAddNpcId={setFactionAddNpcId}
                      onSave={handleFactionSave}
                      onCancel={cancelFactionForm}
                      onAddNpc={handleAddNpcToFaction}
                      onRemoveNpc={handleRemoveNpcFromFaction}
                      S={S}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <div style={{ ...S.card, marginBottom: 0 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <span style={{ ...S.sectionLbl, marginBottom: 0, marginTop: 16 }}>
              Players, Crew &amp; Characters
            </span>
            {isGM ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 4,
                  flex: "1 1 220px",
                  maxWidth: 340,
                  minWidth: 180,
                }}
              >
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    style={{
                      ...S.inp,
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11,
                      padding: "4px 8px",
                    }}
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    placeholder="Invite username…"
                    list="campaign-invite-users"
                    aria-label="Invite player by username"
                    onKeyDown={(e) => e.key === "Enter" && onInvite()}
                  />
                  <datalist id="campaign-invite-users">
                    {invitableUsers.map((u) => (
                      <option key={u.id} value={u.username} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={onInvite}
                    style={{
                      ...S.btnPrimary,
                      fontSize: 11,
                      padding: "4px 10px",
                      flexShrink: 0,
                    }}
                  >
                    Invite
                  </button>
                </div>
                {inviteError ? (
                  <div
                    style={{
                      ...S.err,
                      marginBottom: 0,
                      fontSize: 10,
                      padding: "4px 8px",
                    }}
                  >
                    {inviteError}
                  </div>
                ) : null}
                {inviteSuccess ? (
                  <div
                    style={{
                      background: "#064e3b",
                      border: "1px solid #059669",
                      borderRadius: 4,
                      padding: "4px 8px",
                      fontSize: 10,
                      color: "#6ee7b7",
                    }}
                  >
                    {inviteSuccess}
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setPlayerRosterCollapsed((v) => !v)}
              style={{
                ...S.btnGhost,
                fontSize: 10,
                padding: "2px 8px",
                flexShrink: 0,
                marginLeft: isGM ? 0 : "auto",
              }}
              title={
                playerRosterCollapsed
                  ? "Expand player roster"
                  : "Collapse player roster"
              }
            >
              {playerRosterCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>

          {!playerRosterCollapsed ? (
            <>
              {canManageCrew ? (
                <div
                  style={{
                    marginTop: 12,
                    marginBottom: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {(campaign.crews || []).length === 0 && !crewForm ? (
                    <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                      No crew yet.{" "}
                      <button
                        type="button"
                        onClick={startCrewCreate}
                        style={{
                          ...S.btnPrimary,
                          fontSize: 10,
                          padding: "2px 8px",
                        }}
                      >
                        + New Crew
                      </button>
                    </div>
                  ) : null}
                  {(campaign.crews || []).map((crew) => {
                    const crewOpen = !!collapsedCrewIds[crew.id];
                    const memberNames = (crew.members || [])
                      .map((m) => m.true_name || m.alias || `#${m.id}`)
                      .join(", ");
                    return (
                      <div
                        key={crew.id}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          border: "1px solid #4338ca",
                          borderRadius: 8,
                          padding: 12,
                          background: "#0d1117",
                        }}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            setCollapsedCrewIds((p) => ({
                              ...p,
                              [crew.id]: !p[crew.id],
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCollapsedCrewIds((p) => ({
                                ...p,
                                [crew.id]: !p[crew.id],
                              }));
                            }
                          }}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            cursor: "pointer",
                          }}
                          title={crewOpen ? "Collapse crew" : "Expand crew"}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              minWidth: 0,
                            }}
                          >
                            <HomeCardThumb
                              src={null}
                              label={crew.name}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 6,
                                border: "1px solid #374151",
                                background: "#111827",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontWeight: "bold",
                                color: "#a78bfa",
                                fontSize: 12,
                              }}
                            >
                              Crew · {crew.name}
                            </span>
                          </div>
                          <span
                            style={{
                              ...S.btnGhost,
                              fontSize: 10,
                              padding: "2px 8px",
                            }}
                          >
                            {crewOpen ? "▾" : "▸"}
                          </span>
                        </div>
                        {crewOpen ? (
                          <div style={{ marginTop: 10, fontSize: 11 }}>
                            <div
                              style={{
                                display: "flex",
                                gap: 12,
                                color: "var(--text-muted)",
                                flexWrap: "wrap",
                                marginBottom: 6,
                              }}
                            >
                              <span>Tier {crew.level ?? 0}</span>
                              <span>Hold: {crew.hold || "—"}</span>
                              <span>Rep: {crew.rep ?? 0}</span>
                              <span>Coin: {crew.coin ?? 0}</span>
                              <span>Wanted: {crew.wanted_level ?? 0}</span>
                            </div>
                            {crew.description ? (
                              <div
                                style={{
                                  color: "var(--text-dim)",
                                  marginBottom: 6,
                                }}
                              >
                                {crew.description}
                              </div>
                            ) : null}
                            {memberNames ? (
                              <div style={{ color: "var(--text-dim)" }}>
                                Members: {memberNames}
                              </div>
                            ) : null}
                            <div
                              style={{
                                display: "flex",
                                gap: 8,
                                marginTop: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                style={{ ...S.btnGhost, fontSize: 10 }}
                                onClick={() => startCrewEdit(crew)}
                              >
                                Edit
                              </button>
                              {isGM ? (
                                <button
                                  type="button"
                                  style={{
                                    ...S.btn,
                                    fontSize: 10,
                                    background: "#7f1d1d",
                                    color: "#fca5a5",
                                  }}
                                  onClick={() => handleCrewDelete(crew.id)}
                                >
                                  Del
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {crewForm ? (
                <div
                  style={{
                    border: "1px solid var(--hftf-purple)",
                    borderRadius: 4,
                    padding: 12,
                    marginBottom: 12,
                    background: "var(--hftf-deep)",
                  }}
                >
                  <span style={S.lbl}>
                    {crewForm.id ? "EDIT CREW" : "CREATE CREW"}
                  </span>
                  {crewError ? (
                    <div style={{ ...S.err, marginBottom: 8 }}>{crewError}</div>
                  ) : null}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
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
                      <span
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
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
                      <span
                        style={{ fontSize: 11, color: "var(--text-muted)" }}
                      >
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
                  </div>
                  <div style={S.row}>
                    <button type="button" onClick={handleCrewSave} style={S.btnPrimary}>
                      Save
                    </button>
                    <button
                      type="button"
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
              ) : null}

              <div
                className="home-poc session-roster-tokens"
                style={{ marginTop: 10 }}
              >
                {pcEntries.length === 0 ? (
                  <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
                    No characters in this campaign yet.
                  </div>
                ) : (
                  <>
                    <div className="session-pc-finder">
                      <input
                        type="search"
                        value={pcRosterFilter}
                        onChange={(e) => setPcRosterFilter(e.target.value)}
                        placeholder="Filter PCs…"
                        aria-label="Filter player characters"
                        style={{
                          ...S.inp,
                          fontSize: 11,
                          flex: "1 1 140px",
                          minWidth: 120,
                          maxWidth: 220,
                        }}
                      />
                      <div className="session-pc-finder-chips">
                        {pcEntries.map(({ ch, name }) => (
                          <button
                            key={`chip-${ch.id}`}
                            type="button"
                            className="session-pc-finder-chip"
                            onClick={() => togglePcExpand(ch.id)}
                            title={`Open ${name}`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="home-card-grid">
                      {pcEntries.map(({ ch, name }) => {
                        const meta = charMetaById.get(ch.id) || {};
                        const pcExpanded = expandedPcId === ch.id;
                        const canUnassign =
                          (meta.role === "GM" &&
                            user?.id === campaign.gm?.id) ||
                          (meta.role === "Player" &&
                            ((isGM && meta.user?.id !== campaign.gm?.id) ||
                              meta.user?.id === user?.id));
                        return (
                          <div className="session-roster-cell" key={ch.id}>
                            <SessionPcToken
                              character={ch}
                              name={name}
                              isExpanded={pcExpanded}
                              onToggleExpand={() => togglePcExpand(ch.id)}
                            />
                            {pcExpanded ? (
                              <div
                                className="session-pc-expand-panel"
                                style={expandPanelChrome}
                              >
                                <button
                                  type="button"
                                  className="session-expand-close"
                                  aria-label="Close PC panel"
                                  title="Close"
                                  onClick={() => setExpandedPcId(null)}
                                >
                                  ×
                                </button>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    flexWrap: "wrap",
                                    marginBottom: 8,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontWeight: "bold",
                                      color: "var(--hftf-text-cream)",
                                      fontSize: 12,
                                    }}
                                  >
                                    {meta.user?.username || "—"}
                                  </span>
                                  {meta.role ? (
                                    <RoleBadge role={meta.role} />
                                  ) : null}
                                </div>
                                {typeof onNavigateToCharacter === "function" ? (
                                  <a
                                    href={buildRouteHref("character", {
                                      characterId: ch.id,
                                    })}
                                    onClick={(e) =>
                                      handleSpaNavClick(e, () =>
                                        onNavigateToCharacter(ch.id),
                                      )
                                    }
                                    style={{
                                      ...S.btnGhost,
                                      fontSize: 10,
                                      display: "inline-block",
                                      textDecoration: "none",
                                      marginBottom: 8,
                                    }}
                                  >
                                    Open sheet
                                  </a>
                                ) : null}
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 6,
                                    marginTop: 8,
                                  }}
                                >
                                  {canUnassign ? (
                                    <button
                                      type="button"
                                      style={{
                                        ...S.btn,
                                        fontSize: 10,
                                        background: "#7f1d1d",
                                        color: "#fca5a5",
                                      }}
                                      onClick={() => onUnassignCharacter(ch.id)}
                                    >
                                      Remove character
                                    </button>
                                  ) : null}
                                  {meta.showRemovePlayer ? (
                                    <button
                                      type="button"
                                      style={{
                                        ...S.btn,
                                        fontSize: 10,
                                        background: "#7f1d1d",
                                        color: "#fca5a5",
                                      }}
                                      onClick={() =>
                                        onRemovePlayerFromCampaign(
                                          meta.user.id,
                                          meta.user.username,
                                        )
                                      }
                                    >
                                      Remove from campaign
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {isGM && (campaign.pending_invitations || []).length > 0 ? (
                <>
                  <div style={{ ...S.divider, marginTop: 12 }} />
                  <span
                    style={{
                      fontSize: 11,
                      color: "#fbbf24",
                      fontWeight: "bold",
                    }}
                  >
                    PENDING INVITATIONS
                  </span>
                  {campaign.pending_invitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        paddingLeft: 12,
                        marginTop: 6,
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>
                        {inv.invited_user?.username} (invited by{" "}
                        {inv.invited_by?.username})
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onWithdrawInvitation(
                            inv.id,
                            inv.invited_user?.username,
                          )
                        }
                        style={{
                          ...S.btn,
                          fontSize: 10,
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
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NpcCampaignExpandPanel({
  npc,
  S,
  onNavigateToNPC,
  onLeaveFaction,
  onRemoveFromCampaign,
  onClose,
}) {
  if (!npc) return null;
  const portraitSrc = getCharacterPortraitSrc(npc);
  return (
    <div className="session-npc-expand-panel" style={expandPanelChrome}>
      <button
        type="button"
        className="session-expand-close"
        aria-label="Close NPC panel"
        title="Close"
        onClick={onClose}
      >
        ×
      </button>
      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
        {npc.name}
      </div>
      {npc.stand_name ? (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
          Stand: {npc.stand_name}
        </div>
      ) : null}
      {portraitSrc ? (
        <img
          src={portraitSrc}
          alt=""
          style={{
            width: 80,
            height: 80,
            objectFit: "cover",
            borderRadius: 6,
            marginBottom: 8,
          }}
          referrerPolicy="no-referrer"
        />
      ) : null}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {typeof onNavigateToNPC === "function" ? (
          <a
            href={buildRouteHref("npcs", { npcId: npc.id })}
            onClick={(e) =>
              handleSpaNavClick(e, () => onNavigateToNPC(npc.id))
            }
            style={{
              ...S.btnGhost,
              fontSize: 10,
              textDecoration: "none",
            }}
          >
            Open NPC
          </a>
        ) : null}
        {onLeaveFaction ? (
          <button
            type="button"
            style={{ ...S.btnGhost, fontSize: 10 }}
            onClick={onLeaveFaction}
          >
            Leave faction
          </button>
        ) : null}
        <button
          type="button"
          style={{
            ...S.btn,
            fontSize: 10,
            background: "#7f1d1d",
            color: "#fca5a5",
          }}
          onClick={onRemoveFromCampaign}
        >
          Remove from campaign
        </button>
      </div>
    </div>
  );
}
