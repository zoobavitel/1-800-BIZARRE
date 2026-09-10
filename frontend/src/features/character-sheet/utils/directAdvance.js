/** XP track caps and spend costs for direct click-to-advance (Plan A). */

import { ACTION_ATTR } from "../constants/srd";

const ATTRIBUTE_ACTION_TRACKS = new Set(["insight", "prowess", "resolve"]);

export const TRACK_CAPS = {
  insight: 5,
  prowess: 5,
  resolve: 5,
  heritage: 5,
  playbook: 10,
};

export const TRACK_ADVANCE_COST = {
  insight: 5,
  prowess: 5,
  resolve: 5,
  heritage: 5,
  playbook: 10,
};

export function trackAdvanceCost(track) {
  const key = String(track || "").trim().toLowerCase();
  return TRACK_ADVANCE_COST[key] ?? 5;
}

export function marksOnTrack(xpMarks, track) {
  const key = String(track || "").trim().toLowerCase();
  if (xpMarks && typeof xpMarks === "object" && key in xpMarks) {
    return Math.max(0, Math.floor(Number(xpMarks[key]) || 0));
  }
  return 0;
}

/** Marks still needed on a track before the next fill mints a pending. */
export function marksNeededToMintPending(track, xpMarks) {
  const key = String(track || "").trim().toLowerCase();
  const cap = TRACK_CAPS[key];
  if (!cap) return 0;
  const marks = marksOnTrack(xpMarks, key);
  if (marks >= cap) return 0;
  return cap - marks;
}

/** Open pending or legacy marks already cover the advance cost. */
export function hasRedeemableTrackAdvance({
  track,
  xpMarks,
  pendingAdvanceCounts,
}) {
  const key = String(track || "").trim().toLowerCase();
  const pending = Math.max(0, Number(pendingAdvanceCounts?.[key]) || 0);
  if (pending > 0) return true;
  const cost = trackAdvanceCost(key);
  return marksOnTrack(xpMarks, key) >= cost;
}

/**
 * Pool marks to bank so the next pending mints, or 0 if already redeemable.
 * Returns null when the pool cannot cover the gap.
 */
export function poolMarksNeededToMint({
  track,
  xpMarks,
  unallocatedXp,
  pendingAdvanceCounts,
}) {
  if (hasRedeemableTrackAdvance({ track, xpMarks, pendingAdvanceCounts })) {
    return 0;
  }
  const need = marksNeededToMintPending(track, xpMarks);
  const pool = Math.max(0, Math.floor(Number(unallocatedXp) || 0));
  if (need <= 0) {
    // Full track but no pending — legacy spend path on the server.
    return 0;
  }
  return pool >= need ? need : null;
}

export function canFundTrackAdvance({
  track,
  xpMarks,
  unallocatedXp,
  pendingAdvanceCounts,
}) {
  return poolMarksNeededToMint({
    track,
    xpMarks,
    unallocatedXp,
    pendingAdvanceCounts,
  }) !== null;
}

/**
 * True while free chargen Stand Coin points remain (budget 6, no XP-bought ranks yet).
 * After budget is full, wedge +1 must spend playbook XP — not local incrementStat.
 */
export function standCoinChargenHasFreeRoom({
  standCoinPointsGained,
  totalStandPoints,
  creationBudget = 6,
}) {
  if (Math.max(0, Number(standCoinPointsGained) || 0) > 0) return false;
  const budget = Math.max(0, Math.floor(Number(creationBudget) || 0));
  return Math.max(0, Math.floor(Number(totalStandPoints) || 0)) < budget;
}

export function canDirectStandUpgrade({
  stat,
  standGradeIndex,
  maxStandGradeIndex,
  canEditSheet,
  hasStandPlaybook,
  xpMarks,
  unallocatedXp,
  pendingAdvanceCounts,
}) {
  // Do not gate on allocation-history "post-chargen": first XP spend has no rows yet.
  if (!canEditSheet || !hasStandPlaybook || !stat) return false;
  if (standGradeIndex >= maxStandGradeIndex) return false;
  return canFundTrackAdvance({
    track: "playbook",
    xpMarks,
    unallocatedXp,
    pendingAdvanceCounts,
  });
}

