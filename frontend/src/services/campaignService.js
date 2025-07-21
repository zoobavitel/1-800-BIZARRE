import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const getCampaigns = async () => {
  try {
    const response = await axios.get(`${API_URL}/campaigns/`);
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
