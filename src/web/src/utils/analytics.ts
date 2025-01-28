// Simple analytics wrapper that's safe when analytics isn't configured
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {
    // Only track if window.analytics exists and is configured
    if (import.meta.env.DEV) {
      console.log('Analytics Event (DEV):', event, properties);
      return;
    }
    
    if (window.analytics?.track) {
      window.analytics.track(event, properties);
    }
  }
};