export function canDirectActionDotUpgrade({
  actionRating,
  canEditSheet,
  isPostChargen,
  track,
  xpMarks,
  unallocatedXp,
  pendingAdvanceCounts,
}) {
  if (!canEditSheet || !isPostChargen || !track) return false;
  if (Math.max(0, Math.floor(Number(actionRating) || 0)) >= 4) return false;
  return canFundTrackAdvance({
    track,
    xpMarks,
    unallocatedXp,
    pendingAdvanceCounts,
  });
}

/** Owned rating merged from local state and last server snapshot. */
export function mergedActionRating(action, localRatings, serverRatings) {
  const key = String(action || "").toUpperCase();
  return Math.max(
    0,
    Math.floor(Number(localRatings?.[key]) || 0),
    Math.floor(Number(serverRatings?.[key]) || 0),
  );
}

export function actionDotBatchBlockedReason({
  action,
  targetDot,
  actionRating,
  plannedExtra,
}) {
  const owned = Math.max(0, Math.floor(Number(actionRating) || 0));
  const planned = Math.max(0, Math.floor(Number(plannedExtra) || 0));
  const target = Math.min(4, Math.max(1, Math.floor(Number(targetDot) || 0)));
  const effective = owned + planned;
  if (owned >= 4) {
    return `${String(action).toUpperCase()} is already at 4 dots.`;
  }
  if (effective >= target) {
    if (planned > 0) {
      return `${String(action).toUpperCase()} already at dot ${effective} (${owned} owned + ${planned} queued). Edit the plan strip to change.`;
    }
    return `${String(action).toUpperCase()} is already at dot ${effective}.`;
  }
  return null;
}

/** Dots still to queue/apply to reach ``targetDot`` (1–4). */
export function actionDotStepsToTarget({
  actionRating,
  plannedExtra,
  targetDot,
}) {
  const owned = Math.max(0, Math.floor(Number(actionRating) || 0));
  const planned = Math.max(0, Math.floor(Number(plannedExtra) || 0));
  const target = Math.min(4, Math.max(1, Math.floor(Number(targetDot) || 0)));
  return Math.max(0, target - (owned + planned));
}

function consumeOneSimulatedTrackAdvance(track, marksObj, pendObj) {
  const key = String(track || "").trim().toLowerCase();
  const pending = Math.max(0, Number(pendObj[key]) || 0);
  if (pending > 0) {
    pendObj[key] = pending - 1;
    return true;
  }
  const cost = trackAdvanceCost(key);
  const marks = marksOnTrack(marksObj, key);
  if (marks >= cost) {
    marksObj[key] = marks - cost;
    return true;
  }
  return false;
}

/** True when free pool + pendings + track marks cover ``steps`` attribute advances. */
/** Action names tied to insight / prowess / resolve. */
export function actionsForAttributeTrack(track) {
  const key = String(track || "").trim().toLowerCase();
  if (!ATTRIBUTE_ACTION_TRACKS.has(key)) return [];
  return Object.entries(ACTION_ATTR)
    .filter(([, attrTrack]) => attrTrack === key)
    .map(([action]) => action);
}

/** True when every action under the attribute is already at 4 dots (no +1 left). */
export function isAttributeActionTrackComplete(actionRatings, track) {
  const actions = actionsForAttributeTrack(track);
  if (!actions.length) return false;
  const ratings = actionRatings || {};
  return actions.every(
    (action) => Math.max(0, Math.floor(Number(ratings[action]) || 0)) >= 4,
  );
}

export function canAffordActionDotSteps({
  steps,
  track,
  xpMarks,
  unallocatedXp,
  pendingAdvanceCounts,
}) {
  const count = Math.max(0, Math.floor(Number(steps) || 0));
  if (count === 0) return true;
  let pool = Math.max(0, Math.floor(Number(unallocatedXp) || 0));
  const marksObj = { ...(xpMarks || {}) };
  const pendObj = { ...(pendingAdvanceCounts || {}) };
  const key = String(track || "").trim().toLowerCase();

  for (let i = 0; i < count; i += 1) {
    const fund = poolMarksNeededToMint({
      track: key,
      xpMarks: marksObj,
      unallocatedXp: pool,
      pendingAdvanceCounts: pendObj,
    });
    if (fund === null) return false;
    if (fund > 0) {
      pool -= fund;
      marksObj[key] = 0;
      pendObj[key] = (Number(pendObj[key]) || 0) + 1;
    }
    if (!consumeOneSimulatedTrackAdvance(key, marksObj, pendObj)) {
      return false;
    }
  }
  return true;
}
