// API service for character sheet backend integration

import { getApiBaseUrl, requireApiBaseUrl } from "../../../config/apiConfig";
import { getApiErrorMessage } from "../../../utils/apiErrorMessage";
import {
  gradeToIndex,
  indexToGrade,
  DEFAULT_TRAUMA,
  TRAUMA_PK_TO_KEY,
  MAX_CREATION_DOTS,
  standPathArmorMaxFromDurabilityIndex,
} from "../constants/srd";
import {
  normalizeSheetProgressClock,
  serializeSheetProgressClocks,
} from "../utils/progressClockSegments";

/** Backend Character.playbook values */
const PLAYBOOK_BACKEND = ["STAND", "HAMON", "SPIN"];
const PLAYBOOK_DISPLAY = ["Stand", "Hamon", "Spin"];

/** Map API playbook (STAND/HAMON/SPIN) to CharacterSheet select labels */
export function playbookToDisplay(pb) {
  if (pb == null || pb === "") return "Stand";
  const u = String(pb).toUpperCase();
  if (u === "HAMON") return "Hamon";
  if (u === "SPIN") return "Spin";
  return "Stand";
}

/** True when target playbook (display or backend label) is in primary or secondary slot. */
export function hasPlaybook(primary, secondary, target) {
  const want = playbookToDisplay(target);
  const slots = [playbookToDisplay(primary)];
  if (secondary != null && String(secondary).trim() !== "") {
    slots.push(playbookToDisplay(secondary));
  }
  return slots.includes(want);
}

/** Human-readable dual-playbook label for roster cards. */
export function formatPlaybookPair(primary, secondary) {
  const main = playbookToDisplay(primary);
  if (secondary == null || String(secondary).trim() === "") return main;
  return `${main} + ${playbookToDisplay(secondary)}`;
}

/** Sheet select options for playbook dropdowns. */
export const PLAYBOOK_SHEET_OPTIONS = [...PLAYBOOK_DISPLAY];

/** True when the sheet is linked to a campaign crew (stash lives on Crew). */
function hasLinkedCrew(crewId) {
  if (crewId == null || crewId === "") return false;
  const n =
    typeof crewId === "number" ? crewId : parseInt(String(crewId).trim(), 10);
  return Number.isFinite(n) && n > 0;
}

/** Backend `inventory` is a JSON array; legacy data may be a single object. */
export function normalizeCharacterInventory(inv) {
  if (Array.isArray(inv)) return inv;
  if (inv != null && typeof inv === "object") return [inv];
  return [];
}

/** Map sheet labels or backend enums to API playbook */
export function playbookToBackend(pb) {
  if (pb == null || pb === "") return "STAND";
  const s = String(pb).trim();
  if (PLAYBOOK_BACKEND.includes(s)) return s;
  const lower = s.toLowerCase();
  if (lower === "hamon") return "HAMON";
  if (lower === "spin") return "SPIN";
  return "STAND";
}

/** Map optional second playbook sheet value to API (null when empty). */
export function secondaryPlaybookToBackend(pb) {
  if (pb == null || String(pb).trim() === "" || String(pb).trim() === "—") {
    return null;
  }
  return playbookToBackend(pb);
}

function abilityIdsByType(abilities, type) {
  return (abilities || [])
    .filter(
      (a) =>
        a.type === type &&
        (typeof a.id === "number" ||
          (typeof a.id === "string" && /^\d+$/.test(a.id))),
    )
    .map((a) => (typeof a.id === "number" ? a.id : parseInt(a.id, 10)));
}

function numericNonNegative(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

function totalFrontendActionDots(actionRatings = {}) {
  if (!actionRatings || typeof actionRatings !== "object") return 0;
  return Object.values(actionRatings).reduce(
    (sum, value) => sum + Math.max(0, Number(value) || 0),
    0,
  );
}

/** Build absolute URL for uploaded media paths (e.g. /media/...) so <img src> works with the API host. */
export function resolveMediaUrl(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === "") return "";
  const s = String(pathOrUrl).trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s) || s.startsWith("blob:") || s.startsWith("data:"))
    return s;
  const base = getApiBaseUrl().replace(/\/api\/?$/i, "");
  if (s.startsWith("/")) return `${base}${s}`;
  return `${base}/${s}`;
}

/** Personal Blades coin boxes (4 booleans); persisted on Character.coin_boxes. */
export function normalizeCoinBoxes(v) {
  const d = [false, false, false, false];
  if (!Array.isArray(v)) return d;
  return d.map((_, i) => Boolean(v[i]));
}

/** Shared crew stash grid (40 booleans); persisted on Crew.stash_slots. */
export function normalizeStashSlots(v) {
  const d = Array(40).fill(false);
  if (!Array.isArray(v)) return d;
  return d.map((_, i) => Boolean(v[i]));
}

/** File input returns File; drag/paste or tests may use Blob — both must multipart-upload. */
export function isImageUploadPayload(v) {
  return (
    v != null &&
    (v instanceof File || (typeof Blob !== "undefined" && v instanceof Blob))
  );
}

function portraitFilenameForUpload(fileOrBlob) {
  if (
    fileOrBlob instanceof File &&
    fileOrBlob.name &&
    String(fileOrBlob.name).trim() !== ""
  ) {
    return fileOrBlob.name;
  }
  const mime = (fileOrBlob && fileOrBlob.type) || "";
  if (mime.includes("png")) return "portrait.png";
  if (mime.includes("gif")) return "portrait.gif";
  if (mime.includes("webp")) return "portrait.webp";
  if (mime.includes("bmp")) return "portrait.bmp";
  if (mime.includes("svg")) return "portrait.svg";
  if (mime.includes("tiff")) return "portrait.tiff";
  if (mime.includes("heic") || mime.includes("heif")) return "portrait.heic";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "portrait.jpg";
  return "portrait.jpg";
}

/**
 * Read response body once. DELETE and some endpoints return 204 / empty body — avoid response.json() on empty.
 */
async function readFetchResponseBody(response) {
  const text = await response.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return { parsed: null };
  }
  try {
    return { parsed: JSON.parse(trimmed) };
  } catch {
    return {
      parsed: null,
      invalidJson: true,
      textPreview: trimmed.slice(0, 200),
    };
  }
}

/** Download a binary export (e.g. PDF) from the API and trigger a browser save. */
async function downloadBinaryExport(endpoint, filename) {
  const token = localStorage.getItem("authToken");
  const base = requireApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Token ${token}`;
  if (url.includes("ngrok")) headers["ngrok-skip-browser-warning"] = "1";

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const { parsed } = await readFetchResponseBody(response);
    const errorData =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    throw new Error(
      getApiErrorMessage(errorData, response.status, response.statusText),
    );
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "export.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

// Helper function for API requests
const apiRequest = async (endpoint, options = {}) => {
  const token = localStorage.getItem("authToken");

  const base = requireApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${path}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Token ${token}` }),
      ...(url.includes("ngrok") && { "ngrok-skip-browser-warning": "1" }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const { parsed, invalidJson, textPreview } =
      await readFetchResponseBody(response);

    if (!response.ok) {
      const errorData =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
      const message = getApiErrorMessage(
        errorData,
        response.status,
        response.statusText,
      );
      throw new Error(message);
    }

    if (invalidJson) {
      throw new Error(
        `Invalid JSON response (${response.status})${textPreview ? `: ${textPreview}` : ""}`,
      );
    }

    return parsed;
  } catch (error) {
    console.error("API request failed:", error);
    throw error;
  }
};

