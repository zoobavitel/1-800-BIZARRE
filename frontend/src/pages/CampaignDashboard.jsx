// src/pages/CampaignDashboard.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import Clock from '../components/Clock';

export default function CampaignDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [npcs, setNpcs] = useState([]);

  useEffect(() => {
    api.get('/campaigns/')
       .then(res => {
         setCampaigns(res.data);
         if (res.data.length > 0) {
           setSelectedCampaign(res.data[0].id);
         }
       })
       .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      api.get('/characters/')
         .then(res => {
           const filtered = res.data.filter(c => c.campaign === selectedCampaign);
           setCharacters(filtered);
         });
      api.get('/npcs/')
         .then(res => {
           const filtered = res.data.filter(npc => npc.campaign === selectedCampaign);
           setNpcs(filtered);
         });
    }
  }, [selectedCampaign]);

  return (
    <div>
      <h1>GM Campaign Dashboard</h1>

      <label>Select Campaign:</label>
      <select onChange={e => setSelectedCampaign(Number(e.target.value))} value={selectedCampaign || ''}>
        {campaigns.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <h2>Characters</h2>
      <ul>
        {characters.map(char => (
          <li key={char.id}>
            {char.name} — Heritage: {char.heritage}, Vice: {char.vice}
          </li>
        ))}
      </ul>

      <h2>NPCs</h2>
      <ul>
        {npcs.map(npc => (
          <li key={npc.id}>
            <h3>{npc.name}</h3>
            <pre style={{ fontSize: '0.8rem' }}>{npc.stats?.stand_name}</pre>

            {npc.stats?.clocks && (
              <div style={{ marginBottom: '1rem' }}>
                <Clock label="Harm" total={npc.stats.clocks.harm_clock} filled={0} />
                <Clock label="Vulnerability" total={npc.stats.clocks.vulnerability_clock} filled={0} />
                <Clock label="Healing" total={npc.stats.clocks.healing_clock} filled={0} />
                <Clock label="Progress" total={npc.stats.clocks.progress_clock} filled={0} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
