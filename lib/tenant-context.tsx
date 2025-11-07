'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface TenantContextType {
  currentTenantId: string | null
  setCurrentTenantId: (id: string | null) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentTenantId, setCurrentTenantIdState] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('currentTenantId')
    if (stored) {
      setCurrentTenantIdState(stored)
    }
  }, [])

  const setCurrentTenantId = (id: string | null) => {
    setCurrentTenantIdState(id)
    if (id) {
      localStorage.setItem('currentTenantId', id)
    } else {
      localStorage.removeItem('currentTenantId')
    }
  }

  return (
    <TenantContext.Provider value={{ currentTenantId, setCurrentTenantId }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}
