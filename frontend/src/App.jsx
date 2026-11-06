import React, { useEffect, useRef, useState } from 'react'
import OSDesktopShell from './components/os/OSDesktopShell'
import ErrorBoundary from './components/workbench/ErrorBoundary'
import EngineerApprovalDialog from './components/workbench/EngineerApprovalDialog'
import LampLogin from './components/LampLogin'
import { kernel } from './core/runtime/Kernel'
import { supabase, jenisTautanAwal } from './supabase'
import { penyimpanKeadaan } from './core/runtime/PenyimpanKeadaan'
import { temaService } from './core/runtime/services/TemaService'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pemulihan, setPemulihan] = useState(jenisTautanAwal === 'pemulihan')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setPemulihan(true)
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const penggunaSebelumnyaRef = useRef(undefined)
  useEffect(() => {
    if (loading) return
    const id = session?.user?.id ?? null
    if (penggunaSebelumnyaRef.current !== undefined && penggunaSebelumnyaRef.current !== id) {
      penyimpanKeadaan.lupakanSemua()
    }
    penggunaSebelumnyaRef.current = id
  }, [session, loading])

  useEffect(() => {
    if (session?.user) temaService.sinkronDariAkun(session.user)
  }, [session])

  useEffect(() => {
    if (session) {
      kernel.setUser({
        id: session.user.id,
        email: session.user.email,
        name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User'
      })
    }
  }, [session])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-emerald-500 font-mono text-sm">
        [Auth] Checking session...
      </div>
    )
  }

  if (!session || pemulihan) {
    return (
      <div data-tema="ruangan-kayu" data-dasar="gelap" className="contents">
        <LampLogin
          onLoginSuccess={() => { }}
          modeAwal={pemulihan ? 'sandiBaru' : jenisTautanAwal === 'kedaluwarsa' ? 'lupa' : 'akun'}
          adaSesi={Boolean(session)}
          onSandiBaruSelesai={() => setPemulihan(false)}
        />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <OSDesktopShell />
      <EngineerApprovalDialog />
    </ErrorBoundary>
  )
}