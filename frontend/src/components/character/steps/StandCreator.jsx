// src/components/character/steps/StandCreator.jsx
import { useMemo } from 'react';
import PropTypes from 'prop-types';

export default function StandCreator({
  playbook,
  standType,
  onStandTypeChange,
  standName,
  onStandNameChange,
  standForm,
  onStandFormChange,
  standConscious,
  onStandConsciousChange,
  coinStats,
  onCoinStatsChange
}) {
  // Define stand categories
  const standCategories = useMemo(() => [
    { value: 'COLONY', label: 'Colony Stand' },
    { value: 'TOOLBOUND', label: 'Tool Bound' },
    { value: 'PHENOMENA', label: 'Phenomena' },
    { value: 'AUTOMATIC', label: 'Automatic' },
    { value: 'FIGHTING', label: 'Fighting Spirit' },
  ], []);

  // Calculate total coin points used (A=4 points, F=0 points)
  const coinPointsUsed = useMemo(
    () => Object.values(coinStats).reduce((sum, pts) => sum + pts, 0),
    [coinStats]
  );

  // Map point values to letter grades for display
  const pointToGrade = (points) => {
    const grades = ['F', 'D', 'C', 'B', 'A'];
    return grades[points] || 'F';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Create Your {playbook}</h3>
      <p className="text-gray-600">
        Define the supernatural abilities that set your character apart.
      </p>
      
      {/* ——— Stand Type Dropdown ——— */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select
            className="w-full border rounded px-3 py-2"
            value={standType}
            onChange={e => onStandTypeChange(e.target.value)}
            required
          >
            <option value="">— Choose Type —</option>
            {standCategories.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* —— Stand Name —— */}
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={standName}
            onChange={e => onStandNameChange(e.target.value)}
            placeholder="Your STAND name..."
            required
          />
        </div>

        {/* —— Form —— */}
        <div>
          <label className="block text-sm font-medium mb-1">Form</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={standForm}
            onChange={e => onStandFormChange(e.target.value)}
            placeholder="Physical appearance..."
          />
        </div>

        {/* —— Conscious Entity? —— */}
        <div className="flex items-center">
          <input
            id="standConscious"
            type="checkbox"
            className="mr-2"
            checked={standConscious}
            onChange={e => onStandConsciousChange(e.target.checked)}
          />
          <label htmlFor="standConscious">Conscious Entity?</label>
        </div>
      </div>
      
      {/* ——— Coin Stats ——— */}
      <div className="mt-6">
        <h4 className="font-semibold">Coin Stats (10 points total)</h4>
        <p className="text-sm text-gray-600 mb-2">
          Distribute 10 points among these stats (A=4 pts, B=3 pts, C=2 pts, D=1 pt, F=0 pts)
        </p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(coinStats).map(([key, val]) => (
            <div key={key} className="bg-gray-50 p-2 rounded border">
              <label className="block text-sm font-medium mb-1 capitalize">{key}</label>
              <select
                className="w-full border rounded px-2 py-1"
                value={val}
                onChange={e =>
                  onCoinStatsChange({ ...coinStats, [key]: Number(e.target.value) })
                }
              >
                {[4, 3, 2, 1, 0].map(v => (
                  <option key={v} value={v}>
                    {pointToGrade(v)} ({v} pts)
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        
        {/* Show status of total points used */}
        <div className={`mt-3 p-2 rounded border ${
          coinPointsUsed === 10 ? 'bg-green-50' :
          coinPointsUsed > 10 ? 'bg-red-50' : 'bg-yellow-50'
        }`}>
          <p className="font-semibold">
            Points used: {coinPointsUsed} / 10
            {coinPointsUsed < 10 && " (Need to use all points)"}
            {coinPointsUsed > 10 && " (Too many points used)"}
          </p>
        </div>
      </div>
    </div>
  );
}

StandCreator.propTypes = {
  playbook: PropTypes.string.isRequired,
  standType: PropTypes.string,
  onStandTypeChange: PropTypes.func.isRequired,
  standName: PropTypes.string,
  onStandNameChange: PropTypes.func.isRequired,
  standForm: PropTypes.string,
  onStandFormChange: PropTypes.func.isRequired,
  standConscious: PropTypes.bool,
  onStandConsciousChange: PropTypes.func.isRequired,
  coinStats: PropTypes.object.isRequired,
  onCoinStatsChange: PropTypes.func.isRequired
};