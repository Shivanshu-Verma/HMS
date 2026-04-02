export const useDemoData =
  process.env.NEXT_PUBLIC_USE_DEMO_DATA === 'true' || !process.env.NEXT_PUBLIC_API_URL;
