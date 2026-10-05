import React, { useEffect, useRef, useState } from "react";
import { buildRouteHref, handleSpaNavClick } from "../../utils/spaNavigation";
import CampaignFactionEditor from "../campaign/CampaignFactionEditor";
import {
  SessionFactionToken,
  SessionNpcToken,
} from "../session/SessionTokenFaces";
import {
  NO_FACTION_DROP_KEY,
  NPC_PLAYBOOK_OPTIONS,
} from "../session/sessionShellUi";
import { rosterExpandPanelChrome } from "./rosterShared";
import NpcCampaignExpandPanel from "./NpcCampaignExpandPanel";
import useRosterExpandAnchor from "./useRosterExpandAnchor";

/**
 * Campaign-scope NPC roster column: faction token grid, make-faction, add-NPC, unaffiliated.
 */
export default function RosterNpcColumn({
  S,
  campaign,
  factionGroups,
  unaffiliated,
  dragOverFactionKey,
  setDragOverFactionKey,
  expandedFactionId,
  expandedNpcId,
  setExpandedNpcId,
  setExpandedPcId,
  toggleFactionExpand,
  startFactionEdit,
  startFactionCreate,
  handleFactionDelete,
  handleFactionSave,
  cancelFactionForm,
  handleAddNpcToFaction,
  handleRemoveNpcFromFaction,
  handleToggleNpcVisibleToPlayers,
  handleBulkSetFactionNpcsVisibleToPlayers,
  factionForm,
  setFactionForm,
  factionError,
  factionImagePreview,
  factionPreviewError,
  setFactionPreviewError,
  factionCropOpen,
  setFactionCropOpen,
  factionAddNpcId,
  setFactionAddNpcId,
  campaignNPCs,
  onNpcFactionDrop,
  onNavigateToNPC,
  onUnassignNPC,
  onMoveNpcToFaction,
  onAssignNPCById,
  onCreateNpcForFaction,
  npcsThatCanBeAdded,
  quickFactionName,
  setQuickFactionName,
  quickFactionBusy,
  handleQuickCreateFaction,
  addNpcChooserOpen,
  setAddNpcChooserOpen,
  addNpcChooserRef,
  npcDragging,
  setNpcDragging,
  clearNpcDrag,
  onRefresh,
  onError,
  readOnly = false,
}) {
  const [stripAddFactionId, setStripAddFactionId] = useState(null);
  const [stripAddMode, setStripAddMode] = useState("pick");
  const [stripCreateName, setStripCreateName] = useState("");
  const [stripCreatePlaybook, setStripCreatePlaybook] = useState("STAND");
  const [stripCreateBusy, setStripCreateBusy] = useState(false);
  const stripChooserRef = useRef(null);

  useEffect(() => {
    if (stripAddFactionId == null) return undefined;
    const onDoc = (e) => {
      if (stripChooserRef.current?.contains(e.target)) return;
      setStripAddFactionId(null);
      setStripAddMode("pick");
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setStripAddFactionId(null);
        setStripAddMode("pick");
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [stripAddFactionId]);

  const closeStripChooser = () => {
    setStripAddFactionId(null);
    setStripAddMode("pick");
    setStripCreateName("");
    setStripCreatePlaybook("STAND");
    setStripCreateBusy(false);
  };

  const handleEditorCreateNpc = async ({ name, playbook }) => {
    if (typeof onCreateNpcForFaction !== "function" || !factionForm?.id) {
      return null;
    }
    return onCreateNpcForFaction(factionForm.id, { name, playbook });
  };

  const addableForFaction = (memberNpcs) => {
    const memberIds = new Set(
      (memberNpcs || []).map((n) => Number(n.id)).filter((id) => Number.isFinite(id)),
    );
    const seen = new Set();
    const out = [];
    for (const n of [...(campaignNPCs || []), ...(npcsThatCanBeAdded || [])]) {
      const id = Number(n?.id);
      if (!Number.isFinite(id) || memberIds.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(n);
    }
    return out;
  };

  const expandedFactionNpc =
    expandedNpcId != null
      ? factionGroups
          .flatMap(({ npcs }) => npcs || [])
          .find((n) => n.id === expandedNpcId) || null
      : null;
  const expandedUnaffiliatedNpc =
    expandedNpcId != null
      ? unaffiliated.find((n) => n.id === expandedNpcId) || null
      : null;

  const expandAnchorKey =
    expandedFactionId != null
      ? `f-${expandedFactionId}`
      : expandedNpcId != null
        ? `n-${expandedNpcId}`
        : null;
  const { tokensRef, tokensStyle } = useRosterExpandAnchor(expandAnchorKey);

  const renderNpcExpand = (npc, { showLeaveFaction }) => (
    <div className="session-roster-expand-slot">
      <NpcCampaignExpandPanel
        npc={npc}
        S={S}
        campaign={campaign}
        onNavigateToNPC={onNavigateToNPC}
        onLeaveFaction={
          !readOnly && showLeaveFaction
            ? () => onMoveNpcToFaction(npc.id, null)
            : null
        }
        onRemoveFromCampaign={
          !readOnly ? () => onUnassignNPC(npc.id) : null
        }
        onMoveNpcToFaction={!readOnly ? onMoveNpcToFaction : null}
        onRefresh={onRefresh}
        onError={onError}
        onClose={() => setExpandedNpcId(null)}
        readOnly={readOnly}
      />
    </div>
  );

  return (
    <>
      <div
        ref={tokensRef}
        className="home-poc session-roster-tokens"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 10,
          ...tokensStyle,
        }}
      >
        <div className="home-faction-grid">
          {factionGroups.map(({ faction, npcs }) => {
            const dropKey = String(faction.id);
            const isExpanded = expandedFactionId === faction.id;
            const chooserOpen = stripAddFactionId === faction.id;
            const addable = addableForFaction(npcs);
            return (
              <div
                className="session-roster-cell"
                key={`faction-${faction.id}`}
                style={{ position: "relative" }}
                ref={chooserOpen ? stripChooserRef : undefined}
              >
                <SessionFactionToken
                  faction={faction}
                  npcList={npcs}
                  isExpanded={isExpanded}
                  isDragOver={!readOnly && dragOverFactionKey === dropKey}
                  dropKey={dropKey}
                  onToggleExpand={() => toggleFactionExpand(faction)}
                  onNpcThumbClick={(npc) => {
                    setExpandedNpcId((cur) =>
                      cur === npc.id ? null : npc.id,
                    );
                    setExpandedPcId(null);
                  }}
                  onAddNpc={
                    readOnly
                      ? undefined
                      : () => {
                          if (chooserOpen) {
                            closeStripChooser();
                            return;
                          }
                          setStripAddFactionId(faction.id);
                          setStripAddMode("pick");
                          setStripCreateName("");
                          setStripCreatePlaybook("STAND");
                        }
                  }
                  onDelete={
                    readOnly
                      ? undefined
                      : () => handleFactionDelete(faction)
                  }
                  onDragOver={
                    readOnly
                      ? undefined
                      : () => setDragOverFactionKey(dropKey)
                  }
                  onDragLeave={
                    readOnly
                      ? undefined
                      : () =>
                          setDragOverFactionKey((k) =>
                            k === dropKey ? null : k,
                          )
                  }
                  onDrop={
                    readOnly
                      ? undefined
                      : (e) => onNpcFactionDrop(e, dropKey)
                  }
                  onNpcDragBegin={
                    readOnly ? undefined : () => setNpcDragging(true)
                  }
                  onNpcDragEnd={readOnly ? undefined : clearNpcDrag}
                />
                {!readOnly && chooserOpen ? (
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
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {stripAddMode === "pick" ? (
                      <>
                        {addable.length === 0 ? (
                          <div
                            style={{
                              fontSize: 10,
                              color: "#6b7280",
                              padding: "6px 8px",
                            }}
                          >
                            No other campaign NPCs — create one instead.
                          </div>
                        ) : (
                          addable.map((n) => (
                            <button
                              key={n.id}
                              type="button"
                              role="menuitem"
                              onClick={async () => {
                                if (typeof onMoveNpcToFaction !== "function")
                                  return;
                                await onMoveNpcToFaction(n.id, faction.id);
                                closeStripChooser();
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
                              {n.name || n.stand_name || `NPC ${n.id}`}
                            </button>
                          ))
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => setStripAddMode("create")}
                          style={{
                            ...S.btnGhost,
                            width: "100%",
                            textAlign: "left",
                            fontSize: 11,
                            padding: "8px 10px",
                            border: "1px dashed #4b5563",
                            borderRadius: 4,
                            color: "#86efac",
                            marginTop: 4,
                          }}
                        >
                          Create new…
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                            padding: "4px 6px 6px",
                          }}
                        >
                          New NPC in {faction.name || "faction"}
                        </div>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: "0 4px 6px",
                            fontSize: 10,
                            color: "#9ca3af",
                          }}
                        >
                          Name
                          <input
                            type="text"
                            value={stripCreateName}
                            onChange={(e) => setStripCreateName(e.target.value)}
                            placeholder="e.g. Highway Star"
                            disabled={stripCreateBusy}
                            style={{
                              ...S.inp,
                              width: "100%",
                              boxSizing: "border-box",
                              fontSize: 11,
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                e.currentTarget
                                  .closest("[role=menu]")
                                  ?.querySelector("[data-strip-create-submit]")
                                  ?.click();
                              }
                            }}
                          />
                        </label>
                        <label
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            padding: "0 4px 8px",
                            fontSize: 10,
                            color: "#9ca3af",
                          }}
                        >
                          Playbook
                          <select
                            value={stripCreatePlaybook}
                            onChange={(e) =>
                              setStripCreatePlaybook(e.target.value)
                            }
                            disabled={stripCreateBusy}
                            style={{
                              ...S.select,
                              width: "100%",
                              fontSize: 11,
                            }}
                          >
                            {NPC_PLAYBOOK_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            padding: "0 4px 4px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setStripAddMode("pick")}
                            disabled={stripCreateBusy}
                            style={{
                              ...S.btnGhost,
                              fontSize: 10,
                              flex: 1,
                            }}
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            data-strip-create-submit
                            disabled={
                              stripCreateBusy || !stripCreateName.trim()
                            }
                            onClick={async () => {
                              if (typeof onCreateNpcForFaction !== "function")
                                return;
                              setStripCreateBusy(true);
                              try {
                                const newId = await onCreateNpcForFaction(
                                  faction.id,
                                  {
                                    name: stripCreateName.trim(),
                                    playbook: stripCreatePlaybook,
                                  },
                                );
                                if (newId != null) {
                                  setExpandedNpcId(newId);
                                  setExpandedPcId(null);
                                  closeStripChooser();
                                }
                              } finally {
                                setStripCreateBusy(false);
                              }
                            }}
                            style={{
                              ...S.btnPrimary,
                              fontSize: 10,
                              flex: 1,
                            }}
                          >
                            {stripCreateBusy ? "Creating…" : "Create"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          {!readOnly ? (
            <>
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
              style={{ ...S.btnPrimary, fontSize: 11, alignSelf: "stretch" }}
              onClick={handleQuickCreateFaction}
              disabled={
                quickFactionBusy || !campaign?.id || !quickFactionName.trim()
              }
            >
              {quickFactionBusy ? "Working…" : "Create faction"}
            </button>
            <button
              type="button"
              style={{ ...S.btnGhost, fontSize: 10, alignSelf: "stretch" }}
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
              <span style={{ fontSize: 22, color: "#6b7280", lineHeight: 1 }}>
                +
              </span>
              <span style={{ color: "#9ca3af", fontSize: 11, lineHeight: 1.3 }}>
                Add NPC to campaign
              </span>
              <span
                style={{ fontSize: 9, color: "#6b7280", lineHeight: 1.35 }}
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
                    href={buildRouteHref("npcs", { campaignId: campaign.id })}
                    role="menuitem"
                    onClick={(e) => {
                      handleSpaNavClick(e, () =>
                        onNavigateToNPC(null, { campaignId: campaign.id }),
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
            </>
          ) : null}
        </div>

        {!readOnly &&
        expandedFactionId &&
        factionForm?.id === expandedFactionId ? (
          <div className="session-roster-expand-slot">
            <div
              id={`faction-editor-${expandedFactionId}`}
              className="session-faction-expand-panel"
              style={rosterExpandPanelChrome}
            >
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
                onToggleNpcVisibleToPlayers={handleToggleNpcVisibleToPlayers}
                onBulkSetNpcVisibleToPlayers={
                  handleBulkSetFactionNpcsVisibleToPlayers
                }
                onCreateNpc={
                  typeof onCreateNpcForFaction === "function"
                    ? handleEditorCreateNpc
                    : undefined
                }
                onNavigateToNPC={onNavigateToNPC}
                embedded
                S={S}
              />
            </div>
          </div>
        ) : null}

        {expandedFactionNpc
          ? renderNpcExpand(expandedFactionNpc, { showLeaveFaction: true })
          : null}

        {unaffiliated.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ ...S.sectionLbl, marginBottom: 0, fontSize: 11 }}>
              No faction ({unaffiliated.length} NPC
              {unaffiliated.length === 1 ? "" : "s"})
            </span>
            <div className="home-card-grid">
              {unaffiliated.map((npc) => (
                <div className="session-roster-cell" key={`unaffiliated-${npc.id}`}>
                  <SessionNpcToken
                    npc={npc}
                    selected={expandedNpcId === npc.id}
                    draggable={!readOnly}
                    sourceFactionKey={NO_FACTION_DROP_KEY}
                    onOpen={() => {
                      setExpandedNpcId((cur) =>
                        cur === npc.id ? null : npc.id,
                      );
                      setExpandedPcId(null);
                    }}
                    onDragBegin={
                      readOnly ? undefined : () => setNpcDragging(true)
                    }
                    onDragEnd={readOnly ? undefined : clearNpcDrag}
                  />
                </div>
              ))}
            </div>
            {expandedUnaffiliatedNpc
              ? renderNpcExpand(expandedUnaffiliatedNpc, {
                  showLeaveFaction: false,
                })
              : null}
          </div>
        ) : null}

        {npcDragging && !readOnly ? (
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
            onToggleNpcVisibleToPlayers={handleToggleNpcVisibleToPlayers}
            onBulkSetNpcVisibleToPlayers={
              handleBulkSetFactionNpcsVisibleToPlayers
            }
            onCreateNpc={
              typeof onCreateNpcForFaction === "function" && factionForm?.id
                ? handleEditorCreateNpc
                : undefined
            }
            onNavigateToNPC={onNavigateToNPC}
            S={S}
          />
        </div>
      ) : null}
    </>
  );
}
