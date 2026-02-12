import { Button } from '@/components/ui/button';
import { type ComponentType, type ReactNode } from 'react';
import {
    ArrowRight,
    CheckCircle2,
    Database,
    FlaskConical,
    Lock,
    RotateCcw,
    Upload,
    Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
    id: number;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
}

interface WorkflowStepperProps {
    currentStep: number;
    onStepChange: (step: number) => void;
    canAccessStep: (step: number) => boolean;
    onRestart?: () => void;
    children: ReactNode;
}

const STEPS: WorkflowStep[] = [
    { id: 1, title: 'Connections', icon: Database, description: 'Create and manage database connections' },
    { id: 2, title: 'Upload & Validate', icon: Upload, description: 'Upload mapping file and validate structure' },
    { id: 3, title: 'Test Comparison', icon: FlaskConical, description: 'Run and manage test cases' },
    { id: 4, title: 'Save Results', icon: Save, description: 'Review and save test results' },
];

export function WorkflowStepper({ currentStep, onStepChange, canAccessStep, onRestart, children }: WorkflowStepperProps) {
    return (
        <div className="space-y-6">
            <div className="rounded-xl border bg-card px-4 py-5 sm:px-5">
                <div className="relative">
                    <div className="absolute left-0 right-0 top-5 h-px bg-border" />
                    <div
                        className="absolute left-0 top-5 h-px bg-primary transition-all duration-500"
                        style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                    />

                    <div className="relative grid grid-cols-4 gap-2 sm:gap-4">
                        {STEPS.map((step) => {
                            const StepIcon = step.icon;
                            const isActive = currentStep === step.id;
                            const isCompleted = currentStep > step.id;
                            const isAccessible = canAccessStep(step.id);

                            return (
                                <button
                                    key={step.id}
                                    type="button"
                                    onClick={() => isAccessible && onStepChange(step.id)}
                                    disabled={!isAccessible}
                                    className={cn(
                                        'group flex flex-col items-center gap-2 rounded-lg p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                                        !isAccessible && 'cursor-not-allowed'
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border text-muted-foreground transition-all',
                                            isCompleted && 'border-emerald-500 bg-emerald-500 text-white',
                                            isActive && 'border-primary bg-primary text-primary-foreground ring-4 ring-primary/15',
                                            !isActive && !isCompleted && isAccessible && 'bg-background group-hover:border-primary/40 group-hover:text-primary',
                                            !isAccessible && 'border-border/60 bg-muted text-muted-foreground/60'
                                        )}
                                    >
                                        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <StepIcon className="h-4 w-4" />}
                                        {!isAccessible && !isCompleted && (
                                            <span className="absolute -right-1 -top-1 rounded-full border bg-background p-0.5">
                                                <Lock className="h-2.5 w-2.5 text-muted-foreground" />
                                            </span>
                                        )}
                                    </div>

                                    <div className="space-y-0.5">
                                        <p className={cn('text-xs font-semibold sm:text-sm', isActive ? 'text-primary' : 'text-foreground')}>
                                            {step.title}
                                        </p>
                                        <p className="hidden text-[11px] text-muted-foreground lg:block">{step.description}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border bg-card p-4 sm:p-6">
                {children}
            </div>

            <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-xl border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
                <Button
                    onClick={() => onStepChange(currentStep - 1)}
                    disabled={currentStep === 1}
                    variant="ghost"
                    className="h-9 gap-2"
                >
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    Previous
                </Button>

                {currentStep < STEPS.length ? (
                    <Button
                        onClick={() => onStepChange(currentStep + 1)}
                        disabled={!canAccessStep(currentStep + 1)}
                        className="h-9 gap-2 px-4"
                    >
                        Next: {STEPS[currentStep]?.title}
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={() => (onRestart ? onRestart() : onStepChange(1))}
                        variant="outline"
                        className="h-9 gap-2"
                    >
                        <RotateCcw className="h-4 w-4" />
                        Start New Workflow
                    </Button>
                )}
            </div>
        </div>
    );
}
