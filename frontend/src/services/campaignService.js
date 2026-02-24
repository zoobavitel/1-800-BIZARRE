import axios from 'axios';
import { getApiBaseUrl } from '../config/apiConfig';

const getCampaigns = async () => {
  try {
    const base = getApiBaseUrl();
    const response = await axios.get(`${base}/campaigns/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    throw error;
  }
};

const campaignService = {
  getCampaigns,
};

export default campaignService;
