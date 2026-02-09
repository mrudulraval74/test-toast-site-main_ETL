import { Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WorkflowStep {
    id: string;
    label: string;
    description?: string;
    completed: boolean;
    active?: boolean;
}

interface WorkflowStepsProps {
    steps: WorkflowStep[];
    onStepClick?: (stepId: string) => void;
    className?: string;
}

/**
 * Workflow step indicator component
 * Shows progress through a multi-step process with visual feedback
 */
export function WorkflowSteps({ steps, onStepClick, className }: WorkflowStepsProps) {
    return (
        <div className={cn("w-full", className)}>
            {/* Desktop view - horizontal */}
            <div className="hidden md:flex items-center justify-between">
                {steps.map((step, idx) => (
                    <div key={step.id} className="flex items-center flex-1">
                        <div
                            className={cn(
                                "flex items-center gap-3 flex-1",
                                onStepClick && "cursor-pointer hover:opacity-80 transition-opacity"
                            )}
                            onClick={() => onStepClick?.(step.id)}
                        >
                            {/* Step circle */}
                            <div
                                className={cn(
                                    "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                                    step.completed
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : step.active
                                            ? "border-primary text-primary bg-primary/10"
                                            : "border-muted-foreground/30 text-muted-foreground bg-background"
                                )}
                            >
                                {step.completed ? (
                                    <Check className="h-5 w-5" />
                                ) : (
                                    <span className="text-sm font-semibold">{idx + 1}</span>
                                )}
                            </div>

                            {/* Step label */}
                            <div className="flex-1 min-w-0">
                                <p
                                    className={cn(
                                        "text-sm font-medium truncate",
                                        step.completed || step.active
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {step.label}
                                </p>
                                {step.description && (
                                    <p className="text-xs text-muted-foreground truncate">
                                        {step.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Connector */}
                        {idx < steps.length - 1 && (
                            <ChevronRight
                                className={cn(
                                    "h-5 w-5 mx-2 flex-shrink-0",
                                    step.completed ? "text-primary" : "text-muted-foreground/30"
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Mobile view - vertical */}
            <div className="md:hidden space-y-3">
                {steps.map((step, idx) => (
                    <div
                        key={step.id}
                        className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                            step.active && "border-primary bg-primary/5",
                            !step.active && "border-border",
                            onStepClick && "cursor-pointer hover:bg-accent"
                        )}
                        onClick={() => onStepClick?.(step.id)}
                    >
                        {/* Step circle */}
                        <div
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full border-2 flex-shrink-0 transition-all",
                                step.completed
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : step.active
                                        ? "border-primary text-primary bg-primary/10"
                                        : "border-muted-foreground/30 text-muted-foreground bg-background"
                            )}
                        >
                            {step.completed ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <span className="text-xs font-semibold">{idx + 1}</span>
                            )}
                        </div>

                        {/* Step content */}
                        <div className="flex-1 min-w-0 pt-0.5">
                            <p
                                className={cn(
                                    "text-sm font-medium",
                                    step.completed || step.active
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                )}
                            >
                                {step.label}
                            </p>
                            {step.description && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {step.description}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/**
 * Helper to calculate next incomplete step
 */
export function getNextIncompleteStep(steps: WorkflowStep[]): WorkflowStep | null {
    return steps.find(step => !step.completed) || null;
}

/**
 * Helper to check if all steps are completed
 */
export function areAllStepsCompleted(steps: WorkflowStep[]): boolean {
    return steps.every(step => step.completed);
}
