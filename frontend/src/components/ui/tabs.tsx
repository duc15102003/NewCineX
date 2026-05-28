import * as React from 'react'
import { cn } from '@/lib/utils'

interface TabsContextType {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = React.createContext<TabsContextType>({ activeTab: '', setActiveTab: () => {} })

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue: string
  onValueChange?: (value: string) => void
}

function Tabs({ defaultValue, onValueChange, children, className, ...props }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultValue)

  const handleChange = (tab: string) => {
    setActiveTab(tab)
    onValueChange?.(tab)
  }

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleChange }}>
      <div className={cn('', className)} {...props}>{children}</div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1', className)} {...props} />
  )
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

function TabsTrigger({ value, className, ...props }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  return (
    <button
      type="button"
      onClick={() => setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all',
        activeTab === value
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-gray-500 hover:text-gray-900',
        className,
      )}
      {...props}
    />
  )
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ value, className, ...props }: TabsContentProps) {
  const { activeTab } = React.useContext(TabsContext)
  if (activeTab !== value) return null
  return <div className={cn('mt-2', className)} {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
