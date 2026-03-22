import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/lib/theme-context'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  title: 'Safe Link — Dashboard de Asistencias',
  description: 'Panel de control de asistencias con reconocimiento facial IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
