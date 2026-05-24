import { useCallback } from 'react'

interface ToastOptions {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const toast = useCallback(({ title, description, variant = 'default' }: ToastOptions) => {
    // 1. Get or create the toast container
    let container = document.getElementById('dynamic-toast-container')
    if (!container) {
      container = document.createElement('div')
      container.id = 'dynamic-toast-container'
      container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full sm:w-96 pointer-events-none'
      document.body.appendChild(container)
    }

    // 2. Create the toast element
    const toastEl = document.createElement('div')
    toastEl.className = `
      p-4 rounded-xl shadow-lg border transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto flex flex-col gap-1 cursor-pointer
      backdrop-blur-md
      ${variant === 'destructive' 
        ? 'bg-red-500/90 text-white border-red-600 dark:bg-red-950/90 dark:border-red-800' 
        : 'bg-slate-900/90 text-slate-100 border-slate-800 dark:bg-slate-950/90 dark:border-slate-800'
      }
    `
    
    // Set up interior structure
    const titleEl = document.createElement('div')
    titleEl.className = 'font-semibold text-sm'
    titleEl.innerText = title
    toastEl.appendChild(titleEl)

    if (description) {
      const descEl = document.createElement('div')
      descEl.className = `text-xs ${variant === 'destructive' ? 'text-red-100' : 'text-slate-400'}`
      descEl.innerText = description
      toastEl.appendChild(descEl)
    }

    // Append to container
    container.appendChild(toastEl)

    // Trigger animate in on next tick
    setTimeout(() => {
      toastEl.classList.remove('translate-y-2', 'opacity-0')
    }, 10)

    // Auto remove function
    const removeToast = () => {
      toastEl.classList.add('opacity-0', 'scale-95')
      setTimeout(() => {
        toastEl.remove()
        // If container is empty, remove it too
        if (container && container.childNodes.length === 0) {
          container.remove()
        }
      }, 300)
    }

    // Auto-remove after 4 seconds
    const timeoutId = setTimeout(removeToast, 4000)

    // Add click handler to close manually
    toastEl.addEventListener('click', () => {
      clearTimeout(timeoutId)
      removeToast()
    })
  }, [])

  return { toast }
}
