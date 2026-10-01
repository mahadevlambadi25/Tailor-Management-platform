import React, { useState } from 'react';
import { api } from '../../api/client';
import { trackFunnelEvent } from '../../utils/funnel';
import { Smartphone, Check, Send, X, ExternalLink, MessageSquare } from 'lucide-react';

export interface AhaModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName?: string;
  orderNumber?: string;
  stage?: string;
  orderTotal?: number;
  balanceDue?: number;
  deliveryDate?: string;
}

export const AhaModal: React.FC<AhaModalProps> = ({
  isOpen,
  onClose,
  customerName = 'Rajesh Kumar',
  orderNumber = 'ORD-101',
  stage = 'CUTTING',
  orderTotal = 2500,
  balanceDue = 1000,
  deliveryDate
}) => {
  const [phone, setPhone] = useState('');
  const [renderedMessage, setRenderedMessage] = useState<string | null>(null);
  const [waLink, setWaLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSendToSelf = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post('/conversion/aha/send-to-self', {
        phone: phone.trim() || '919999999999',
        customerName
      });

      if (res.data?.success) {
        setRenderedMessage(res.data.data.rendered);
        setWaLink(res.data.data.waLink);
        await trackFunnelEvent('aha_sent_to_self', { phone: phone.trim() });
      }
    } catch (err) {
      console.error('Failed to trigger aha delivery preview', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-left my-auto space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pr-8">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold uppercase tracking-wider">
            <MessageSquare className="h-3 w-3" />
            Live Customer Experience
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-950 tracking-tight">
            This is what {customerName} sees.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            No more 'is my suit ready?' calls. Your customer gets an update the moment the order moves. You get your evening back.
          </p>
        </div>

        {/* Realistic Phone-Style WhatsApp Preview Frame */}
        <div className="rounded-2xl border-4 border-slate-800 bg-[#E5DDD5] p-3 shadow-inner max-w-sm mx-auto overflow-hidden">
          {/* WhatsApp Header Simulation */}
          <div className="bg-[#075E54] -mx-3 -mt-3 p-3 text-white flex items-center gap-2.5 shadow-xs mb-3">
            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              ✂️
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold leading-none truncate">Your Tailoring Studio</div>
              <div className="text-[9px] text-emerald-200 mt-0.5">Online • Business Account</div>
            </div>
          </div>

          {/* WhatsApp Chat Bubble */}
          <div className="bg-white rounded-xl rounded-tl-xs p-3 shadow-sm space-y-1.5 max-w-[90%] text-left">
            <p className="text-xs text-slate-800 font-sans leading-relaxed">
              Hi {customerName}, your tailoring order has moved to the cutting table! We'll keep you posted every step.
            </p>
            <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400">
              <span>10:15 AM</span>
              <span className="text-blue-500 font-bold">✓✓</span>
            </div>
          </div>
        </div>

        {/* Action: Send to my own number */}
        {!renderedMessage ? (
          <form onSubmit={handleSendToSelf} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Try it with your own phone number:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all shrink-0"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>Send it to my own number</span>
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Safe testing mode: This generates your personal preview and wa.me test link without charging external fees.
            </p>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3 text-left animate-in fade-in">
            <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold">
              <Check className="h-4 w-4" />
              <span>Preview generated successfully!</span>
            </div>
            <p className="text-xs text-slate-700 font-mono bg-white p-2.5 rounded-xl border border-emerald-100">
              {renderedMessage}
            </p>
            {waLink && (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
              >
                <span>Open in WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Footer OK button */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
          >
            Got it, back to my shop
          </button>
        </div>

      </div>
    </div>
  );
};
