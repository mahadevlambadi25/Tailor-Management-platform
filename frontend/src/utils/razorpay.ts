export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
    metadata: {
      order_id: string;
      payment_id?: string;
    };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpaySuccessResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    confirm_close?: boolean;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: string, callback: (response: RazorpayFailureResponse) => void) => void;
  close: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptLoadPromise: Promise<boolean> | null = null;

/**
 * Dynamically loads the official Razorpay Checkout SDK script if not already present.
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  if (typeof window === 'undefined') {
    return Promise.resolve(false);
  }

  // If already loaded and instantiated on window
  if (typeof window.Razorpay === 'function') {
    return Promise.resolve(true);
  }

  // If script tag already exists in DOM
  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
  if (existingScript) {
    return new Promise((resolve) => {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
    });
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      resolve(true);
    };

    script.onerror = () => {
      scriptLoadPromise = null;
      resolve(false);
    };

    document.body.appendChild(script);
  });

  return scriptLoadPromise;
};
