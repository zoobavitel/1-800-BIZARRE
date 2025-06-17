// Rules.jsx - Enhanced Rules Page
import React, { useState, useEffect } from 'react';
import { useLocation, Routes, Route, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';

// Enhanced rule content components with dynamic data
const BasicsContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">🎯 The Basics</h1>
    <div className="rule-section">
      <p className="lead-text">1(800)BIZARRE is a game about stylish weirdos, personal powers, and missions that never go according to plan. 
        We play to find out whether they can hold it together when everything—and everyone—starts to fall apart.</p>
      
      <h2>🎭 The Players</h2>
      <p>Each player creates a character and works with the others to form a crew their character belongs to. 
        Every character is built to feel alive, with larger-than-life dreams, a tangled past, and something they're willing to risk everything for.</p>
      <p>Players and the Game Master (GM) collaborate to set the tone and style of play, making judgment calls about mechanics, dice, and consequences. 
        Everyone at the table shares responsibility as co-authors of the story.</p>
      
      <h2>🎲 Core Mechanics</h2>
      <div className="mechanics-grid">
        <div className="mechanic-card">
          <h3>Action Rolls</h3>
          <p>Roll 2d6. 6+ is success, 4-5 is partial success, 1-3 is failure with complications.</p>
        </div>
        <div className="mechanic-card">
          <h3>Position & Effect</h3>
          <p>The GM sets how dangerous (risky/desperate) and effective (limited/great) your action will be.</p>
        </div>
        <div className="mechanic-card">
          <h3>Consequences</h3>
          <p>Failure brings harm, complications, or reduced effect. Partial success offers tough choices.</p>
        </div>
      </div>
    </div>
  </div>
);

