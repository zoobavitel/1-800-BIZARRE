// src/components/shared/StepIndicator.jsx
import PropTypes from 'prop-types';

export default function StepIndicator({ currentStep, totalSteps }) {
  const progressPercentage = (currentStep / totalSteps) * 100;
  
  return (
    <div className="flex items-center mt-2">
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className="bg-blue-600 h-2.5 rounded-full" 
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>
      <span className="ml-2 text-sm font-medium">{currentStep}/{totalSteps}</span>
    </div>
  );
}

StepIndicator.propTypes = {
  currentStep: PropTypes.number.isRequired,
  totalSteps: PropTypes.number.isRequired
};