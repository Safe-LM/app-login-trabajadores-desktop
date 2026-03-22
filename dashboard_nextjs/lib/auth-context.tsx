'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Session, User } from '@supabase/supabase-js'

interface AuthCtx {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string, nombre: string) => Promise<{ error: string | null; needsConfirm: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => null,
  signUp: async () => ({ error: null, needsConfirm: false }),
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }

  const signUp = async (
    email: string,
    password: string,
    nombre: string
  ): Promise<{ error: string | null; needsConfirm: boolean }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre_completo: nombre },
      },
    })
    if (error) return { error: error.message, needsConfirm: false }
    // Si el usuario ya existe o requiere confirmación por email
    const needsConfirm = !data.session && !!data.user
    return { error: null, needsConfirm }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
