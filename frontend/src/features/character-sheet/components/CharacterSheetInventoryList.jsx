import React, { useCallback, useEffect, useMemo, useState } from "react";
import { equipmentAPI, normalizeCharacterInventory } from "../services/api";
import {
  ARMOR_KIND_OPTIONS,
  armorChargesForItem,
  armorKindLabel,
  bandLabel,
  catalogItemToKitRow,
  categoryLabel,
  computeInventoryLoadUsed,
  characterHasAbility,
  EQUIPMENT_CATEGORY_OPTIONS,
  loadBandForUsed,
  loadCapForBand,
  newArmorItemDraft,
  newInventoryItemDraft,
  normalizeArmorKind,
  normalizeLoadoutEntry,
  RIGGING_CATEGORY_OPTIONS,
} from "../utils/loadoutUtils";

const rowInputStyle = {
  flex: 1,
  minWidth: 0,
  background: "#010409",
  color: "#fff",
  border: "1px solid #30363d",
  padding: "6px 8px",
  fontFamily: "monospace",
  fontSize: "12px",
  borderRadius: "4px",
  boxSizing: "border-box",
};

const btnStyle = {
  background: "#21262d",
  color: "#c9d1d9",
  border: "1px solid #30363d",
  borderRadius: "4px",
  padding: "4px 8px",
  fontFamily: "monospace",
  fontSize: "11px",
  cursor: "pointer",
};

