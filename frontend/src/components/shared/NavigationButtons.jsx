// src/components/shared/NavigationButtons.jsx
import PropTypes from 'prop-types';

export default function NavigationButtons({ 
  currentStep, 
  totalSteps, 
  onPrev, 
  onNext, 
  onSubmit,
  isValid
}) {
  return (
    <div className="flex justify-between mt-8">
      {/* Back button (only show if not on first step) */}
      {currentStep > 1 && (
        <button
          type="button"
          onClick={onPrev}
          className="px-4 py-2 border rounded hover:bg-gray-50"
        >
          ← Back
        </button>
      )}
      
      {/* Spacer when no back button to maintain alignment */}
      {currentStep === 1 && <div></div>}
      
      {/* Next or Submit button */}
      {currentStep < totalSteps ? (
        <button
          type="button"
          onClick={onNext}
          disabled={!isValid}
          className={`px-4 py-2 ${
            isValid 
              ? "bg-indigo-600 text-white hover:bg-indigo-700" 
              : "bg-indigo-300 text-white cursor-not-allowed"
          } rounded ml-auto`}
        >
          Next →
        </button>
      ) : (
        <button
          type="submit"
          disabled={!isValid}
          className={`px-4 py-2 ${
            isValid 
              ? "bg-green-600 text-white hover:bg-green-700" 
              : "bg-green-300 text-white cursor-not-allowed"
          } rounded ml-auto`}
        >
          Create Character
        </button>
      )}
    </div>
  );
}

NavigationButtons.propTypes = {
  currentStep: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired,
  onPrev: PropTypes.func.isRequired,
  onNext: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isValid: PropTypes.bool.isRequired
};