// API service for character sheet backend integration

import { getApiBaseUrl, requireApiBaseUrl } from "../../../config/apiConfig";
import { getApiErrorMessage } from "../../../utils/apiErrorMessage";
import {
  gradeToIndex,
  indexToGrade,
  DUR_TABLE,
  DEFAULT_TRAUMA,
} from "../constants/srd";

/** Backend Character.playbook values */
const PLAYBOOK_BACKEND = ["STAND", "HAMON", "SPIN"];

/** Map API playbook (STAND/HAMON/SPIN) to CharacterSheet select labels */
export function playbookToDisplay(pb) {
  if (pb == null || pb === "") return "Stand";
  const u = String(pb).toUpperCase();
  if (u === "HAMON") return "Hamon";
  if (u === "SPIN") return "Spin";
  return "Stand";
}

/** True when the sheet is linked to a campaign crew (stash lives on Crew). */
function hasLinkedCrew(crewId) {
  if (crewId == null || crewId === "") return false;
  const n =
    typeof crewId === "number" ? crewId : parseInt(String(crewId).trim(), 10);
  return Number.isFinite(n) && n > 0;
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
  getCharacters: () => apiRequest("/characters/"),

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

  // Partial update character
  patchCharacter: (id, characterData) =>
    apiRequest(`/characters/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(characterData),
    }),

  // Delete character
  deleteCharacter: (id) =>
    apiRequest(`/characters/${id}/`, {
      method: "DELETE",
    }),

  // Roll action dice
  rollAction: (id, actionData) =>
    apiRequest(`/characters/${id}/roll-action/`, {
      method: "POST",
      body: JSON.stringify(actionData),
    }),

  /** Crew Help: helper spends 1 stress (same crew). */
  assistHelp: (id, helperCharacterId) =>
    apiRequest(`/characters/${id}/assist-help/`, {
      method: "POST",
      body: JSON.stringify({ helper_character_id: helperCharacterId }),
    }),

  // Add XP to character
  addXP: (id, xpData) =>
    apiRequest(`/characters/${id}/add-xp/`, {
      method: "POST",
      body: JSON.stringify(xpData),
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
  invitePlayer: (id, username) =>
    apiRequest(`/campaigns/${id}/invite/`, {
      method: "POST",
      body: JSON.stringify({ username }),
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
  createFaction: (data) =>
    apiRequest("/factions/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateFaction: (id, data) =>
    apiRequest(`/factions/${id}/`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
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
  const { imageFile: _if, image: _img, ...rest } = data || {};
  return { multipart: false, body: JSON.stringify(rest) };
}

// NPC API functions (GM / campaign NPCs)
export const npcAPI = {
  getNPCs: (campaignId) =>
    campaignId
      ? apiRequest(`/npcs/?campaign=${campaignId}`)
      : apiRequest("/npcs/"),
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
};

export const xpHistoryAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/xp-history/${qs ? "?" + qs : ""}`);
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

// Data transformation helpers
export const transformBackendToFrontend = (backendCharacter) => {
  return {
    id: backendCharacter.id,
    name: backendCharacter.true_name || "",
    standName: backendCharacter.stand_name || "",
    heritage: backendCharacter.heritage ?? null,
    heritageName: backendCharacter.heritage_details?.name || null,
    background: backendCharacter.background_note || "",
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
      BIZARRE: backendCharacter.action_dots?.attune || 0, // Note: backend uses 'attune'
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

    // Stress: backend integer; frontend uses filled count + array for compatibility
    stressFilled: Math.max(0, backendCharacter.stress ?? 0),
    stress: (() => {
      const dur = gradeToIndex(backendCharacter.stand?.durability);
      const maxStress = 9 + (DUR_TABLE[dur]?.stressBonus ?? 0);
      const filled = Math.min(backendCharacter.stress ?? 0, maxStress);
      return Array(maxStress)
        .fill(false)
        .map((_, i) => i < filled);
    })(),
    // Trauma: backend list of IDs; build checkbox object from trauma_details
    trauma: (() => {
      const details = backendCharacter.trauma_details || [];
      const names = details.map((t) => (t.name || "").toUpperCase());
      return {
        ...DEFAULT_TRAUMA,
        ...Object.fromEntries(names.map((n) => [n, true])),
      };
    })(),

    // Armor
    regularArmorUsed: 0, // derived from light_armor_used + heavy_armor_used if needed
    specialArmorUsed: false,
    armor: {
      armor: backendCharacter.light_armor_used || false,
      heavy: backendCharacter.heavy_armor_used || false,
      special: false,
    },

    // Harm: backend has level1/2/3_used + _name (single); frontend uses arrays
    harm: {
      level3: [
        backendCharacter.harm_level3_used
          ? backendCharacter.harm_level3_name || ""
          : "",
      ],
      level2: [
        backendCharacter.harm_level2_used
          ? backendCharacter.harm_level2_name || ""
          : "",
        "",
      ],
      level1: [
        backendCharacter.harm_level1_used
          ? backendCharacter.harm_level1_name || ""
          : "",
        "",
      ],
    },
    harmEntries: {
      level3: [
        backendCharacter.harm_level3_used
          ? backendCharacter.harm_level3_name || ""
          : "",
      ],
      level2: [
        backendCharacter.harm_level2_used
          ? backendCharacter.harm_level2_name || ""
          : "",
        "",
      ],
      level1: [
        backendCharacter.harm_level1_used
          ? backendCharacter.harm_level1_name || ""
          : "",
        "",
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

    // XP tracks
    xp: backendCharacter.xp_clocks || {
      insight: 0,
      prowess: 0,
      resolve: 0,
      heritage: 0,
      playbook: 0,
    },

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
        if (type === "single_with_3_uses" && (desc || extra.length > 0)) {
          const name =
            (desc || extra[0]?.name || "Custom Ability").trim() ||
            "Custom Ability";
          const uses =
            extra.length >= 3
              ? extra.map((u) => u.description || u)
              : desc
                ? [desc]
                : ["", "", ""];
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
    ],

    // Progress clocks
    clocks: backendCharacter.progress_clocks || [],

    // Additional backend fields
    campaign: backendCharacter.campaign,
    playbook: playbookToDisplay(backendCharacter.playbook),
    level: backendCharacter.level,
    loadout: backendCharacter.loadout,
    inventory: backendCharacter.inventory || [],
    reputation_status: backendCharacter.reputation_status || {},

    // Heritage benefits and detriments (arrays of IDs)
    selected_benefits: Array.isArray(backendCharacter.selected_benefits)
      ? backendCharacter.selected_benefits
      : [],
    selected_detriments: Array.isArray(backendCharacter.selected_detriments)
      ? backendCharacter.selected_detriments
      : [],
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

  return {
    true_name: frontendCharacter.name,
    stand_name: frontendCharacter.standName,
    heritage: heritageOut,
    playbook: playbookToBackend(frontendCharacter.playbook),
    background_note: frontendCharacter.background,
    appearance: frontendCharacter.look,
    ...vicePayload,
    vice_details:
      frontendCharacter.viceDetails ?? frontendCharacter.vice_details ?? "",
    image_url: frontendCharacter.image_url ?? "",

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

    // Armor
    light_armor_used: frontendCharacter.armor.armor,
    heavy_armor_used: frontendCharacter.armor.heavy,

    // Harm (first slot per level; backend has single name per level)
    harm_level3_used:
      (frontendCharacter.harmEntries?.level3?.[0] ??
        frontendCharacter.harm?.level3?.[0] ??
        "") !== "",
    harm_level3_name:
      (frontendCharacter.harmEntries?.level3?.[0] ??
        frontendCharacter.harm?.level3?.[0] ??
        "") ||
      "",
    harm_level2_used:
      (frontendCharacter.harmEntries?.level2?.[0] ??
        frontendCharacter.harm?.level2?.[0] ??
        "") !== "",
    harm_level2_name:
      (frontendCharacter.harmEntries?.level2?.[0] ??
        frontendCharacter.harm?.level2?.[0] ??
        "") ||
      "",
    harm_level1_used:
      (frontendCharacter.harmEntries?.level1?.[0] ??
        frontendCharacter.harm?.level1?.[0] ??
        "") !== "",
    harm_level1_name:
      (frontendCharacter.harmEntries?.level1?.[0] ??
        frontendCharacter.harm?.level1?.[0] ??
        "") ||
      "",

    // XP clocks
    xp_clocks: frontendCharacter.xp,

    // Progress clocks
    progress_clocks: frontendCharacter.clocks,

    // Additional fields (safe defaults for new character)
    campaign:
      frontendCharacter.campaign != null
        ? typeof frontendCharacter.campaign === "object"
          ? frontendCharacter.campaign?.id
          : frontendCharacter.campaign
        : null,
    inventory: frontendCharacter.inventory ?? [],
    reputation_status: frontendCharacter.reputation_status ?? {},

    // Standard abilities (array of Ability IDs)
    standard_abilities: abilityIdsByType(abilitiesList, "standard"),

    hamon_ability_ids: abilityIdsByType(abilitiesList, "hamon"),
    spin_ability_ids: abilityIdsByType(abilitiesList, "spin"),

    // Custom abilities (SRD: 3x1 or 1x3)
    ...(function () {
      const customs = (frontendCharacter.abilities || []).filter(
        (a) => a.type === "custom",
      );
      if (customs.length === 0) {
        return {
          custom_ability_type: "single_with_3_uses",
          custom_ability_description: "",
          extra_custom_abilities: [],
        };
      }
      const single = customs.find((a) => a.id === "custom-single" || a._uses);
      if (single && single._uses && single._uses.length >= 3) {
        return {
          custom_ability_type: "single_with_3_uses",
          custom_ability_description: single.name || "",
          extra_custom_abilities: single._uses.map((d) => ({ description: d })),
        };
      }
      const three = customs.filter(
        (a) =>
          !a._uses &&
          (String(a.id || "").startsWith("custom-") || a.type === "custom"),
      );
      if (three.length >= 1) {
        const items = three
          .slice(0, 3)
          .map((a) => ({
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
      return {
        custom_ability_type:
          frontendCharacter.custom_ability_type || "single_with_3_uses",
        custom_ability_description:
          frontendCharacter.custom_ability_description || "",
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

    coin_boxes: normalizeCoinBoxes(frontendCharacter.coin),

    // Stash: crew grid when linked; otherwise personal stash_slots on Character
    ...(hasLinkedCrew(frontendCharacter.crewId)
      ? {}
      : { stash_slots: normalizeStashSlots(frontendCharacter.stash) }),

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
