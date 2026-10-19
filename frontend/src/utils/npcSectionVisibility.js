/** Campaign player section flags on an NPC. Missing key means visible. */

export const NPC_PLAYERS_SEE_KEYS = [
  "playbook",
  "abilities",
  "pc_standing",
  "faction_membership",
  "notes",
  "stand_identity",
  "heritage",
  "forms",
  "consciousness",
  "contacts",
  "crew_standing",
];

export function npcSectionVisible(playersSee, key) {
  if (!playersSee || typeof playersSee !== "object") return true;
  return playersSee[key] !== false;
}

export function normalizeNpcPlayersSee(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  for (const key of NPC_PLAYERS_SEE_KEYS) {
    out[key] = src[key] !== false;
  }
  return out;
}

export function npcFactionMembershipVisible(npc) {
  return npcSectionVisible(npc?.players_see, "faction_membership");
}
