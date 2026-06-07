import * as React from "react"
import {
  LayoutDashboard,
  Megaphone,
  Database,
  GraduationCap,
  FileText,
  Settings,
  LogOut,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface NavItem {
  id: string
  title: string
  icon: React.ElementType
  isActive?: boolean
  onClick?: () => void
}

export function CompactSidebar({
  items,
  onLogout,
  onSettings
}: {
  items: NavItem[]
  onLogout: () => void
  onSettings?: () => void
}) {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark')
    }
    return false
  })

  const toggleTheme = (checked: boolean) => {
    setIsDark(checked)
    if (checked) {
      document.documentElement.classList.add("dark")
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "72px" } as React.CSSProperties}>
      <Sidebar 
        variant="sidebar" 
        collapsible="none"
        className="border-r border-border/50 bg-background"
      >
        <div className="flex flex-col items-center justify-between py-6 h-full w-full">
          <SidebarHeader className="flex flex-col items-center gap-6 p-0 w-full">
            {/* Isotipo C-curve Abstracto */}
            <div className="flex items-center justify-center w-10 h-10">
              <svg viewBox="0 0 100 100" className="w-8 h-8 fill-primary dark:fill-white">
                <path d="M70,10 A40,40 0 1,0 70,90 A30,30 0 1,1 70,10 Z" />
              </svg>
            </div>
            
            {/* Theme Toggle */}
            <Switch checked={isDark} onCheckedChange={toggleTheme} aria-label="Toggle theme" />
          </SidebarHeader>

          <SidebarContent className="flex flex-col items-center gap-4 mt-8 w-full p-0">
            <SidebarMenu className="flex flex-col items-center gap-4 w-full">
              <TooltipProvider delayDuration={0}>
                {items.map((item) => (
                  <SidebarMenuItem key={item.id} className="w-full flex justify-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          isActive={item.isActive}
                          onClick={item.onClick}
                          className={`
                            h-10 w-10 p-0 flex items-center justify-center rounded-[4px] transition-all duration-200
                            ${item.isActive 
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 dark:bg-primary/20 dark:text-primary dark:shadow-none" 
                              : "text-muted-foreground hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white"}
                          `}
                        >
                          <item.icon className="w-5 h-5" />
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent 
                        side="right" 
                        align="center" 
                        sideOffset={8}
                        className="bg-popover border border-border text-popover-foreground text-xs font-semibold px-2 py-1 rounded shadow-lg"
                      >
                        {item.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                ))}
              </TooltipProvider>
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="flex flex-col items-center gap-4 w-full p-0">
            <SidebarMenu className="flex flex-col items-center gap-4 w-full">
              <TooltipProvider delayDuration={0}>
                <SidebarMenuItem className="w-full flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton onClick={onSettings} className="h-10 w-10 p-0 flex items-center justify-center rounded-[4px] transition-all duration-200 text-muted-foreground hover:bg-primary/10 hover:text-primary dark:hover:bg-white/10 dark:hover:text-white">
                        <Settings className="w-5 h-5" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" sideOffset={8} className="bg-popover border border-border text-popover-foreground text-xs font-semibold px-2 py-1 rounded shadow-lg">
                      Configuración
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>

                <SidebarMenuItem className="w-full flex justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <SidebarMenuButton onClick={onLogout} className="h-10 w-10 p-0 flex items-center justify-center rounded-[4px] transition-all duration-200 text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 dark:hover:text-red-400">
                        <LogOut className="w-5 h-5" />
                      </SidebarMenuButton>
                    </TooltipTrigger>
                    <TooltipContent side="right" align="center" sideOffset={8} className="bg-popover border border-border text-popover-foreground text-xs font-semibold px-2 py-1 rounded shadow-lg">
                      Cerrar sesión
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              </TooltipProvider>
            </SidebarMenu>
          </SidebarFooter>
        </div>
      </Sidebar>
    </SidebarProvider>
  )
}
