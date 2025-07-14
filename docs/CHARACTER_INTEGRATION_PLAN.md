# Character.jsx Frontend Integration Plan

## Overview

This document outlines the comprehensive plan for integrating the `Character.jsx` frontend component with the Django REST Framework backend API for the 1(800)BIZARRE TTRPG platform.

## Current State Analysis

### Frontend (`Character.jsx`)
- **Size**: 2,044 lines - monolithic component
- **Architecture**: Single massive component with all functionality embedded
- **Data Management**: Local state only, no backend integration
- **Features**: 
  - Character sheet management
  - Crew management interface
  - Faction management system
  - Dice rolling functionality
  - Search capabilities
  - Progress clock tracking
  - Experience and advancement system
- **UI**: Well-designed with Tailwind CSS, responsive layout
- **Dependencies**: React, Lucide React icons, basic HTTP client setup

### Backend Integration Status
- **API Structure**: Well-defined Django REST Framework API with comprehensive endpoints
- **Models**: Rich data models for characters, stands, crews, factions, etc.
- **Authentication**: Token-based authentication system
- **Endpoints**: Complete CRUD operations for all entities
- **Current Integration**: None - frontend operates entirely in isolation

## Integration Challenges

### 1. Component Architecture
- **Issue**: 2,044-line monolithic component
- **Impact**: Difficult to maintain, test, and debug
- **Solution**: Break into smaller, focused components

### 2. Data Structure Mismatch
- **Issue**: Frontend data structure doesn't align with backend models
- **Impact**: Complex data mapping required
- **Solution**: Create adapter layer between frontend and backend

### 3. State Management
- **Issue**: Local component state only
- **Impact**: No persistence, no real-time updates
- **Solution**: Implement global state management

### 4. Authentication
- **Issue**: Mock authentication (`isAuthenticated = true`)
- **Impact**: No security, no user-specific data
- **Solution**: Implement proper token-based authentication

## Detailed Integration Plan

### Phase 1: Foundation Setup (1-2 days)

#### 1.1 Authentication System
**Current State**: Mock authentication (`isAuthenticated = true`)

**Required Changes**:
- Implement login/signup forms
- Token management with axios interceptors
- Protected route wrapper
- User context provider

**Implementation Tasks**:
```javascript
// Create authentication context
const AuthContext = createContext();

// Implement token management
const useAuth = () => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  
  const login = async (credentials) => {
    const response = await api.post('/accounts/login/', credentials);
    const { token, user } = response.data;
    setToken(token);
    setUser(user);
    localStorage.setItem('token', token);
  };
  
  return { token, user, login, logout };
};
```

#### 1.2 API Service Layer
**Current State**: No API integration

**Required Changes**:
- Create API service modules for each entity
- Error handling and loading states
- Request/response interceptors

**Implementation Tasks**:
```javascript
// Create API service
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
});

// Add request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

#### 1.3 State Management
**Current State**: Local component state

**Required Changes**:
- React Context or Redux for global state
- Character data synchronization
- Campaign/crew data management

**Implementation Tasks**:
```javascript
// Create character context
const CharacterContext = createContext();

const CharacterProvider = ({ children }) => {
  const [characters, setCharacters] = useState([]);
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const loadCharacters = async () => {
    setLoading(true);
    try {
      const response = await api.get('/characters/');
      setCharacters(response.data);
    } catch (error) {
      console.error('Failed to load characters:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <CharacterContext.Provider value={{
      characters,
      currentCharacter,
      loading,
      loadCharacters,
      setCurrentCharacter
    }}>
      {children}
    </CharacterContext.Provider>
  );
};
```

### Phase 2: Core Character Integration (3-4 days)

#### 2.1 Character CRUD Operations
**Current State**: Local state management

**Required Changes**:
- Connect character creation to `/api/characters/`
- Implement character loading/updating
- Handle character deletion
- Real-time save functionality

**Backend Endpoints**:
- `GET /api/characters/` - List user's characters
- `POST /api/characters/` - Create new character
- `GET /api/characters/{id}/` - Get character details
- `PUT /api/characters/{id}/` - Update character
- `DELETE /api/characters/{id}/` - Delete character

**Implementation Tasks**:
```javascript
// Character service
const characterService = {
  async getCharacters() {
    const response = await api.get('/characters/');
    return response.data;
  },
  
  async createCharacter(characterData) {
    const response = await api.post('/characters/', characterData);
    return response.data;
  },
  
  async updateCharacter(id, characterData) {
    const response = await api.put(`/characters/${id}/`, characterData);
    return response.data;
  },
  
  async deleteCharacter(id) {
    await api.delete(`/characters/${id}/`);
  }
};
```

#### 2.2 Data Mapping
**Current State**: Frontend data structure doesn't match backend models

**Required Changes**:
- Map frontend state to backend serializer fields
- Handle nested objects (Stand, Heritage, Abilities)
- Implement proper data validation

**Data Mapping Examples**:
```javascript
// Frontend to Backend mapping
const mapCharacterToBackend = (frontendCharacter) => ({
  true_name: frontendCharacter.name,
  alias: frontendCharacter.alias,
  appearance: frontendCharacter.look,
  background_note: frontendCharacter.background,
  action_dots: frontendCharacter.actionRatings,
  stand_name: frontendCharacter.standName,
  coin_stats: frontendCharacter.standStats,
  stress: frontendCharacter.stress,
  trauma: frontendCharacter.trauma,
  // ... additional mappings
});

