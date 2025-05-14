// Rules.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route, Link } from 'react-router-dom';

// Import rule content components
const BasicsContent = () => (
  <div className="rules-content">
    <h1>The Basics</h1>
    <p>1(800)BIZARRE is a game about stylish weirdos, personal powers, and missions that never go according to plan. 
      We play to find out whether they can hold it together when everything—and everyone—starts to fall apart.</p>
    
    <h2>The Players</h2>
    <p>Each player creates a character and works with the others to form a crew their character belongs to. 
      Every character is built to feel alive, with larger-than-life dreams, a tangled past, and something they're willing to risk everything for.</p>
    <p>Players and the Game Master (GM) collaborate to set the tone and style of play, making judgment calls about mechanics, dice, and consequences. 
      Everyone at the table shares responsibility as co-authors of the story.</p>
  </div>
);

const CoreSystemContent = () => (
  <div className="rules-content">
    <h1>The Core System</h1>
    <h2>Judgment Calls</h2>
    <p>When you play, you'll make several key judgment calls. Everyone contributes, but either the players or the GM gets final say for each:</p>
    <ul>
      <li>Which skills are reasonable as a solution to a problem? Can this person be Swayed? Must we get out the tools and Tinker with this old rusty lock, or could it also be quietly Finessed? The players have final say.</li>
      <li>How dangerous and how effective is a given skill in this circumstance? How risky is this? Can this person be Swayed very little or a whole lot? The GM has final say.</li>
      <li>Which consequences are inflicted to manifest the dangers in a given circumstance? Does this fall from the roof break your leg? Do the mercenaries merely become suspicious or do they already have you trapped? The GM has final say.</li>
      <li>Does this situation call for a dice roll, and which one? Is it your character's turn in initiative, or must they wait before the NPC with higher Speed goes? The GM has final say.</li>
      <li>Which events in the story match the experience (xp) triggers for character advancement? Did you express your character's beliefs, drives, heritage, or background? You tell us. The players have final say.</li>
    </ul>
  </div>
);

const CharactersContent = () => (
  <div className="rules-content">
    <h1>The Characters</h1>
    <p>The characters dive into high-stakes missions, aiming to build their crew's reputation while surviving rival factions, strange enemies, and the fallout of their own choices.</p>
    
    <h2>Character Creation</h2>
    <p>When creating a character for 1(800)BIZARRE, you'll make several key decisions that define your bizarre individual:</p>
    <ol>
      <li>Choose a playbook - Will you be a Stand user, a Hamon practitioner, or a Spin master?</li>
      <li>Select a heritage - Human, Rock Human, Vampire, Pillar Man, or another bizarre ancestry.</li>
      <li>Distribute action dots - Focus on the skills your character excels in.</li>
      <li>Define your Stand or special ability - Your unique power and its limitations.</li>
      <li>Choose your vice - Everyone has something they turn to in times of stress.</li>
    </ol>
  </div>
);

const CrewContent = () => (
  <div className="rules-content">
    <h1>The Crew</h1>
    <p>Your bizarre crew isn't just a collection of individuals—it's a force unto itself, with its own reputation, turf, and problems.</p>
    
    <h2>Creating Your Crew</h2>
    <p>When establishing your crew, consider:</p>
    <ul>
      <li>Crew Type - What kind of work do you specialize in?</li>
      <li>Reputation - How are you viewed in the underworld?</li>
      <li>Lair - Where do you operate from?</li>
      <li>Special Abilities - What makes your crew unique?</li>
    </ul>
  </div>
);

const ScoreContent = () => (
  <div className="rules-content">
    <h1>The Score</h1>
    <p>A score is a single mission or operation that your crew undertakes. Scores drive the action of the game and generate both rewards and consequences for the characters.</p>
    
    <h2>Score Structure</h2>
    <p>A typical score follows this sequence:</p>
    <ol>
      <li>Develop a plan</li>
      <li>Gather information</li>
      <li>Take action through the engagement roll</li>
      <li>Deal with complications</li>
      <li>Wrap up and determine payoff</li>
    </ol>
  </div>
);

