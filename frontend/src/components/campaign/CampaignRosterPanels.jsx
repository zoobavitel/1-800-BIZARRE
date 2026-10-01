import React, { useEffect, useMemo, useRef, useState } from "react";
import { factionAPI } from "../../features/character-sheet";
import RosterCrewInlineSection from "../roster/RosterCrewInlineSection";
import RosterPcExpandPanel from "../roster/RosterPcExpandPanel";
import RosterNpcColumn from "../roster/RosterNpcColumn";
import RosterTwoColumnShell from "../roster/RosterTwoColumnShell";
import RosterCollapsibleSection from "../roster/RosterCollapsibleSection";
import useRosterExpandAnchor from "../roster/useRosterExpandAnchor";
import { SessionPcToken } from "../session/SessionTokenFaces";
import { groupCampaignNpcsByFaction, SessionHelpTip } from "../session/sessionShellUi";
import {
  filterFactionRosterForPlayerView,
} from "../roster/rosterShared";
import "../../styles/Home.css";
import "../../styles/SessionTokenCards.css";

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
  onCreateNpcForFaction,
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
  handleToggleNpcVisibleToPlayers,
  handleBulkSetFactionNpcsVisibleToPlayers,
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
  characters = [],
  onCharactersRefresh,
  rosterActionError,
  setRosterActionError,
  showNpcColumn = true,
  showPcColumn = true,
}) {
  const [expandedFactionId, setExpandedFactionId] = useState(null);
  const [expandedPcId, setExpandedPcId] = useState(null);
  const [expandedNpcId, setExpandedNpcId] = useState(null);
  const [pcRosterFilter, setPcRosterFilter] = useState("");
  const [addNpcChooserOpen, setAddNpcChooserOpen] = useState(false);
  const [quickFactionName, setQuickFactionName] = useState("");
  const [quickFactionBusy, setQuickFactionBusy] = useState(false);
  const [npcDragging, setNpcDragging] = useState(false);
  const addNpcChooserRef = useRef(null);

  const { tokensRef: pcTokensRef, tokensStyle: pcTokensStyle } =
    useRosterExpandAnchor(expandedPcId);

  const { factionGroups: allFactionGroups, unaffiliated: allUnaffiliated } =
    useMemo(() => groupCampaignNpcsByFaction(campaign), [campaign]);

  const { factionGroups, unaffiliated } = useMemo(() => {
    if (isGM) {
      return {
        factionGroups: allFactionGroups,
        unaffiliated: allUnaffiliated,
      };
    }
    return filterFactionRosterForPlayerView(allFactionGroups, allUnaffiliated);
  }, [isGM, allFactionGroups, allUnaffiliated]);

  const isCampaignMember =
    isGM || (campaign.players || []).some((p) => p.id === user?.id);

  const { charMetaById, campaignCharacters } = useMemo(
    () => buildCharacterMeta(campaign, isGM),
    [campaign, isGM],
  );

  const fullCharById = useMemo(() => {
    const m = new Map();
    for (const c of characters || []) {
      if (c?.id != null) m.set(Number(c.id), c);
    }
    for (const ch of campaignCharacters || []) {
      const id = Number(ch?.id);
      if (!Number.isFinite(id)) continue;
      if (!m.has(id)) m.set(id, ch);
    }
    return m;
  }, [characters, campaignCharacters]);

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
  const showRoster = isGM || isCampaignMember;

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

  const inviteHeaderExtra = isGM ? (
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
  ) : null;

  if (!showRoster) return null;

  return (
    <RosterTwoColumnShell
      showLeftColumn={showRoster && showNpcColumn}
      showSecondColumn={showRoster && showPcColumn}
      leftColumn={
        showRoster && showNpcColumn ? (
          <RosterCollapsibleSection
            title="Factions & NPCs"
            S={S}
            helpTip={
              isGM ? (
                <SessionHelpTip
                  label="Factions & NPCs help"
                  panelId="campaign-factions-npc-help"
                >
                  Drag strip thumbs onto another faction to reassign. Click a
                  thumb for Leave faction / Remove from campaign.
                </SessionHelpTip>
              ) : null
            }
          >
            <RosterNpcColumn
              S={S}
              campaign={campaign}
              factionGroups={factionGroups}
              unaffiliated={unaffiliated}
              readOnly={!isGM}
              dragOverFactionKey={dragOverFactionKey}
              setDragOverFactionKey={setDragOverFactionKey}
              expandedFactionId={expandedFactionId}
              expandedNpcId={expandedNpcId}
              setExpandedNpcId={setExpandedNpcId}
              setExpandedPcId={setExpandedPcId}
              toggleFactionExpand={toggleFactionExpand}
              startFactionEdit={startFactionEdit}
              startFactionCreate={startFactionCreate}
              handleFactionDelete={handleFactionDelete}
              handleFactionSave={handleFactionSave}
              cancelFactionForm={cancelFactionForm}
              handleAddNpcToFaction={handleAddNpcToFaction}
              handleRemoveNpcFromFaction={handleRemoveNpcFromFaction}
              handleToggleNpcVisibleToPlayers={
                handleToggleNpcVisibleToPlayers
              }
              handleBulkSetFactionNpcsVisibleToPlayers={
                handleBulkSetFactionNpcsVisibleToPlayers
              }
              factionForm={factionForm}
              setFactionForm={setFactionForm}
              factionError={factionError}
              factionImagePreview={factionImagePreview}
              factionPreviewError={factionPreviewError}
              setFactionPreviewError={setFactionPreviewError}
              factionCropOpen={factionCropOpen}
              setFactionCropOpen={setFactionCropOpen}
              factionAddNpcId={factionAddNpcId}
              setFactionAddNpcId={setFactionAddNpcId}
              campaignNPCs={campaignNPCs}
              onNpcFactionDrop={onNpcFactionDrop}
              onNavigateToNPC={onNavigateToNPC}
              onUnassignNPC={onUnassignNPC}
              onMoveNpcToFaction={onMoveNpcToFaction}
              onAssignNPCById={onAssignNPCById}
              onCreateNpcForFaction={onCreateNpcForFaction}
              npcsThatCanBeAdded={npcsThatCanBeAdded}
              quickFactionName={quickFactionName}
              setQuickFactionName={setQuickFactionName}
              quickFactionBusy={quickFactionBusy}
              handleQuickCreateFaction={handleQuickCreateFaction}
              addNpcChooserOpen={addNpcChooserOpen}
              setAddNpcChooserOpen={setAddNpcChooserOpen}
              addNpcChooserRef={addNpcChooserRef}
              npcDragging={npcDragging}
              setNpcDragging={setNpcDragging}
              clearNpcDrag={clearNpcDrag}
              onRefresh={onRefresh}
              onError={setRosterActionError}
            />
          </RosterCollapsibleSection>
        ) : null
      }
      rightColumn={
        <RosterCollapsibleSection
          title="Players, Crew & Characters"
          headerExtra={inviteHeaderExtra}
          S={S}
        >
            <>
              {rosterActionError ? (
                <div style={{ ...S.err, marginTop: 10, fontSize: 11 }}>
                  {rosterActionError}
                </div>
              ) : null}
              {canManageCrew ? (
                <RosterCrewInlineSection
                  campaign={campaign}
                  crews={campaign.crews || []}
                  S={S}
                  onRefresh={onRefresh}
                  onError={setRosterActionError}
                  canManageCrew={canManageCrew}
                  crewForm={crewForm}
                  startCrewCreate={startCrewCreate}
                  crewError={crewError}
                />
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
                ref={pcTokensRef}
                className="home-poc session-roster-tokens"
                style={{ marginTop: 10, ...pcTokensStyle }}
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
                        const pcExpanded = expandedPcId === ch.id;
                        return (
                          <div className="session-roster-cell" key={ch.id}>
                            <SessionPcToken
                              character={ch}
                              name={name}
                              isExpanded={pcExpanded}
                              onToggleExpand={() => togglePcExpand(ch.id)}
                              player={charMetaById.get(ch.id)?.user || null}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {(() => {
                      if (expandedPcId == null) return null;
                      const entry = pcEntries.find(
                        ({ ch }) => ch.id === expandedPcId,
                      );
                      if (!entry) return null;
                      const { ch } = entry;
                      const meta = charMetaById.get(ch.id) || {};
                      const full =
                        fullCharById.get(Number(ch.id)) || ch;
                      return (
                        <div className="session-roster-expand-slot">
                          <RosterPcExpandPanel
                            character={full}
                            summaryCharacter={ch}
                            S={S}
                            meta={meta}
                            campaign={campaign}
                            user={user}
                            isGM={isGM}
                            readOnly={
                              !(
                                isGM ||
                                (user?.id != null &&
                                  meta.user?.id != null &&
                                  Number(meta.user.id) === Number(user.id))
                              )
                            }
                            onClose={() => setExpandedPcId(null)}
                            onNavigateToCharacter={onNavigateToCharacter}
                            onUnassignCharacter={onUnassignCharacter}
                            onRemovePlayerFromCampaign={
                              onRemovePlayerFromCampaign
                            }
                            onRefresh={onRefresh}
                            onCharactersRefresh={onCharactersRefresh}
                            onError={setRosterActionError}
                          />
                        </div>
                      );
                    })()}
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
        </RosterCollapsibleSection>
      }
    />
  );
}
