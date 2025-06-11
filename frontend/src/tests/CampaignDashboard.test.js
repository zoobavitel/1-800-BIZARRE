// src/tests/CampaignDashboard.test.js
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import CampaignDashboard from '../pages/CampaignDashboard';
import { AuthProvider } from '../utils/AuthContext';

// Mock the API module
jest.mock('../api/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

// Mock the Layout component to focus on CampaignDashboard logic
jest.mock('../components/Layout', () => {
  return function MockLayout({ children }) {
    return <div data-testid="layout">{children}</div>;
  };
});

const mockApi = require('../api/axios');

// Helper function to render CampaignDashboard with necessary providers
const renderCampaignDashboard = (authValue = { isAuthenticated: true }) => {
  return render(
    <BrowserRouter>
      <AuthProvider value={authValue}>
        <CampaignDashboard />
      </AuthProvider>
    </BrowserRouter>
  );
};

// Mock campaign data
const mockCampaigns = [
  {
    id: 1,
    name: "1(800)BIZARRE",
    description: "A bizarre adventure through modern-day stands and mysteries",
    created_date: "2024-01-15",
    gm_name: "DM_JoJo",
    player_count: 4,
    max_players: 6,
    open_to_new_players: true,
    user_role: "player",
    status: "active",
    characters: [
      { name: "Josuke", avatar: "/api/placeholder/40/40" },
      { name: "Okuyasu", avatar: "/api/placeholder/40/40" }
    ],
    last_session: "2024-12-15",
    next_session: "2024-12-22"
  },
  {
    id: 2,
    name: "A History of Bad Men",
    description: "Dark intrigue and conspiracy",
    created_date: "2024-02-20",
    gm_name: "TestUser",
    player_count: 3,
    max_players: 5,
    open_to_new_players: true,
    user_role: "gm",
    status: "recruiting",
    characters: [
      { name: "Giorno", avatar: "/api/placeholder/40/40" }
    ],
    last_session: null,
    next_session: "2024-12-17"
  }
];

describe('CampaignDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default API responses
    mockApi.get.mockImplementation((url) => {
      if (url === '/campaigns/') {
        return Promise.resolve({ data: [] }); // Will use mock data
      }
      if (url === '/auth/user/') {
        return Promise.resolve({ data: { username: 'TestUser' } });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    });
  });

  describe('Initial Rendering', () => {
    test('renders loading state initially', () => {
      renderCampaignDashboard();
      expect(screen.getByText('Loading campaigns...')).toBeInTheDocument();
    });

    test('renders campaign dashboard header after loading', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('📞 My Campaigns')).toBeInTheDocument();
      });
      
      expect(screen.getByText('Browse and manage your active campaigns')).toBeInTheDocument();
    });

    test('renders action buttons in header', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('✨ Create Character')).toBeInTheDocument();
        expect(screen.getByText('+ Create Campaign')).toBeInTheDocument();
      });
    });
  });

  describe('Campaign Grid Display', () => {
    test('displays campaigns in tiled layout', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('1(800)BIZARRE')).toBeInTheDocument();
        expect(screen.getByText('A History of Bad Men')).toBeInTheDocument();
      });
    });

    test('shows campaign status badges correctly', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('ACTIVE')).toBeInTheDocument();
        expect(screen.getByText('RECRUITING')).toBeInTheDocument();
      });
    });

    test('displays role badges for each campaign', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('PLAYER')).toBeInTheDocument();
        expect(screen.getByText('GM')).toBeInTheDocument();
      });
    });

    test('shows player count and capacity', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('4/6')).toBeInTheDocument();
        expect(screen.getByText('3/5')).toBeInTheDocument();
      });
    });

    test('displays character avatars', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        // Character initials should be shown
        expect(screen.getByText('J')).toBeInTheDocument(); // Josuke
        expect(screen.getByText('O')).toBeInTheDocument(); // Okuyasu
        expect(screen.getByText('G')).toBeInTheDocument(); // Giorno
      });
    });
  });

  describe('Filtering Functionality', () => {
    test('renders filter controls', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByDisplayValue('All Roles')).toBeInTheDocument();
        expect(screen.getByDisplayValue('All Campaigns')).toBeInTheDocument();
      });
    });

    test('filters campaigns by role', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('1(800)BIZARRE')).toBeInTheDocument();
        expect(screen.getByText('A History of Bad Men')).toBeInTheDocument();
      });

      // Filter to show only player campaigns
      const roleFilter = screen.getByDisplayValue('All Roles');
      fireEvent.change(roleFilter, { target: { value: 'player' } });

      await waitFor(() => {
        expect(screen.getByText('1(800)BIZARRE')).toBeInTheDocument();
        expect(screen.queryByText('A History of Bad Men')).not.toBeInTheDocument();
      });
    });

    test('filters campaigns by status', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('1(800)BIZARRE')).toBeInTheDocument();
        expect(screen.getByText('A History of Bad Men')).toBeInTheDocument();
      });

      // Filter to show only open campaigns
      const statusFilter = screen.getByDisplayValue('All Campaigns');
      fireEvent.change(statusFilter, { target: { value: 'open' } });

      // Both campaigns should still be visible as they're both open
      await waitFor(() => {
        expect(screen.getByText('1(800)BIZARRE')).toBeInTheDocument();
        expect(screen.getByText('A History of Bad Men')).toBeInTheDocument();
      });
    });

    test('shows filter result count', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText(/Showing \d+ of \d+ campaigns/)).toBeInTheDocument();
      });
    });
  });

  describe('Campaign Actions', () => {
    test('shows correct action buttons based on user role', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        // Should show "View Campaign" for player role
        expect(screen.getByText('View Campaign')).toBeInTheDocument();
        // Should show "Manage Campaign" for GM role
        expect(screen.getByText('Manage Campaign')).toBeInTheDocument();
      });
    });

    test('shows join button for open campaigns where user is not GM', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        // Should show join button for campaigns where user is not GM and has space
        const joinButtons = screen.getAllByText('Join');
        expect(joinButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Campaign Creation', () => {
    test('opens create campaign modal when button clicked', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        const createButton = screen.getByText('+ Create Campaign');
        fireEvent.click(createButton);
      });

      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter campaign name...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Describe your campaign...')).toBeInTheDocument();
    });

    test('creates new campaign with form submission', async () => {
      mockApi.post.mockResolvedValue({
        data: {
          id: 3,
          name: 'Test Campaign',
          description: 'Test Description',
          max_players: 6,
          open_to_new_players: true
        }
      });

      renderCampaignDashboard();
      
      await waitFor(() => {
        const createButton = screen.getByText('+ Create Campaign');
        fireEvent.click(createButton);
      });

      // Fill out the form
      const nameInput = screen.getByPlaceholderText('Enter campaign name...');
      const descInput = screen.getByPlaceholderText('Describe your campaign...');
      
      fireEvent.change(nameInput, { target: { value: 'Test Campaign' } });
      fireEvent.change(descInput, { target: { value: 'Test Description' } });

      // Submit the form
      const submitButton = screen.getByText('Create Campaign');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith('/campaigns/', expect.objectContaining({
          name: 'Test Campaign',
          description: 'Test Description'
        }));
      });
    });

    test('closes modal when cancel button clicked', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        const createButton = screen.getByText('+ Create Campaign');
        fireEvent.click(createButton);
      });

      expect(screen.getByText('Create New Campaign')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Create New Campaign')).not.toBeInTheDocument();
      });
    });
  });

  describe('Empty States', () => {
    test('shows empty state when no campaigns exist', async () => {
      // Mock empty campaigns response
      mockApi.get.mockImplementation((url) => {
        if (url === '/campaigns/') {
          return Promise.resolve({ data: [] });
        }
        if (url === '/auth/user/') {
          return Promise.resolve({ data: { username: 'TestUser' } });
        }
        return Promise.reject(new Error('Unknown endpoint'));
      });

      renderCampaignDashboard();
      
      await waitFor(() => {
        expect(screen.getByText('No campaigns yet. Create one to get started!')).toBeInTheDocument();
        expect(screen.getByText('Create Your First Campaign')).toBeInTheDocument();
      });
    });

    test('shows filtered empty state when filters match nothing', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        // Filter to completed status (none exist)
        const statusFilter = screen.getByDisplayValue('All Campaigns');
        fireEvent.change(statusFilter, { target: { value: 'closed' } });
      });

      await waitFor(() => {
        expect(screen.getByText('No campaigns match your filters.')).toBeInTheDocument();
      });
    });
  });

  describe('Join Campaign Functionality', () => {
    test('handles join campaign action', async () => {
      mockApi.post.mockResolvedValue({ data: {} });

      renderCampaignDashboard();
      
      await waitFor(() => {
        const joinButtons = screen.getAllByText('Join');
        if (joinButtons.length > 0) {
          fireEvent.click(joinButtons[0]);
        }
      });

      await waitFor(() => {
        expect(mockApi.post).toHaveBeenCalledWith(expect.stringContaining('/join/'));
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      mockApi.get.mockRejectedValue(new Error('API Error'));

      renderCampaignDashboard();
      
      // Should still render with mock data when API fails
      await waitFor(() => {
        expect(screen.getByText('📞 My Campaigns')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    test('renders properly on different screen sizes', async () => {
      renderCampaignDashboard();
      
      await waitFor(() => {
        const dashboard = screen.getByTestId('layout');
        expect(dashboard).toBeInTheDocument();
      });

      // The grid should be responsive (checked via CSS classes in actual component)
      // This test verifies the component renders without crashing
    });
  });
});
