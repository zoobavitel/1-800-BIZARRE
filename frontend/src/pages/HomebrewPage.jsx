import React, { useEffect, useMemo, useState } from "react";

import { equipmentAPI } from "../features/character-sheet/services/api";
import MySharedItems from "../features/character-sheet/components/MySharedItems";
import {
  EQUIPMENT_CATEGORY_OPTIONS,
  categoryLabel,
} from "../features/character-sheet/utils/loadoutUtils";

const S = {
  page: { padding: "16px", maxWidth: "800px", margin: "0 auto", color: "var(--text-primary)" },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "16px",
    marginBottom: "16px",
  },
  title: { fontSize: "13px", fontWeight: "bold", color: "var(--sheet-label)", margin: "0 0 8px" },
  muted: { color: "var(--text-dim)", fontSize: "12px" },
  tabs: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" },
  btn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-primary)",
    padding: "4px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  inp: {
    background: "var(--bg-input, var(--bg-card))",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-primary)",
    padding: "6px 8px",
    fontSize: "12px",
    boxSizing: "border-box",
  },
  label: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "11px", color: "var(--text-muted)" },
};

const ITEM_TABS = [
  { id: "creations", label: "My creations" },
  { id: "create", label: "Create item" },
];

const EMPTY_FORM = { name: "", description: "", category: "gear", load: 1, quality: 1 };

/** Create a homebrew item from scratch or from an existing item (S8). */
function CreateHomebrewItem() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [template, setTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    // SRD items, staff homebrew, published homebrew and my own homebrew.
    equipmentAPI
      .list({})
      .then((list) => setSources(Array.isArray(list) ? list : []))
      .catch(() => setSources([]));
  }, []);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return sources.filter((i) => String(i.name || "").toLowerCase().includes(q)).slice(0, 8);
  }, [search, sources]);

  const pickTemplate = (item) => {
    setTemplate(item);
    setSearch("");
    setForm({
      name: item.name || "",
      description: item.description || "",
      category: item.category || "gear",
      load: item.load_slots ?? 1,
      quality: item.quality ?? 1,
    });
  };

  const save = async (isPublic) => {
    const name = form.name.trim();
    if (!name) {
      setError("Name required.");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const body = {
        name,
        detail: form.description || "",
        category: form.category,
        load: Number(form.load),
        quality: Number(form.quality),
        public: isPublic,
      };
      if (template?.id != null) body.template = template.id;
      const made = await equipmentAPI.share(body);
      setNotice(
        `“${made?.name || name}” ${isPublic ? "published" : "saved as private homebrew"}. It's in My creations.`,
      );
      setForm(EMPTY_FORM);
      setTemplate(null);
    } catch (e) {
      setError(e.message || "Could not save the item.");
    }
  };

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label style={S.label}>
        Start from an existing item (optional)
        <input
          style={S.inp}
          aria-label="Start from an existing item"
          placeholder="Search SRD and homebrew items"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {matches.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              style={{ ...S.btn, textAlign: "left" }}
              aria-label={`Use ${item.name} as template`}
              onClick={() => pickTemplate(item)}
            >
              {item.name}
              <span style={{ ...S.muted, marginLeft: "8px" }}>
                {item.scope === "TEMPLATE" ? "SRD" : `by ${item.created_by_username || "admin"}`} ·{" "}
                {categoryLabel(item.category)}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {template ? (
        <div style={S.muted}>
          Starting from {template.name}. The original stays as it is.{" "}
          <button type="button" style={S.btn} onClick={() => setTemplate(null)}>
            Start from scratch
          </button>
        </div>
      ) : null}
      <label style={S.label}>
        Name
        <input style={S.inp} aria-label="Homebrew item name" value={form.name} onChange={set("name")} />
      </label>
      <label style={S.label}>
        Description
        <textarea
          style={{ ...S.inp, minHeight: "56px" }}
          aria-label="Homebrew item description"
          value={form.description}
          onChange={set("description")}
        />
      </label>
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <label style={S.label}>
          Category
          <select style={S.inp} aria-label="Homebrew item category" value={form.category} onChange={set("category")}>
            {EQUIPMENT_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label style={S.label}>
          Load
          <input
            style={{ ...S.inp, width: "70px" }}
            type="number"
            min="0"
            max="2"
            aria-label="Homebrew item load"
            value={form.load}
            onChange={set("load")}
          />
        </label>
        <label style={S.label}>
          Quality
          <input
            style={{ ...S.inp, width: "70px" }}
            type="number"
            min="0"
            max="3"
            aria-label="Homebrew item quality"
            value={form.quality}
            onChange={set("quality")}
          />
        </label>
      </div>
      {error ? <div style={{ color: "var(--sheet-label)", fontSize: "12px" }}>{error}</div> : null}
      {notice ? <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{notice}</div> : null}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button type="button" style={S.btn} onClick={() => save(false)}>
          Save as homebrew
        </button>
        <button type="button" style={S.btn} onClick={() => save(true)}>
          Publish as homebrew
        </button>
      </div>
      <div style={S.muted}>Saved homebrew is private to you. Published homebrew anyone can find.</div>
    </div>
  );
}

/**
 * Homebrew page (S8): make your own items and manage them. Browse, the
 * collection and other homebrew kinds come in later stories.
 */
export default function HomebrewPage({ tab, onNavigate }) {
  const initial = ITEM_TABS.some((t) => t.id === tab) ? tab : "creations";
  const [current, setCurrent] = useState(initial);

  useEffect(() => {
    if (ITEM_TABS.some((t) => t.id === tab)) setCurrent(tab);
  }, [tab]);

  const go = (id) => {
    setCurrent(id);
    onNavigate?.({ tab: id });
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Homebrew items</h2>
        <div style={S.tabs} role="tablist">
          {ITEM_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={current === t.id}
              style={{
                ...S.btn,
                borderColor: current === t.id ? "var(--sheet-label)" : "var(--border)",
              }}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {current === "create" ? <CreateHomebrewItem /> : <MySharedItems />}
      </div>
    </div>
  );
}
