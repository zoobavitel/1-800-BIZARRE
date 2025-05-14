// src/components/character/steps/ActionDotsDistributor.jsx
import { useMemo } from 'react';
import PropTypes from 'prop-types';

export default function ActionDotsDistributor({ actionDots, onActionDotsChange }) {
  // Calculate total action dots used
  const totalActionDots = useMemo(() => 
    Object.values(actionDots).reduce((sum, val) => sum + val, 0),
    [actionDots]
  );

  // Group action categories
  const actionGroups = {
    Insight: ["study", "survey", "tinker", "hunt"],
    Prowess: ["prowl", "skirmish", "finesse", "wreck"],
    Resolve: ["bizarre", "sway", "command", "consort"]
  };

  // Handle incrementing or decrementing a dot
  const adjustDot = (action, amount) => {
    const newValue = Math.max(0, Math.min(2, actionDots[action] + amount));
    
    // Only allow increment if we're not already at max dots
    if (amount > 0 && totalActionDots >= 7) {
      return;
    }
    
    onActionDotsChange({
      ...actionDots,
      [action]: newValue
    });
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Distribute Action Dots</h3>
      <p className="text-gray-600">
        Assign 7 dots to your actions (maximum 2 dots per action at creation).
      </p>
      
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.entries(actionGroups).map(([groupName, actions]) => (
          <div key={groupName} className="bg-gray-50 p-3 rounded border">
            <h4 className="font-semibold mb-2">{groupName}</h4>
            {actions.map(action => (
              <div key={action} className="flex items-center justify-between mb-2">
                <span className="capitalize">{action}</span>
                <div className="flex space-x-2 items-center">
                  <button
                    type="button"
                    className="w-6 h-6 bg-red-100 rounded flex items-center justify-center"
                    disabled={actionDots[action] === 0}
                    onClick={() => adjustDot(action, -1)}
                  >-</button>
                  <span className="w-5 text-center">{actionDots[action]}</span>
                  <button
                    type="button"
                    className="w-6 h-6 bg-green-100 rounded flex items-center justify-center"
                    disabled={
                      actionDots[action] >= 2 || 
                      totalActionDots >= 7
                    }
                    onClick={() => adjustDot(action, 1)}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className={`bg-${totalActionDots === 7 ? 'green' : 'blue'}-50 p-3 rounded border mt-4`}>
        <p className="font-semibold">
          Points used: {totalActionDots} / 7
          {totalActionDots < 7 && " (Need to assign all 7 points)"}
          {totalActionDots > 7 && " (Too many points assigned)"}
        </p>
      </div>
    </div>
  );
}

ActionDotsDistributor.propTypes = {
  actionDots: PropTypes.object.isRequired,
  onActionDotsChange: PropTypes.func.isRequired
};