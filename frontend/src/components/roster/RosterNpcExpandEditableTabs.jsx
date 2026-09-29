import React, { useEffect, useState } from "react";
import {
  normalizeCharacterInventory,
  referenceAPI,
} from "../../features/character-sheet/services/api";
import InventoryItemPicker from "../../features/character-sheet/components/InventoryItemPicker";
import { standardAbilities } from "../../features/character-sheet/utils/characterUtils";

const lbl = { fontSize: 10, color: "#9ca3af", textTransform: "uppercase" };

function heritageIdFromNpc(npc) {
  const h = npc?.heritage ?? npc?.heritage_id ?? null;
  if (h == null || h === "") return "";
  if (typeof h === "object" && h !== null) return String(h.id ?? "");
  return String(h);
}

function infoDraftFromNpc(npc) {
  return {
    heritage: heritageIdFromNpc(npc),
    role: String(npc?.role ?? ""),
    weakness: String(npc?.weakness ?? ""),
    need: String(npc?.need ?? ""),
    desire: String(npc?.desire ?? ""),
    notes: String(npc?.notes ?? ""),
  };
}

function formatInvLine(item) {
  if (item == null || item === "") return null;
  if (typeof item === "string") {
    const t = item.trim();
    return t || null;
  }
  if (typeof item === "object" && !Array.isArray(item)) {
    const name = String(item.name ?? item.label ?? "").trim();
    const desc = String(item.description ?? item.detail ?? "").trim();
    const qty =
      item.quantity != null && item.quantity !== ""
        ? ` ×${item.quantity}`
        : "";
    const loadN = Number(item.load);
    const loadBit =
      Number.isFinite(loadN) && loadN > 0 ? ` (${loadN} load)` : "";
    if (name && desc) return `${name}${qty}${loadBit} — ${desc}`;
    if (name) return `${name}${qty}${loadBit}`;
    try {
      return JSON.stringify(item);
    } catch {
      return "[item]";
    }
  }
  try {
    return JSON.stringify(item);
  } catch {
    return String(item);
  }
}

function inventoryRowsFromNpc(npc) {
  if (Array.isArray(npc?.inventory)) return npc.inventory;
  if (Array.isArray(npc?.equipment)) return npc.equipment;
  return [];
}

/**
 * Shared Info / Abilities / Items editors for session + campaign NPC expand.
 * Parent owns tab bar; pass activeTab = "info" | "abilities" | "items".
 */
