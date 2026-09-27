import { Construction } from 'lucide-react'

interface PageStubProps {
  title: string
  description?: string
}

export default function PageStub({ title, description }: PageStubProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="h-12 w-12 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center mb-4">
        <Construction className="h-6 w-6 text-[var(--text-tertiary)]" />
      </div>
      <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">{title}</h2>
      <p className="text-sm text-[var(--text-tertiary)] max-w-md">{description || 'This page will be built in the next phase.'}</p>
    </div>
  )
}
