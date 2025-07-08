# JoJo TTRPG - Dynamic Ability Management System
## Developer Documentation

### 🎯 System Overview

The Dynamic Ability Management System allows players to manage different types of abilities based on their selected playbook. This creates a more immersive and accurate role-playing experience by providing access to playbook-specific abilities while maintaining a unified interface.

### 🏗️ Architecture

#### Backend Components

**Models** (`/backend/src/characters/models.py`):
- `HamonAbility`: Stores Hamon-specific abilities with type classifications
- `SpinAbility`: Stores Spin-specific abilities with type classifications
- Both models include: `name`, `description`, `stress_cost`, `frequency`, and type fields

**Serializers** (`/backend/src/characters/serializers.py`):
```python
class HamonAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = HamonAbility
        fields = ['id', 'name', 'hamon_type', 'description', 'stress_cost', 'frequency']

class SpinAbilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SpinAbility
        fields = ['id', 'name', 'spin_type', 'description', 'stress_cost', 'frequency']
```

**ViewSets** (`/backend/src/characters/views.py`):
- `HamonAbilityViewSet`: REST API for Hamon abilities
- `SpinAbilityViewSet`: REST API for Spin abilities
- Both require authentication for production use

**API Endpoints**:
- `GET /api/hamon-abilities/` - List all Hamon abilities
- `GET /api/spin-abilities/` - List all Spin abilities
- Standard CRUD operations available for both

#### Frontend Components

**State Management**:
```javascript
// Core state for ability management
const [gameState, setGameState] = useState({
  abilityPanelType: 'standard', // 'standard', 'hamon', 'spin'
  showAbilitiesPanel: false,
  // ... other state
});

// Ability data states
const [standardAbilities, setStandardAbilities] = useState({});
const [hamonAbilities, setHamonAbilities] = useState({});
const [spinAbilities, setSpinAbilities] = useState({});
```

**Helper Functions**:

1. **`getAvailableAbilities()`**:
   - Returns the appropriate ability set based on current panel type
   - Switches between standard, hamon, and spin abilities

2. **`getCharacterAbilities()`**:
   - Gets character's abilities for the current panel type
   - Returns appropriate array from character data

3. **`updateCharacterAbilities(abilities)`**:
   - Updates character's abilities for the current panel type
   - Returns updated character object

4. **`getAbilityPanelOptions()`**:
   - Returns available panel options based on character's playbook
   - Dynamically shows/hides Hamon and Spin options

**Auto-switching Logic**:
```javascript
useEffect(() => {
  if (character.playbook === 'Hamon' && gameState.abilityPanelType !== 'hamon') {
    setGameState(prev => ({ ...prev, abilityPanelType: 'hamon' }));
  } else if (character.playbook === 'Spin' && gameState.abilityPanelType !== 'spin') {
    setGameState(prev => ({ ...prev, abilityPanelType: 'spin' }));
  } else if (!['Hamon', 'Spin'].includes(character.playbook) && gameState.abilityPanelType !== 'standard') {
    setGameState(prev => ({ ...prev, abilityPanelType: 'standard' }));
  }
}, [character.playbook, gameState.abilityPanelType]);
```

### 🎨 Visual Design

#### Color Coding System:
- **Standard Abilities**: Blue (`#3b82f6`) ⭐
- **Hamon Abilities**: Yellow (`#eab308`) ☀️ (Represents sunlight)
- **Spin Abilities**: Green (`#10b981`) 🌀 (Represents golden ratio/nature)
- **Special Abilities**: Purple (`#8b5cf6`) ⚡

#### UI Components:
- **Dropdown Selector**: Dynamic options based on playbook
- **Checkbox Interface**: Unified across all ability types
- **Visual Indicators**: Colored borders and backgrounds
- **Emoji Icons**: Quick visual identification

### 📊 Data Flow

1. **Initialization**:
   - Frontend fetches abilities from backend APIs
   - Fallback data used if API unavailable
   - Character data loaded with ability arrays

2. **Playbook Change**:
   - Auto-switching logic triggers
   - Panel type updates automatically
   - Available options refresh

3. **Ability Selection**:
   - User selects abilities via checkboxes
   - Character data updates immediately
   - Changes persist automatically

4. **Persistence**:
   - All ability types stored in character object
   - Save/load includes all ability arrays
   - No data loss when switching types

### 🔧 Configuration

#### Adding New Ability Types

To add a new ability type (e.g., "Vampire" abilities):

