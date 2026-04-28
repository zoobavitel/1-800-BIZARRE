import React, { useState, useEffect, useRef } from "react";
import { Search as SearchIcon } from "lucide-react";
import { searchAPI } from "../features/character-sheet/services/api";
import { buildRouteHref, handleSpaNavClick } from "../utils/spaNavigation";

// Dark mode format (same as Character Sheet, Character Options)
const S = {
  page: {
    fontFamily: "monospace",
    fontSize: "13px",
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
  },
  hdr: {
    background: "#1f2937",
    padding: "8px 16px",
    borderBottom: "1px solid #4b5563",
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  content: { padding: "16px", maxWidth: "1000px", margin: "0 auto" },
  searchInput: {
    width: "100%",
    padding: "10px 14px 10px 40px",
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "14px",
    fontFamily: "monospace",
    outline: "none",
  },
  searchWrapper: { position: "relative", marginBottom: "16px" },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#6b7280",
  },
  tabs: { display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" },
  tab: (active) => ({
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: "bold",
    cursor: "pointer",
    border: `1px solid ${active ? "#4b5563" : "#374151"}`,
    background: active ? "#374151" : "transparent",
    color: active ? "#fff" : "#9ca3af",
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  }),
  card: {
    background: "#111827",
    border: "1px solid #374151",
    borderRadius: "4px",
    padding: "12px",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
  },
  cardTitle: { fontWeight: "bold", fontSize: "14px", marginBottom: "4px" },
  cardSubtitle: { fontSize: "12px", color: "#9ca3af", marginBottom: "4px" },
  cardDesc: { fontSize: "11px", color: "#6b7280", lineHeight: 1.4 },
  tag: (color) => ({
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: "4px",
    fontSize: "9px",
    fontWeight: "bold",
    background: color,
    color: "#fff",
    marginRight: "6px",
  }),
  emptyState: { textAlign: "center", padding: "48px 16px", color: "#6b7280" },
};

const CATEGORIES = [
  { id: "all", label: "All Results" },
  { id: "character", label: "Characters" },
  { id: "compendium", label: "Compendium" },
  { id: "item", label: "Items" },
  { id: "npc", label: "Enemies" },
  { id: "vehicle", label: "Vehicles" },
  { id: "playbook", label: "Playbooks" },
  { id: "ability", label: "Abilities" },
  { id: "heritage", label: "Character options" },
];

const TYPE_COLORS = {
  character: "#a78bfa",
  campaign: "#059669",
  npc: "#dc2626",
  ability: "#7c3aed",
  hamon_ability: "#b45309",
  spin_ability: "#7c3aed",
  stand_ability: "#1d4ed8",
  heritage: "#059669",
};

export default function SearchPage({
  onNavigateToCharacter,
  onNavigateToCampaign,
  onNavigateToAbilities,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("all");
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(true);
      searchAPI
        .globalSearch(query)
        .then((data) => {
          const list = data?.results || [];
          setResults(list);
        })
        .catch((err) => {
          console.error("Search error:", err);
          setResults([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [query]);

  const filteredResults =
    category === "all"
      ? results
      : results.filter((r) => {
          if (category === "npc") return r.type === "npc";
          if (category === "heritage") return r.type === "heritage";
          if (category === "ability")
            return [
              "ability",
              "hamon_ability",
              "spin_ability",
              "stand_ability",
            ].includes(r.type);
          if (category === "playbook")
            return ["hamon_ability", "spin_ability"].includes(r.type);
          return r.type === category;
        });

  const handleResultClick = (r) => {
    if (r.type === "character" && onNavigateToCharacter)
      onNavigateToCharacter(r.id);
    else if (r.type === "campaign" && onNavigateToCampaign)
      onNavigateToCampaign(r.id);
    else if (onNavigateToAbilities) {
      if (r.type === "heritage") onNavigateToAbilities("heritage");
      else if (
        ["ability", "hamon_ability", "spin_ability", "stand_ability"].includes(
          r.type,
        )
      ) {
        const filter =
          r.type === "hamon_ability"
            ? "hamon"
            : r.type === "spin_ability"
              ? "spin"
              : r.type === "stand_ability"
                ? "standard"
                : "all";
        onNavigateToAbilities(filter);
      }
    }
  };

  const getResultHref = (r) => {
    if (r.type === "character") return buildRouteHref("character", { characterId: r.id });
    if (r.type === "campaign") return buildRouteHref("campaigns", { campaignId: r.id });
    if (r.type === "heritage") return buildRouteHref("abilities", { filter: "heritage" });
    if (["ability", "hamon_ability", "spin_ability", "stand_ability"].includes(r.type)) {
      const filter =
        r.type === "hamon_ability"
          ? "hamon"
          : r.type === "spin_ability"
            ? "spin"
            : r.type === "stand_ability"
              ? "standard"
              : "all";
      return buildRouteHref("abilities", { filter });
    }
    return "#";
  };

  return (
    <div style={S.page}>
      <div style={S.content}>
        <div style={S.searchWrapper}>
          <SearchIcon size={18} style={S.searchIcon} />
          <input
            type="text"
            placeholder="Search characters, abilities, heritages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={S.searchInput}
            autoFocus
          />
        </div>

        <div style={S.tabs}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              style={S.tab(category === c.id)}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {loading && <div style={S.emptyState}>Searching...</div>}
        {!loading && query.trim() && filteredResults.length === 0 && (
          <div style={S.emptyState}>
            No results found for "{query}"
            {category !== "all" && results.length > 0 && " in this category"}
          </div>
        )}
        {!loading && filteredResults.length > 0 && (
          <div>
            {filteredResults.map((r) => (
              <a
                key={`${r.type}-${r.id}`}
                href={getResultHref(r)}
                style={S.card}
                onClick={(e) => handleSpaNavClick(e, () => handleResultClick(r))}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span style={S.tag(TYPE_COLORS[r.type] || "#4b5563")}>
                    {r.type?.toUpperCase()}
                  </span>
                  <span style={S.cardTitle}>{r.title}</span>
                </div>
                {r.subtitle && <div style={S.cardSubtitle}>{r.subtitle}</div>}
                {r.description && <div style={S.cardDesc}>{r.description}</div>}
              </a>
            ))}
          </div>
        )}
        {!loading && !query.trim() && (
          <div style={S.emptyState}>
            Enter a search term to find characters, abilities, heritages, and
            more.
          </div>
        )}
      </div>
    </div>
  );
}
