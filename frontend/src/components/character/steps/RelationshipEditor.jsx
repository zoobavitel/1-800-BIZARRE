// src/components/character/steps/RelationshipEditor.jsx
import PropTypes from 'prop-types';

export default function RelationshipEditor({ 
  closeFriend, 
  onCloseFriendChange, 
  rival, 
  onRivalChange 
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Close Friend and Rival</h3>
      <p className="text-gray-600">
        Define important relationships that anchor your character in the world.
      </p>
      
      <div className="mt-4">
        <label className="block text-sm font-medium mb-1">Close Friend</label>
        <input
          type="text"
          className="w-full border rounded px-3 py-2"
          value={closeFriend}
          onChange={e => onCloseFriendChange(e.target.value)}
          placeholder="Name and brief description of your close friend..."
          required
        />
        
        <div className="mt-1 text-sm text-gray-500">
          Who has your back when things get dangerous? How do you know each other?
        </div>
        
        <div className="mt-3">
          <label className="block text-sm font-medium mb-1">Rival</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2"
            value={rival}
            onChange={e => onRivalChange(e.target.value)}
            placeholder="Name and brief description of your rival..."
            required
          />
          
          <div className="mt-1 text-sm text-gray-500">
            Who challenges you or competes with you? What's your history together?
          </div>
        </div>
      </div>
    </div>
  );
}

RelationshipEditor.propTypes = {
  closeFriend: PropTypes.string.isRequired,
  onCloseFriendChange: PropTypes.func.isRequired,
  rival: PropTypes.string.isRequired,
  onRivalChange: PropTypes.func.isRequired
};