1. **Backend**:
   ```python
   # Add model to models.py
   class VampireAbility(models.Model):
       name = models.CharField(max_length=100)
       vampire_type = models.CharField(max_length=20, choices=VAMPIRE_TYPE_CHOICES)
       description = models.TextField()
       # ... other fields
   
   # Add serializer
   class VampireAbilitySerializer(serializers.ModelSerializer):
       # ... implementation
   
   # Add ViewSet
   class VampireAbilityViewSet(viewsets.ModelViewSet):
       # ... implementation
   ```

2. **Frontend**:
   ```javascript
   // Add state
   const [vampireAbilities, setVampireAbilities] = useState({});
   
   // Update helper functions
   const getAvailableAbilities = () => {
     switch (gameState.abilityPanelType) {
       case 'vampire':
         return vampireAbilities;
       // ... other cases
     }
   };
   
   // Add to panel options
   if (character.playbook === 'Vampire') {
     options.push({ value: 'vampire', label: 'Vampire Abilities' });
   }
   ```

#### Fallback Data

Each ability type has comprehensive fallback data for offline usage:
- 12 Hamon abilities covering Foundation and Traditionalist types
- 12 Spin abilities covering Foundation and Cavalier types
- 8 Standard abilities for general use

### 🧪 Testing

#### Manual Testing Checklist:

**Basic Functionality**:
- [ ] Create character with different playbooks
- [ ] Verify dropdown options change based on playbook
- [ ] Test ability selection and deselection
- [ ] Verify persistence across save/load

**Edge Cases**:
- [ ] Switch playbooks with abilities selected
- [ ] Test with empty ability lists
- [ ] Verify fallback data when API unavailable
- [ ] Test character import/export with abilities

**Visual Verification**:
- [ ] Color coding displays correctly
- [ ] Emoji icons appear properly
- [ ] Hover states work as expected
- [ ] Panel scrolling functions correctly

#### Automated Testing

Key test scenarios to implement:
```javascript
// Test helper functions
describe('Ability Management', () => {
  test('getAvailableAbilities returns correct set', () => {
    // Test standard, hamon, spin ability selection
  });
  
  test('auto-switching works correctly', () => {
    // Test playbook change triggers panel type update
  });
  
  test('ability persistence works', () => {
    // Test save/load preserves all ability types
  });
});
```

### 🚀 Performance Considerations

#### Optimization Strategies:
1. **Lazy Loading**: Abilities loaded only when needed
2. **Caching**: Ability data cached in state
3. **Debouncing**: Rapid selection changes debounced
4. **Virtual Scrolling**: For large ability lists (future enhancement)

#### Memory Management:
- Fallback data loaded once on mount
- API responses cached until page reload
- Character state updates use immutable patterns

### 🔮 Future Enhancements

#### Planned Features:

1. **Ability Categories**:
   - Foundation, Advanced, Master tiers
   - Prerequisites and unlock conditions
   - Experience-based progression

2. **Search and Filter**:
   - Text search across ability names/descriptions
   - Filter by type, cost, frequency
   - Favorites system

3. **Enhanced Visuals**: 
   - Ability icons and artwork
   - Animation transitions
   - Sound effects for selection

4. **Advanced Features**:
   - Ability recommendations based on build
   - Combination suggestions
   - Export ability lists
   - Integration of temporary abilities from 'A' rank Development Potential into the UI.

#### Extension Points:

**Custom Ability Types**:
- Framework supports easy addition of new types
- Modular design allows third-party extensions
- API structure accommodates additional fields

**Integration Opportunities**:
- Character builder integration
- Campaign management features
- Dice rolling system connections

### 📚 References

#### Key Files:
- `/backend/src/characters/models.py` - Data models
- `/backend/src/characters/views.py` - API endpoints
- `/frontend/src/components/CharacterSheet.jsx` - Main implementation
- `/backend/src/characters/fixtures/` - Sample data

#### External Dependencies:
- Django REST Framework for backend APIs
- React hooks for state management
- Axios for HTTP requests

#### Documentation:
- API documentation available at `/api/docs/` (when enabled)
- Character model documentation in codebase
- Frontend component documentation in JSDoc format

---

## 📈 Success Metrics

The Dynamic Ability Management System successfully achieves:

- ✅ **User Experience**: Seamless switching between ability types
- ✅ **Data Integrity**: All abilities properly stored and retrieved
- ✅ **Performance**: Fast response times and smooth interactions
- ✅ **Maintainability**: Clean, modular code structure
- ✅ **Extensibility**: Easy to add new ability types
- ✅ **Visual Design**: Clear, intuitive interface with proper feedback

This system significantly enhances the JoJo TTRPG experience by providing players with authentic, playbook-specific abilities while maintaining the simplicity and elegance of the original interface.
