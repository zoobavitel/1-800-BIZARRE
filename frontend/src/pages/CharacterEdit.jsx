// src/pages/CharacterEdit.jsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function CharacterEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [character, setCharacter] = useState(null);
  const [heritages, setHeritages] = useState([]);
  const [vices, setVices] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/characters/${id}/`).then(res => setCharacter(res.data));
    api.get('/heritages/').then(res => setHeritages(res.data));
    api.get('/vices/').then(res => setVices(res.data));
  }, [id]);

  const selectedHeritage = heritages.find(h => h.id === Number(character?.heritage));

  const benefits = selectedHeritage?.benefits || [];
  const detriments = selectedHeritage?.detriments || [];
  const baseHp = selectedHeritage?.base_hp || 0;

  const benefitCost = benefits
    .filter(b => character?.selected_benefits?.includes(b.id))
    .reduce((sum, b) => sum + b.hp_cost, 0);

  const detrimentGain = detriments
    .filter(d => character?.selected_detriments?.includes(d.id))
    .reduce((sum, d) => sum + d.hp_value, 0);

  const totalHp = baseHp + character?.bonus_hp_from_xp - benefitCost + detrimentGain;

  const handleChange = (field) => (e) => {
    setCharacter(prev => ({ ...prev, [field]: e.target.value }));
  };

  const toggleSelection = (field, id) => {
    setCharacter(prev => {
      const list = prev[field];
      return {
        ...prev,
        [field]: list.includes(id) ? list.filter(i => i !== id) : [...list, id],
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/characters/${id}/`, {
        name: character.name,
        heritage: character.heritage,
        vice: character.vice,
        close_friend: character.close_friend,
        rival: character.rival,
        selected_benefits: character.selected_benefits,
        selected_detriments: character.selected_detriments,
      });
      navigate(`/characters/${id}`);
    } catch (err) {
      setError('Failed to update character.');
    }
  };

  if (!character) return <p>Loading...</p>;

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white shadow p-6 rounded">
      <h2 className="text-2xl font-bold mb-4">Edit Character</h2>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={character.name}
          onChange={handleChange('name')}
        />

        <select
          className="w-full border rounded px-3 py-2"
          value={character.heritage}
          onChange={handleChange('heritage')}
        >
          <option value="">Select Heritage</option>
          {heritages.map(h => (
            <option key={h.id} value={h.id}>
              {h.name} — Base HP: {h.base_hp}
            </option>
          ))}
        </select>

        {benefits.length > 0 && (
          <div>
            <label className="font-semibold">Benefits</label>
            {benefits.map(b => (
              <div key={b.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={character.selected_benefits.includes(b.id)}
                    disabled={b.required}
                    onChange={() => toggleSelection('selected_benefits', b.id)}
                  />
                  {b.name} ({b.hp_cost} HP)
                </label>
              </div>
            ))}
          </div>
        )}

        {detriments.length > 0 && (
          <div>
            <label className="font-semibold">Detriments</label>
            {detriments.map(d => (
              <div key={d.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={character.selected_detriments.includes(d.id)}
                    disabled={d.required}
                    onChange={() => toggleSelection('selected_detriments', d.id)}
                  />
                  {d.name} (+{d.hp_value} HP)
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-100 rounded p-3">
          <p>HP Summary: Base {baseHp} + XP {character.bonus_hp_from_xp || 0} + Detriments {detrimentGain} - Benefits {benefitCost}</p>
          <p className={`font-bold ${totalHp < 0 ? 'text-red-500' : 'text-green-600'}`}>Total: {totalHp}</p>
        </div>

        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={character.close_friend}
          onChange={handleChange('close_friend')}
          placeholder="Close Friend"
        />

        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={character.rival}
          onChange={handleChange('rival')}
          placeholder="Rival"
        />

        <select
          className="w-full border rounded px-3 py-2"
          value={character.vice}
          onChange={handleChange('vice')}
        >
          <option value="">Select Vice</option>
          {vices.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <button
          type="submit"
          className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
