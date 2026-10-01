import React, { useState } from 'react';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { Sparkles, Scissors, Users, Building, Check, ArrowRight } from 'lucide-react';

export interface OnboardingModalProps {
  firstName?: string;
  isOpen: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  firstName = 'there',
  isOpen,
  onComplete,
  onSkip
}) => {
  const [shopType, setShopType] = useState<string>('Ladies tailoring');
  const [teamSize, setTeamSize] = useState<string>('2 to 5');
  const [shopCount, setShopCount] = useState<string>('One');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const shopTypeOptions = [
    'Gents tailoring',
    'Ladies tailoring',
    'Boutique',
    'Uniforms',
    'Alterations'
  ];

  const teamSizeOptions = [
    'Just me',
    '2 to 5',
    '6 to 15',
    'More than 15'
  ];

  const shopCountOptions = [
    'One',
    'Two or three',
    'More than three'
  ];

  const handleSave = async () => {
    try {
      setLoading(true);
      await api.post('/conversion/onboarding', {
        shopType,
        teamSize,
        shopCount,
        skipped: false
      });
      await trackFunnelEvent('onboarding_answered', { shopType, teamSize, shopCount });
      onComplete();
    } catch (err) {
      console.error('Failed to save onboarding', err);
      onComplete();
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setLoading(true);
      await api.post('/conversion/onboarding', {
        skipped: true
      });
      await trackFunnelEvent('onboarding_skipped', {
        defaultShopType: 'Ladies tailoring',
        defaultTeamSize: '2 to 5',
        defaultShopCount: 'One'
      });
      onComplete();
      if (onSkip) onSkip();
    } catch (err) {
      console.error('Failed to skip onboarding', err);
      onComplete();
      if (onSkip) onSkip();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-auto max-h-[95vh] flex flex-col">
        
        {/* Header Decor */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 px-5 sm:px-8 py-6 text-white text-left relative shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-7 w-7 rounded-lg bg-white/20 items-center justify-center text-white backdrop-blur-xs">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-100">Quick Workshop Setup</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Let's set up your shop, {firstName}.
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/90 mt-1 leading-relaxed">
            Three quick taps. We'll use them to make everything feel like your own shop from the first minute.
          </p>
        </div>

        {/* Content body */}
        <div className="p-5 sm:p-8 space-y-6 overflow-y-auto flex-1 text-left">
          
          {/* Question 1: What kind of shop do you run? */}
          <div className="space-y-2.5">
            <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Scissors className="h-4 w-4 text-blue-600 shrink-0" />
              What kind of shop do you run?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {shopTypeOptions.map((option) => {
                const isSelected = shopType === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setShopType(option)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0 ml-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 2: How many people work with you? */}
          <div className="space-y-2.5">
            <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600 shrink-0" />
              How many people work with you?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {teamSizeOptions.map((option) => {
                const isSelected = teamSize === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setTeamSize(option)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20 shadow-xs font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question 3: How many shops do you have? */}
          <div className="space-y-2.5">
            <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-2">
              <Building className="h-4 w-4 text-blue-600 shrink-0" />
              How many shops do you have?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {shopCountOptions.map((option) => {
                const isSelected = shopCount === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setShopCount(option)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold border text-center transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20 shadow-xs font-bold'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSkip}
            disabled={loading}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 order-2 sm:order-1 transition-colors py-2 px-1"
          >
            I'll do this later
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all active:scale-[0.98] order-1 sm:order-2"
          >
            <span>Show me my shop</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