// Character API functions
export const characterAPI = {
  // Get all characters for current user
  getCharacters: ({ mine } = {}) =>
    apiRequest(mine ? "/characters/?mine=true" : "/characters/"),

  // Get character creation guide with rules and options
  getCreationGuide: () => apiRequest("/characters/creation-guide/"),

  // Get single character by ID
  getCharacter: (id) => apiRequest(`/characters/${id}/`),

  createCharacter: (data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart) return apiRequestMultipart("/characters/", body, "POST");
    return apiRequest("/characters/", { method: "POST", body });
  },

  updateCharacter: (id, data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart)
      return apiRequestMultipart(`/characters/${id}/`, body, "PUT");
    return apiRequest(`/characters/${id}/`, { method: "PUT", body });
  },

  // Partial update character (JSON or multipart when imageFile present)
  patchCharacter: (id, data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart)
      return apiRequestMultipart(`/characters/${id}/`, body, "PATCH");
    return apiRequest(`/characters/${id}/`, { method: "PATCH", body });
  },

  // Delete character
  deleteCharacter: (id) =>
    apiRequest(`/characters/${id}/`, {
      method: "DELETE",
    }),

  /**
   * Roll action dice. `actionData` may include `pool_source: "stand_coin"` and
   * `stand_stat` (`power`|`speed`|`precision`|`durability`) so server builds pool
   * from Stand Coin grades; other fields match existing roll-action contract.
   */
  rollAction: (id, actionData) =>
    apiRequest(`/characters/${id}/roll-action/`, {
      method: "POST",
      body: JSON.stringify(actionData),
    }),

  /**
   * Crew Assist: recipient is `recipientCharacterId` (gets pending +1d); helper spends 1 stress.
   */
  assistHelp: (recipientCharacterId, helperCharacterId, sessionId) =>
    apiRequest(`/characters/${recipientCharacterId}/assist-help/`, {
      method: "POST",
      body: JSON.stringify({
        helper_character_id: helperCharacterId,
        session_id: sessionId,
      }),
    }),

  // Add XP to character
  addXP: (id, xpData) =>
    apiRequest(`/characters/${id}/add-xp/`, {
      method: "POST",
      body: JSON.stringify(xpData),
    }),

  allocatePoolXp: (id, body) =>
    apiRequest(`/characters/${id}/allocate-pool-xp/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Move XP from a track back into the free pool (untick). */
  deallocatePoolXp: (id, body) =>
    apiRequest(`/characters/${id}/deallocate-pool-xp/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getXpAllocations: (id, { includeUndone = false } = {}) =>
    apiRequest(
      `/characters/${id}/xp-allocations/${
        includeUndone ? "?include_undone=true" : ""
      }`,
    ),

  applyLevelUp: (id, body) =>
    apiRequest(`/characters/${id}/apply-level-up/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** GM-only: force +1 Stand Coin grade as a playbook advance (tops up XP if short). */
  gmForceStandStat: (id, body) =>
    apiRequest(`/characters/${id}/gm-force-stand-stat/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Claim deferred B→A Stand Coin ability reward (player sheet). */
  claimStandAReward: (id, body) =>
    apiRequest(`/characters/${id}/claim-stand-a-reward/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  applyMinorAdvance: (id, body) =>
    apiRequest(`/characters/${id}/apply-minor-advance/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  unlockSecondPlaybook: (id, body) =>
    apiRequest(`/characters/${id}/unlock-second-playbook/`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  buyHpWithXp: (id, body) =>
    apiRequest(`/characters/${id}/buy-hp-with-xp/`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    }),

  undoLatestAllocation: (id) =>
    apiRequest(`/characters/${id}/undo-latest-allocation/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  redoLatestAllocation: (id) =>
    apiRequest(`/characters/${id}/redo-latest-allocation/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  /** Reset mechanics to a blank sheet. Keeps campaign, name, crew, look, vice, heritage. */
  resetCharacterSheet: (id) =>
    apiRequest(`/characters/${id}/reset-sheet/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getGmUndoStatus: (id) =>
    apiRequest(`/characters/${id}/gm-undo-status/`),

  undoLatestGmChange: (id) =>
    apiRequest(`/characters/${id}/undo-latest-gm-change/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getGmRedoStatus: (id) =>
    apiRequest(`/characters/${id}/gm-redo-status/`),

  redoLatestGmChange: (id) =>
    apiRequest(`/characters/${id}/redo-latest-gm-change/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getSheetUndoStatus: (id) =>
    apiRequest(`/characters/${id}/sheet-undo-status/`),

  undoLatestSheetEdit: (id) =>
    apiRequest(`/characters/${id}/undo-latest-sheet-edit/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  getSheetRedoStatus: (id) =>
    apiRequest(`/characters/${id}/sheet-redo-status/`),

  redoLatestSheetEdit: (id) =>
    apiRequest(`/characters/${id}/redo-latest-sheet-edit/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),

  removeAllocationResult: (id, allocationId) =>
    apiRequest(`/characters/${id}/remove-allocation-result/`, {
      method: "POST",
      body: JSON.stringify({ allocation_id: allocationId }),
    }),

  // Take harm
  takeHarm: (id, harmData) =>
    apiRequest(`/characters/${id}/take-harm/`, {
      method: "POST",
      body: JSON.stringify(harmData),
    }),

  // Heal harm
  healHarm: (id, healData) =>
    apiRequest(`/characters/${id}/heal-harm/`, {
      method: "POST",
      body: JSON.stringify(healData),
    }),

  // Indulge vice
  indulgeVice: (id, viceData) =>
    apiRequest(`/characters/${id}/indulge-vice/`, {
      method: "POST",
      body: JSON.stringify(viceData),
    }),

  // Log armor expenditure
  logArmorExpenditure: (id, armorData) =>
    apiRequest(`/characters/${id}/log-armor-expenditure/`, {
      method: "POST",
      body: JSON.stringify(armorData),
    }),

  exportPdf: async (id, filename) => {
    const safeName =
      filename ||
      `character-${id}-sheet.pdf`.replace(/[^\w.-]+/g, "-").slice(0, 120);
    await downloadBinaryExport(`/characters/${id}/export-pdf/`, safeName);
  },

  // Add progress clock
  addProgressClock: (id, clockData) =>
    apiRequest(`/characters/${id}/add-progress-clock/`, {
      method: "POST",
      body: JSON.stringify(clockData),
    }),

  // Update progress clock
  updateProgressClock: (id, clockData) =>
    apiRequest(`/characters/${id}/update-progress-clock/`, {
      method: "POST",
      body: JSON.stringify(clockData),
    }),
};

/** Unwrap list responses: plain array or paginated `{ results: [...] }`. */
export function normalizeListResponse(data) {
  if (data == null) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === "object" && Array.isArray(data.results))
    return data.results;
  return [];
}

// Reference data API functions
export const referenceAPI = {
  // Get all heritages
  getHeritages: () => apiRequest("/heritages/"),

  // Get all vices
  getVices: () => apiRequest("/vices/"),

  // Get all abilities
  getAbilities: () => apiRequest("/abilities/"),

  // Get all hamon abilities
  getHamonAbilities: () => apiRequest("/hamon-abilities/"),

  // Get all spin abilities
  getSpinAbilities: () => apiRequest("/spin-abilities/"),

  // Get all trauma conditions
  getTraumas: () => apiRequest("/traumas/"),

  // Get available playbook abilities
  getAvailablePlaybookAbilities: (playbook, coinStats) =>
    apiRequest("/get-available-playbook-abilities/", {
      method: "POST",
      body: JSON.stringify({ playbook, coin_stats: coinStats }),
    }),
};

// Campaign API functions
export const campaignAPI = {
  getCampaigns: () => apiRequest("/campaigns/"),
  getCampaign: (id) => apiRequest(`/campaigns/${id}/`),
  createCampaign: (campaignData) =>
    apiRequest("/campaigns/", {
      method: "POST",
      body: JSON.stringify(campaignData),
    }),
  updateCampaign: (id, campaignData) =>
    apiRequest(`/campaigns/${id}/`, {
      method: "PUT",
      body: JSON.stringify(campaignData),
    }),
  patchCampaign: (id, campaignData) =>
    apiRequest(`/campaigns/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(campaignData),
    }),
  /** Campaign members: rules-triggered wanted (e.g. vice brag +2); GM-only PATCH unchanged. */
  incrementCampaignWanted: (campaignId, { amount = 2, cap = 5 } = {}) =>
    apiRequest(`/campaigns/${campaignId}/increment-wanted/`, {
      method: "POST",
      body: JSON.stringify({ amount, cap }),
    }),
  deleteCampaign: (id) =>
    apiRequest(`/campaigns/${id}/`, { method: "DELETE" }),
  invitePlayer: (id, username) =>
    apiRequest(`/campaigns/${id}/invite/`, {
      method: "POST",
      body: JSON.stringify({ username }),
    }),
  withdrawInvitation: (campaignId, invitationId) =>
    apiRequest(`/campaigns/${campaignId}/withdraw-invitation/`, {
      method: "POST",
      body: JSON.stringify({ invitation_id: invitationId }),
    }),
  removePlayer: (campaignId, userId) =>
    apiRequest(`/campaigns/${campaignId}/remove-player/`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  getInvitableUsers: (campaignId, search) =>
    apiRequest(
      search
        ? `/campaigns/${campaignId}/invitable-users/?search=${encodeURIComponent(search)}`
        : `/campaigns/${campaignId}/invitable-users/`,
    ),
  deactivateCampaign: (id) =>
    apiRequest(`/campaigns/${id}/deactivate/`, { method: "POST" }),
  activateCampaign: (id) =>
    apiRequest(`/campaigns/${id}/activate/`, { method: "POST" }),
  assignCharacter: (id, characterId) =>
    apiRequest(`/campaigns/${id}/assign-character/`, {
      method: "POST",
      body: JSON.stringify({ character_id: characterId }),
    }),
  unassignCharacter: (id, characterId) =>
    apiRequest(`/campaigns/${id}/unassign-character/`, {
      method: "POST",
      body: JSON.stringify({ character_id: characterId }),
    }),
  getInvitations: () => apiRequest("/campaign-invitations/"),
  acceptInvitation: (id) =>
    apiRequest(`/campaign-invitations/${id}/accept/`, { method: "POST" }),
  declineInvitation: (id) =>
    apiRequest(`/campaign-invitations/${id}/decline/`, { method: "POST" }),
  showcaseNpc: (campaignId, npcId) =>
    apiRequest(`/campaigns/${campaignId}/showcase-npc/`, {
      method: "POST",
      body: JSON.stringify({ npc_id: npcId }),
    }),
  patchShowcasedNpc: (id, data) =>
    apiRequest(`/showcased-npcs/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteShowcasedNpc: (id) =>
    apiRequest(`/showcased-npcs/${id}/`, { method: "DELETE" }),
};

// Faction API functions (factions are per-campaign, created by GM)
export const factionAPI = {
  getFactions: (campaignId) =>
    campaignId
      ? apiRequest(`/factions/?campaign=${campaignId}`)
      : apiRequest("/factions/"),
  getFaction: (id) => apiRequest(`/factions/${id}/`),
  createFaction: (data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart) return apiRequestMultipart("/factions/", body, "POST");
    return apiRequest("/factions/", {
      method: "POST",
      body,
    });
  },
  updateFaction: (id, data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart) return apiRequestMultipart(`/factions/${id}/`, body, "PUT");
    return apiRequest(`/factions/${id}/`, {
      method: "PUT",
      body,
    });
  },
  patchFaction: (id, data) =>
    apiRequest(`/factions/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteFaction: (id) => apiRequest(`/factions/${id}/`, { method: "DELETE" }),
};

// Crew API functions
export const crewAPI = {
  // Get all crews
  getCrews: () => apiRequest("/crews/"),

  // Get single crew
  getCrew: (id) => apiRequest(`/crews/${id}/`),

  // Create crew
  createCrew: (crewData) =>
    apiRequest("/crews/", {
      method: "POST",
      body: JSON.stringify(crewData),
    }),

  // Update crew
  updateCrew: (id, crewData) =>
    apiRequest(`/crews/${id}/`, {
      method: "PUT",
      body: JSON.stringify(crewData),
    }),
  // Partial update crew (e.g. coin only)
  patchCrew: (id, crewData) =>
    apiRequest(`/crews/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(crewData),
    }),

  // Delete crew
  deleteCrew: (id) => apiRequest(`/crews/${id}/`, { method: "DELETE" }),

  // Get crews for a specific campaign
  getCrewsByCampaign: (campaignId) =>
    apiRequest(`/crews/?campaign=${campaignId}`),

  // Propose a new crew name (consensus flow)
  proposeName: (id, newName) =>
    apiRequest(`/crews/${id}/propose-name/`, {
      method: "POST",
      body: JSON.stringify({ new_name: newName }),
    }),

  // Approve a proposed crew name
  approveName: (id) =>
    apiRequest(`/crews/${id}/approve-name/`, { method: "POST" }),
};

/** Crew sheet change history (scalar field diffs); ?crew=<id> */
export const crewHistoryAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v != null && v !== ""),
    ).toString();
    return apiRequest(`/crew-history/${qs ? `?${qs}` : ""}`);
  },
};

// Multipart request helper (for file uploads)
const apiRequestMultipart = async (endpoint, formData, method = "POST") => {
  const token = localStorage.getItem("authToken");
  const base = requireApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${base}${path}`;
  const headers = {};
  if (token) headers["Authorization"] = `Token ${token}`;
  if (url.includes("ngrok")) headers["ngrok-skip-browser-warning"] = "1";
  const response = await fetch(url, { method, headers, body: formData });
  const { parsed, invalidJson, textPreview } =
    await readFetchResponseBody(response);
  if (!response.ok) {
    const errorData =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed
        : {};
    const message = getApiErrorMessage(
      errorData,
      response.status,
      response.statusText,
    );
    throw new Error(message);
  }
  if (invalidJson) {
    throw new Error(
      `Invalid JSON response (${response.status})${textPreview ? `: ${textPreview}` : ""}`,
    );
  }
  return parsed;
};

/** Used by character/NPC multipart saves; exported for unit tests. */
export function buildMultipartOrJson(data) {
  const file = data?.imageFile;
  const hasFile =
    file != null &&
    (file instanceof File ||
      (typeof Blob !== "undefined" && file instanceof Blob));
  if (hasFile) {
    const fd = new FormData();
    fd.append("image", file, portraitFilenameForUpload(file));
    for (const [k, v] of Object.entries(data)) {
      if (k === "imageFile" || k === "image") continue;
      if (v == null) continue;
      if (
        typeof v === "object" &&
        v !== null &&
        !(v instanceof File) &&
        !(v instanceof Blob)
      ) {
        fd.append(k, JSON.stringify(v));
      } else {
        fd.append(k, v);
      }
    }
    return { multipart: true, body: fd };
  }
  const dataObj = data || {};
  const { imageFile: _if, image, ...rest } = dataObj;
  const jsonPayload = { ...rest };
  if (
    Object.prototype.hasOwnProperty.call(dataObj, "image") &&
    image === null
  ) {
    jsonPayload.image = null;
  }
  return { multipart: false, body: JSON.stringify(jsonPayload) };
}

// NPC API functions (GM / campaign NPCs)
export const npcAPI = {
  getNPCs: (campaignId, { mine } = {}) => {
    const params = new URLSearchParams();
    if (campaignId) params.set("campaign", campaignId);
    if (mine) params.set("mine", "true");
    const query = params.toString();
    return apiRequest(query ? `/npcs/?${query}` : "/npcs/");
  },
  getNPC: (id) => apiRequest(`/npcs/${id}/`),
  createNPC: (data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart) return apiRequestMultipart("/npcs/", body, "POST");
    return apiRequest("/npcs/", { method: "POST", body });
  },
  updateNPC: (id, data) => {
    const { multipart, body } = buildMultipartOrJson(data);
    if (multipart) return apiRequestMultipart(`/npcs/${id}/`, body, "PUT");
    return apiRequest(`/npcs/${id}/`, { method: "PUT", body });
  },
  patchNPC: (id, data) =>
    apiRequest(`/npcs/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteNPC: (id) => apiRequest(`/npcs/${id}/`, { method: "DELETE" }),
  exportPdf: async (id, filename) => {
    const safeName =
      filename || `npc-${id}-sheet.pdf`.replace(/[^\w.-]+/g, "-").slice(0, 120);
    await downloadBinaryExport(`/npcs/${id}/export-pdf/`, safeName);
  },
};

// Session API functions
export const sessionAPI = {
  // Get sessions for campaign
  getSessions: (campaignId) => apiRequest(`/sessions/?campaign=${campaignId}`),

  // Get single session
  getSession: (id) => apiRequest(`/sessions/${id}/`),

  // Create session
  createSession: (sessionData) =>
    apiRequest("/sessions/", {
      method: "POST",
      body: JSON.stringify(sessionData),
    }),

  // Update session
  updateSession: (id, sessionData) =>
    apiRequest(`/sessions/${id}/`, {
      method: "PUT",
      body: JSON.stringify(sessionData),
    }),
  patchSession: (id, sessionData) =>
    apiRequest(`/sessions/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(sessionData),
    }),

  deleteSession: (id) =>
    apiRequest(`/sessions/${id}/`, { method: "DELETE" }),
};

// Progress clock API (GM clocks for campaigns/sessions)
export const progressClockAPI = {
  getProgressClocks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/progress-clocks/${qs ? "?" + qs : ""}`);
  },
  createProgressClock: (data) =>
    apiRequest("/progress-clocks/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateProgressClock: (id, data) =>
    apiRequest(`/progress-clocks/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteProgressClock: (id) =>
    apiRequest(`/progress-clocks/${id}/`, {
      method: "DELETE",
    }),
};

// Roll API (dice history; GM can PATCH position/effect, grant XP)
export const rollAPI = {
  getRolls: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/rolls/${qs ? "?" + qs : ""}`);
  },
  getRoll: (id) => apiRequest(`/rolls/${id}/`),
  createRoll: (data) =>
    apiRequest("/rolls/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  patchRoll: (id, data) =>
    apiRequest(`/rolls/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deleteRoll: (id) =>
    apiRequest(`/rolls/${id}/`, {
      method: "DELETE",
    }),
  grantXP: (id) =>
    apiRequest(`/rolls/${id}/grant-xp/`, {
      method: "POST",
    }),
};

export const experienceTrackerAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/experience-tracker/${qs ? "?" + qs : ""}`);
  },
  // Toggle +1 XP for an end-of-session trigger; SRD-capped at 2 / trigger / session.
  // Requires an active session on the character's campaign.
  award: ({ character, trigger }) =>
    apiRequest("/experience-tracker/award/", {
      method: "POST",
      body: JSON.stringify({ character, trigger }),
    }),
  // Untoggle (delete latest toggled trigger entry) and roll back playbook XP.
  revoke: ({ character, trigger }) =>
    apiRequest("/experience-tracker/revoke/", {
      method: "POST",
      body: JSON.stringify({ character, trigger }),
    }),
  // Delete a specific XP entry by id; rolls back the entry's clock_key track
  // (or unallocated_xp pool, for end-of-session pool rows).
  remove: (id) =>
    apiRequest(`/experience-tracker/${id}/`, { method: "DELETE" }),
};

export const xpHistoryAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/xp-history/${qs ? "?" + qs : ""}`);
  },
};

export const characterHistoryAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/character-history/${qs ? "?" + qs : ""}`);
  },
  undo: (id) =>
    apiRequest(`/character-history/${id}/undo/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

export const gmHistoryAPI = {
  listCampaign: (campaignId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/campaigns/${campaignId}/gm-history/${qs ? "?" + qs : ""}`);
  },
};

export const groupActionAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/group-actions/${qs ? "?" + qs : ""}`);
  },
  create: (data) =>
    apiRequest("/group-actions/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resolve: (id) =>
    apiRequest(`/group-actions/${id}/resolve/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  cancel: (id) =>
    apiRequest(`/group-actions/${id}/cancel/`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
};

// Global search
export const searchAPI = {
  globalSearch: (query) =>
    apiRequest(`/search/?q=${encodeURIComponent(query)}`),
};

/** Site-wide aggregates (all PCs / rolls); authenticated only. */
export const siteStatsAPI = {
  getSiteStats: () => apiRequest("/site-stats/"),
};

// Authentication API functions
export const authAPI = {
  // Login
  login: (credentials) =>
    apiRequest("/login/", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  // Register
  register: (userData) =>
    apiRequest("/register/", {
      method: "POST",
      body: JSON.stringify(userData),
    }),

  // Logout (clear token)
  logout: () => {
    localStorage.removeItem("authToken");
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("authToken");
  },
};

// --- Harm (full slot coverage: L1/L2 ×2, L3, L4 + slot2 fields on backend) ---
function harmSlotFromBackend(used, name) {
  if (!used) return "";
  return name == null ? "" : String(name);
}

function harmSlotToBackend(text) {
  const t = String(text ?? "").trim();
  return { used: t !== "", name: t };
}

const EMPTY_HARM_SHAPE = {
  level4: [""],
  level3: [""],
  level2: ["", ""],
  level1: ["", ""],
};

/** @param {Record<string,unknown>|undefined} fe */
function pickHarmArrays(fe) {
  const src = fe.harm != null ? fe.harm : fe.harmEntries || {};
  const l1 = Array.isArray(src.level1) ? src.level1 : ["", ""];
  const l2 = Array.isArray(src.level2) ? src.level2 : ["", ""];
  const l3 = Array.isArray(src.level3) ? src.level3 : [""];
  const l4 = Array.isArray(src.level4) ? src.level4 : [""];
  return {
    level1: [l1[0] ?? "", l1[1] ?? ""],
    level2: [l2[0] ?? "", l2[1] ?? ""],
    level3: [l3[0] ?? ""],
    level4: [l4[0] ?? ""],
  };
}

/** Stable full harm object for spread merges / UI defaults. */
export function normalizeHarmObject(h) {
  const p = pickHarmArrays({ harm: h, harmEntries: h });
  return {
    level4: [...p.level4],
    level3: [...p.level3],
    level2: [...p.level2],
    level1: [...p.level1],
  };
}

export { EMPTY_HARM_SHAPE };

/** PC sheet progress clocks: unify `segments`/`filled` with API `max_segments`/`filled_segments`. */
function normalizeProgressClocksFromBackend(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => normalizeSheetProgressClock(c)).filter(Boolean);
}

// Data transformation helpers
export const transformBackendToFrontend = (backendCharacter) => {
  return {
    id: backendCharacter.id,
    user_id: backendCharacter.user ?? null,
    creator_username: backendCharacter.creator_username || "",
    name: backendCharacter.true_name || "",
    standName: backendCharacter.stand_name || "",
    heritage: backendCharacter.heritage ?? null,
    heritageName: backendCharacter.heritage_details?.name || null,
    background: backendCharacter.background_note || "",
    sheetNotes: backendCharacter.background_note2 ?? "",
    look: backendCharacter.appearance || "",
    // DRF returns vice as FK id (number); nested name is on vice_info (see CharacterSerializer)
    vice: backendCharacter.vice_info?.name || backendCharacter.vice?.name || "",
    viceDetails: backendCharacter.vice_details || "",
    crew:
      backendCharacter.crew?.name || backendCharacter.personal_crew_name || "",
    crewId: backendCharacter.crew?.id ?? null,
    personal_crew_name: backendCharacter.personal_crew_name || "",
    image_url: backendCharacter.image_url || "",
    image: resolveMediaUrl(
      backendCharacter.image || backendCharacter.image_url || "",
    ),

    // Action ratings (convert from action_dots)
    actionRatings: {
      HUNT: backendCharacter.action_dots?.hunt || 0,
      STUDY: backendCharacter.action_dots?.study || 0,
      SURVEY: backendCharacter.action_dots?.survey || 0,
      TINKER: backendCharacter.action_dots?.tinker || 0,
      FINESSE: backendCharacter.action_dots?.finesse || 0,
      PROWL: backendCharacter.action_dots?.prowl || 0,
      SKIRMISH: backendCharacter.action_dots?.skirmish || 0,
      WRECK: backendCharacter.action_dots?.wreck || 0,
      // BitD ATTUNE key in DB; roll_action resolves bizarre↔attune (roll_helpers.action_rating_from_action_dots)
      BIZARRE: backendCharacter.action_dots?.attune || 0,
      COMMAND: backendCharacter.action_dots?.command || 0,
      CONSORT: backendCharacter.action_dots?.consort || 0,
      SWAY: backendCharacter.action_dots?.sway || 0,
    },

    // Stand stats: backend uses grade letters (F–A/S), frontend uses index 0–4
    standStats: {
      power: gradeToIndex(backendCharacter.stand?.power),
      speed: gradeToIndex(backendCharacter.stand?.speed),
      range: gradeToIndex(backendCharacter.stand?.range),
      durability: gradeToIndex(backendCharacter.stand?.durability),
      precision: gradeToIndex(backendCharacter.stand?.precision),
      development: gradeToIndex(backendCharacter.stand?.development),
    },
    standType: String(backendCharacter.stand?.type || "").trim(),
    standTypeCustom: String(backendCharacter.stand?.type_custom || "").trim(),
    standForms: (() => {
      const raw = backendCharacter.stand?.forms;
      if (Array.isArray(raw) && raw.length) {
        return raw.map((x) => String(x || "").trim()).filter(Boolean);
      }
      const legacy = String(backendCharacter.stand?.form || "").trim();
      return legacy ? [legacy] : [];
    })(),
    standConsciousness: String(
      backendCharacter.stand?.consciousness_level || "",
    )
      .trim()
      .toUpperCase()
      .slice(0, 1),

    // Stress: backend integer; frontend uses filled count + array for compatibility
    stressFilled: Math.max(0, backendCharacter.stress ?? 0),
    stress: (() => {
      const maxStress = 9;
      const filled = Math.min(backendCharacter.stress ?? 0, maxStress);
      return Array(maxStress)
        .fill(false)
        .map((_, i) => i < filled);
    })(),
    // Trauma: prefer trauma_details; also merge raw `trauma` ID list when details are empty/out of sync
    // (legacy DB values like string names made id__in match nothing; save+refetch then cleared the UI).
    trauma: (() => {
      const base = { ...DEFAULT_TRAUMA };
      const details = backendCharacter.trauma_details || [];
      for (const t of details) {
        const k = (t.name || "").toUpperCase();
        if (Object.prototype.hasOwnProperty.call(base, k)) base[k] = true;
      }
      const raw = backendCharacter.trauma;
      if (Array.isArray(raw)) {
        for (const item of raw) {
          let n = null;
          if (typeof item === "number" && Number.isInteger(item) && item > 0) {
            n = item;
          } else if (typeof item === "string") {
            const s = item.trim();
            if (/^\d+$/.test(s)) n = parseInt(s, 10);
          }
          if (n == null) continue;
          const key = TRAUMA_PK_TO_KEY[n];
          if (key) base[key] = true;
        }
      }
      return base;
    })(),

    // Armor (SRD_DEV: stand path vs physical gear; legacy light/heavy unused)
    standArmorUsed: Math.max(
      0,
      Math.floor(Number(backendCharacter.stand_armor_used) || 0),
    ),
    hasPhysicalArmorItem: !!backendCharacter.has_physical_armor_item,
    physicalArmorBonusCharges: Math.min(
      6,
      Math.max(0, Math.floor(Number(backendCharacter.physical_armor_bonus_charges) || 0)),
    ),
    physicalArmorUsed: Math.min(
      6,
      Math.max(0, Math.floor(Number(backendCharacter.physical_armor_used) || 0)),
    ),
    spinArmorUsed: Math.min(
      3,
      Math.max(0, Math.floor(Number(backendCharacter.spin_armor_used) || 0)),
    ),
    hamonArmorUsed: Math.min(
      3,
      Math.max(0, Math.floor(Number(backendCharacter.hamon_armor_used) || 0)),
    ),
    armor: {
      armor: false,
      heavy: false,
      special: false,
    },

    // Harm: backend has two boxes for L1/L2 + L3 severe + L4 fatal; frontend uses arrays
    harm: {
      level4: [
        harmSlotFromBackend(
          backendCharacter.harm_level4_used,
          backendCharacter.harm_level4_name,
        ),
      ],
      level3: [
        harmSlotFromBackend(
          backendCharacter.harm_level3_used,
          backendCharacter.harm_level3_name,
        ),
      ],
      level2: [
        harmSlotFromBackend(
          backendCharacter.harm_level2_used,
          backendCharacter.harm_level2_name,
        ),
        harmSlotFromBackend(
          backendCharacter.harm_level2_slot2_used,
          backendCharacter.harm_level2_slot2_name,
        ),
      ],
      level1: [
        harmSlotFromBackend(
          backendCharacter.harm_level1_used,
          backendCharacter.harm_level1_name,
        ),
        harmSlotFromBackend(
          backendCharacter.harm_level1_slot2_used,
          backendCharacter.harm_level1_slot2_name,
        ),
      ],
    },
    harmEntries: {
      level4: [
        harmSlotFromBackend(
          backendCharacter.harm_level4_used,
          backendCharacter.harm_level4_name,
        ),
      ],
      level3: [
        harmSlotFromBackend(
          backendCharacter.harm_level3_used,
          backendCharacter.harm_level3_name,
        ),
      ],
      level2: [
        harmSlotFromBackend(
          backendCharacter.harm_level2_used,
          backendCharacter.harm_level2_name,
        ),
        harmSlotFromBackend(
          backendCharacter.harm_level2_slot2_used,
          backendCharacter.harm_level2_slot2_name,
        ),
      ],
      level1: [
        harmSlotFromBackend(
          backendCharacter.harm_level1_used,
          backendCharacter.harm_level1_name,
        ),
        harmSlotFromBackend(
          backendCharacter.harm_level1_slot2_used,
          backendCharacter.harm_level1_slot2_name,
        ),
      ],
    },

    // Coin (character); stash on crew when linked, else personal Character.stash_slots
    coin: normalizeCoinBoxes(backendCharacter.coin_boxes),
    stash: normalizeStashSlots(
      Array.isArray(backendCharacter.crew?.stash_slots)
        ? backendCharacter.crew.stash_slots
        : backendCharacter.stash_slots,
    ),

    // Healing clock
    healingClock: backendCharacter.healing_clock_filled || 0,
    healingClockSegments: Math.min(
      5,
      Math.max(
        4,
        Math.floor(Number(backendCharacter.healing_clock_segments) || 4),
      ),
    ),

    // XP tracks
    xp: backendCharacter.xp_clocks || {
      insight: 0,
      prowess: 0,
      resolve: 0,
      heritage: 0,
      playbook: 0,
    },
    unallocatedXp: Math.max(
      0,
      Math.floor(Number(backendCharacter.unallocated_xp) || 0),
    ),

    // Abilities (standard + hamon + spin + custom from custom_ability fields)
    abilities: [
      ...(backendCharacter.standard_ability_details || []).map((a) => ({
        ...a,
        type: a.type || "standard",
      })),
      ...(backendCharacter.hamon_ability_details || []).map((a) => ({
        ...a,
        type: "hamon",
      })),
      ...(backendCharacter.spin_ability_details || []).map((a) => ({
        ...a,
        type: "spin",
      })),
      ...(function () {
        const type =
          backendCharacter.custom_ability_type || "single_with_3_uses";
        const desc = backendCharacter.custom_ability_description || "";
        const extra = backendCharacter.extra_custom_abilities || [];
        if (type === "three_separate_uses" && extra.length > 0) {
          return extra.map((a, i) => ({
            id: `custom-${i}`,
            name: a.name || `Custom ${i + 1}`,
            description: a.description,
            type: "custom",
          }));
        }
        if (type === "single_with_2_uses" && (desc || extra.length > 0)) {
          const name =
            (desc || extra[0]?.name || "Custom Ability").trim() ||
            "Custom Ability";
          const uses =
            extra.length >= 2
              ? extra.map((u) => u.description || u)
              : desc
                ? [desc, ""]
                : ["", ""];
          return [
            {
              id: "custom-single-2",
              name,
              type: "custom",
              _uses: uses.slice(0, 2),
              _description: desc,
            },
          ];
        }
        if (type === "single_with_3_uses" && (desc || extra.length > 0)) {
          const name =
            (desc || extra[0]?.name || "Custom Ability").trim() ||
            "Custom Ability";
          let uses;
          if (extra.length >= 3) {
            uses = extra.map((u) => u.description || u);
          } else if (extra.length > 0) {
            uses = extra.map((u) => u.description || u);
            while (uses.length < 3) uses.push("");
          } else {
            // Pad so FE→BE round-trip keeps custom-single (_uses.length >= 3)
            uses = [desc, "", ""];
          }
          return [
            {
              id: "custom-single",
              name,
              type: "custom",
              _uses: uses.slice(0, 3),
              _description: desc,
            },
          ];
        }
        return [];
      })(),
      ...(backendCharacter.advancement_ability_grants || []).map((g, i) => {
        const uses = Array.isArray(g.uses) ? g.uses : [];
        return {
          id: `advancement-${g.allocation_id ?? i}`,
          name: g.name || `Advancement Ability ${i + 1}`,
          type: "custom",
          _uses: uses.slice(0, 2),
          _fromAdvancement: true,
          _allocationId: g.allocation_id,
        };
      }),
    ],

    // Progress clocks
    clocks: normalizeProgressClocksFromBackend(backendCharacter.progress_clocks),

    gm_can_have_s_rank_stand_stats: Boolean(
      backendCharacter.gm_can_have_s_rank_stand_stats,
    ),

    pendingStandAReward: backendCharacter.pending_stand_a_reward || null,

    // Additional backend fields
    campaign: backendCharacter.campaign,
    playbook: playbookToDisplay(backendCharacter.playbook),
    secondaryPlaybook: backendCharacter.secondary_playbook
      ? playbookToDisplay(backendCharacter.secondary_playbook)
      : "",
    secondaryPlaybookUnlocked: Boolean(
      backendCharacter.secondary_playbook_unlocked ||
        backendCharacter.secondary_playbook,
    ),
    playbookXpArchetypes: Array.isArray(backendCharacter.playbook_xp_archetypes)
      ? [...backendCharacter.playbook_xp_archetypes]
      : [],
    level: backendCharacter.level,
    loadout: backendCharacter.loadout,
    inventory: normalizeCharacterInventory(backendCharacter.inventory),
    reputation_status: backendCharacter.reputation_status || {},

    // Heritage benefits and detriments (arrays of IDs)
    selected_benefits: Array.isArray(backendCharacter.selected_benefits)
      ? backendCharacter.selected_benefits
      : [],
    selected_detriments: Array.isArray(backendCharacter.selected_detriments)
      ? backendCharacter.selected_detriments
      : [],
    fed_today:
      typeof backendCharacter.fed_today === "boolean"
        ? backendCharacter.fed_today
        : null,
    disguised_as_human:
      typeof backendCharacter.disguised_as_human === "boolean"
        ? backendCharacter.disguised_as_human
        : null,

    /** +1 Stand Coin ranks bought with XP beyond chargen (10 XP each on backend); chargen baseline is excluded. */
    standCoinPointsGained: Math.max(
      0,
      Number(backendCharacter.stand_coin_points_gained) || 0,
    ),
    /** +1 action dots bought with XP beyond chargen (5 XP each on backend); chargen baseline is excluded. */
    actionDiceGained: numericNonNegative(
      backendCharacter.action_dice_gained,
      backendCharacter.actionDiceGained,
    ),
  };
};

export const transformFrontendToBackend = (frontendCharacter) => {
  const viceVal = frontendCharacter.vice;
  const isViceName = typeof viceVal === "string" && viceVal.trim() !== "";
  const vicePayload = isViceName
    ? { custom_vice: viceVal }
    : { vice: viceVal === "" || viceVal == null ? null : viceVal };
  const abilitiesList = frontendCharacter.abilities || [];
  const heritageOut = (() => {
    const h = frontendCharacter.heritage;
    if (h == null || h === "") return null;
    if (typeof h === "number" && Number.isFinite(h)) return h;
    if (typeof h === "string") {
      const t = h.trim();
      if (!t) return null;
      if (/^\d+$/.test(t)) return parseInt(t, 10);
    }
    return null;
  })();

  const actionDiceGained = Math.max(
    numericNonNegative(
      frontendCharacter.actionDiceGained,
      frontendCharacter.action_dice_gained,
    ),
    Math.max(
      0,
      totalFrontendActionDots(frontendCharacter.actionRatings) -
        MAX_CREATION_DOTS,
    ),
  );

  return {
    true_name: frontendCharacter.name,
    stand_name: frontendCharacter.standName,
    heritage: heritageOut,
    playbook: playbookToBackend(frontendCharacter.playbook),
    secondary_playbook: secondaryPlaybookToBackend(
      frontendCharacter.secondaryPlaybook,
    ),
    playbook_xp_archetypes: Array.isArray(frontendCharacter.playbookXpArchetypes)
      ? frontendCharacter.playbookXpArchetypes.map((x) =>
          String(x || "")
            .trim()
            .toUpperCase(),
        )
      : [],
    background_note: frontendCharacter.background,
    background_note2: String(frontendCharacter.sheetNotes ?? ""),
    appearance: frontendCharacter.look,
    ...vicePayload,
    vice_details:
      frontendCharacter.viceDetails ?? frontendCharacter.vice_details ?? "",
    image_url: frontendCharacter.image_url ?? "",
    ...(frontendCharacter.image === null ? { image: null } : {}),

    // Action dots
    action_dots: {
      hunt: frontendCharacter.actionRatings.HUNT,
      study: frontendCharacter.actionRatings.STUDY,
      survey: frontendCharacter.actionRatings.SURVEY,
      tinker: frontendCharacter.actionRatings.TINKER,
      finesse: frontendCharacter.actionRatings.FINESSE,
      prowl: frontendCharacter.actionRatings.PROWL,
      skirmish: frontendCharacter.actionRatings.SKIRMISH,
      wreck: frontendCharacter.actionRatings.WRECK,
      attune: frontendCharacter.actionRatings.BIZARRE, // Note: backend uses 'attune'
      command: frontendCharacter.actionRatings.COMMAND,
      consort: frontendCharacter.actionRatings.CONSORT,
      sway: frontendCharacter.actionRatings.SWAY,
    },
    action_dice_gained: actionDiceGained,

    // Stand: backend may use coin_stats (JSON) and/or nested stand; send grade letters (F–A)
    coin_stats: {
      power: indexToGrade(frontendCharacter.standStats?.power),
      speed: indexToGrade(frontendCharacter.standStats?.speed),
      range: indexToGrade(frontendCharacter.standStats?.range),
      durability: indexToGrade(frontendCharacter.standStats?.durability),
      precision: indexToGrade(frontendCharacter.standStats?.precision),
      development: indexToGrade(frontendCharacter.standStats?.development),
    },
    stand: {
      name: frontendCharacter.standName,
      power: indexToGrade(frontendCharacter.standStats?.power),
      speed: indexToGrade(frontendCharacter.standStats?.speed),
      range: indexToGrade(frontendCharacter.standStats?.range),
      durability: indexToGrade(frontendCharacter.standStats?.durability),
      precision: indexToGrade(frontendCharacter.standStats?.precision),
      development: indexToGrade(frontendCharacter.standStats?.development),
      ...(String(frontendCharacter.standType || "").trim()
        ? {
            type: String(frontendCharacter.standType).trim().toUpperCase(),
          }
        : {}),
      forms: Array.isArray(frontendCharacter.standForms)
        ? frontendCharacter.standForms
            .map((x) => String(x || "").trim())
            .filter(Boolean)
        : [],
      ...(String(frontendCharacter.standForms?.[0] || "").trim()
        ? { form: String(frontendCharacter.standForms[0]).trim() }
        : {}),
      ...(String(frontendCharacter.standConsciousness || "")
        .trim()
        .toUpperCase()
        .match(/^[A-F]$/)
        ? {
            consciousness_level: String(frontendCharacter.standConsciousness)
              .trim()
              .toUpperCase()
              .slice(0, 1),
          }
        : {}),
      type_custom: String(frontendCharacter.standTypeCustom || "").trim(),
    },

    // Stress: backend integer; accept stressFilled or array length
    stress:
      typeof frontendCharacter.stressFilled === "number"
        ? frontendCharacter.stressFilled
        : Array.isArray(frontendCharacter.stress)
          ? frontendCharacter.stress.filter(Boolean).length
          : frontendCharacter.stress || 0,
    // Trauma: backend expects list of Trauma IDs (caller should resolve object keys to IDs via reference)
    trauma: Array.isArray(frontendCharacter.trauma)
      ? frontendCharacter.trauma
      : [],

    // Armor (SRD_DEV)
    stand_armor_used: (() => {
      const durIdx = Math.min(
        5,
        Math.max(
          0,
          Math.floor(Number(frontendCharacter.standStats?.durability) || 0),
        ),
      );
      const cap = standPathArmorMaxFromDurabilityIndex(durIdx);
      return Math.min(
        cap,
        Math.max(0, Math.floor(Number(frontendCharacter.standArmorUsed) || 0)),
      );
    })(),
    has_physical_armor_item: !!frontendCharacter.hasPhysicalArmorItem,
    physical_armor_bonus_charges: Math.min(
      6,
      Math.max(
        0,
        Math.floor(Number(frontendCharacter.physicalArmorBonusCharges) || 0),
      ),
    ),
    physical_armor_used: (() => {
      const has = !!frontendCharacter.hasPhysicalArmorItem;
      const pool = has
        ? Math.min(
            6,
            Math.max(
              0,
              Math.floor(Number(frontendCharacter.physicalArmorBonusCharges) || 0),
            ),
          )
        : 0;
      return Math.min(
        pool,
        Math.max(0, Math.floor(Number(frontendCharacter.physicalArmorUsed) || 0)),
      );
    })(),
    light_armor_used: false,
    heavy_armor_used: false,
    healing_clock_filled: Math.max(
      0,
      Math.floor(Number(frontendCharacter.healingClock) || 0),
    ),
    healing_clock_segments: Math.min(
      5,
      Math.max(
        4,
        Math.floor(Number(frontendCharacter.healingClockSegments) || 4),
      ),
    ),
    spin_armor_used: Math.min(
      3,
      Math.max(0, Math.floor(Number(frontendCharacter.spinArmorUsed) || 0)),
    ),
    hamon_armor_used: Math.min(
      3,
      Math.max(0, Math.floor(Number(frontendCharacter.hamonArmorUsed) || 0)),
    ),

    // Harm — full L1/L2 two-slot + L3 + L4; `used` follows trimmed non-empty text
    ...(() => {
      const H = pickHarmArrays(frontendCharacter);
      const s1a = harmSlotToBackend(H.level1[0]);
      const s1b = harmSlotToBackend(H.level1[1]);
      const s2a = harmSlotToBackend(H.level2[0]);
      const s2b = harmSlotToBackend(H.level2[1]);
      const s3 = harmSlotToBackend(H.level3[0]);
      const s4 = harmSlotToBackend(H.level4[0]);
      return {
        harm_level1_used: s1a.used,
        harm_level1_name: s1a.name,
        harm_level1_slot2_used: s1b.used,
        harm_level1_slot2_name: s1b.name,
        harm_level2_used: s2a.used,
        harm_level2_name: s2a.name,
        harm_level2_slot2_used: s2b.used,
        harm_level2_slot2_name: s2b.name,
        harm_level3_used: s3.used,
        harm_level3_name: s3.name,
        harm_level4_used: s4.used,
        harm_level4_name: s4.name,
      };
    })(),

    // XP clocks + free pool: owned by allocate/deallocate/add-xp APIs only.
    // Never round-trip via sheet autosave PUT — stale local clocks were wiping
    // server tracks (and dropping XP that never returned to the free pool).

    // Progress clocks (segments + max_segments; drop Date.now() temp ids)
    progress_clocks: serializeSheetProgressClocks(frontendCharacter.clocks),

    // Additional fields (safe defaults for new character)
    campaign:
      frontendCharacter.campaign != null
        ? typeof frontendCharacter.campaign === "object"
          ? frontendCharacter.campaign?.id
          : frontendCharacter.campaign
        : null,
    inventory: Array.isArray(frontendCharacter.inventory)
      ? frontendCharacter.inventory
      : normalizeCharacterInventory(frontendCharacter.inventory),
    reputation_status: frontendCharacter.reputation_status ?? {},

    // Standard abilities (array of Ability IDs)
    standard_abilities: abilityIdsByType(abilitiesList, "standard"),

    hamon_ability_ids: abilityIdsByType(abilitiesList, "hamon"),
    spin_ability_ids: abilityIdsByType(abilitiesList, "spin"),

    // Custom abilities (SRD: 3x1 or 1x3). Ignore advancement grants — those live on
    // advancement_ability_grants and must not clear or shadow sheet custom_* fields.
    ...(function () {
      const sheetCustoms = (frontendCharacter.abilities || []).filter(
        (a) => a.type === "custom" && !a._fromAdvancement,
      );
      if (sheetCustoms.length === 0) {
        return {
          custom_ability_type: "single_with_3_uses",
          custom_ability_description: "",
          extra_custom_abilities: [],
        };
      }
      const padUses = (raw, n) => {
        const uses = Array.isArray(raw)
          ? raw.map((d) => (d == null ? "" : String(d)))
          : [];
        while (uses.length < n) uses.push("");
        return uses.slice(0, n);
      };
      const single3 = sheetCustoms.find((a) => a.id === "custom-single");
      if (single3) {
        return {
          custom_ability_type: "single_with_3_uses",
          custom_ability_description:
            single3.name || single3._description || "",
          extra_custom_abilities: padUses(single3._uses, 3).map((d) => ({
            description: d,
          })),
        };
      }
      const single2 = sheetCustoms.find((a) => a.id === "custom-single-2");
      if (single2) {
        return {
          custom_ability_type: "single_with_2_uses",
          custom_ability_description:
            single2.name || single2._description || "",
          extra_custom_abilities: padUses(single2._uses, 2).map((d) => ({
            description: d,
          })),
        };
      }
      const legacyUses = sheetCustoms.find(
        (a) => Array.isArray(a._uses) && a._uses.length >= 3,
      );
      if (legacyUses) {
        return {
          custom_ability_type: "single_with_3_uses",
          custom_ability_description: legacyUses.name || "",
          extra_custom_abilities: padUses(legacyUses._uses, 3).map((d) => ({
            description: d,
          })),
        };
      }
      const three = sheetCustoms.filter((a) => !Array.isArray(a._uses));
      if (three.length >= 1) {
        const items = three.slice(0, 3).map((a) => ({
          name: a.name || "",
          description: a.description || "",
        }));
        while (items.length < 3) items.push({ name: "", description: "" });
        return {
          custom_ability_type: "three_separate_uses",
          custom_ability_description: "",
          extra_custom_abilities: items,
        };
      }
      // Sheet customs present but unrecognized shape — prefer explicit fields over wipe
      return {
        custom_ability_type:
          frontendCharacter.custom_ability_type || "single_with_3_uses",
        custom_ability_description:
          frontendCharacter.custom_ability_description ||
          sheetCustoms[0]?.name ||
          "",
        extra_custom_abilities: frontendCharacter.extra_custom_abilities || [],
      };
    })(),

    // Heritage benefits and detriments (arrays of IDs)
    selected_benefits: Array.isArray(frontendCharacter.selected_benefits)
      ? frontendCharacter.selected_benefits
      : [],
    selected_detriments: Array.isArray(frontendCharacter.selected_detriments)
      ? frontendCharacter.selected_detriments
      : [],
    fed_today:
      typeof frontendCharacter.fed_today === "boolean"
        ? frontendCharacter.fed_today
        : null,
    disguised_as_human:
      typeof frontendCharacter.disguised_as_human === "boolean"
        ? frontendCharacter.disguised_as_human
        : null,

    coin_boxes: normalizeCoinBoxes(frontendCharacter.coin),

    // Stash: crew grid when linked; otherwise personal stash_slots on Character
    ...(hasLinkedCrew(frontendCharacter.crewId)
      ? {}
      : { stash_slots: normalizeStashSlots(frontendCharacter.stash) }),

    ...(typeof frontendCharacter.gm_can_have_s_rank_stand_stats === "boolean"
      ? {
          gm_can_have_s_rank_stand_stats:
            frontendCharacter.gm_can_have_s_rank_stand_stats,
        }
      : {}),

    // Solo / no campaign crew: stored on Character; cleared when linked to a Crew
    personal_crew_name:
      frontendCharacter.crewId != null && frontendCharacter.crewId !== ""
        ? ""
        : String(
            frontendCharacter.crew ??
              frontendCharacter.personal_crew_name ??
              "",
          ).slice(0, 100),
  };
};
