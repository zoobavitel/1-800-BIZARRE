import React, { useEffect, useState } from "react";
import {
  factionAPI,
  npcAPI,
  progressClockAPI,
} from "../../features/character-sheet";

const TIER_OPTIONS = [0, 1, 2, 3, 4, 5, 6];
const TIER_LABEL = ["—", "I", "II", "III", "IV", "V", "VI"];

const CLOCK_TYPE_OPTIONS = [
  { value: "CUSTOM", label: "Custom" },
  { value: "DANGER", label: "Danger" },
  { value: "MISSION", label: "Mission" },
  { value: "PROJECT", label: "Long-term Project" },
  { value: "COUNTDOWN", label: "Countdown" },
];

const CLOCK_SEGMENT_OPTIONS = [4, 6, 8, 10, 12];

/**
 * Compact inline editor for a faction. Lives inside the dark Home page
 * "Your Factions" list — clicking an f-card opens this beneath the card.
 * Renders name/type/tier/hold/rep/visibility/notes, NPC roster, and faction
 * clocks without leaving the home page.
 */
const HomeFactionInlineEditor = ({
  faction,
  campaign,
  onCancel,
  onSaved,
  onDeleted,
}) => {
  const [form, setForm] = useState({
    name: faction.name || "",
    faction_type: faction.faction_type || "",
    level: Number(faction.level) || 0,
    hold: faction.hold === "strong" ? "strong" : "weak",
    reputation: Number(faction.reputation) || 0,
    visible_to_players: faction.visible_to_players !== false,
    notes: faction.notes || "",
  });
  const [npcList, setNpcList] = useState(
    Array.isArray(faction.npcs) ? faction.npcs : [],
  );
  const [addNpcId, setAddNpcId] = useState("");
  const [clocks, setClocks] = useState([]);
  const [clocksLoading, setClocksLoading] = useState(true);
  const [showNewClock, setShowNewClock] = useState(false);
  const [newClockName, setNewClockName] = useState("");
  const [newClockSegments, setNewClockSegments] = useState(4);
  const [newClockType, setNewClockType] = useState("CUSTOM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setClocksLoading(true);
    const params = campaign?.id ? { campaign: campaign.id } : {};
    progressClockAPI
      .getProgressClocks(params)
      .then((list) => {
        if (cancelled) return;
        const filtered = (Array.isArray(list) ? list : []).filter(
          (c) => c.faction === faction.id,
        );
        setClocks(filtered);
      })
      .catch(() => {
        if (!cancelled) setClocks([]);
      })
      .finally(() => {
        if (!cancelled) setClocksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [faction.id, campaign?.id]);

  const campaignNpcs = Array.isArray(campaign?.campaign_npcs)
    ? campaign.campaign_npcs
    : [];
  const unaffiliatedNpcs = campaignNpcs.filter(
    (n) => !npcList.some((existing) => existing.id === n.id),
  );

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        faction_type: form.faction_type || "",
        level: Number(form.level) || 0,
        hold: form.hold === "strong" ? "strong" : "weak",
        reputation: Number(form.reputation) || 0,
        visible_to_players: !!form.visible_to_players,
        notes: form.notes || "",
      };
      const updated = await factionAPI.patchFaction(faction.id, payload);
      onSaved?.({ ...updated, npcs: npcList });
    } catch (e) {
      setError(e.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete faction "${faction.name}"?`)) return;
    setError(null);
    try {
      await factionAPI.deleteFaction(faction.id);
      onDeleted?.(faction.id);
    } catch (e) {
      setError(e.message || "Could not delete.");
    }
  };

  const handleAddNpc = async () => {
    if (!addNpcId) return;
    const npcId = Number(addNpcId);
    const npc = campaignNpcs.find((n) => n.id === npcId);
    setError(null);
    try {
      await npcAPI.patchNPC(npcId, { faction: faction.id });
      setNpcList((prev) => {
        if (prev.some((n) => n.id === npcId)) return prev;
        return [...prev, npc || { id: npcId, name: `NPC ${npcId}` }];
      });
      setAddNpcId("");
    } catch (e) {
      setError(e.message || "Could not attach NPC.");
    }
  };

  const handleRemoveNpc = async (npcId) => {
    setError(null);
    try {
      await npcAPI.patchNPC(npcId, { faction: null });
      setNpcList((prev) => prev.filter((n) => n.id !== npcId));
    } catch (e) {
      setError(e.message || "Could not detach NPC.");
    }
  };

  const updateClockLocal = (id, patch) =>
    setClocks((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const tickClock = async (clk, delta) => {
    const next = Math.max(
      0,
      Math.min(clk.max_segments, (clk.filled_segments || 0) + delta),
    );
    if (next === clk.filled_segments) return;
    updateClockLocal(clk.id, { filled_segments: next });
    try {
      await progressClockAPI.updateProgressClock(clk.id, {
        filled_segments: next,
      });
    } catch (e) {
      setError(e.message || "Could not update clock.");
    }
  };

  const toggleClockVisible = async (clk, visible) => {
    updateClockLocal(clk.id, { visible_to_players: visible });
    try {
      await progressClockAPI.updateProgressClock(clk.id, {
        visible_to_players: visible,
      });
    } catch (e) {
      setError(e.message || "Could not update clock visibility.");
    }
  };

  const deleteClock = async (clkId) => {
    if (!window.confirm("Delete this clock?")) return;
    try {
      await progressClockAPI.deleteProgressClock(clkId);
      setClocks((prev) => prev.filter((c) => c.id !== clkId));
    } catch (e) {
      setError(e.message || "Could not delete clock.");
    }
  };

  const createClock = async () => {
    if (!newClockName.trim()) return;
    try {
      const created = await progressClockAPI.createProgressClock({
        campaign: campaign?.id,
        faction: faction.id,
        name: newClockName.trim(),
        clock_type: newClockType,
        max_segments: newClockSegments,
      });
      setClocks((prev) => [...prev, created]);
      setNewClockName("");
      setNewClockSegments(4);
      setNewClockType("CUSTOM");
      setShowNewClock(false);
    } catch (e) {
      setError(e.message || "Could not create clock.");
    }
  };

  return (
    <div className="f-edit-panel" onClick={(e) => e.stopPropagation()}>
      {error && <div className="f-edit-error">{error}</div>}

      <div className="f-edit-grid">
        <label className="f-edit-field f-edit-field-wide">
          <span>Name</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) =>
              setForm((p) => ({ ...p, name: e.target.value }))
            }
          />
        </label>
        <label className="f-edit-field f-edit-field-wide">
          <span>Type</span>
          <input
            type="text"
            value={form.faction_type}
            placeholder="e.g. Criminal Syndicate"
            onChange={(e) =>
              setForm((p) => ({ ...p, faction_type: e.target.value }))
            }
          />
        </label>
        <label className="f-edit-field">
          <span>Tier</span>
          <select
            value={form.level}
            onChange={(e) =>
              setForm((p) => ({ ...p, level: Number(e.target.value) }))
            }
          >
            {TIER_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {TIER_LABEL[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="f-edit-field">
          <span>Hold</span>
          <select
            value={form.hold}
            onChange={(e) =>
              setForm((p) => ({ ...p, hold: e.target.value }))
            }
          >
            <option value="weak">Weak</option>
            <option value="strong">Strong</option>
          </select>
        </label>
        <label className="f-edit-field">
          <span>Rep w/ crew</span>
          <input
            type="number"
            min={-3}
            max={3}
            value={form.reputation}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                reputation: parseInt(e.target.value, 10) || 0,
              }))
            }
          />
        </label>
        <label className="f-edit-field f-edit-field-checkbox">
          <input
            type="checkbox"
            checked={form.visible_to_players}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                visible_to_players: e.target.checked,
              }))
            }
          />
          <span>Visible to players</span>
        </label>
      </div>

      <label className="f-edit-field f-edit-field-wide f-edit-field-notes">
        <span>Notes</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(e) =>
            setForm((p) => ({ ...p, notes: e.target.value }))
          }
        />
      </label>

      <div className="f-edit-section">
        <div className="f-edit-section-label">NPC Members</div>
        {npcList.length === 0 ? (
          <div className="f-edit-empty">No NPCs in this faction.</div>
        ) : (
          <ul className="f-edit-npc-list">
            {npcList.map((n) => (
              <li key={n.id} className="f-edit-npc-row">
                <span className="f-edit-npc-name">
                  {n.name || n.stand_name || `NPC ${n.id}`}
                </span>
                <button
                  type="button"
                  className="f-card-btn f-card-btn-delete"
                  onClick={() => handleRemoveNpc(n.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
        {unaffiliatedNpcs.length > 0 && (
          <div className="f-edit-npc-add">
            <select
              value={addNpcId}
              onChange={(e) => setAddNpcId(e.target.value)}
            >
              <option value="">Add an NPC…</option>
              {unaffiliatedNpcs.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name || n.stand_name || `NPC ${n.id}`}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="f-card-btn"
              onClick={handleAddNpc}
              disabled={!addNpcId}
            >
              Add
            </button>
          </div>
        )}
      </div>

      <div className="f-edit-section">
        <div className="f-edit-section-label">Clocks</div>
        {clocksLoading ? (
          <div className="f-edit-empty">Loading clocks…</div>
        ) : clocks.length === 0 ? (
          <div className="f-edit-empty">No clocks yet.</div>
        ) : (
          <ul className="f-edit-clock-list">
            {clocks.map((clk) => (
              <li key={clk.id} className="f-edit-clock-row">
                <span className="f-edit-clock-name">{clk.name}</span>
                <span className="f-edit-clock-count">
                  {clk.filled_segments}/{clk.max_segments}
                </span>
                <button
                  type="button"
                  className="f-card-btn"
                  onClick={() => tickClock(clk, -1)}
                  aria-label="Decrement clock"
                >
                  −
                </button>
                <button
                  type="button"
                  className="f-card-btn"
                  onClick={() => tickClock(clk, 1)}
                  aria-label="Increment clock"
                >
                  +
                </button>
                <label className="f-edit-clock-vis">
                  <input
                    type="checkbox"
                    checked={!!clk.visible_to_players}
                    onChange={(e) =>
                      toggleClockVisible(clk, e.target.checked)
                    }
                  />
                  <span>visible</span>
                </label>
                <button
                  type="button"
                  className="f-card-btn f-card-btn-delete"
                  onClick={() => deleteClock(clk.id)}
                  aria-label="Delete clock"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {showNewClock ? (
          <div className="f-edit-clock-create">
            <input
              type="text"
              placeholder="Clock name"
              value={newClockName}
              onChange={(e) => setNewClockName(e.target.value)}
            />
            <select
              value={newClockSegments}
              onChange={(e) =>
                setNewClockSegments(parseInt(e.target.value, 10))
              }
              aria-label="Segments"
            >
              {CLOCK_SEGMENT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} seg
                </option>
              ))}
            </select>
            <select
              value={newClockType}
              onChange={(e) => setNewClockType(e.target.value)}
              aria-label="Clock type"
            >
              {CLOCK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="f-card-btn"
              onClick={createClock}
              disabled={!newClockName.trim()}
            >
              Create
            </button>
            <button
              type="button"
              className="f-card-btn"
              onClick={() => {
                setShowNewClock(false);
                setNewClockName("");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="f-card-btn"
            onClick={() => setShowNewClock(true)}
          >
            + New Clock
          </button>
        )}
      </div>

      <div className="f-edit-actions">
        <button
          type="button"
          className="f-card-btn f-card-btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="f-card-btn"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="f-card-btn f-card-btn-delete"
          onClick={handleDelete}
          disabled={saving}
        >
          Delete Faction
        </button>
      </div>
    </div>
  );
};

export default HomeFactionInlineEditor;
