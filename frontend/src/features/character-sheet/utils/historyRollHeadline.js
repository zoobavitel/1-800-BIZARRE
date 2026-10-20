/**
 * Sheet history headline for one logged roll.
 * A resistance check sets stress cost (6 − highest die). It is not an action outcome.
 */
export function historyRollHeadline(roll, diceStr, outcomeDisp) {
  const name = roll?.action_name || "Roll";
  const dice = diceStr == null ? "" : String(diceStr);
  if (String(roll?.roll_type || "").toUpperCase() === "RESISTANCE") {
    return `${name} · ${dice}`;
  }
  const outcome = outcomeDisp == null ? "" : String(outcomeDisp);
  return `${name} · ${dice} → ${outcome}`;
}

/** Resistance has no position or effect. */
export function historyRollPositionEffectModifiers(roll) {
  if (String(roll?.roll_type || "").toUpperCase() === "RESISTANCE") return [];
  return [
    roll?.position ? `Pos ${roll.position}` : null,
    roll?.effect ? `Eff ${roll.effect}` : null,
  ];
}
