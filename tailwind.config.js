module.exports = {
    content: [
      "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          'oswald': ['Oswald', 'sans-serif'],
          'bebas': ['Bebas Neue', 'cursive'],
        },
        colors: {
          // Dark theme colors
          'dark': {
            100: '#374151',  // Lighter dark
            200: '#2d3748',  // Medium dark
            300: '#1f2937',  // Darker
            400: '#1a202c',  // Very dark
            500: '#111827',  // Almost black
            900: '#000000',  // Pure black
          },
          // Border colors
          'border': {
            DEFAULT: '#4a5568',
            light: '#718096',
          },
          // Brand colors
          'brand': {
            red: '#dc2626',
            purple: '#8b5cf6',
            blue: '#3b82f6',
            green: '#10b981',
            yellow: '#eab308',
          },
          // Game-specific colors
          'stress': '#dc2626',
          'coin': '#eab308',
          'xp': '#8b5cf6',
          'action': '#8b5cf6',
          'attribute': '#3b82f6',
          'success': '#10b981',
          'partial': '#3b82f6',
          'failure': '#4a5568',
        },
        boxShadow: {
          'glow-red': '0 0 8px rgba(220, 38, 38, 0.5)',
          'glow-purple': '0 0 8px rgba(139, 92, 246, 0.5)',
          'glow-yellow': '0 0 8px rgba(234, 179, 8, 0.5)',
          'glow-blue': '0 0 6px rgba(139, 92, 246, 0.5)',
          'dark': '0 2px 8px rgba(0, 0, 0, 0.3)',
          'dark-lg': '0 4px 16px rgba(0, 0, 0, 0.5)',
          'inner-dark': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
        },
        animation: {
          'fill-pulse': 'fillPulse 0.3s ease-out',
          'spinner1': 'spinner1 0.6s infinite',
          'spinner2': 'spinner2 0.6s infinite',
          'spinner3': 'spinner3 0.6s infinite',
        },
        keyframes: {
          fillPulse: {
            '0%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0.7)' },
            '70%': { boxShadow: '0 0 0 6px rgba(220, 38, 38, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(220, 38, 38, 0)' },
          },
          spinner1: {
            '0%': { transform: 'scale(0)' },
            '100%': { transform: 'scale(1)' },
          },
          spinner2: {
            '0%': { transform: 'translate(0, 0)' },
            '100%': { transform: 'translate(24px, 0)' },
          },
          spinner3: {
            '0%': { transform: 'scale(1)' },
            '100%': { transform: 'scale(0)' },
          },
        },
        fontSize: {
          '2xs': '0.625rem',
        },
        spacing: {
          '15': '3.75rem',
          '18': '4.5rem',
          '70': '17.5rem',
          '88': '22rem',
        },
      },
    },
    plugins: [],
  }