const PlanningContent = () => (
  <div className="rules-content">
    <h1>Planning & Engagement</h1>
    <p>Before your crew begins a score, you'll create a plan together. The plan creates the initial scenario for the score's action.</p>
    
    <h2>Plan Types</h2>
    <ul>
      <li><strong>Assault:</strong> You go in guns blazing.</li>
      <li><strong>Deception:</strong> You create and exploit false beliefs.</li>
      <li><strong>Stealth:</strong> You sneak in undetected.</li>
      <li><strong>Social:</strong> You charm, negotiate, or manipulate.</li>
      <li><strong>Transport:</strong> You carry cargo or people through dangerous territory.</li>
      <li><strong>Occult:</strong> You employ bizarre powers or supernatural elements.</li>
    </ul>
    
    <h2>The Engagement Roll</h2>
    <p>The engagement roll determines how well your initial plan goes. The result creates the starting point for the score.</p>
  </div>
);

const TeamworkContent = () => (
  <div className="rules-content">
    <h1>Teamwork</h1>
    <p>When the team of bizarre individuals works together, they have access to special teamwork maneuvers:</p>
    
    <h2>Teamwork Maneuvers</h2>
    <ul>
      <li><strong>Assist:</strong> Help another player who's rolling an action.</li>
      <li><strong>Lead a Group Action:</strong> Coordinate multiple members of the team to tackle a problem together.</li>
      <li><strong>Protect:</strong> Step in to face a consequence that one of your teammates would otherwise face.</li>
      <li><strong>Set Up:</strong> Create an advantageous situation that another player can exploit.</li>
    </ul>
  </div>
);

const DowntimeContent = () => (
  <div className="rules-content">
    <h1>Downtime</h1>
    <p>Between scores, your crew spends time at their liberty, attending to personal needs and side projects.</p>
    
    <h2>Downtime Activities</h2>
    <ul>
      <li><strong>Long-Term Project:</strong> Work on a personal goal or research.</li>
      <li><strong>Recover:</strong> Heal your injuries.</li>
      <li><strong>Reduce Wanted Level:</strong> Lower your heat with the authorities.</li>
      <li><strong>Train:</strong> Gain experience in a specific action.</li>
      <li><strong>Indulge Vice:</strong> Relieve stress through your personal vice.</li>
    </ul>
  </div>
);

// Main Rules component
const Rules = () => {
  const location = useLocation();
  const [activePath, setActivePath] = useState('');
  
  useEffect(() => {
    // Extract the current rules section from the URL
    const path = location.pathname.split('/').filter(Boolean);
    if (path.length >= 2) {
      setActivePath(path[1]);
    } else {
      setActivePath('basics');
    }
  }, [location]);

  return (
    <div className="rules-container bg-white min-h-screen">
      <div className="rules-navigation bg-gray-100 p-4 border-b border-gray-200">
        <div className="container mx-auto">
          <h1 className="text-3xl font-bold text-[#cc230a] mb-4">Game Rules</h1>
          <nav className="rules-nav flex overflow-x-auto pb-2">
            <Link 
              to="/rules/basics" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'basics' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              The Basics
            </Link>
            <Link 
              to="/rules/core-system" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'core-system' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              The Core System
            </Link>
            <Link 
              to="/rules/characters" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'characters' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              The Characters
            </Link>
            <Link 
              to="/rules/crew" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'crew' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              The Crew
            </Link>
            <Link 
              to="/rules/score" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'score' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              The Score
            </Link>
            <Link 
              to="/rules/planning" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'planning' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              Planning
            </Link>
            <Link 
              to="/rules/teamwork" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'teamwork' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              Teamwork
            </Link>
            <Link 
              to="/rules/downtime" 
              className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'downtime' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
            >
              Downtime
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="container mx-auto p-6">
        <Routes>
          <Route path="basics" element={<BasicsContent />} />
          <Route path="core-system" element={<CoreSystemContent />} />
          <Route path="characters" element={<CharactersContent />} />
          <Route path="crew" element={<CrewContent />} />
          <Route path="score" element={<ScoreContent />} />
          <Route path="planning" element={<PlanningContent />} />
          <Route path="teamwork" element={<TeamworkContent />} />
          <Route path="downtime" element={<DowntimeContent />} />
          <Route path="*" element={<BasicsContent />} />
        </Routes>
      </div>
    </div>
  );
};

export default Rules;