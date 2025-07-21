# Backend Integration Guide

## Overview

This guide explains how to connect your React character sheet frontend to the Django backend. The integration includes:

1. **API Service Layer** - Handles HTTP requests to Django
2. **Custom Hooks** - Manages state and backend synchronization
3. **Connected Components** - Backend-aware versions of UI components
4. **Authentication** - Token-based auth with Django REST Framework

## Architecture

```
Frontend (React)
├── API Layer (characterApi.js)
├── Custom Hooks (useCharacter.js)
├── Connected Components (CharacterSheetConnected.jsx)
└── Pages (CharacterSheetPage.jsx)
                ↓
Backend (Django)
├── Models (Character, Stand, etc.)
├── Serializers (CharacterSerializer, etc.)
├── ViewSets (CharacterViewSet, etc.)
└── URLs (/api/characters/, etc.)
```

## Setup Steps

### 1. Install Dependencies

Make sure your frontend has these packages:
```bash
cd frontend
npm install axios react-router-dom
```

### 2. Configure Axios Base URL

Update `frontend/src/api/axios.js`:
```javascript
import axios from 'axios';

const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 10000,
});

// Add auth token to requests
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

export default instance;
```

### 3. Environment Variables

Create `frontend/.env`:
```
REACT_APP_API_URL=http://localhost:8000
```

For production:
```
REACT_APP_API_URL=https://your-domain.com
```

### 4. Update Backend URLs

Ensure your Django `backend/src/app/urls.py` includes:
```python
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from characters.views import (
    CharacterViewSet, CampaignViewSet, AbilityViewSet,
    HamonAbilityViewSet, SpinAbilityViewSet, HeritageViewSet,
    ViceViewSet, global_search, get_available_playbook_abilities
)

router = DefaultRouter()
router.register(r'characters', CharacterViewSet)
router.register(r'campaigns', CampaignViewSet)
router.register(r'abilities', AbilityViewSet)
router.register(r'hamon-abilities', HamonAbilityViewSet)
router.register(r'spin-abilities', SpinAbilityViewSet)
router.register(r'heritages', HeritageViewSet)
router.register(r'vices', ViceViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/search/', global_search, name='global_search'),
    path('api/playbook-abilities/', get_available_playbook_abilities, name='playbook_abilities'),
    path('api/auth/', include('rest_framework.urls')),
]
```

### 5. Backend Model Updates

Your Character model should include these fields for frontend compatibility:

```python
# In backend/src/characters/models.py
class Character(models.Model):
    # Basic info
    name = models.CharField(max_length=100)  # Maps to frontend 'name'
    crew = models.CharField(max_length=100, blank=True)  # Maps to 'crew'
    stand_name = models.CharField(max_length=100, blank=True)
    look = models.TextField(blank=True)  # Maps to 'look'
    heritage = models.CharField(max_length=100, blank=True)
    background = models.CharField(max_length=100, blank=True)
    
    # Game mechanics
    stress = models.JSONField(default=list)  # Array of booleans [true, false, ...]
    trauma = models.JSONField(default=dict)  # Object {COLD: false, HAUNTED: true, ...}
    harm = models.JSONField(default=dict)  # Object {level1: ["", ""], level2: [...], ...}
    coin = models.JSONField(default=list)  # Array of booleans for coin boxes
    stash = models.JSONField(default=list)  # Array of booleans for stash boxes
    action_ratings = models.JSONField(default=dict)  # Object {HUNT: 2, STUDY: 1, ...}
    
    # New fields for enhanced features
    wanted_level = models.IntegerField(default=0)  # 0-5 stars
    position = models.CharField(max_length=20, default='RISKY')
    effect = models.CharField(max_length=20, default='STANDARD')
    vaults = models.IntegerField(default=0)  # 0-2 vaults for stash expansion
    stand_coin_stats = models.JSONField(default=dict)  # Stand stats
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 6. Serializer Updates

Update `CharacterSerializer` to include all frontend fields:

```python
# In backend/src/characters/serializers.py
class CharacterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Character
        fields = [
            'id', 'name', 'crew', 'stand_name', 'look', 'heritage', 'background',
            'stress', 'trauma', 'harm', 'coin', 'stash', 'action_ratings',
            'wanted_level', 'position', 'effect', 'vaults', 'stand_coin_stats',
            'created_at', 'updated_at'
        ]
    
    def validate_stress(self, value):
        """Ensure stress is array of 9 booleans"""
        if not isinstance(value, list) or len(value) != 9:
            raise serializers.ValidationError("Stress must be array of 9 booleans")
        return value
    
    def validate_action_ratings(self, value):
        """Ensure action ratings are valid"""
        required_actions = [
            'HUNT', 'STUDY', 'SURVEY', 'TINKER',
            'FINESSE', 'PROWL', 'SKIRMISH', 'WRECK',
            'BIZARRE', 'COMMAND', 'CONSORT', 'SWAY'
        ]
        for action in required_actions:
            if action not in value:
                value[action] = 0
            elif not isinstance(value[action], int) or value[action] < 0 or value[action] > 4:
                raise serializers.ValidationError(f"Invalid rating for {action}")
        return value
```

## Usage Examples

### 1. Loading a Character

```javascript
// In a React component
import { useCharacter } from '../hooks/useCharacter';

const CharacterSheet = ({ characterId }) => {
  const { character, loading, error, saving } = useCharacter(characterId);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>{character.name}</h1>
      {saving && <div>Saving...</div>}
      {/* Rest of character sheet */}
    </div>
  );
};
```

### 2. Updating Character Data

```javascript
// Using the custom hook
const { updateStress, updateActionRatings } = useCharacter(characterId);