const StandsContent = ({ abilities }) => (
  <div className="rules-content">
    <h1 className="rules-title">🌟 Stand Rules</h1>
    <div className="rule-section">
      <p className="lead-text">Stands are the manifestation of one's fighting spirit and psychic energy. Each Stand is unique, with its own appearance, abilities, and limitations.</p>
      
      <h2>Stand Statistics</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Power</h3>
          <p>Physical strength and destructive capability</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
        <div className="stat-card">
          <h3>Speed</h3>
          <p>How fast the Stand can move and act</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
        <div className="stat-card">
          <h3>Range</h3>
          <p>How far from the user the Stand can operate</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
        <div className="stat-card">
          <h3>Durability</h3>
          <p>How much damage the Stand can take</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
        <div className="stat-card">
          <h3>Precision</h3>
          <p>Accuracy and fine control</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
        <div className="stat-card">
          <h3>Development</h3>
          <p>Potential for growth and new abilities</p>
          <div className="rating-scale">S &gt; A &gt; B &gt; C &gt; D &gt; F</div>
        </div>
      </div>

      <h2>Stand Types</h2>
      <div className="stand-types">
        <div className="type-card">
          <h3>🥊 Fighting Spirit</h3>
          <p>Close-range combat specialists with high physical stats</p>
        </div>
        <div className="type-card">
          <h3>🔧 Tool Bound</h3>
          <p>Stands that take the form of or are bound to objects</p>
        </div>
        <div className="type-card">
          <h3>🌊 Phenomena</h3>
          <p>Stands that manifest as environmental effects or phenomena</p>
        </div>
        <div className="type-card">
          <h3>🤖 Automatic</h3>
          <p>Stands that operate independently of conscious control</p>
        </div>
        <div className="type-card">
          <h3>👥 Colony</h3>
          <p>Multiple small Stands working together</p>
        </div>
      </div>

      {abilities && abilities.length > 0 && (
        <div className="abilities-section">
          <h2>Available Stand Abilities</h2>
          <div className="abilities-grid">
            {abilities.filter(ability => ability.type === 'standard').slice(0, 6).map(ability => (
              <div key={ability.id} className="ability-card">
                <h4>{ability.name}</h4>
                <p>{ability.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

const HeritagesContent = ({ heritages }) => (
  <div className="rules-content">
    <h1 className="rules-title">🧬 Heritage Rules</h1>
    <div className="rule-section">
      <p className="lead-text">Your character's heritage determines their ancestry and provides unique benefits and potential drawbacks.</p>
      
      {heritages && heritages.length > 0 ? (
        <div className="heritages-grid">
          {heritages.map(heritage => (
            <div key={heritage.id} className="heritage-card">
              <h3>{heritage.name}</h3>
              <div className="heritage-stats">
                <span className="base-hp">Base HP: {heritage.base_hp}</span>
              </div>
              <p>{heritage.description || 'A unique heritage with its own traits and characteristics.'}</p>
              
              {heritage.benefits && heritage.benefits.length > 0 && (
                <div className="heritage-benefits">
                  <h4>Benefits:</h4>
                  <ul>
                    {heritage.benefits.slice(0, 3).map((benefit, index) => (
                      <li key={index}>{benefit.name} - {benefit.description}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>Heritage information is being loaded...</p>
      )}
    </div>
  </div>
);

const CoreSystemContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">⚙️ The Core System</h1>
    <div className="rule-section">
      <p className="lead-text">1(800)BIZARRE uses a dice system that puts the focus on drama, consequences, and character growth.</p>
      
      <h2>🎲 Action Rolls</h2>
      <div className="action-roll-section">
        <div className="roll-breakdown">
          <h3>When to Roll</h3>
          <p>Roll when the outcome is uncertain and the action is risky. Not every action requires a roll—only when failure would be interesting.</p>
          
          <h3>How to Roll</h3>
          <ol>
            <li>Choose the appropriate action (Prowl, Skirmish, Study, etc.)</li>
            <li>Add dice for action rating + assistance + pushed yourself</li>
            <li>Roll and take the highest die</li>
          </ol>
          
          <h3>Results</h3>
          <div className="results-grid">
            <div className="result-card critical">
              <h4>6: Critical Success</h4>
              <p>You achieve your goal with some additional benefit</p>
            </div>
            <div className="result-card success">
              <h4>4-5: Success</h4>
              <p>You achieve your goal but suffer consequences</p>
            </div>
            <div className="result-card failure">
              <h4>1-3: Failure</h4>
              <p>Things go wrong and you face serious consequences</p>
            </div>
          </div>
        </div>
      </div>
      
      <h2>🎯 Position & Effect</h2>
      <div className="position-effect-grid">
        <div className="position-section">
          <h3>Position (Risk)</h3>
          <div className="position-cards">
            <div className="pos-card controlled">
              <h4>Controlled</h4>
              <p>Safe approach, minor consequences on failure</p>
            </div>
            <div className="pos-card risky">
              <h4>Risky</h4>
              <p>Standard approach, serious consequences</p>
            </div>
            <div className="pos-card desperate">
              <h4>Desperate</h4>
              <p>Dangerous approach, severe consequences</p>
            </div>
          </div>
        </div>
        
        <div className="effect-section">
          <h3>Effect (Scale)</h3>
          <div className="effect-cards">
            <div className="eff-card limited">
              <h4>Limited</h4>
              <p>Partial or reduced outcome</p>
            </div>
            <div className="eff-card standard">
              <h4>Standard</h4>
              <p>Full expected outcome</p>
            </div>
            <div className="eff-card great">
              <h4>Great</h4>
              <p>Enhanced or amplified outcome</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const CharactersContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">👤 The Characters</h1>
    <div className="rule-section">
      <p className="lead-text">Every character in 1(800)BIZARRE is a unique individual with their own personality, motivations, and supernatural abilities.</p>
      
      <h2>📊 Character Creation</h2>
      <div className="creation-steps">
        <div className="step-card">
          <h3>1. Choose Your Playbook</h3>
          <p>Select a character archetype that defines your role and abilities</p>
          <ul>
            <li><strong>The Muscle:</strong> Physical powerhouse with raw strength</li>
            <li><strong>The Face:</strong> Charismatic leader and negotiator</li>
            <li><strong>The Brain:</strong> Tactical genius and information broker</li>
            <li><strong>The Mystic:</strong> Supernatural specialist with occult knowledge</li>
            <li><strong>The Ghost:</strong> Stealth expert and infiltrator</li>
            <li><strong>The Gearhead:</strong> Tech specialist and inventor</li>
          </ul>
        </div>
        
        <div className="step-card">
          <h3>2. Assign Action Ratings</h3>
          <p>Distribute points among your 12 actions:</p>
          <div className="actions-grid">
            <div className="action-category">
              <h4>🏃 Prowess</h4>
              <ul>
                <li>Prowl (stealth, infiltration)</li>
                <li>Skirmish (fighting, athletics)</li>
                <li>Study (research, analysis)</li>
                <li>Wreck (demolition, destruction)</li>
              </ul>
            </div>
            <div className="action-category">
              <h4>🎭 Resolve</h4>
              <ul>
                <li>Attune (supernatural awareness)</li>
                <li>Command (leadership, intimidation)</li>
                <li>Consort (socializing, etiquette)</li>
                <li>Sway (persuasion, manipulation)</li>
              </ul>
            </div>
            <div className="action-category">
              <h4>🔧 Insight</h4>
              <ul>
                <li>Hunt (tracking, investigation)</li>
                <li>Survey (observation, planning)</li>
                <li>Tinker (mechanical, technical)</li>
                <li>Pilot (vehicles, navigation)</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="step-card">
          <h3>3. Define Your Character</h3>
          <ul>
            <li>Choose your heritage and background</li>
            <li>Define your look and personality</li>
            <li>Select your vice and trauma</li>
            <li>Determine your relationships</li>
            <li>Design your Stand (if applicable)</li>
          </ul>
        </div>
      </div>
      
      <h2>💾 Character Advancement</h2>
      <div className="advancement-section">
        <h3>Experience Points (XP)</h3>
        <p>Characters gain XP through:</p>
        <ul>
          <li>Desperate action rolls</li>
          <li>Expressing their beliefs or drive</li>
          <li>Struggling with their vice or trauma</li>
          <li>End-of-session reflections</li>
        </ul>
        
        <h3>What You Can Advance</h3>
        <ul>
          <li>Increase action ratings</li>
          <li>Gain new special abilities</li>
          <li>Add new friends/contacts</li>
          <li>Reduce trauma</li>
          <li>Change playbooks (rare)</li>
        </ul>
      </div>
    </div>
  </div>
);

const CrewContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">👥 The Crew</h1>
    <div className="rule-section">
      <p className="lead-text">Your bizarre crew isn't just a collection of individuals—it's a force unto itself, with its own reputation, turf, and problems.</p>
      
      <h2>🏗️ Creating Your Crew</h2>
      <div className="crew-creation">
        <div className="crew-aspects">
          <div className="aspect-card">
            <h3>Crew Type</h3>
            <p>What kind of work do you specialize in?</p>
            <ul>
              <li><strong>Assassins:</strong> Professional killers and eliminators</li>
              <li><strong>Bravos:</strong> Street fighters and muscle for hire</li>
              <li><strong>Cult:</strong> Occult practitioners with supernatural goals</li>
              <li><strong>Hawkers:</strong> Dealers in contraband and vice</li>
              <li><strong>Shadows:</strong> Thieves and infiltrators</li>
              <li><strong>Smugglers:</strong> Transportation specialists</li>
            </ul>
          </div>
          
          <div className="aspect-card">
            <h3>Reputation</h3>
            <p>How are you viewed in the underworld?</p>
            <ul>
              <li>Professional - Known for clean, efficient work</li>
              <li>Brutal - Fear-inducing through violence</li>
              <li>Weird - Associated with the supernatural</li>
              <li>Honorable - Trustworthy and principled</li>
              <li>Wild - Unpredictable and chaotic</li>
            </ul>
          </div>
          
          <div className="aspect-card">
            <h3>Lair</h3>
            <p>Where do you operate from?</p>
            <ul>
              <li>Abandoned warehouse district</li>
              <li>Underground tunnels</li>
              <li>Floating barge</li>
              <li>Legitimate business front</li>
              <li>Mobile operations (vehicles)</li>
            </ul>
          </div>
        </div>
      </div>
      
      <h2>⚡ Crew Advancement</h2>
      <div className="crew-advancement">
        <h3>Crew XP</h3>
        <p>The crew gains experience through successful scores and achieving long-term goals.</p>
        
        <h3>Crew Upgrades</h3>
        <ul>
          <li><strong>Lair:</strong> Improve your base of operations</li>
          <li><strong>Training:</strong> Boost crew member capabilities</li>
          <li><strong>Quality:</strong> Enhance equipment and resources</li>
          <li><strong>Cohorts:</strong> Recruit specialist gangs or experts</li>
        </ul>
        
        <h3>Wanted Level</h3>
        <p>Your crew's criminal activities attract attention from authorities. Manage your exposure carefully to avoid overwhelming pressure.</p>
      </div>
    </div>
  </div>
);

const ScoreContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">🎯 The Score</h1>
    <div className="rule-section">
      <p className="lead-text">A score is a single mission or operation that your crew undertakes. Scores drive the action of the game and generate both rewards and consequences for the characters.</p>
      
      <h2>🏗️ Score Structure</h2>
      <div className="score-phases">
        <div className="phase-card">
          <h3>1. Planning Phase</h3>
          <p>The crew discusses their approach and gathers information</p>
          <ul>
            <li>Choose a target or objective</li>
            <li>Select a plan type</li>
            <li>Determine the detail level</li>
            <li>Assign crew members to roles</li>
          </ul>
        </div>
        
        <div className="phase-card">
          <h3>2. Engagement Roll</h3>
          <p>Determines how the plan unfolds initially</p>
          <ul>
            <li>Roll based on plan type and prep</li>
            <li>6: Great start, dominant position</li>
            <li>4-5: Good start, minor complications</li>
            <li>1-3: Poor start, serious problems</li>
          </ul>
        </div>
        
        <div className="phase-card">
          <h3>3. The Action</h3>
          <p>Play through the score scene by scene</p>
          <ul>
            <li>Make action rolls as needed</li>
            <li>Handle consequences and complications</li>
            <li>Use teamwork maneuvers</li>
            <li>Adapt to changing circumstances</li>
          </ul>
        </div>
        
        <div className="phase-card">
          <h3>4. Payoff</h3>
          <p>Resolve the score's outcome</p>
          <ul>
            <li>Determine success level</li>
            <li>Calculate coin/rep earned</li>
            <li>Assess consequences</li>
            <li>Handle entanglements</li>
          </ul>
        </div>
      </div>
      
      <h2>⚡ Consequences & Entanglements</h2>
      <div className="consequences-section">
        <h3>Consequence Levels</h3>
        <p>Your crew generates consequences based on the exposure and violence of your methods:</p>
        <ul>
          <li>0 Consequences: Smooth and quiet</li>
          <li>1 Consequence: Contained exposure</li>
          <li>2 Consequences: Witnesses or evidence</li>
          <li>3-4 Consequences: Exposed operation</li>
          <li>5-6 Consequences: Wild operation with major evidence</li>
        </ul>
        
        <h3>Entanglements</h3>
        <p>When consequences build up, roll for entanglements that create ongoing problems for your crew.</p>
      </div>
    </div>
  </div>
);

const PlanningContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">📋 Planning & Engagement</h1>
    <div className="rule-section">
      <p className="lead-text">Before your crew begins a score, you'll create a plan together. The plan creates the initial scenario for the score's action.</p>
      
      <h2>🎭 Plan Types</h2>
      <div className="plan-types-grid">
        <div className="plan-card assault">
          <h3>⚔️ Assault</h3>
          <p><strong>Detail:</strong> Point of attack</p>
          <p>You go in guns blazing, using force and intimidation to achieve your goals.</p>
          <div className="plan-benefits">
            <span className="benefit">High damage potential</span>
            <span className="drawback">High exposure</span>
          </div>
        </div>
        
        <div className="plan-card deception">
          <h3>🎭 Deception</h3>
          <p><strong>Detail:</strong> Method of deception</p>
          <p>You create and exploit false beliefs, using lies and misdirection.</p>
          <div className="plan-benefits">
            <span className="benefit">Lower exposure if successful</span>
            <span className="drawback">Requires good acting</span>
          </div>
        </div>
        
        <div className="plan-card stealth">
          <h3>🥷 Stealth</h3>
          <p><strong>Detail:</strong> Infiltration method</p>
          <p>You sneak in undetected, avoiding confrontation and witnesses.</p>
          <div className="plan-benefits">
            <span className="benefit">Minimal exposure</span>
            <span className="drawback">Fragile if discovered</span>
          </div>
        </div>
        
        <div className="plan-card social">
          <h3>🗣️ Social</h3>
          <p><strong>Detail:</strong> Social connection</p>
          <p>You charm, negotiate, or manipulate your way to success.</p>
          <div className="plan-benefits">
            <span className="benefit">Builds relationships</span>
            <span className="drawback">Requires social skills</span>
          </div>
        </div>
        
        <div className="plan-card transport">
          <h3>🚛 Transport</h3>
          <p><strong>Detail:</strong> Route and method</p>
          <p>You carry cargo or people through dangerous territory.</p>
          <div className="plan-benefits">
            <span className="benefit">Mobile advantage</span>
            <span className="drawback">Vehicle dependent</span>
          </div>
        </div>
        
        <div className="plan-card occult">
          <h3>🔮 Occult</h3>
          <p><strong>Detail:</strong> Supernatural method</p>
          <p>You employ bizarre powers or supernatural elements.</p>
          <div className="plan-benefits">
            <span className="benefit">Unique capabilities</span>
            <span className="drawback">Unpredictable consequences</span>
          </div>
        </div>
      </div>
      
      <h2>🎲 The Engagement Roll</h2>
      <div className="engagement-section">
        <h3>How to Roll</h3>
        <p>Start with 1d6, then add dice based on:</p>
        <ul>
          <li><strong>+1d</strong> if the plan is particularly bold or daring</li>
          <li><strong>+1d</strong> if you have a friend or contact who aids the plan</li>
          <li><strong>+1d</strong> if you gather a lot of intel beforehand</li>
          <li><strong>+1d</strong> if you have the right tools for the job</li>
          <li><strong>-1d</strong> if the target is well-protected or alert</li>
          <li><strong>-1d</strong> if you're rushing or under time pressure</li>
        </ul>
        
        <h3>Results</h3>
        <div className="engagement-results">
          <div className="result-card critical">
            <h4>Critical: 6</h4>
            <p>Exceptional result. You're in a dominant position when the action starts.</p>
          </div>
          <div className="result-card good">
            <h4>Good: 4-5</h4>
            <p>Good result. You're in a favorable position when the action starts.</p>
          </div>
          <div className="result-card bad">
            <h4>Bad: 1-3</h4>
            <p>Bad result. You're in a tough spot when the action starts.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const TeamworkContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">🤝 Teamwork</h1>
    <div className="rule-section">
      <p className="lead-text">When the team of bizarre individuals works together, they have access to special teamwork maneuvers that amplify their effectiveness.</p>
      
      <h2>🎯 Teamwork Maneuvers</h2>
      <div className="teamwork-grid">
        <div className="teamwork-card">
          <h3>🤲 Assist</h3>
          <p><strong>When:</strong> Another player is rolling an action</p>
          <p>Help another player who's rolling an action by adding a die to their pool. Describe how you're helping.</p>
          <div className="teamwork-mechanics">
            <span className="mechanic">+1d to their roll</span>
            <span className="requirement">Requires fictional positioning</span>
          </div>
        </div>
        
        <div className="teamwork-card">
          <h3>👥 Lead a Group Action</h3>
          <p><strong>When:</strong> Multiple crew members tackle the same problem</p>
          <p>Coordinate multiple members of the team to tackle a problem together as one action.</p>
          <div className="teamwork-mechanics">
            <span className="mechanic">Leader rolls, others contribute</span>
            <span className="requirement">All participants face consequences</span>
          </div>
        </div>
        
        <div className="teamwork-card">
          <h3>🛡️ Protect</h3>
          <p><strong>When:</strong> A teammate faces a consequence</p>
          <p>Step in to face a consequence that one of your teammates would otherwise face.</p>
          <div className="teamwork-mechanics">
            <span className="mechanic">Take the consequence instead</span>
            <span className="requirement">Must be in position to help</span>
          </div>
        </div>
        
        <div className="teamwork-card">
          <h3>⚡ Set Up</h3>
          <p><strong>When:</strong> Creating an advantage for others</p>
          <p>Create an advantageous situation that another player can exploit on their next action.</p>
          <div className="teamwork-mechanics">
            <span className="mechanic">Improves position/effect</span>
            <span className="requirement">Requires creative approach</span>
          </div>
        </div>
      </div>
      
      <h2>🔄 Group Actions</h2>
      <div className="group-actions-section">
        <h3>How Group Actions Work</h3>
        <ol>
          <li>One player is designated as the leader</li>
          <li>The leader makes the action roll</li>
          <li>Count the number of participants</li>
          <li>Roll that many dice, keep the highest result</li>
          <li>All participants face the consequences based on the result</li>
        </ol>
        
        <h3>When to Use Group Actions</h3>
        <ul>
          <li>Everyone is doing the same thing at the same time</li>
          <li>The task requires coordination</li>
          <li>Individual actions would be less effective</li>
          <li>You want to share the risk among the group</li>
        </ul>
      </div>
    </div>
  </div>
);

const DowntimeContent = () => (
  <div className="rules-content">
    <h1 className="rules-title">🏠 Downtime</h1>
    <div className="rule-section">
      <p className="lead-text">Between scores, your crew spends time at their liberty, attending to personal needs and side projects. This is when characters recover, pursue long-term goals, and deal with the consequences of their actions.</p>
      
      <h2>⚡ Downtime Activities</h2>
      <div className="downtime-grid">
        <div className="downtime-card">
          <h3>📚 Long-Term Project</h3>
          <p>Work on a personal goal or research that takes multiple sessions to complete.</p>
          <div className="activity-details">
            <span className="complexity">Complexity: 4-8 segments</span>
            <span className="roll">Roll: Relevant action</span>
          </div>
          <p className="activity-examples"><strong>Examples:</strong> Learning a new skill, researching ancient artifacts, building relationships</p>
        </div>
        
        <div className="downtime-card">
          <h3>🏥 Recover</h3>
          <p>Heal your injuries and reduce harm levels through rest and medical attention.</p>
          <div className="activity-details">
            <span className="complexity">Auto-success</span>
            <span className="roll">No roll required</span>
          </div>
          <p className="activity-examples"><strong>Effect:</strong> Reduce one harm level by one step (Severe → Moderate → Light → Gone)</p>
        </div>
        
        <div className="downtime-card">
          <h3>🕵️ Reduce Wanted Level</h3>
          <p>Lower your exposure with the authorities through bribes, misdirection, or laying low.</p>
          <div className="activity-details">
            <span className="complexity">Variable</span>
            <span className="roll">Sway, Consort, or other</span>
          </div>
          <p className="activity-examples"><strong>Methods:</strong> Bribing officials, creating alibis, destroying evidence</p>
        </div>
        
        <div className="downtime-card">
          <h3>🎯 Train</h3>
          <p>Gain experience in a specific action rating through practice and study.</p>
          <div className="activity-details">
            <span className="complexity">1 XP per activity</span>
            <span className="roll">No roll required</span>
          </div>
          <p className="activity-examples"><strong>Focus:</strong> Choose one action rating to improve</p>
        </div>
        
        <div className="downtime-card">
          <h3>🎭 Indulge Vice</h3>
          <p>Relieve stress through your personal vice, but risk overindulgence.</p>
          <div className="activity-details">
            <span className="complexity">Stress relief</span>
            <span className="roll">Lowest action + vice rating</span>
          </div>
          <p className="activity-examples"><strong>Risk:</strong> Overindulgence can cause problems</p>
        </div>
        
        <div className="downtime-card">
          <h3>💰 Acquire Asset</h3>
          <p>Obtain special equipment, information, or services for future use.</p>
          <div className="activity-details">
            <span className="complexity">Varies by asset</span>
            <span className="roll">Relevant action</span>
          </div>
          <p className="activity-examples"><strong>Examples:</strong> Rare equipment, insider information, temporary allies</p>
        </div>
      </div>
      
      <h2>📊 Downtime Sequence</h2>
      <div className="downtime-sequence">
        <div className="sequence-step">
          <h3>1. Payoff</h3>
          <p>Distribute coin and reputation from the completed score</p>
        </div>
        <div className="sequence-step">
          <h3>2. Entanglements</h3>
          <p>Roll for entanglements if your exposure level is high</p>
        </div>
        <div className="sequence-step">
          <h3>3. Downtime Activities</h3>
          <p>Each crew member picks 2 downtime activities</p>
        </div>
        <div className="sequence-step">
          <h3>4. Crew Advancement</h3>
          <p>Spend crew XP on upgrades and improvements</p>
        </div>
      </div>
    </div>
  </div>
);

// Main Rules component
const Rules = () => {
  const location = useLocation();
  const [activePath, setActivePath] = useState('');
  const [abilities, setAbilities] = useState([]);
  const [heritages, setHeritages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Extract the current rules section from the URL
    const path = location.pathname.split('/').filter(Boolean);
    if (path.length >= 2) {
      setActivePath(path[1]);
    } else {
      setActivePath('basics');
    }
  }, [location]);

  useEffect(() => {
    // Fetch abilities and heritages data
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch abilities
        const abilitiesResponse = await api.get('/api/abilities/');
        setAbilities(abilitiesResponse.data.results || abilitiesResponse.data || []);
        
        // Fetch heritages
        const heritagesResponse = await api.get('/api/heritages/');
        setHeritages(heritagesResponse.data.results || heritagesResponse.data || []);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        // Set empty arrays as fallback
        setAbilities([]);
        setHeritages([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      {loading ? (
        <div className="rules-container loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Loading game rules...</p>
          </div>
        </div>
      ) : (
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
                  Core System
                </Link>
                <Link 
                  to="/rules/characters" 
                  className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'characters' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
                >
                  Characters
                </Link>
                <Link 
                  to="/rules/stands" 
                  className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'stands' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
                >
                  Stands
                </Link>
                <Link 
                  to="/rules/heritages" 
                  className={`px-4 py-2 mr-2 whitespace-nowrap ${activePath === 'heritages' ? 'bg-[#cc230a] text-white' : 'bg-gray-200 hover:bg-gray-300'} rounded`}
                >
                  Heritages
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
              <Route path="stands" element={<StandsContent abilities={abilities} />} />
              <Route path="heritages" element={<HeritagesContent heritages={heritages} />} />
              <Route path="crew" element={<CrewContent />} />
              <Route path="score" element={<ScoreContent />} />
              <Route path="planning" element={<PlanningContent />} />
              <Route path="teamwork" element={<TeamworkContent />} />
              <Route path="downtime" element={<DowntimeContent />} />
              <Route path="*" element={<BasicsContent />} />
            </Routes>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default Rules;