export default function RosterNpcExpandEditableTabs({
  activeTab,
  npc,
  S,
  busy = false,
  onPatch,
  equipmentCatalog = [],
}) {
  const npcId = npc?.id;
  const [heritages, setHeritages] = useState([]);
  const [infoDraft, setInfoDraft] = useState(() => infoDraftFromNpc(npc));
  const [customAbilityName, setCustomAbilityName] = useState("");

  useEffect(() => {
    let cancelled = false;
    referenceAPI
      .getHeritages()
      .then((list) => {
        if (!cancelled) setHeritages(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setHeritages([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const infoSeed = [
    npcId,
    heritageIdFromNpc(npc),
    String(npc?.role ?? ""),
    String(npc?.weakness ?? ""),
    String(npc?.need ?? ""),
    String(npc?.desire ?? ""),
    String(npc?.notes ?? ""),
  ].join("\0");

  useEffect(() => {
    setInfoDraft(infoDraftFromNpc(npc));
    // Seed from server snapshot fields only (avoid resetting while typing).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- infoSeed encodes npc fields
  }, [infoSeed]);

  useEffect(() => {
    setCustomAbilityName("");
  }, [npcId]);

  if (!npcId) return null;

  const patchField = async (partial) => {
    if (typeof onPatch !== "function") return;
    await onPatch(partial);
  };

  const commitInfoField = async (key, value) => {
    const server = infoDraftFromNpc(npc);
    let nextVal = value;
    let patchVal = value;
    if (key === "heritage") {
      const s = String(value ?? "").trim();
      nextVal = s;
      patchVal = s === "" ? null : Number(s) || s;
      if (String(server.heritage) === String(nextVal)) return;
    } else {
      nextVal = String(value ?? "");
      patchVal = nextVal;
      if (String(server[key] ?? "") === nextVal) return;
    }
    await patchField({ [key]: patchVal });
  };

  const abilities = Array.isArray(npc.abilities) ? npc.abilities : [];
  const invRows = inventoryRowsFromNpc(npc);

  if (activeTab === "info") {
    return (
      <div style={{ display: "grid", gap: 6, fontSize: 11 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Heritage</span>
          <select
            style={{ ...S.select, width: "100%", fontSize: 11 }}
            value={infoDraft.heritage}
            disabled={busy}
            onChange={(e) =>
              setInfoDraft((p) => ({ ...p, heritage: e.target.value }))
            }
            onBlur={(e) => commitInfoField("heritage", e.target.value)}
          >
            <option value="">— None —</option>
            {heritages.map((h) => (
              <option key={h.id} value={String(h.id)}>
                {h.name || `Heritage ${h.id}`}
              </option>
            ))}
          </select>
        </label>
        {[
          ["role", "Role"],
          ["weakness", "Weakness"],
          ["need", "Need"],
          ["desire", "Desire"],
        ].map(([key, label]) => (
          <label
            key={key}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
          >
            <span style={lbl}>{label}</span>
            <input
              style={{ ...S.inp, width: "100%", fontSize: 11 }}
              value={infoDraft[key] ?? ""}
              disabled={busy}
              onChange={(e) =>
                setInfoDraft((p) => ({ ...p, [key]: e.target.value }))
              }
              onBlur={(e) => commitInfoField(key, e.target.value)}
            />
          </label>
        ))}
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={lbl}>Notes</span>
          <textarea
            style={{
              ...S.inp,
              width: "100%",
              fontSize: 11,
              minHeight: 56,
              resize: "vertical",
            }}
            value={infoDraft.notes ?? ""}
            disabled={busy}
            onChange={(e) =>
              setInfoDraft((p) => ({ ...p, notes: e.target.value }))
            }
            onBlur={(e) => commitInfoField("notes", e.target.value)}
          />
        </label>
      </div>
    );
  }

  if (activeTab === "abilities") {
    return (
      <div>
        <div style={lbl}>Abilities</div>
        {abilities.length === 0 ? (
          <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0" }}>
            No abilities yet.
          </p>
        ) : (
          <ul
            style={{
              margin: "4px 0 8px",
              paddingLeft: 0,
              listStyle: "none",
              color: "#9ca3af",
            }}
          >
            {abilities.map((a, i) => {
              const name = (a && a.name) || "";
              return (
                <li
                  key={`ability-${npcId}-${i}`}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <input
                    style={{ ...S.inp, flex: 1, fontSize: 11, minWidth: 0 }}
                    defaultValue={name}
                    key={`${npcId}-abil-${i}-${name}`}
                    disabled={busy}
                    onBlur={async (e) => {
                      const nextName = String(e.target.value || "").trim();
                      if (nextName === String(name).trim()) return;
                      if (!nextName) return;
                      const next = abilities.map((row, j) =>
                        j === i
                          ? {
                              ...(typeof row === "object" && row
                                ? row
                                : { name: String(row) }),
                              name: nextName,
                            }
                          : row,
                      );
                      await patchField({ abilities: next });
                    }}
                  />
                  <button
                    type="button"
                    style={{
                      ...S.btnGhost,
                      fontSize: 10,
                      padding: "2px 8px",
                      color: "#f87171",
                      flexShrink: 0,
                    }}
                    disabled={busy}
                    title="Remove ability"
                    onClick={async () => {
                      const next = abilities.filter((_, j) => j !== i);
                      await patchField({ abilities: next });
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <input
            style={{ ...S.inp, flex: 1, fontSize: 11, minWidth: 0 }}
            placeholder="Custom ability name…"
            value={customAbilityName}
            disabled={busy}
            onChange={(e) => setCustomAbilityName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const name = String(customAbilityName || "").trim();
              if (!name) return;
              const next = [
                ...abilities,
                { name, description: "", type: "custom" },
              ];
              setCustomAbilityName("");
              await patchField({ abilities: next });
            }}
          />
          <button
            type="button"
            style={{ ...S.btnGhost, fontSize: 10, flexShrink: 0 }}
            disabled={busy || !String(customAbilityName || "").trim()}
            onClick={async () => {
              const name = String(customAbilityName || "").trim();
              if (!name) return;
              const next = [
                ...abilities,
                { name, description: "", type: "custom" },
              ];
              setCustomAbilityName("");
              await patchField({ abilities: next });
            }}
          >
            Add
          </button>
        </div>
        <div style={lbl}>Premade templates (narrative)</div>
        <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 6 }}>
          Pick a name to copy onto the NPC sheet — no dice.
        </div>
        <select
          style={{ ...S.select, width: "100%", fontSize: 11 }}
          defaultValue=""
          disabled={busy}
          onChange={async (e) => {
            const name = e.target.value;
            e.target.value = "";
            if (!name) return;
            const next = [
              ...abilities,
              { name, description: "", type: "standard" },
            ];
            await patchField({ abilities: next });
          }}
        >
          <option value="">+ Add from standard list…</option>
          {standardAbilities.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (activeTab === "items") {
    return (
      <div>
        <div style={lbl}>Items / equipment</div>
        {invRows.length === 0 ? (
          <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0" }}>
            No inventory or equipment on this NPC.
          </p>
        ) : (
          <ul
            style={{
              margin: "6px 0 8px",
              paddingLeft: 0,
              listStyle: "none",
              color: "#9ca3af",
              fontSize: 11,
            }}
          >
            {invRows.map((row, i) => {
              const line = formatInvLine(row) || `Item ${i + 1}`;
              return (
                <li
                  key={`npc-inv-${npcId}-${i}`}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>{line}</span>
                  <button
                    type="button"
                    style={{
                      ...S.btnGhost,
                      fontSize: 10,
                      padding: "2px 8px",
                      color: "#f87171",
                      flexShrink: 0,
                    }}
                    disabled={busy}
                    title="Remove item"
                    onClick={async () => {
                      const next = normalizeCharacterInventory(
                        invRows.filter((_, j) => j !== i),
                      );
                      await patchField({ inventory: next });
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <InventoryItemPicker
          catalogItems={equipmentCatalog}
          allowArmor={true}
          disabled={busy}
          inputStyle={{
            ...S.inp,
            fontSize: 11,
            minWidth: 0,
          }}
          buttonStyle={{
            ...S.btnGhost,
            fontSize: 10,
            flexShrink: 0,
          }}
          onPickRow={async (row) => {
            const base = normalizeCharacterInventory(invRows);
            const next = normalizeCharacterInventory([...base, row]);
            await patchField({ inventory: next });
          }}
          onPickCustomName={async (name) => {
            const trimmed = String(name ?? "").trim();
            if (!trimmed) return;
            const row = {
              id:
                typeof crypto !== "undefined" && crypto.randomUUID
                  ? crypto.randomUUID()
                  : `item-${Date.now()}`,
              name: trimmed,
              detail: "",
              category: "other",
              load: 1,
              quality: 1,
              coin_value: null,
              catalog_id: null,
            };
            const base = normalizeCharacterInventory(invRows);
            const next = normalizeCharacterInventory([...base, row]);
            await patchField({ inventory: next });
          }}
        />
      </div>
    );
  }

  return null;
}
