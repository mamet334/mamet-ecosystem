import React, { useEffect, useRef, useState } from 'react'
import OSDesktopShell from './components/os/OSDesktopShell'
import ErrorBoundary from './components/workbench/ErrorBoundary'
import EngineerApprovalDialog from './components/workbench/EngineerApprovalDialog'
import LampLogin from './components/LampLogin'
import { kernel } from './core/runtime/Kernel'
import { supabase } from './supabase'
import { penyimpanKeadaan } from './core/runtime/PenyimpanKeadaan'
import './App.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Keadaan layar kini hidup di luar layarnya (PenyimpanKeadaan, Item 127 Tahap 1), jadi logout TIDAK
  // lagi menghapusnya dengan sendirinya. Pengguna berganti (keluar, atau akun lain masuk) = semua keadaan
  // dilupakan — tanpa ini orang berikutnya di aplikasi yang sama melihat percakapan orang sebelumnya.
  // Penyegaran token (pengguna sama) tidak menghapus apa pun. Selama sesi masih diperiksa (`loading`),
  // `session` memang null — itu bukan "keluar", jadi belum dicatat sebagai pengguna sebelumnya.
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

  if (!session) {
    return <LampLogin onLoginSuccess={() => { }} />
  }

  return (
    <ErrorBoundary>
      <OSDesktopShell />
      <EngineerApprovalDialog />
    </ErrorBoundary>
  )
}