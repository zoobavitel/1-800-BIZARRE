import React from 'react';

// Test component to validate TailwindCSS responsive design features
const ResponsiveTest = () => {
  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
      {/* Header with responsive text and spacing */}
      <header className="text-center mb-8 sm:mb-12 lg:mb-16">
        <h1 className="text-2xl sm:text-4xl lg:text-6xl xl:text-8xl font-bold text-white mb-4">
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Responsive Test
          </span>
        </h1>
        <p className="text-sm sm:text-base lg:text-lg text-gray-400 max-w-md sm:max-w-2xl lg:max-w-4xl mx-auto">
          Testing TailwindCSS responsive design with different breakpoints and utility classes.
        </p>
      </header>

      {/* Grid layout that changes at different breakpoints */}
      <section className="mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 lg:mb-8">
          Responsive Grid Layout
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
            <div 
              key={item}
              className="bg-gray-800 border border-gray-600 rounded-lg p-4 sm:p-6 lg:p-8 hover:border-purple-500 transition-all duration-300 transform hover:scale-105"
            >
              <div className="w-8 h-8 sm:w-12 sm:h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full mb-3 sm:mb-4 lg:mb-6"></div>
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-2 sm:mb-3">
                Card {item}
              </h3>
              <p className="text-sm sm:text-base text-gray-400 line-clamp-2">
                This is a test card to demonstrate responsive design with TailwindCSS. The layout adapts to different screen sizes.
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Typography scaling test */}
      <section className="mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 lg:mb-8">
          Typography Scaling
        </h2>
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 lg:p-8">
            <h3 className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold text-white mb-2">
              Extra Small to Large
            </h3>
            <p className="text-xs sm:text-sm lg:text-base xl:text-lg text-gray-400">
              This text scales from extra small on mobile to large on extra large screens.
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 lg:p-8">
            <h3 className="text-sm sm:text-base lg:text-lg xl:text-xl font-bold text-white mb-2">
              Small to Extra Large
            </h3>
            <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-400">
              This text scales from small on mobile to extra large on desktop.
            </p>
          </div>
        </div>
      </section>

      {/* Spacing and padding test */}
      <section className="mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 lg:mb-8">
          Responsive Spacing
        </h2>
        <div className="bg-gray-800 rounded-lg">
          <div className="p-2 sm:p-4 lg:p-6 xl:p-8 border-b border-gray-600">
            <p className="text-white text-sm sm:text-base">
              Padding: p-2 sm:p-4 lg:p-6 xl:p-8
            </p>
          </div>
          <div className="m-2 sm:m-4 lg:m-6 xl:m-8 p-4 bg-gray-700 rounded">
            <p className="text-white text-sm sm:text-base">
              Margin: m-2 sm:m-4 lg:m-6 xl:m-8
            </p>
          </div>
        </div>
      </section>

      {/* Flex layout test */}
      <section className="mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 lg:mb-8">
          Responsive Flex Layout
        </h2>
        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-4 sm:gap-6 lg:gap-8">
          <div className="flex-1 bg-red-600 rounded-lg p-4 sm:p-6 lg:p-8">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Flex Item 1</h3>
            <p className="text-red-100 text-sm sm:text-base">
              Changes from column to row layout at different breakpoints
            </p>
          </div>
          <div className="flex-1 bg-blue-600 rounded-lg p-4 sm:p-6 lg:p-8">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Flex Item 2</h3>
            <p className="text-blue-100 text-sm sm:text-base">
              Responsive flex layout demonstration
            </p>
          </div>
          <div className="flex-1 bg-green-600 rounded-lg p-4 sm:p-6 lg:p-8">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Flex Item 3</h3>
            <p className="text-green-100 text-sm sm:text-base">
              Works across all screen sizes
            </p>
          </div>
        </div>
      </section>

      {/* Hide/show elements at different breakpoints */}
      <section className="mb-8 sm:mb-12 lg:mb-16">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 lg:mb-8">
          Responsive Visibility
        </h2>
        <div className="space-y-4">
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
            <p className="text-white text-sm sm:text-base">
              <span className="inline sm:hidden text-red-400 font-bold">Mobile only text</span>
              <span className="hidden sm:inline lg:hidden text-blue-400 font-bold">Tablet only text</span>
              <span className="hidden lg:inline text-green-400 font-bold">Desktop only text</span>
            </p>
          </div>
        </div>
      </section>

      {/* Breakpoint indicator */}
      <section className="fixed bottom-4 right-4 bg-black bg-opacity-75 rounded-lg p-2 sm:p-3 lg:p-4 border border-gray-600">
        <div className="text-white text-xs sm:text-sm font-mono">
          <div className="block sm:hidden text-red-400">📱 Mobile (&lt; 640px)</div>
          <div className="hidden sm:block md:hidden text-blue-400">📱 Small (640px - 768px)</div>
          <div className="hidden md:block lg:hidden text-yellow-400">💻 Medium (768px - 1024px)</div>
          <div className="hidden lg:block xl:hidden text-green-400">🖥️ Large (1024px - 1280px)</div>
          <div className="hidden xl:block text-purple-400">🖥️ Extra Large (&gt; 1280px)</div>
        </div>
      </section>
    </div>
  );
};

export default ResponsiveTest;
