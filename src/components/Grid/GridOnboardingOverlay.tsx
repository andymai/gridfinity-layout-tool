import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLayoutStore } from '../../store';

const STORAGE_KEY = 'gridfinity-grid-tutorial-seen';

interface GridOnboardingOverlayProps {
  onDismiss: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  icon: string;
  details: string[];
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'Create Bins',
    description: 'Click and drag on empty cells to create bins',
    icon: 'M12 4v16m8-8H4',
    details: [
      'Click on any empty cell and drag to create a bin',
      'Release to place the bin at the selected size',
      'Bins snap to the grid for precise placement',
    ],
  },
  {
    title: 'Resize Bins',
    description: 'Select a bin, then drag the handles to resize',
    icon: 'M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4',
    details: [
      'Click on a bin to select it',
      'Drag the handles at edges or corners to resize',
      'Bins automatically adjust to fit the grid',
    ],
  },
  {
    title: 'Paint Mode',
    description: 'Select a size from Bin Palette, then drag to fill areas',
    icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
    details: [
      'Choose a bin size from the Bin Palette in the sidebar',
      'Drag across empty space to fill with multiple bins',
      'Press Esc or click × to exit paint mode',
    ],
  },
];

/**
 * First-time user tutorial overlay for grid interactions.
 * Multi-step walkthrough with navigation controls.
 */
export function GridOnboardingOverlay({ onDismiss }: GridOnboardingOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const layers = useLayoutStore(state => state.layout.layers);

  // Add conditional step for multi-layer layouts
  const steps = [...TUTORIAL_STEPS];
  if (layers.length > 1) {
    steps.push({
      title: 'Layer System',
      description: 'Striped areas show bins from layers below',
      icon: 'M4 5h16M4 12h16m-7 7h7',
      details: [
        'Layers stack vertically in your drawer',
        'Striped/hatched areas are blocked by bins extending from lower layers',
        'Click blocked zones to switch to that layer and edit the bin',
      ],
    });
  }

  useEffect(() => {
    // Check if user has already seen the tutorial
    const hasSeenTutorial = localStorage.getItem(STORAGE_KEY);

    if (!hasSeenTutorial) {
      // Small delay for smooth appearance
      setTimeout(() => setIsVisible(true), 300);
    } else {
      onDismiss();
    }
  }, [onDismiss]);

  const handleDismiss = () => {
    // Mark tutorial as seen
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsVisible(false);

    // Notify parent after fade-out animation
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Only dismiss if clicking the backdrop, not the content
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  if (!isVisible) {
    return null;
  }

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center z-50 animate-fade-in"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="relative max-w-lg mx-4 p-6 rounded-xl shadow-2xl"
        style={{
          background: 'rgba(20, 20, 30, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-accent/20">
            <svg
              className="w-8 h-8 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={step.icon}
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {step.title}
          </h2>
          <p className="text-sm text-content-secondary">
            {step.description}
          </p>
        </div>

        {/* Step Details */}
        <div className="space-y-3 mb-6">
          {step.details.map((detail, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated/50"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xs font-semibold text-accent">{index + 1}</span>
              </div>
              <p className="text-sm text-content-secondary flex-1">{detail}</p>
            </div>
          ))}
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className="w-2 h-2 rounded-full transition-all duration-200"
              style={{
                background: index === currentStep ? '#f59e0b' : 'rgba(255, 255, 255, 0.3)',
                width: index === currentStep ? '24px' : '8px',
              }}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          {/* Skip Button */}
          <button
            onClick={handleDismiss}
            className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            Skip
          </button>

          {/* Previous Button (only show after first step) */}
          {!isFirstStep && (
            <button
              onClick={handlePrevious}
              className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:scale-105"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
              }}
            >
              Previous
            </button>
          )}

          {/* Next/Done Button */}
          <button
            onClick={handleNext}
            className="flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 hover:scale-105"
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
            }}
          >
            {isLastStep ? 'Got it!' : 'Next'}
          </button>
        </div>

        {/* Small hint */}
        <p className="text-xs text-center text-content-tertiary mt-3">
          Step {currentStep + 1} of {steps.length} · Click outside to dismiss
        </p>
      </div>
    </div>,
    document.body
  );
}
