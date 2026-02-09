
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Trash2, Plus, Search } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface TestRun {
    id: string;
    created_at: string;
    summary: {
        fileName: string;
        folderName?: string;
        totalTests: number;
        passedTests: number;
        failedTests: number;
    };
}

interface TestHistorySidebarProps {
    savedRuns: TestRun[];
    onLoadRun: (run: TestRun) => void;
    onDeleteRun?: (id: string) => void;
    onDeleteFolder?: (folderName: string) => void;
    className?: string; // Add className prop
}

export function TestHistorySidebar({ savedRuns, onLoadRun, onDeleteRun, onDeleteFolder, className }: TestHistorySidebarProps) {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['Uncategorized']));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRuns, setSelectedRuns] = useState<string[]>([]); // For bulk delete

    // Toggle folder expansion
    const toggleFolder = (folder: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folder)) {
            newExpanded.delete(folder);
        } else {
            newExpanded.add(folder);
        }
        setExpandedFolders(newExpanded);
    };

    // Group runs by folder
    const groupedRuns = useMemo(() => {
        const groups: Record<string, TestRun[]> = { 'Uncategorized': [] };

        savedRuns.forEach(run => {
            // Filter by search term
            if (searchTerm && !run.summary.fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
                return;
            }

            const folder = run.summary.folderName || 'Uncategorized';
            if (!groups[folder]) {
                groups[folder] = [];
            }
            groups[folder].push(run);
        });

        // Remove empty groups if searching (except if match found)
        if (searchTerm) {
            Object.keys(groups).forEach(key => {
                if (groups[key].length === 0) delete groups[key];
            });
        }

        return groups;
    }, [savedRuns, searchTerm]);

    const sortedFolders = Object.keys(groupedRuns).sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
    });

    return (
        <div className={cn("flex flex-col h-full border-r bg-muted/10", className)}>
            <div className="p-4 border-b space-y-2">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Folder className="h-4 w-4 text-primary" />
                        Test Explorer
                    </h3>
                    {savedRuns.length > 0 && (
                        <div className="flex items-center gap-2">
                            {/* Select All Checkbox */}
                            <div className="flex items-center gap-1">
                                <Checkbox
                                    checked={selectedRuns.length === savedRuns.length && savedRuns.length > 0}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedRuns(savedRuns.map(r => r.id));
                                        } else {
                                            setSelectedRuns([]);
                                        }
                                    }}
                                />
                                <span className="text-xs text-muted-foreground">All</span>
                            </div>

                            {/* Bulk Actions Dropdown */}
                            {selectedRuns.length > 0 && onDeleteRun && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-7 gap-1 text-xs"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Delete ({selectedRuns.length})
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete {selectedRuns.length} Test Run(s)?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the selected test runs. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => {
                                                    selectedRuns.forEach(id => onDeleteRun(id));
                                                    setSelectedRuns([]);
                                                }}
                                                className="bg-red-500 hover:bg-red-600"
                                            >
                                                Delete All Selected
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Search runs..."
                        className="pl-8 h-8 text-xs"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {sortedFolders.map(folder => (
                        <div key={folder} className="space-y-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start font-semibold text-xs h-8 hover:bg-muted/50 group"
                                onClick={() => toggleFolder(folder)}
                            >
                                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                    {expandedFolders.has(folder) ? (
                                        <ChevronDown className="h-3 w-3 shrink-0" />
                                    ) : (
                                        <ChevronRight className="h-3 w-3 shrink-0" />
                                    )}
                                    <Folder className="h-3.5 w-3.5 shrink-0 text-blue-500/70" />
                                    <span className="truncate">{folder}</span>
                                    <span className="ml-auto text-[10px] text-muted-foreground bg-muted px-1.5 rounded-full">
                                        {groupedRuns[folder].length}
                                    </span>
                                </div>

                                {/* Folder Delete Action */}
                                {onDeleteFolder && folder !== 'Uncategorized' && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity px-1" onClick={(e) => e.stopPropagation()}>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 text-muted-foreground hover:text-red-500"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Folder "{folder}"?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete this folder and ALL {groupedRuns[folder].length} test runs inside it.
                                                        This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDeleteFolder(folder)} className="bg-red-500 hover:bg-red-600">
                                                        Delete Folder
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </Button>

                            {/* Runs List */}
                            {expandedFolders.has(folder) && (
                                <div className="ml-4 space-y-[2px] border-l pl-2 border-border/50">
                                    {groupedRuns[folder].map(run => (
                                        <div key={run.id} className="group flex items-center gap-1 pr-2 rounded-md hover:bg-muted/50 transition-colors">
                                            {/* Checkbox for selection */}
                                            <Checkbox
                                                checked={selectedRuns.includes(run.id)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedRuns([...selectedRuns, run.id]);
                                                    } else {
                                                        setSelectedRuns(selectedRuns.filter(id => id !== run.id));
                                                    }
                                                }}
                                                className="ml-1"
                                                onClick={(e) => e.stopPropagation()}
                                            />

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="flex-1 justify-start h-8 text-xs font-normal"
                                                onClick={() => onLoadRun(run)}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden w-full">
                                                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="truncate" title={run.summary.fileName}>
                                                        {run.summary.fileName}
                                                    </span>
                                                </div>
                                            </Button>

                                            {/* Status Dot */}
                                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${run.summary.failedTests > 0 ? 'bg-red-500' : 'bg-green-500'
                                                }`} title={run.summary.failedTests > 0 ? 'Has Failures' : 'All Passed'} />

                                            {/* Delete Action */}
                                            {onDeleteRun && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Test Run?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone. This will permanently delete this test run history.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => onDeleteRun(run.id)}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                    ))}
                                    {groupedRuns[folder].length === 0 && (
                                        <div className="px-2 py-1 text-[10px] text-muted-foreground italic">
                                            No runs found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {savedRuns.length === 0 && (
                        <div className="text-center p-4 text-xs text-muted-foreground">
                            No test history found.
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

// Dialog to Save Run with Folder
interface SaveRunDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (name: string, folder: string) => void;
    defaultName: string;
    existingFolders: string[];
}

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export function SaveRunDialog({ open, onOpenChange, onSave, defaultName, existingFolders }: SaveRunDialogProps) {
    const [name, setName] = useState(defaultName);
    const [folder, setFolder] = useState('Uncategorized');
    const [isCustomFolder, setIsCustomFolder] = useState(false);
    const [customFolder, setCustomFolder] = useState('');

    const handleSave = () => {
        const finalFolder = isCustomFolder ? customFolder : folder;
        if (!finalFolder) return;
        onSave(name, finalFolder);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Save Test Suite (With Logic)</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Run Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label>Folder / Module</Label>
                        {!isCustomFolder ? (
                            <div className="flex gap-2">
                                <Select value={folder} onValueChange={(val) => {
                                    if (val === 'new_custom') {
                                        setIsCustomFolder(true);
                                        setFolder('');
                                    } else {
                                        setFolder(val);
                                    }
                                }}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select folder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                                        {existingFolders.filter(f => f !== 'Uncategorized').map(f => (
                                            <SelectItem key={f} value={f}>{f}</SelectItem>
                                        ))}
                                        <SelectItem value="new_custom" className="text-primary font-medium">
                                            <span className="flex items-center gap-1"><PlusCircle className="h-3 w-3" /> Create New Folder</span>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter folder name..."
                                    value={customFolder}
                                    onChange={(e) => setCustomFolder(e.target.value)}
                                    autoFocus
                                />
                                <Button variant="ghost" onClick={() => setIsCustomFolder(false)}>Cancel</Button>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
