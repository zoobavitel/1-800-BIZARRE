import axios from "axios";
import { requireApiBaseUrl } from "../config/apiConfig";

const getCampaigns = async () => {
  try {
    const base = requireApiBaseUrl();
    const headers = base.includes("ngrok")
      ? { "ngrok-skip-browser-warning": "1" }
      : {};
    const response = await axios.get(`${base}/campaigns/`, { headers });
    return response.data;
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }
};

const campaignService = {
  getCampaigns,
};

export default campaignService;
