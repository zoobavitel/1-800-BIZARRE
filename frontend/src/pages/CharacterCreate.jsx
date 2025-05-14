// src/pages/CharacterCreate.jsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../utils/AuthContext';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';

// Import step components
import PlaybookSelector from '../components/character/steps/PlaybookSelector';
import HeritageSelector from '../components/character/steps/HeritageSelector';
import BackgroundEditor from '../components/character/steps/BackgroundEditor';
import ActionDotsDistributor from '../components/character/steps/ActionDotsDistributor';
import StandCreator from '../components/character/steps/StandCreator';
import AbilitySelector from '../components/character/steps/AbilitySelector';
import ArmorSelector from '../components/character/steps/ArmorSelector';
import RelationshipEditor from '../components/character/steps/RelationshipEditor';
import ViceSelector from '../components/character/steps/ViceSelector';
import CharacterIdentity from '../components/character/steps/CharacterIdentity';
import XpTriggerViewer from '../components/character/steps/XpTriggerViewer';
import LoadoutSelector from '../components/character/steps/LoadoutSelector';
import SuccessScreen from '../components/character/steps/SuccessScreen';

// Import shared components
import StepIndicator from '../components/shared/StepIndicator';
import NavigationButtons from '../components/shared/NavigationButtons';

export default function CharacterCreate() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth(); // Use isAuthenticated instead if needed

  
  // === Wizard step state ===
  const [step, setStep] = useState(1);
  const [totalSteps] = useState(13); // Added success screen as step 13
  const next = () => setStep(s => Math.min(totalSteps, s + 1));
  const prev = () => setStep(s => Math.max(1, s - 1));
  
  // === Submission state ===
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState(null);
  const [createdCharacterId, setCreatedCharacterId] = useState(null);
  
  // === Data lists ===
  const [heritages, setHeritages] = useState([]);
  const [vices, setVices] = useState([]);
  const [abilities, setAbilities] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  // === Form fields ===
  // Basic character info
  const [playbook, setPlaybook] = useState('');
  const [heritageId, setHeritageId] = useState('');
  const [backgroundNote, setBackgroundNote] = useState('');
  const [backgroundNote2, setBackgroundNote2] = useState('');
  
  // Action dots
  const [actionDots, setActionDots] = useState({
    study: 0, survey: 0, tinker: 0, hunt: 0,
    prowl: 0, skirmish: 0, finesse: 0, wreck: 0,
    bizarre: 0, sway: 0, command: 0, consort: 0
  });
  
  // Stand-related state
  const [standType, setStandType] = useState('');
  const [standName, setStandName] = useState('');
  const [standForm, setStandForm] = useState('');
  const [standConscious, setStandConscious] = useState(true);
  const [coinStats, setCoinStats] = useState({
    power: 0, speed: 0, range: 0,
    durability: 0, precision: 0, development: 0
  });
  
  // Ability state
  const [standAbilities, setStandAbilities] = useState([]);
  const [customAbilityType, setCustomAbilityType] = useState("single_with_3_uses");
  const [customAbilityDescription, setCustomAbilityDescription] = useState("");
  const [selectedStandardAbilities, setSelectedStandardAbilities] = useState([]);
  
  // Character attributes
  const [armorType, setArmorType] = useState('');
  const [closeFriend, setCloseFriend] = useState('');
  const [rival, setRival] = useState('');
  
  // Vice information
  const [viceId, setViceId] = useState('');
  const [viceDetails, setViceDetails] = useState('');
  const [customViceName, setCustomViceName] = useState('');
  
  // Identity
  const [trueName, setTrueName] = useState('');
  const [alias, setAlias] = useState('');
  const [appearance, setAppearance] = useState('');
  const [loadout, setLoadout] = useState(1);
  
  // Heritage-specific state
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const [selectedDetriments, setSelectedDetriments] = useState([]);
  const [heritageHP, setHeritageHP] = useState(0);
  const [bonusHpFromXp, setBonusHpFromXp] = useState(0);
  
  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoading(true);
      try {
        const [heritagesRes, vicesRes, abilitiesRes] = await Promise.all([
          api.get('heritages/'),
          api.get('vices/'),
          api.get('abilities/')
        ]);
        
        setHeritages(heritagesRes.data);
        setVices(vicesRes.data);
        setAbilities(abilitiesRes.data);
      } catch (error) {
        console.error("Failed to load initial data:", error);
        setSubmissionError("Failed to load game data. Please try refreshing the page.");
      } finally {
        setIsDataLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Calculate derived values
  const aGradeCount = useMemo(() => 
    Object.values(coinStats).filter(v => v === 4).length, 
    [coinStats]
  );
  
  const totalStandAbilities = useMemo(() => 
    3 + 2 * aGradeCount, 
    [aGradeCount]
  );
  
  const totalStandardAbilities = useMemo(() => 
    1 + aGradeCount, 
    [aGradeCount]
  );
  
  // Calculate total action dots used
  const totalActionDots = useMemo(() => 
    Object.values(actionDots).reduce((sum, val) => sum + val, 0),
  [actionDots]);

  // Calculate total coin points used
  const coinPointsUsed = useMemo(() => 
    Object.values(coinStats).reduce((sum, pts) => sum + pts, 0),
    [coinStats]
  );
  
  // Calculate heritage HP
  const calculateTotalHP = useCallback(() => {
    if (!heritageId) return 0;
    
    const selectedHeritage = heritages.find(h => h.id === Number(heritageId));
    if (!selectedHeritage) return 0;
    
    const baseHp = selectedHeritage.base_hp || 0;
    
    const benefitCost = selectedBenefits
      .map(id => selectedHeritage.benefits?.find(b => b.id === id))
      .filter(Boolean)
      .reduce((sum, b) => sum + b.hp_cost, 0);
    
    const detrimentGain = selectedDetriments
      .map(id => selectedHeritage.detriments?.find(d => d.id === id))
      .filter(Boolean)
      .reduce((sum, d) => sum + d.hp_value, 0);
    
    return baseHp + bonusHpFromXp - benefitCost + detrimentGain;
  }, [heritageId, heritages, selectedBenefits, selectedDetriments, bonusHpFromXp]);
  
  // Update stand abilities when grades change
  useEffect(() => {
    const base = 3;
    const bonus = 2 * aGradeCount;
  
    setStandAbilities(prev => {
      let desiredCount;
      if (customAbilityType === 'single_with_3_uses') {
        desiredCount = 1; // Only 1 ability, but it implies multiple internal "uses"
      } else {
        desiredCount = base + bonus;
      }
  
      if (prev.length < desiredCount) {
        return [
          ...prev,
          ...Array(desiredCount - prev.length).fill({ name: '', desc: '' })
        ];
      } else if (prev.length > desiredCount) {
        return prev.slice(0, desiredCount);
      }
      return prev;
    });
  }, [customAbilityType, aGradeCount]);
  
  // Update heritageHP when calculations change
  useEffect(() => {
    setHeritageHP(calculateTotalHP());
  }, [calculateTotalHP]);
  
  // Required benefits and detriments from heritage
  useEffect(() => {
    if (!heritageId) return;
    
    const selectedHeritage = heritages.find(h => h.id === Number(heritageId));
    if (!selectedHeritage) return;
    
    // Set required benefits
    const requiredBenefits = selectedHeritage.benefits?.filter(b => b.required) || [];
    setSelectedBenefits(requiredBenefits.map(b => b.id));
    
    // Set required detriments
    const requiredDetriments = selectedHeritage.detriments?.filter(d => d.required) || [];
    setSelectedDetriments(requiredDetriments.map(d => d.id));
  }, [heritageId, heritages]);
  
  // Auto-redirect timer for success screen
  useEffect(() => {
    let redirectTimer;
    if (step === totalSteps && createdCharacterId) {
      redirectTimer = setTimeout(() => {
        navigate(`/characters/${createdCharacterId}`);
      }, 5000); // Auto-redirect after 5 seconds
    }
    
    return () => {
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [step, createdCharacterId, navigate, totalSteps]);
  
  // === Form validation ===
  const validateStep = () => {
    switch (step) {
      case 1:
        return !!playbook;
      case 2:
        return !!heritageId && !!backgroundNote;
      case 3:
        return !!backgroundNote2;
      case 4:
        return totalActionDots === 7;
      case 5:
        return !!standType && !!standName && coinPointsUsed === 10;
      case 6:
        return (
          standAbilities.length > 0 &&
          standAbilities.every(a => a.name && a.desc) &&
          selectedStandardAbilities.length > 0
        );
      case 7:
        return !!armorType;
      case 8:
        return !!closeFriend && !!rival;
      case 9:
        return !!viceId && !!viceDetails && (viceId !== -1 || !!customViceName);
      case 10:
        return !!trueName;
      case 11:
        return true; // Just informational
      case 12:
        return true; // Loadout always has a default
      case 13:
        return true; // Success screen
      default:
        return true;
    }
  };
  
  // Updated handleSubmit function for CharacterCreate.jsx
  const handleSubmit = async e => {
    e.preventDefault();
    
    // Final validation
    if (!validateStep()) {
      alert('Please complete all required fields before creating your character.');
      return;
    }
    
    // Prevent double submission
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setSubmissionError(null);
    
    try {
      // Prepare data for submission
      const payload = {
        // Do NOT include user field - the backend will add it from the auth token
        playbook,
        heritage: Number(heritageId),
        background_note: backgroundNote,
        background_note2: backgroundNote2,
        action_dots: actionDots,
        stand_type: standType, 
        stand_name: standName,
        stand_form: standForm,
        stand_conscious: standConscious,
        coin_stats: coinStats,
        
        // Step 6 ability data
        custom_ability_type: customAbilityType,
        custom_ability_description: customAbilityDescription,
        extra_custom_abilities: standAbilities,
        standard_abilities: selectedStandardAbilities.filter(Boolean),
        
        armor_type: armorType,
        vice_details: viceDetails,
        true_name: trueName,
        alias: alias || null, // Handle empty string
        appearance: appearance || null, // Handle empty string
        loadout,
        close_friend: closeFriend,
        rival,
        bonus_hp_from_xp: bonusHpFromXp,
        selected_benefits: selectedBenefits,
        selected_detriments: selectedDetriments,
      };
      
      // Handle custom vice
      if (viceId === -1 && customViceName) {
        payload.custom_vice = customViceName;
      } else {
        payload.vice = Number(viceId);
      }
      
      console.log('Submitting character payload:', payload);
      
      // Make the API request with auth header
      // The interceptor in axios.js should automatically add the token
      const response = await api.post('characters/', payload);
      
      console.log('Character created successfully:', response.data);
      setCreatedCharacterId(response.data.id);
      next(); // Go to success screen
    } catch (err) {
      console.error('Error creating character:', err);
      
      // More detailed error logging
      if (err.response) {
        console.error('Response data:', err.response.data);
        console.error('Response status:', err.response.status);
        
        // Handle specific error types
        if (err.response.status === 403 || err.response.status === 401) {
          setSubmissionError('Authentication error. Please log in again.');
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        } else {
          // Display the actual error message from the server
          const errorMessage = typeof err.response.data === 'object'
            ? JSON.stringify(err.response.data)
            : err.response.data;
          
          setSubmissionError(`Error creating character: ${errorMessage}`);
        }
      } else if (err.request) {
        // Request was made but no response received
        setSubmissionError('No response from server. Please check your connection.');
      } else {
        // Error setting up the request
        setSubmissionError('Error preparing request: ' + err.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Render the appropriate step component
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <PlaybookSelector 
            playbook={playbook}
            onPlaybookChange={setPlaybook}
          />
        );
        
      case 2:
        return (
          <HeritageSelector
            heritages={heritages}
            selectedHeritageId={heritageId}
            onHeritageChange={setHeritageId}
            backgroundNote={backgroundNote}
            onBackgroundNoteChange={setBackgroundNote}
            selectedBenefits={selectedBenefits}
            onSelectedBenefitsChange={setSelectedBenefits}
            selectedDetriments={selectedDetriments}
            onSelectedDetrimentsChange={setSelectedDetriments}
            bonusHpFromXp={bonusHpFromXp}
            onBonusHpChange={setBonusHpFromXp}
            heritageHP={heritageHP}
          />
        );
        
      case 3:
        return (
          <BackgroundEditor
            backgroundNote={backgroundNote2}
            onBackgroundNoteChange={setBackgroundNote2}
          />
        );
        
      case 4:
        return (
          <ActionDotsDistributor
            actionDots={actionDots}
            onActionDotsChange={setActionDots}
            totalActionDots={totalActionDots}
          />
        );
        
      case 5:
        return (
          <StandCreator
            playbook={playbook}
            standType={standType}
            onStandTypeChange={setStandType}
            standName={standName}
            onStandNameChange={setStandName}
            standForm={standForm}
            onStandFormChange={setStandForm}
            standConscious={standConscious}
            onStandConsciousChange={setStandConscious}
            coinStats={coinStats}
            onCoinStatsChange={setCoinStats}
            coinPointsUsed={coinPointsUsed}
          />
        );
        
      case 6:
        return (
          <AbilitySelector
            abilities={abilities}
            standAbilities={standAbilities}
            onStandAbilitiesChange={setStandAbilities}
            customAbilityType={customAbilityType}
            onCustomAbilityTypeChange={setCustomAbilityType}
            customAbilityDescription={customAbilityDescription}
            onCustomAbilityDescriptionChange={setCustomAbilityDescription}
            selectedStandardAbilities={selectedStandardAbilities}
            onSelectedStandardAbilitiesChange={setSelectedStandardAbilities}
            totalStandAbilities={totalStandAbilities}
            totalStandardAbilities={totalStandardAbilities}
            aGradeCount={aGradeCount}
          />
        );
        
      case 7:
        return (
          <ArmorSelector
            playbook={playbook}
            armorType={armorType}
            onArmorTypeChange={setArmorType}
          />
        );
        
      case 8:
        return (
          <RelationshipEditor
            closeFriend={closeFriend}
            onCloseFriendChange={setCloseFriend}
            rival={rival}
            onRivalChange={setRival}
          />
        );
        
      case 9:
        return (
          <ViceSelector
            vices={vices}
            selectedViceId={viceId}
            viceDetails={viceDetails}
            customViceName={customViceName}
            onViceChange={setViceId}
            onViceDetailsChange={setViceDetails}
            onCustomViceNameChange={setCustomViceName}
          />
        );
        
      case 10:
        return (
          <CharacterIdentity
            trueName={trueName}
            onTrueNameChange={setTrueName}
            alias={alias}
            onAliasChange={setAlias}
            appearance={appearance}
            onAppearanceChange={setAppearance}
          />
        );
        
      case 11:
        return <XpTriggerViewer />;
        
      case 12:
        return (
          <LoadoutSelector
            loadout={loadout}
            onLoadoutChange={setLoadout}
          />
        );
        
      case 13:
        return (
          <SuccessScreen 
            characterId={createdCharacterId}
            characterName={trueName}
            playbook={playbook}
            onViewSheet={() => navigate(`/characters/${createdCharacterId}`)}
            onCreateAnother={() => window.location.reload()}
          />
        );
        
      default:
        return <div>Unknown step</div>;
    }
  };

  // If loading initial data, show loading spinner
  if (isDataLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-screen">
          <LoadingSpinner size="large" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-white rounded shadow">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Create Character</h2>
          {step < totalSteps && (
            <StepIndicator currentStep={step} totalSteps={totalSteps - 1} />
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          {renderStepContent()}
          
          {submissionError && (
            <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
              {submissionError}
            </div>
          )}
          
          {step < totalSteps && (
            <NavigationButtons 
              currentStep={step} 
              totalSteps={totalSteps - 1}
              onPrev={prev}
              onNext={() => {
                if (validateStep()) {
                  if (step === totalSteps - 1) {
                    // Submit the form when clicking Next on the final regular step
                    handleSubmit({ preventDefault: () => {} });
                  } else {
                    next();
                  }
                } else {
                  alert('Please complete all required fields in this step before continuing.');
                }
              }}
              onSubmit={handleSubmit}
              isValid={validateStep()}
              isSubmitting={isSubmitting}
            />
          )}
        </form>
      </div>
    </Layout>
  );
}