function ItemEditorCard({
  draft,
  readOnly,
  onChange,
  onSave,
  onCancel,
  catalogItems,
  onPickCatalog,
}) {
  const d = draft || newInventoryItemDraft();
  return (
    <div
      style={{
        border: "1px solid #374151",
        borderRadius: "4px",
        padding: "8px",
        marginBottom: "8px",
        background: "#161b22",
      }}
    >
      <input
        type="text"
        aria-label="Item name"
        readOnly={readOnly}
        disabled={readOnly}
        value={d.name}
        placeholder="Name…"
        onChange={(e) => onChange({ ...d, name: e.target.value })}
        style={{ ...rowInputStyle, width: "100%", marginBottom: "6px" }}
      />
      <input
        type="text"
        aria-label="Item detail"
        readOnly={readOnly}
        disabled={readOnly}
        value={d.detail || ""}
        placeholder="Detail (optional)…"
        onChange={(e) => onChange({ ...d, detail: e.target.value })}
        style={{ ...rowInputStyle, width: "100%", marginBottom: "6px" }}
      />
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
        <select
          aria-label="Item category"
          disabled={readOnly}
          value={d.category || "other"}
          onChange={(e) => onChange({ ...d, category: e.target.value })}
          style={{ ...rowInputStyle, flex: "1 1 120px" }}
        >
          {EQUIPMENT_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          aria-label="Load slots"
          disabled={readOnly}
          value={String(d.load ?? 1)}
          onChange={(e) => onChange({ ...d, load: Number(e.target.value) })}
          style={{ ...rowInputStyle, width: "72px" }}
        >
          <option value="0">0 load</option>
          <option value="1">1 load</option>
          <option value="2">2 load</option>
        </select>
        <select
          aria-label="Quality"
          disabled={readOnly}
          value={String(d.quality ?? 1)}
          onChange={(e) => onChange({ ...d, quality: Number(e.target.value) })}
          style={{ ...rowInputStyle, width: "72px" }}
        >
          {[0, 1, 2, 3].map((q) => (
            <option key={q} value={q}>Q{q}</option>
          ))}
        </select>
        <input
          type="number"
          aria-label="Coin value"
          min="0"
          disabled={readOnly}
          placeholder="Coin"
          value={d.coin_value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({
              ...d,
              coin_value: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
            });
          }}
          style={{ ...rowInputStyle, width: "72px" }}
        />
        <select
          aria-label="Armor type"
          disabled={readOnly}
          value={normalizeArmorKind(d) || ""}
          onChange={(e) => {
            const nextKind = e.target.value;
            if (!nextKind) {
              onChange({ ...d, armor_kind: "", is_armor: false });
              return;
            }
            onChange({
              ...d,
              armor_kind: nextKind,
              is_armor: nextKind === "standard" || nextKind === "heavy",
            });
          }}
          style={{ ...rowInputStyle, flex: "1 1 140px" }}
        >
          <option value="">No armor</option>
          {ARMOR_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.pool === "physical"
                ? ` (${o.charges} chg)`
                : " (1 use)"}
            </option>
          ))}
        </select>
      </div>
      {catalogItems?.length > 0 && !readOnly ? (
        <div style={{ marginBottom: "6px" }}>
          <span style={{ color: "#8b949e", fontSize: "10px" }}>From catalog: </span>
          <select
            aria-label="Pick catalog item"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const cat = catalogItems.find((c) => String(c.id) === id);
              if (cat) onPickCatalog(cat);
              e.target.value = "";
            }}
            style={{ ...rowInputStyle, maxWidth: "100%" }}
          >
            <option value="">Choose template…</option>
            {catalogItems.map((c) => (
              <option key={c.id} value={c.id}>
                {categoryLabel(c.category)} — {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {!readOnly ? (
        <div style={{ display: "flex", gap: "6px" }}>
          <button type="button" style={btnStyle} onClick={onSave}>
            Save item
          </button>
          <button type="button" style={btnStyle} onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ArmorEditorCard({ draft, readOnly, onChange, onSave, onCancel }) {
  const d = draft || newArmorItemDraft();
  const kind = normalizeArmorKind(d) || "standard";
  return (
    <div
      style={{
        border: "1px solid #374151",
        borderRadius: "4px",
        padding: "8px",
        marginBottom: "8px",
        background: "#161b22",
      }}
    >
      <input
        type="text"
        aria-label="Armor name"
        readOnly={readOnly}
        disabled={readOnly}
        value={d.name}
        placeholder="Name…"
        onChange={(e) => onChange({ ...d, name: e.target.value })}
        style={{ ...rowInputStyle, width: "100%", marginBottom: "6px" }}
      />
      <input
        type="text"
        aria-label="Armor detail"
        readOnly={readOnly}
        disabled={readOnly}
        value={d.detail || ""}
        placeholder="Detail (optional)…"
        onChange={(e) => onChange({ ...d, detail: e.target.value })}
        style={{ ...rowInputStyle, width: "100%", marginBottom: "6px" }}
      />
      <div style={{ marginBottom: "6px" }}>
        <span style={{ color: "#8b949e", fontSize: "10px", display: "block", marginBottom: "4px" }}>
          Type
        </span>
        <select
          aria-label="Armor type"
          disabled={readOnly}
          value={kind}
          onChange={(e) => {
            const nextKind = e.target.value;
            onChange({
              ...d,
              armor_kind: nextKind,
              is_armor: true,
              load: 0,
            });
          }}
          style={{ ...rowInputStyle, width: "100%" }}
        >
          {ARMOR_KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.pool === "physical"
                ? ` (${o.charges} chg)`
                : " (1 use)"}
            </option>
          ))}
        </select>
      </div>
      {kind === "special" ? (
        <div
          style={{
            fontSize: "9px",
            color: "#6b7280",
            lineHeight: 1.35,
            marginBottom: "6px",
          }}
        >
          Resist a qualifying consequence or push without 2 stress. One use per
          score; restored when you choose load for the next score.
        </div>
      ) : null}
      {!readOnly ? (
        <div style={{ display: "flex", gap: "6px" }}>
          <button type="button" style={btnStyle} onClick={onSave}>
            Save armor
          </button>
          <button type="button" style={btnStyle} onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function CharacterSheetInventoryList({
  panelId,
  inventory,
  readOnly,
  onChange,
  onInventoryTouch,
  loadoutEntry,
  onLoadoutChange,
  activeSessionId,
  coinFilled = 0,
  abilities = [],
  campaignId,
  characterId,
  isGM = false,
  onPromoteToCampaign,
  onPublishToSite,
}) {
  const inv = normalizeCharacterInventory(inventory);
  const loadout = normalizeLoadoutEntry(loadoutEntry);
  const hasMule = characterHasAbility(abilities, "Mule");
  const hasRigging = characterHasAbility(abilities, "Rigging");
  const used = computeInventoryLoadUsed({
    inventory: inv,
    coinFilled,
    riggingCategories: loadout.rigging_categories,
    hasRigging,
  });
  const derivedBand = loadBandForUsed(used);
  const bandMax = derivedBand ? loadCapForBand(derivedBand, hasMule) : null;
  const loadedItemIds = useMemo(
    () =>
      inv
        .filter((item) => (Number(item.load) || 0) > 0)
        .map((item) => String(item.id)),
    [inv],
  );

  const sessionActive = Boolean(activeSessionId);

  const [addDraft, setAddDraft] = useState(null);
  const [addMode, setAddMode] = useState(null);
  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogError, setCatalogError] = useState(null);

  useEffect(() => {
    if (!sessionActive || !onLoadoutChange || readOnly) return;
    const bandChanged = derivedBand !== (loadout.band || "");
    const prevIds = [...(loadout.carried_ids || [])].sort().join(",");
    const nextIds = [...loadedItemIds].sort().join(",");
    const idsChanged = prevIds !== nextIds;
    if (!bandChanged && !idsChanged) return;
    onLoadoutChange({
      ...loadout,
      band: derivedBand,
      carried_ids: loadedItemIds,
    });
  }, [
    sessionActive,
    onLoadoutChange,
    readOnly,
    derivedBand,
    loadedItemIds,
    loadout,
  ]);

  useEffect(() => {
    if (!campaignId) {
      setCatalogItems([]);
      return;
    }
    let cancelled = false;
    equipmentAPI
      .list({ campaign: campaignId, available_for_campaign: true })
      .then((list) => {
        if (!cancelled) setCatalogItems(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) setCatalogError(e.message || "Catalog load failed");
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const patchLoadout = useCallback(
    (patch) => {
      if (!onLoadoutChange) return;
      onLoadoutChange({ ...loadout, ...patch });
    },
    [loadout, onLoadoutChange],
  );

  const removeAt = (index) => {
    onInventoryTouch?.();
    onChange(inv.filter((_, i) => i !== index));
  };

  const saveNewItem = () => {
    const armorKind = normalizeArmorKind(addDraft);
    const dedicatedArmor = addMode === "armor";
    let name = String(addDraft?.name || "").trim();
    if (!name && dedicatedArmor && armorKind) {
      name = armorKindLabel(armorKind);
    }
    if (!name) return;
    const row = armorKind
      ? {
          ...addDraft,
          name,
          load: dedicatedArmor ? 0 : Number(addDraft.load) || 0,
          is_armor: armorKind === "standard" || armorKind === "heavy",
          armor_kind: armorKind,
        }
      : {
          ...addDraft,
          name,
          load: Number(addDraft.load) || 1,
          quality: Number(addDraft.quality) || 1,
          is_armor: false,
          armor_kind: "",
        };
    onInventoryTouch?.();
    onChange([...inv, row]);
    setAddDraft(null);
    setAddMode(null);
  };

  const cancelAdd = () => {
    setAddDraft(null);
    setAddMode(null);
  };

  const addingArmor = addMode === "armor";

  return (
    <div
      id={panelId}
      role="list"
      aria-label="Character inventory"
      style={{
        width: "100%",
        minHeight: "48px",
        background: "#0d1117",
        color: "#fff",
        border: "1px solid #374151",
        padding: "8px",
        fontFamily: "monospace",
        fontSize: "12px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          marginBottom: "10px",
          paddingBottom: "8px",
          borderBottom: "1px solid #21262d",
        }}
      >
        <div style={{ marginBottom: sessionActive && hasRigging && !readOnly ? "6px" : 0 }}>
          <span style={{ color: "#9ca3af", fontSize: "11px" }}>
            Load{" "}
            <strong
              style={{
                color:
                  bandMax != null && used > bandMax ? "#f85149" : "#e5e7eb",
              }}
            >
              {used}
            </strong>
            {derivedBand ? ` · ${bandLabel(derivedBand)}` : null}
          </span>
        </div>
        {sessionActive && onLoadoutChange && hasRigging && !readOnly ? (
          <div style={{ marginTop: "6px" }}>
            <span style={{ color: "#8b949e", fontSize: "10px" }}>
              Rigging categories:{" "}
            </span>
            {RIGGING_CATEGORY_OPTIONS.map((o) => {
              const checked = loadout.rigging_categories.includes(o.value);
              return (
                <label
                  key={o.value}
                  style={{ color: "#c9d1d9", fontSize: "10px", marginRight: "8px" }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      let next = [...loadout.rigging_categories];
                      if (checked) next = next.filter((c) => c !== o.value);
                      else if (next.length < 2) next.push(o.value);
                      patchLoadout({ rigging_categories: next });
                    }}
                    style={{ marginRight: "2px" }}
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
        ) : null}
      </div>

      {catalogError ? (
        <div style={{ color: "#f85149", fontSize: "10px", marginBottom: "6px" }}>
          {catalogError}
        </div>
      ) : null}

      {inv.length === 0 && !addDraft ? (
        <div style={{ color: "#9ca3af", marginBottom: readOnly ? 0 : "8px" }}>
          No items.
        </div>
      ) : (
        inv.map((item, index) => {
          const itemId = String(item.id || index);
          const armorKind = normalizeArmorKind(item);
          const noLoad = !armorKind && Number(item.load) === 0;
          return (
            <div
              key={`inv-row-${itemId}`}
              role="listitem"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                marginBottom: index < inv.length - 1 ? "10px" : 0,
                paddingBottom: index < inv.length - 1 ? "10px" : 0,
                borderBottom:
                  index < inv.length - 1 ? "1px solid #21262d" : "none",
                fontStyle: noLoad ? "italic" : "normal",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ flex: 1, color: "#e5e7eb" }}>
                  {item.name}
                  {armorKind
                    ? ` · ${armorKindLabel(armorKind)} (${
                        armorKind === "special"
                          ? "1 use"
                          : `${armorChargesForItem(item)} chg`
                      })`
                    : null}
                  {!armorKind && item.load > 0 ? ` (${item.load} load)` : null}
                  {!armorKind && item.quality != null ? ` · Q${item.quality}` : null}
                  {item.coin_value != null ? ` · ${item.coin_value}c` : null}
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    style={{ ...btnStyle, color: "#f85149" }}
                    onClick={() => removeAt(index)}
                    aria-label={`Remove ${item.name}`}
                  >
                    Del
                  </button>
                ) : null}
              </div>
              {item.detail ? (
                <div style={{ color: "#8b949e", fontSize: "10px" }}>{item.detail}</div>
              ) : null}
              {isGM && onPromoteToCampaign && !armorKind ? (
                <button
                  type="button"
                  style={{ ...btnStyle, alignSelf: "flex-start", fontSize: "10px" }}
                  onClick={() => onPromoteToCampaign(item)}
                >
                  Save to campaign library
                </button>
              ) : null}
              {isGM && onPublishToSite && !armorKind ? (
                <button
                  type="button"
                  style={{ ...btnStyle, alignSelf: "flex-start", fontSize: "10px" }}
                  onClick={() => onPublishToSite(item)}
                >
                  Publish to site catalog
                </button>
              ) : null}
            </div>
          );
        })
      )}

      {addDraft ? (
        addingArmor ? (
          <ArmorEditorCard
            draft={addDraft}
            readOnly={readOnly}
            onChange={setAddDraft}
            onSave={saveNewItem}
            onCancel={cancelAdd}
          />
        ) : (
          <ItemEditorCard
            draft={addDraft}
            readOnly={readOnly}
            onChange={setAddDraft}
            onSave={saveNewItem}
            onCancel={cancelAdd}
            catalogItems={catalogItems}
            onPickCatalog={(cat) =>
              setAddDraft(catalogItemToKitRow(cat))
            }
          />
        )
      ) : null}

      {!readOnly && !addDraft ? (
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexWrap: "wrap",
            marginTop: inv.length ? "8px" : 0,
          }}
        >
          <button
            type="button"
            style={btnStyle}
            onClick={() => {
              setAddMode("item");
              setAddDraft(newInventoryItemDraft());
            }}
          >
            Add item
          </button>
          <button
            type="button"
            style={btnStyle}
            onClick={() => {
              setAddMode("armor");
              setAddDraft(newArmorItemDraft());
            }}
          >
            Add armor
          </button>
        </div>
      ) : null}
    </div>
  );
}
