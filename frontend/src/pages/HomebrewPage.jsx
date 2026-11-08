import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../features/auth";
import {
  campaignAPI,
  characterAPI,
  equipmentAPI,
} from "../features/character-sheet/services/api";
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
  { id: "browse", label: "Browse" },
  { id: "collection", label: "My collection" },
  { id: "creations", label: "My creations" },
  { id: "create", label: "Create item" },
];

// Homebrew kinds, like D&D Beyond's homebrew page. Only items exist so far;
// the rest are planned stories (S12 to S14).
const KINDS = [
  { id: "items", label: "Items", live: true },
  { id: "heritages", label: "Heritages" },
  { id: "standard", label: "Standard abilities" },
  { id: "spin", label: "Spin abilities" },
  { id: "hamon", label: "Hamon abilities" },
];

const EMPTY_FORM = { name: "", description: "", category: "gear", load: 1, quality: 1 };

function formFromItem(item) {
  return {
    name: item.name || "",
    description: item.description || "",
    category: item.category || "gear",
    load: item.load_slots ?? 1,
    quality: item.quality ?? 1,
  };
}

/** Create a homebrew item from scratch or from an existing item (S8). */
function CreateHomebrewItem({ initialTemplate = null, renderActions }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [template, setTemplate] = useState(null);
  const [search, setSearch] = useState("");
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [made, setMade] = useState(null);

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
    setForm(formFromItem(item));
  };

  useEffect(() => {
    if (!initialTemplate) return;
    setTemplate(initialTemplate);
    setSearch("");
    setForm(formFromItem(initialTemplate));
  }, [initialTemplate]);

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
      const created = await equipmentAPI.share(body);
      setMade(created?.id != null ? created : null);
      setNotice(
        `“${created?.name || name}” ${isPublic ? "published" : "saved as private homebrew"}. It's in My creations.`,
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
      {made && renderActions ? renderActions(made) : null}
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
 * Use a homebrew item (S10): put it on one of my sheets, or turn it on for a
 * campaign I run so its players can add it.
 */
function HomebrewItemActions({ item, sheets, campaigns }) {
  const [sheetId, setSheetId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [message, setMessage] = useState(null);

  const run = async (fn, done, failMsg) => {
    setMessage(null);
    try {
      await fn();
      setMessage(done);
    } catch (e) {
      setMessage(e.message || failMsg);
    }
  };

  if (!sheets.length && !campaigns.length) return null;
  const sheetName = (id) => sheets.find((c) => String(c.id) === String(id))?.true_name || "the sheet";
  const campaignName = (id) => campaigns.find((c) => String(c.id) === String(id))?.name || "the campaign";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px" }}>
      {sheets.length ? (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            style={S.inp}
            aria-label={`Sheet for ${item.name}`}
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
          >
            <option value="">Choose a sheet…</option>
            {sheets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.true_name || `Character ${c.id}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={S.btn}
            disabled={!sheetId}
            aria-label={`Add ${item.name} to the sheet`}
            onClick={() =>
              run(
                () => equipmentAPI.addToCharacter(item.id, Number(sheetId)),
                `Added to ${sheetName(sheetId)}.`,
                "Could not add it to the sheet.",
              )
            }
          >
            Add to a character
          </button>
        </div>
      ) : null}
      {campaigns.length ? (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            style={S.inp}
            aria-label={`Campaign for ${item.name}`}
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Choose a campaign you run…</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={S.btn}
            disabled={!campaignId}
            aria-label={`Use ${item.name} in the campaign`}
            onClick={() =>
              run(
                () => equipmentAPI.setCampaignAccess(item.id, Number(campaignId), true),
                `Turned on for ${campaignName(campaignId)}. Its players can add it with "Add owned homebrew item".`,
                "Could not turn it on for the campaign.",
              )
            }
          >
            Use in a campaign
          </button>
        </div>
      ) : null}
      {message ? <div style={S.muted}>{message}</div> : null}
    </div>
  );
}

function makerLabel(item) {
  return item.scope === "TEMPLATE" ? "SRD" : `by ${item.created_by_username || "admin"}`;
}

/** Published homebrew (browse) or my collection, with collect buttons (S9). */
function HomebrewItemList({ which, initialQuery = "", onUseTemplate, onSearch, renderActions }) {
  const [query, setQuery] = useState(initialQuery);
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const load = useCallback(() => {
    const q = query.trim();
    const params = which === "browse" ? { homebrew: "browse", ...(q ? { q } : {}) } : { homebrew: "collection" };
    equipmentAPI
      .list(params)
      .then((list) => setItems(Array.isArray(list) ? list : []))
      .catch(() => setItems([]));
  }, [which, query]);

  useEffect(() => {
    const t = setTimeout(load, which === "browse" && query ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, which, query]);

  const toggle = async (item) => {
    setError(null);
    try {
      const updated = item.in_my_collection || which === "collection"
        ? await equipmentAPI.uncollect(item.id)
        : await equipmentAPI.collect(item.id);
      if (which === "collection") load();
      else setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
    } catch (e) {
      setError(e.message || "Could not update your collection.");
    }
  };

  return (
    <div>
      {which === "browse" ? (
        <input
          style={{ ...S.inp, width: "100%", marginBottom: "10px" }}
          aria-label="Search homebrew items"
          placeholder="Search published homebrew items"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onSearch?.(e.target.value);
          }}
        />
      ) : null}
      {error ? <div style={{ color: "var(--sheet-label)", fontSize: "12px" }}>{error}</div> : null}
      {items.length === 0 ? (
        <div style={S.muted}>
          {which === "browse"
            ? "No published homebrew matches."
            : "Your collection is empty. Add items from Browse."}
        </div>
      ) : (
        items.map((item) => {
          const collected = which === "collection" || item.in_my_collection;
          return (
            <div
              key={item.id}
              style={{ padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "12px" }}
            >
              <strong>{item.name}</strong>
              <span style={{ ...S.muted, marginLeft: "8px" }}>
                {makerLabel(item)} · {categoryLabel(item.category)} · load {item.load_slots} · Q{item.quality}
              </span>
              {item.description ? <div style={{ ...S.muted, marginTop: "2px" }}>{item.description}</div> : null}
              <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={S.btn}
                  aria-label={
                    collected ? `Remove ${item.name} from my collection` : `Add ${item.name} to my collection`
                  }
                  onClick={() => toggle(item)}
                >
                  {collected ? "Remove from collection" : "Add to collection"}
                </button>
                <button
                  type="button"
                  style={S.btn}
                  aria-label={`Use ${item.name} as template`}
                  onClick={() => onUseTemplate(item)}
                >
                  Use as template
                </button>
              </div>
              {which === "collection" && renderActions ? renderActions(item) : null}
            </div>
          );
        })
      )}
    </div>
  );
}

/**
 * Homebrew page, modelled on D&D Beyond's: pick a kind, then browse
 * published homebrew, keep a collection, manage your creations or create
 * one (S8, S9). Only items exist so far.
 */
export default function HomebrewPage({ tab, query = "", onNavigate }) {
  const initial = ITEM_TABS.some((t) => t.id === tab) ? tab : "browse";
  const [current, setCurrent] = useState(initial);
  const [template, setTemplate] = useState(null);
  const { user } = useAuth();
  const [sheets, setSheets] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => {
    if (ITEM_TABS.some((t) => t.id === tab)) setCurrent(tab);
  }, [tab]);

  // For the S10 actions: my sheets, and the campaigns I run.
  useEffect(() => {
    characterAPI
      .getCharacters({ mine: true })
      .then((list) => setSheets(Array.isArray(list) ? list : list?.results || []))
      .catch(() => setSheets([]));
    campaignAPI
      .getCampaigns()
      .then((list) => {
        const all = Array.isArray(list) ? list : list?.results || [];
        setCampaigns(all.filter((c) => user?.id != null && Number(c.gm?.id) === Number(user.id)));
      })
      .catch(() => setCampaigns([]));
  }, [user?.id]);

  const renderActions = (item) => (
    <HomebrewItemActions item={item} sheets={sheets} campaigns={campaigns} />
  );

  const go = (id, extra) => {
    setCurrent(id);
    onNavigate?.({ tab: id, ...extra });
  };

  const startFromTemplate = (item) => {
    setTemplate(item);
    go("create");
  };

  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Homebrew</h2>
        <div style={S.muted}>
          Make your own content, find what other players and GMs published, and keep the ones you like in your
          collection.
        </div>
        <div style={{ ...S.tabs, marginTop: "10px", marginBottom: 0 }}>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={!k.live}
              aria-label={k.live ? k.label : `${k.label} (coming later)`}
              style={{
                ...S.btn,
                opacity: k.live ? 1 : 0.5,
                cursor: k.live ? "pointer" : "default",
                borderColor: k.live ? "var(--sheet-label)" : "var(--border)",
              }}
            >
              {k.label}
              {k.live ? "" : " · coming later"}
            </button>
          ))}
        </div>
      </div>
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
        {current === "create" ? (
          <CreateHomebrewItem initialTemplate={template} renderActions={renderActions} />
        ) : current === "creations" ? (
          <MySharedItems renderActions={renderActions} />
        ) : (
          <HomebrewItemList
            which={current}
            initialQuery={current === "browse" ? query : ""}
            onUseTemplate={startFromTemplate}
            renderActions={renderActions}
          />
        )}
      </div>
    </div>
  );
}
