import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { getAccessToken } from '../lib/api-client'

interface PdfPreviewModalProps {
  planId?: number | null
  title: string
  draftData?: any
  onClose: () => void
}

export function PdfPreviewModal({ planId, title, draftData, onClose }: PdfPreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  useState(() => {
    import('../lib/api-client').then(({ default: api }) => {
      if (draftData) {
        api.post(`/plans/preview-pdf`, draftData, { responseType: 'blob' })
          .then((response) => {
            const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
            setPdfUrl(url)
            setIsLoading(false)
          })
          .catch((error) => {
            console.error("Failed to load PDF preview", error)
            setIsLoading(false)
          })
      } else if (planId) {
        api.get(`/plans/${planId}/pdf`, { responseType: 'blob' })
          .then((response) => {
            const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
            setPdfUrl(url)
            setIsLoading(false)
          })
          .catch((error) => {
            console.error("Failed to load PDF", error)
            setIsLoading(false)
          })
      } else {
        setIsLoading(false)
      }
    })
  })

  const handleDownload = () => {
    if (pdfUrl) {
      const a = document.createElement('a')
      a.href = pdfUrl
      a.download = `planificacion_${planId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b shrink-0 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-xl font-bold">Previsualización PDF</DialogTitle>
            <DialogDescription className="text-sm font-medium">
              {title}
            </DialogDescription>
          </div>
          <Button onClick={handleDownload} disabled={!pdfUrl} className="gap-2 shrink-0">
            <FileDown size={18} />
            Descargar Archivo
          </Button>
        </DialogHeader>
        
        <div className="flex-1 w-full bg-muted/30 relative">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 size={32} className="animate-spin" />
              <p className="font-medium">Generando documento...</p>
            </div>
          ) : pdfUrl ? (
            <iframe 
              src={pdfUrl} 
              className="w-full h-full border-none"
              title="PDF Preview"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-destructive gap-3">
              <p className="font-bold">Error al generar el documento.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
