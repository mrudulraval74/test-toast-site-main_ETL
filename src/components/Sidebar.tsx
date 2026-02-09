import { Database, GitCompare, FileText, FileCode, Home, ChevronRight, PanelLeft, PanelLeftClose, LayoutDashboard, FileSpreadsheet } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

export function Sidebar() {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState<string[]>(['ETL Home']);

    const menuItems = [
        {
            path: '/etl',
            label: 'ETL Home',
            icon: LayoutDashboard,
            children: [
                { path: '/etl/connections', label: 'Connections', icon: Database },
                { path: '/etl/query-builder', label: 'Query Builder', icon: FileCode },
                { path: '/etl/compare', label: 'Compare', icon: GitCompare },
                { path: '/etl/reports', label: 'Reports', icon: FileText },
                { path: '/etl/ai-comparison', label: 'AI Comparison', icon: FileSpreadsheet },
            ]
        }
    ];

    // Auto-expand group if child is active
    useEffect(() => {
        menuItems.forEach(item => {
            if (item.children) {
                const hasActiveChild = item.children.some(child => child.path === location.pathname);
                if (hasActiveChild && !expandedGroups.includes(item.label)) {
                    setExpandedGroups(prev => [...prev, item.label]);
                }
            }
        });
    }, [location.pathname]);

    const toggleGroup = (label: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setExpandedGroups(prev =>
            prev.includes(label)
                ? prev.filter(g => g !== label)
                : [...prev, label]
        );
    };

    const renderMenuItem = (item: any, isChild = false, isLastChild = false) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedGroups.includes(item.label);

        return (
            <div key={item.path} className="relative">
                {/* Tree lines for children */}
                {isChild && (
                    <>
                        {/* Vertical line from parent */}
                        <div className="absolute left-[-1.25rem] top-0 bottom-0 w-px bg-border/40"
                            style={{ height: isLastChild ? '50%' : '100%' }} />
                        {/* Horizontal line to item */}
                        <div className="absolute left-[-1.25rem] top-1/2 w-4 h-px bg-border/40" />
                    </>
                )}

                <div
                    className={cn(
                        "group flex items-center gap-2 px-2 py-1.5 rounded-md transition-all duration-200 select-none cursor-pointer mb-0.5",
                        isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        isChild ? "ml-1" : "mx-2" // Adjusted margins
                    )}
                >
                    {/* Expand/Collapse Arrow (Only for parents) */}
                    {hasChildren ? (
                        <div
                            onClick={(e) => toggleGroup(item.label, e)}
                            className="p-0.5 rounded-sm hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <ChevronRight className={cn(
                                "h-3.5 w-3.5 transition-transform duration-200 opacity-70",
                                isExpanded ? "rotate-90" : ""
                            )} />
                        </div>
                    ) : (
                        // Spacer for items without children to align with those that have arrows
                        <div className="w-4.5" />
                    )}

                    <Link
                        to={item.path}
                        className="flex flex-1 items-center gap-2 overflow-hidden"
                        title={isCollapsed ? item.label : undefined}
                    >
                        <Icon className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                        )} />

                        <span className="truncate text-sm">
                            {item.label}
                        </span>
                    </Link>
                </div>

                {/* Render Children */}
                {hasChildren && isExpanded && (
                    <div className="ml-6 relative border-l border-border/40 pl-2">
                        {item.children.map((child: any, index: number) => (
                            renderMenuItem(child, true, index === item.children.length - 1)
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Flatten items for collapsed state
    const flattenedItems = isCollapsed
        ? menuItems.reduce((acc: any[], item) => {
            acc.push(item);
            if (item.children) {
                acc.push(...item.children);
            }
            return acc;
        }, [])
        : menuItems;

    return (
        <aside className={cn(
            "border-r bg-card min-h-screen sticky top-0 h-screen transition-all duration-300 flex flex-col z-40 shadow-sm",
            isCollapsed ? "w-16" : "w-64"
        )}>
            {/* App Header with Toggle */}
            <div className={cn(
                "h-16 flex items-center border-b border-border/40 px-4",
                isCollapsed ? "justify-center" : "justify-between"
            )}>
                {!isCollapsed && (
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                            <Database className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <span className="font-bold text-lg tracking-tight truncate">
                            DataCompare
                        </span>
                    </div>
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isCollapsed ? (
                        <PanelLeft className="h-5 w-5" />
                    ) : (
                        <PanelLeftClose className="h-5 w-5" />
                    )}
                </Button>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 overflow-y-auto">
                <nav className="space-y-1">
                    {isCollapsed ? (
                        // Flat list for collapsed state
                        flattenedItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = location.pathname === item.path;
                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={cn(
                                        "flex items-center justify-center w-10 h-10 mx-auto rounded-lg transition-all duration-200 mb-2",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground"
                                    )}
                                    title={item.label}
                                >
                                    <Icon className="h-5 w-5" />
                                </Link>
                            );
                        })
                    ) : (
                        // Nested list for expanded state
                        menuItems.map(item => renderMenuItem(item))
                    )}
                </nav>
            </div>

        </aside>
    );
}
