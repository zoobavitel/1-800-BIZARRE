/**
 * History-panel Resistance attribute select.
 * Values match live sheet createRoll action_name (stand path uses stand_durability).
 */
export const HISTORY_MANUAL_RESISTANCE_ATTR_OPTIONS = [
  { value: "insight", label: "Insight" },
  { value: "prowess", label: "Prowess" },
  { value: "resolve", label: "Resolve" },
  { value: "stand_durability", label: "Durability" },
];

/**
 * @param {string} selected historyManual.action from the Resistance <select>
 * @returns {string} createRoll action_name
 */
export function historyManualResistanceActionName(selected) {
  const a = String(selected || "").trim().toLowerCase();
  if (a === "durability") return "stand_durability";
  return a;
}
