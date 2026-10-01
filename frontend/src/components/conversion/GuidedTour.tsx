import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  LayoutDashboard,
  PlusCircle,
  KanbanSquare,
  Users
} from 'lucide-react';

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const GuidedTour: React.FC<GuidedTourProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  if (!isOpen) return null;

  const tourStops = [
    {
      step: 1,
      target: 'Dashboard',
      path: '/dashboard',
      title: 'Dashboard',
      description: 'This is your shop at a glance. Everything due today is right here.',
      icon: LayoutDashboard,
      badge: 'Step 1 of 4'
    },
    {
      step: 2,
      target: 'New Order',
      path: '/orders/new',
      title: 'New Order',
      description: 'Every order starts here. Measurement, fabric, delivery date. Thirty seconds.',
      icon: PlusCircle,
      badge: 'Step 2 of 4'
    },
    {
      step: 3,
      target: 'Order Pipeline',
      path: '/production',
      title: 'Order Pipeline',
      description: 'Watch orders move from cutting to delivery. Nobody has to ask where anything is.',
      icon: KanbanSquare,
      badge: 'Step 3 of 4'
    },
    {
      step: 4,
      target: 'Customer Page',
      path: '/customers',
      title: 'Customer Page',
      description: "Your customer's full story: measurements, past orders, what they still owe.",
      icon: Users,
      badge: 'Step 4 of 4'
    }
  ];

  const currentStop = tourStops[currentStep];

  const handleNext = () => {
    if (currentStep < tourStops.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      navigate(tourStops[nextIdx].path);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      navigate(tourStops[prevIdx].path);
    }
  };

  const handleFinish = async () => {
    try {
      await api.post('/conversion/tour/complete');
      await trackFunnelEvent('tour_completed', {});
      onComplete();
    } catch {
      onComplete();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-6 bg-slate-950/40 backdrop-blur-[2px] animate-fade-in">
      <div className="pointer-events-auto relative z-[100000] w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 text-left space-y-4 animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
              <Compass className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {currentStop.badge}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Content */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-slate-900">
            <currentStop.icon className="h-5 w-5 text-blue-600" />
            <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
              {currentStop.title}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            {currentStop.description}
          </p>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center gap-1.5 pt-1">
          {tourStops.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-6 bg-blue-600' : 'w-1.5 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 transition-colors inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] inline-flex items-center gap-1.5"
            >
              <span>{currentStep === tourStops.length - 1 ? 'Finish tour' : 'Next stop'}</span>
              {currentStep === tourStops.length - 1 ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