// Backend to Frontend mapping
const mapCharacterFromBackend = (backendCharacter) => ({
  id: backendCharacter.id,
  name: backendCharacter.true_name,
  alias: backendCharacter.alias,
  look: backendCharacter.appearance,
  background: backendCharacter.background_note,
  actionRatings: backendCharacter.action_dots,
  standName: backendCharacter.stand_name,
  standStats: backendCharacter.coin_stats,
  stress: backendCharacter.stress,
  trauma: backendCharacter.trauma,
  // ... additional mappings
});
```

#### 2.3 Stand Integration
**Current State**: Basic stand stats in local state

**Required Changes**:
- Connect to Stand model and API
- Handle stand ability management
- Implement stand coin stats validation

**Stand API Endpoints**:
- `GET /api/stands/` - List stands
- `POST /api/stands/` - Create stand
- `GET /api/stands/{id}/` - Get stand details
- `PUT /api/stands/{id}/` - Update stand

### Phase 3: Advanced Features (2-3 days)

#### 3.1 Dice Rolling System
**Current State**: Mock dice rolling

**Required Changes**:
- Connect to `/api/characters/{id}/roll-action/`
- Implement proper action rating validation
- Handle resistance rolls and desperate actions

**Dice Rolling Endpoint**:
```javascript
// Dice rolling service
const diceService = {
  async rollAction(characterId, actionName, diceCount, options = {}) {
    const response = await api.post(`/characters/${characterId}/roll-action/`, {
      action_name: actionName,
      dice_count: diceCount,
      is_resistance_roll: options.isResistanceRoll || false,
      is_desperate_action: options.isDesperateAction || false
    });
    return response.data;
  }
};
```

#### 3.2 Experience & Advancement
**Current State**: Local XP tracking

**Required Changes**:
- Connect to XP history endpoints
- Implement advancement validation
- Handle heritage/stand coin point spending

**XP Endpoints**:
- `POST /api/characters/{id}/add-xp/` - Add XP to character
- `GET /api/xp-history/` - Get XP history

#### 3.3 Progress Clocks
**Current State**: Local clock management

**Required Changes**:
- Connect to ProgressClock model
- Implement clock creation/updating
- Handle different clock types

**Clock Endpoints**:
- `POST /api/characters/{id}/add-progress-clock/` - Add new clock
- `POST /api/characters/{id}/update-progress-clock/` - Update clock

### Phase 4: Crew & Faction Integration (2-3 days)

#### 4.1 Crew Management
**Current State**: Local crew state

**Required Changes**:
- Connect to Crew API endpoints
- Implement crew consensus system
- Handle crew upgrades and special abilities

**Crew Endpoints**:
- `GET /api/crews/` - List crews
- `POST /api/crews/` - Create crew
- `POST /api/crews/{id}/propose-name/` - Propose crew name change
- `POST /api/crews/{id}/approve-name/` - Approve crew name

#### 4.2 Faction System
**Current State**: Mock faction data

**Required Changes**:
- Connect to Faction API
- Implement faction relationships
- Handle reputation tracking

**Faction Endpoints**:
- `GET /api/factions/` - List factions
- `POST /api/factions/` - Create faction

### Phase 5: Search & Navigation (1-2 days)

#### 5.1 Global Search
**Current State**: Mock search functionality

**Required Changes**:
- Connect to `/api/search/` endpoint
- Implement proper search results handling
- Add search result navigation

**Search Implementation**:
```javascript
const searchService = {
  async globalSearch(query) {
    const response = await api.get('/search/', {
      params: { q: query }
    });
    return response.data;
  }
};
```

#### 5.2 Character Switching
**Current State**: Local character switching

**Required Changes**:
- Load characters from user's campaigns
- Handle character permissions
- Implement proper character switching

### Phase 6: Polish & Optimization (1-2 days)

#### 6.1 Error Handling
**Current State**: Basic error handling

**Required Changes**:
- Comprehensive error boundaries
- User-friendly error messages
- Retry mechanisms

#### 6.2 Performance Optimization
**Current State**: Large monolithic component

**Required Changes**:
- Component splitting
- Lazy loading
- Memoization for expensive operations

#### 6.3 Real-time Updates
**Current State**: No real-time functionality

**Required Changes**:
- WebSocket integration for live updates
- Collaborative editing features
- Session synchronization

## Component Refactoring Plan

### Current Structure
```
CharacterSheetWrapper (2,044 lines)
├── State management (200+ lines)
├── Event handlers (300+ lines)
├── UI rendering (1,500+ lines)
└── Utility functions (100+ lines)
```

### Proposed Structure
```
CharacterSheetWrapper (200 lines)
├── CharacterInfo (300 lines)
├── ActionRatings (200 lines)
├── StandStats (150 lines)
├── StressTrauma (200 lines)
├── Abilities (250 lines)
├── ProgressClocks (200 lines)
├── CrewManagement (400 lines)
├── FactionManagement (300 lines)
├── DiceRoller (150 lines)
└── SearchComponent (100 lines)
```

## Technical Decisions

### 1. State Management
**Options**:
- React Context API (recommended for this scale)
- Redux Toolkit
- Zustand

**Recommendation**: React Context API with useReducer for complex state

### 2. Component Architecture
**Options**:
- Keep monolithic component
- Split into smaller components
- Use compound components pattern

**Recommendation**: Split into focused, reusable components

### 3. Real-time Features
**Options**:
- WebSocket with Django Channels
- Server-Sent Events
- Polling

**Recommendation**: Start with polling, upgrade to WebSocket later

### 4. Error Handling Strategy
**Options**:
- Global error boundary
- Component-level error handling
- Service-level error handling

**Recommendation**: Multi-level approach with global fallback

### 5. Data Synchronization
**Options**:
- Optimistic updates
- Server-first approach
- Hybrid approach

**Recommendation**: Server-first with optimistic updates for better UX

## Risk Assessment

### High Risk
1. **Component Size**: 2,044 lines is very large - may need significant refactoring
2. **Data Mapping Complexity**: Frontend and backend data structures differ significantly
3. **Performance Issues**: Large component may cause performance problems

### Medium Risk
1. **Real-time Requirements**: May need WebSocket implementation
2. **Testing Complexity**: Large component difficult to test comprehensively
3. **State Management**: Complex state interactions may cause bugs

### Low Risk
1. **UI Design**: Well-designed and responsive
2. **Backend API**: Comprehensive and well-structured
3. **Authentication**: Standard token-based approach

## Success Metrics

### Phase 1 Success Criteria
- [ ] Authentication system working
- [ ] API service layer implemented
- [ ] Basic character loading functional
- [ ] Error handling in place

### Phase 2 Success Criteria
- [ ] Character CRUD operations working
- [ ] Data mapping validated
- [ ] Stand integration complete
- [ ] Basic validation working

### Phase 3 Success Criteria
- [ ] Dice rolling connected to backend
- [ ] XP system functional
- [ ] Progress clocks working
- [ ] Advanced features tested

### Phase 4 Success Criteria
- [ ] Crew management integrated
- [ ] Faction system working
- [ ] Relationships tracked
- [ ] Multi-user features tested

### Phase 5 Success Criteria
- [ ] Search functionality working
- [ ] Character switching smooth
- [ ] Navigation intuitive
- [ ] Performance acceptable

### Phase 6 Success Criteria
- [ ] Error handling comprehensive
- [ ] Performance optimized
- [ ] Real-time updates working
- [ ] User experience polished

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1 | 1-2 days | Authentication, API layer, basic state management |
| 2 | 3-4 days | Character CRUD, data mapping, stand integration |
| 3 | 2-3 days | Dice rolling, XP system, progress clocks |
| 4 | 2-3 days | Crew management, faction system |
| 5 | 1-2 days | Search, navigation, character switching |
| 6 | 1-2 days | Error handling, optimization, real-time features |

**Total Estimated Timeline: 10-16 days**

## Immediate Next Steps

1. **Set up authentication system** (Day 1)
2. **Create API service layer** (Day 1)
3. **Implement basic character loading** (Day 2)
4. **Test basic CRUD operations** (Day 2)
5. **Begin component refactoring** (Day 3)

## Conclusion

The `Character.jsx` component is well-designed from a UI perspective but requires significant backend integration work. The backend API is comprehensive and well-structured, which will facilitate integration once the foundation is established. The proposed phased approach will ensure steady progress while maintaining system stability.

The key to success will be:
1. **Incremental implementation** - build and test each phase thoroughly
2. **Component refactoring** - break down the monolithic component early
3. **Data mapping focus** - ensure frontend and backend data structures align
4. **Comprehensive testing** - validate each integration point
5. **User feedback** - gather input throughout the process

This integration will transform the frontend from a static prototype into a fully functional, real-time collaborative TTRPG platform. 