import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../features/auth";
import { buildRouteHref } from "../utils/spaNavigation";
import {
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

// Sub-pages of homebrew items. "items" is the search page (route
// #homebrew/items); "create" is #homebrew/create/item.
const ITEM_TABS = [
  { id: "items", label: "Browse items" },
  { id: "create", label: "Create item" },
  { id: "collection", label: "My collection" },
  { id: "creations", label: "My creations" },
];

// Homebrew kinds on the landing page, like D&D Beyond's homebrew page. Only
// items are built; the rest are planned stories (S13 onward).
const KINDS = [
  { id: "heritages", one: "heritage", label: "Heritages",
    blurb: "New heritages, or variations of existing ones, with their own benefits and detriments." },
  { id: "abilities", one: "ability", label: "Abilities", blurb: "Standard abilities anyone can take." },
  { id: "items", one: "item", label: "Items", blurb: "Gear, implements, weapons and other equipment.", live: true },
  { id: "monsters", one: "monster", label: "Monsters", blurb: "Enemies and creatures for GMs to use as NPCs." },
  { id: "playbooks", one: "playbook", label: "Playbooks", blurb: "Stand, Spin and Hamon playbooks and their abilities." },
];

const linkBtn = { display: "inline-block", textDecoration: "none" };

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
 * Use a homebrew item (S10): put it on one of my sheets. Saving homebrew to
 * your collection shares it with your table when homebrew is on (S11).
 */
function HomebrewItemActions({ item, sheets }) {
  const [sheetId, setSheetId] = useState("");
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

  if (!sheets.length) return null;
  const sheetName = (id) => sheets.find((c) => String(c.id) === String(id))?.true_name || "the sheet";

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
function HomebrewLanding() {
  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Homebrew</h2>
        <div style={S.muted}>
          Make your own content, find what other players and GMs published, and keep the ones you like in your
          collection.
        </div>
        <div style={{ ...S.tabs, marginTop: "10px", marginBottom: 0 }}>
          <a style={{ ...S.btn, ...linkBtn }} href={buildRouteHref("homebrew", { tab: "collection" })}>
            My collection
          </a>
          <a style={{ ...S.btn, ...linkBtn }} href={buildRouteHref("homebrew", { tab: "creations" })}>
            My creations
          </a>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
        {KINDS.map((k) => (
          <div key={k.id} style={{ ...S.card, marginBottom: 0, opacity: k.live ? 1 : 0.7 }}>
            <h3 style={{ ...S.title, fontSize: "14px" }}>{k.label}</h3>
            <div style={{ ...S.muted, minHeight: "34px" }}>{k.blurb}</div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
              {k.live ? (
                <>
                  <a
                    style={{ ...S.btn, ...linkBtn }}
                    aria-label={`View homebrew ${k.id}`}
                    href={buildRouteHref("homebrew", { tab: k.id })}
                  >
                    View homebrew
                  </a>
                  <a
                    style={{ ...S.btn, ...linkBtn }}
                    aria-label={`Create homebrew ${k.one}`}
                    href={buildRouteHref("homebrew", { tab: "create", q: k.one })}
                  >
                    Create homebrew
                  </a>
                </>
              ) : (
                <>
                  <button type="button" style={S.btn} disabled aria-label={`View homebrew ${k.id} (coming soon)`}>
                    View homebrew
                  </button>
                  <button type="button" style={S.btn} disabled aria-label={`Create homebrew ${k.one} (coming soon)`}>
                    Create homebrew
                  </button>
                </>
              )}
            </div>
            {k.live ? null : <div style={{ ...S.muted, marginTop: "6px" }}>Coming soon</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ComingSoon({ kind }) {
  const name = kind.label.toLowerCase();
  return (
    <div style={S.page}>
      <div style={S.card}>
        <h2 style={S.title}>Homebrew {name}</h2>
        <div style={S.muted}>Homebrew {name} are coming soon.</div>
        <a style={{ ...S.btn, ...linkBtn, marginTop: "10px" }} href={buildRouteHref("homebrew")}>
          ← Back to Homebrew
        </a>
      </div>
    </div>
  );
}

/** Which page a #homebrew route opens. */
function homebrewView(tab, query) {
  if (!tab) return { page: "landing" };
  if (tab === "browse" || tab === "items") return { page: "items", sub: "items" };
  if (tab === "collection" || tab === "creations") return { page: "items", sub: tab };
  if (tab === "create") {
    const kind = KINDS.find((k) => k.one === (query || "item"));
    if (!kind || kind.live) return { page: "items", sub: "create" };
    return { page: "soon", kind };
  }
  const kind = KINDS.find((k) => k.id === tab);
  if (kind && !kind.live) return { page: "soon", kind };
  return { page: "landing" };
}

/**
 * Homebrew pages, modelled on D&D Beyond's (2026-11-09):
 * #homebrew (landing cards), #homebrew/items (search),
 * #homebrew/create/item, #homebrew/collection, #homebrew/creations.
 */
export default function HomebrewPage({ tab, query = "", onNavigate }) {
  const view = homebrewView(tab, query);
  if (view.page === "landing") return <HomebrewLanding />;
  if (view.page === "soon") return <ComingSoon kind={view.kind} />;
  return <HomebrewItemsPage sub={view.sub} query={tab === "create" ? "" : query} onNavigate={onNavigate} />;
}

/** Homebrew items: search (browse), create, my collection, my creations. */
function HomebrewItemsPage({ sub, query = "", onNavigate }) {
  const [current, setCurrent] = useState(sub);
  const [template, setTemplate] = useState(null);
  const { user } = useAuth();
  const [sheets, setSheets] = useState([]);

  useEffect(() => {
    setCurrent(sub);
  }, [sub]);

  // For the S10 action: my sheets.
  useEffect(() => {
    characterAPI
      .getCharacters({ mine: true })
      .then((list) => setSheets(Array.isArray(list) ? list : list?.results || []))
      .catch(() => setSheets([]));
  }, [user?.id]);

  const renderActions = (item) => (
    <HomebrewItemActions item={item} sheets={sheets} />
  );

  const go = (id, extra) => {
    setCurrent(id);
    onNavigate?.(id === "create" ? { tab: "create", q: "item" } : { tab: id, ...extra });
  };

  const startFromTemplate = (item) => {
    setTemplate(item);
    go("create");
  };

  return (
    <div style={S.page}>
      <div style={{ ...S.muted, marginBottom: "8px" }}>
        <a href={buildRouteHref("homebrew")} style={{ color: "inherit" }}>
          Homebrew
        </a>{" "}
        › Items
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
            which={current === "items" ? "browse" : current}
            initialQuery={current === "items" ? query : ""}
            onUseTemplate={startFromTemplate}
            renderActions={renderActions}
          />
        )}
      </div>
    </div>
  );
}
