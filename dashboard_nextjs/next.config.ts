import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Garantiza que las env vars siempre tengan valor durante el build,
  // evitando que supabase-js explote en la generación estática de /_not_found
  env: {
    NEXT_PUBLIC_SUPABASE_URL:
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key',
  },
};

export default nextConfig;
