import { createContext, useCallback, useContext, useState } from 'react'

const ToastContext = createContext(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', isError: false, visible: false })

  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError, visible: true })
    window.clearTimeout(showToast._t)
    showToast._t = window.setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }))
    }, 2600)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${toast.visible ? ' show' : ''}${toast.isError ? ' error' : ''}`}>
        {toast.message}
      </div>
    </ToastContext.Provider>
  )
}