// Update stress when box is clicked
const handleStressChange = (index) => {
  const newStress = [...character.stress];
  newStress[index] = !newStress[index];
  updateStress(newStress);  // Automatically saves to backend
};

// Update action rating
const handleActionRatingChange = (action, value) => {
  const newRatings = { ...character.action_ratings };
  newRatings[action] = value;
  updateActionRatings(newRatings);  // Automatically saves to backend
};
```

### 3. Creating New Characters

```javascript
import { characterApi } from '../api/characterApi';

const createNewCharacter = async (characterData) => {
  try {
    const newCharacter = await characterApi.createCharacter({
      name: "New Character",
      playbook: "STAND",
      stress: Array(9).fill(false),
      trauma: {
        COLD: false, HAUNTED: false, OBSESSED: false, PARANOID: false,
        RECKLESS: false, SOFT: false, UNSTABLE: false, VICIOUS: false
      },
      action_ratings: {
        HUNT: 0, STUDY: 0, SURVEY: 0, TINKER: 0,
        FINESSE: 0, PROWL: 0, SKIRMISH: 0, WRECK: 0,
        BIZARRE: 0, COMMAND: 0, CONSORT: 0, SWAY: 0
      }
    });
    console.log('Character created:', newCharacter);
  } catch (error) {
    console.error('Failed to create character:', error);
  }
};
```

## Authentication Flow

### 1. Login Component

```javascript
import { characterApi } from '../api/characterApi';

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('/api/auth/login/', credentials);
      localStorage.setItem('authToken', response.data.token);
      // Redirect to character list or dashboard
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  // ... rest of component
};
```

### 2. Protected Routes

```javascript
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" />;
};

// In your App.js
<Route path="/characters/:characterId" element={
  <ProtectedRoute>
    <CharacterSheetPage />
  </ProtectedRoute>
} />
```

## Real-time Features

### Auto-save with Debouncing

The `useCharacter` hook automatically saves changes after 1 second of inactivity:

```javascript
// In useCharacter.js
const debouncedSave = useCallback((updates) => {
  if (saveTimeout) clearTimeout(saveTimeout);
  
  const timeout = setTimeout(() => {
    saveCharacter(updates);
  }, 1000); // Save after 1 second of inactivity
  
  setSaveTimeout(timeout);
}, [saveCharacter, saveTimeout]);
```

### Optimistic Updates

Changes appear immediately in the UI, then sync to backend:

```javascript
const updateCharacter = useCallback((updates) => {
  // Update UI immediately
  setCharacter(prevCharacter => ({ ...prevCharacter, ...updates }));
  // Save to backend with debouncing
  debouncedSave(updates);
}, [debouncedSave]);
```

## Error Handling

### Network Errors

```javascript
// In characterApi.js
try {
  const response = await axios.get(`/api/characters/${characterId}/`);
  return response.data;
} catch (error) {
  if (error.response?.status === 404) {
    throw new Error('Character not found');
  } else if (error.response?.status === 403) {
    throw new Error('You do not have permission to view this character');
  } else if (!error.response) {
    throw new Error('Network error - please check your connection');
  } else {
    throw new Error(error.response.data?.detail || 'An error occurred');
  }
}
```

### Validation Errors

```javascript
// Handle validation errors from Django
catch (error) {
  if (error.response?.status === 400) {
    const validationErrors = error.response.data;
    // Display field-specific errors to user
    setFieldErrors(validationErrors);
  }
}
```

## Performance Optimization

### Lazy Loading

```javascript
// Lazy load the character sheet component
const CharacterSheetConnected = lazy(() => import('../components/CharacterSheetConnected'));

// In your routes
<Route path="/characters/:characterId" element={
  <Suspense fallback={<div>Loading character sheet...</div>}>
    <CharacterSheetConnected />
  </Suspense>
} />
```

### Memoization

```javascript
// Memoize expensive calculations
const attributeDice = useMemo(() => {
  return getAttributeDice(['HUNT', 'STUDY', 'SURVEY', 'TINKER']);
}, [character.action_ratings]);
```

## Testing

### API Testing

```javascript
// Test API calls
import { characterApi } from '../api/characterApi';

test('should fetch character data', async () => {
  const character = await characterApi.getCharacter(1);
  expect(character).toHaveProperty('name');
  expect(character).toHaveProperty('stress');
});
```

### Hook Testing

```javascript
import { renderHook, act } from '@testing-library/react';
import { useCharacter } from '../hooks/useCharacter';

test('should update character stress', async () => {
  const { result } = renderHook(() => useCharacter(1));
  
  await act(async () => {
    result.current.updateStress([true, false, false, false, false, false, false, false, false]);
  });
  
  expect(result.current.character.stress[0]).toBe(true);
});
```

## Deployment Considerations

### Environment Variables

Production `.env`:
```
REACT_APP_API_URL=https://your-production-domain.com
```

### CORS Settings

In Django `settings.py`:
```python
CORS_ALLOWED_ORIGINS = [
    "https://your-frontend-domain.com",
    "http://localhost:3000",  # For development
]
```

### Build Process

```bash
# Build for production
npm run build

# Serve static files through Django or CDN
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check Django CORS settings
2. **401 Unauthorized**: Verify token is being sent in headers
3. **404 Not Found**: Check API URL configuration
4. **Validation Errors**: Ensure frontend data matches backend expectations

### Debug Tools

```javascript
// Add logging to API calls
console.log('API Request:', method, url, data);
console.log('API Response:', response.data);

// Monitor network requests in browser dev tools
// Use React Developer Tools for component state
```

This integration provides a robust, scalable foundation for your 1-800-BIZARRE character sheet application with real-time synchronization, proper error handling, and optimal user experience. 