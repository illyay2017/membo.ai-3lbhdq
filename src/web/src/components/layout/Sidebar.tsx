import React, { useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom' // ^6.0.0
import { cn } from 'classnames' // ^2.3.2
import { 
  InboxIcon, 
  BookOpenIcon, 
  LayersIcon, 
  SettingsIcon,
  ChevronLeftIcon,
  ChevronRightIcon 
} from 'lucide-react' // ^0.284.0
import { Tooltip } from '@radix-ui/react-tooltip' // ^1.0.0

import { ROUTES } from '../../constants/routes'
import Button from '../ui/button'

// Navigation items configuration
const NAV_ITEMS = [
  {
    label: 'Inbox',
    path: ROUTES.CONTENT.INBOX,
    icon: InboxIcon,
    ariaLabel: 'Navigate to inbox'
  },
  {
    label: 'Study',
    path: ROUTES.STUDY.HOME,
    icon: BookOpenIcon,
    ariaLabel: 'Start study session'
  },
  {
    label: 'Cards',
    path: ROUTES.CARDS.LIST,
    icon: LayersIcon,
    ariaLabel: 'View flashcards'
  },
  {
    label: 'Settings',
    path: ROUTES.SETTINGS.HOME,
    icon: SettingsIcon,
    ariaLabel: 'Open settings'
  }
] as const

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  className?: string
  ariaLabel?: string
}

interface NavItemProps {
  icon: typeof InboxIcon
  label: string
  path: string
  isCollapsed: boolean
  isActive?: boolean
}

// Individual navigation item component
const NavItem = React.memo<NavItemProps>(({
  icon: Icon,
  label,
  path,
  isCollapsed,
  isActive
}) => {
  const content = (
    <Button
      variant="ghost"
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
        'hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-200',
        isActive && 'bg-primary-50 text-primary-900 font-medium'
      )}
      asChild
    >
      <Link to={path}>
        <Icon 
          size={20} 
          aria-hidden="true"
          className={cn(
            'flex-shrink-0',
            isActive && 'text-primary-900'
          )}
        />
        {!isCollapsed && (
          <span className="truncate">{label}</span>
        )}
      </Link>
    </Button>
  )

  return isCollapsed ? (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          {content}
        </Tooltip.Trigger>
        <Tooltip.Content
          side="right"
          className="px-2 py-1 text-sm bg-secondary-900 text-white rounded"
        >
          {label}
        </Tooltip.Content>
      </Tooltip.Root>
    </Tooltip.Provider>
  ) : content
})

NavItem.displayName = 'NavItem'

// Main sidebar component
export const Sidebar = React.memo<SidebarProps>(({
  isCollapsed,
  onToggle,
  className,
  ariaLabel = 'Main navigation'
}) => {
  const location = useLocation()

  const handleKeyboardNav = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const currentIndex = NAV_ITEMS.findIndex(item => item.path === location.pathname)
      const nextIndex = e.key === 'ArrowDown' 
        ? (currentIndex + 1) % NAV_ITEMS.length
        : (currentIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length
      const nextPath = NAV_ITEMS[nextIndex].path
      document.querySelector(`a[href="${nextPath}"]`)?.focus()
    }
  }, [location.pathname])

  return (
    <aside
      className={cn(
        'flex flex-col border-r border-gray-200 bg-white transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        'h-[calc(100vh-var(--header-height))] sticky top-[var(--header-height)]',
        'md:relative md:translate-x-0',
        !isCollapsed && 'md:w-64',
        className
      )}
      aria-label={ariaLabel}
      onKeyDown={handleKeyboardNav}
    >
      <Button
        variant="ghost"
        className="absolute -right-3 top-3 h-6 w-6 rounded-full border bg-white"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRightIcon size={12} />
        ) : (
          <ChevronLeftIcon size={12} />
        )}
      </Button>

      <nav className="flex-1 space-y-1 p-4" role="navigation">
        {NAV_ITEMS.map(item => (
          <NavItem
            key={item.path}
            {...item}
            isCollapsed={isCollapsed}
            isActive={location.pathname === item.path}
          />
        ))}
      </nav>
    </aside>
  )
})

Sidebar.displayName = 'Sidebar'

export default Sidebar