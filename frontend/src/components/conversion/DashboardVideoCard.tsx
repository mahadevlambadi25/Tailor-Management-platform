import React, { useState, useEffect } from 'react';
import { Play, Video, X } from 'lucide-react';
import { api } from '../../api/client';
import { Modal } from '../common/Modal';

export const DashboardVideoCard: React.FC = () => {
  const [videoUrls, setVideoUrls] = useState<{ [key: string]: string | undefined }>({
    en: import.meta.env.VITE_DEMO_VIDEO_URL_EN,
    hi: import.meta.env.VITE_DEMO_VIDEO_URL_HI,
    kn: import.meta.env.VITE_DEMO_VIDEO_URL_KN
  });
  const [conversionEnabled, setConversionEnabled] = useState<boolean>(
    import.meta.env.VITE_CONVERSION_V1 !== 'false'
  );
  const [selectedLang, setSelectedLang] = useState<string>('en');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    // Also fetch runtime config from backend if available
    api.get('/conversion/config')
      .then(res => {
        if (res.data?.success && res.data.data) {
          if (res.data.data.conversionV1 === false) {
            setConversionEnabled(false);
            return;
          }
          const remote = res.data.data.demoVideoUrls;
          setVideoUrls(prev => ({
            en: remote?.en || prev.en,
            hi: remote?.hi || prev.hi,
            kn: remote?.kn || prev.kn
          }));
        }
      })
      .catch(() => {
        // Fallback to import.meta.env
      });
  }, []);

  if (dismissed || !conversionEnabled) return null;

  const availableLangs = [
    { code: 'en', label: 'English', url: videoUrls.en },
    { code: 'hi', label: 'Hindi (हिंदी)', url: videoUrls.hi },
    { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', url: videoUrls.kn }
  ].filter(item => Boolean(item.url));

  const activeUrl = videoUrls[selectedLang] || availableLangs[0]?.url;

  return (
    <>
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white p-4 sm:p-5 shadow-xs transition-all mb-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full">
                  Quick Demo
                </span>
                <span className="text-xs text-slate-400">2 min</span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 mt-0.5">
                Watch how a shop runs a day (2 min)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                See orders moving from measurement to cutting, stitching, and WhatsApp delivery updates.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {availableLangs.length > 1 && (
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                {availableLangs.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    className={`px-2 py-1 text-xs font-semibold rounded-md transition-all ${
                      selectedLang === lang.code
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lang.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setIsPlaying(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-98 transition-all"
            >
              <Play className="h-3.5 w-3.5 fill-white" />
              Watch Video
            </button>

            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isPlaying}
        onClose={() => setIsPlaying(false)}
        maxWidth="max-w-3xl"
        className="rounded-2xl bg-black shadow-2xl border border-slate-800 overflow-hidden p-0"
        ariaLabel="Walkthrough Video"
      >
        <div className="w-full">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 text-white">
              <span className="text-xs font-semibold">Watch how a shop runs a day (2 min)</span>
              <button
                onClick={() => setIsPlaying(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="aspect-video w-full bg-slate-950 flex items-center justify-center">
              {activeUrl ? (
                <iframe
                  src={activeUrl}
                  title="Demo Video"
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-8 space-y-2">
                  <Video className="h-10 w-10 text-slate-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">Demo video placeholder</p>
                  <p className="text-xs text-slate-500">
                    Set DEMO_VIDEO_URL_EN, DEMO_VIDEO_URL_HI, or DEMO_VIDEO_URL_KN to display your walkthrough.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      </>
  );
};
