import React, { useCallback, useEffect, useState } from "react";

import { equipmentAPI } from "../services/api";
import { EQUIPMENT_CATEGORY_OPTIONS, categoryLabel } from "../utils/loadoutUtils";

const btn = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--text-primary)",
  padding: "2px 8px",
  fontSize: "11px",
  cursor: "pointer",
  marginLeft: "8px",
};

const inp = {
  background: "var(--bg-input, var(--bg-card))",
  border: "1px solid var(--border)",
  borderRadius: "4px",
  color: "var(--text-primary)",
  padding: "4px 6px",
  fontSize: "12px",
};

/**
 * My creations: the signed-in user's homebrew items (S8), private or
 * published. The creator edits, publishes or unpublishes them here.
 * Unpublishing hides an item from new adds; copies already on sheets stay.
 */
export default function MySharedItems({ renderActions } = {}) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    equipmentAPI
      .list({ homebrew: "mine" })
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn, failMsg) => {
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e.message || failMsg);
    }
  };

  const save = () => {
    if (!form?.name?.trim()) {
      setError("Name required.");
      return;
    }
    run(async () => {
      await equipmentAPI.update(form.id, {
        name: form.name.trim(),
        description: form.description || "",
        category: form.category,
        load_slots: Number(form.load_slots),
        quality: Number(form.quality),
      });
      setForm(null);
    }, "Could not save the item.");
  };

  return (
    <div>
      {error ? (
        <div style={{ color: "var(--sheet-label)", fontSize: "11px", marginBottom: "6px" }}>{error}</div>
      ) : null}
      {items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: "12px" }}>
          No homebrew yet. Create an item here, or use "Save as homebrew" under a custom item on your sheet.
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "12px" }}
          >
            <strong style={{ color: "var(--text-primary)" }}>{item.name}</strong>
            <span style={{ color: "var(--text-dim)", marginLeft: "8px" }}>
              {categoryLabel(item.category)} · load {item.load_slots} · Q{item.quality}
              {item.is_public ? " · published" : " · private"}
            </span>
            <button type="button" style={btn} aria-label={`Edit ${item.name}`} onClick={() => setForm({ ...item })}>
              Edit
            </button>
            {item.is_public ? (
              <button
                type="button"
                style={btn}
                aria-label={`Unpublish ${item.name}`}
                onClick={() => run(() => equipmentAPI.unpublish(item.id), "Could not unpublish.")}
              >
                Unpublish
              </button>
            ) : (
              <button
                type="button"
                style={btn}
                aria-label={`Publish ${item.name}`}
                onClick={() => run(() => equipmentAPI.publish(item.id), "Could not publish.")}
              >
                Publish
              </button>
            )}
            {renderActions ? renderActions(item) : null}
          </div>
        ))
      )}
      {form ? (
        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
          <input
            style={inp}
            aria-label="Shared item name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <textarea
            style={{ ...inp, minHeight: "40px" }}
            aria-label="Shared item description"
            value={form.description || ""}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          />
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <select
              style={inp}
              aria-label="Shared item category"
              value={form.category}
              onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            >
              {EQUIPMENT_CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <input
              style={{ ...inp, width: "60px" }}
              type="number"
              min="0"
              max="2"
              aria-label="Shared item load"
              value={form.load_slots}
              onChange={(e) => setForm((p) => ({ ...p, load_slots: e.target.value }))}
            />
            <input
              style={{ ...inp, width: "60px" }}
              type="number"
              min="0"
              max="3"
              aria-label="Shared item quality"
              value={form.quality}
              onChange={(e) => setForm((p) => ({ ...p, quality: e.target.value }))}
            />
          </div>
          <div>
            <button type="button" style={{ ...btn, marginLeft: 0 }} onClick={save}>
              Save
            </button>
            <button type="button" style={btn} onClick={() => setForm(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
