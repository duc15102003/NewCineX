import { Toaster as SonnerToaster } from 'sonner'

function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 3000,
        className: 'text-sm',
      }}
    />
  )
}

export { Toaster }
