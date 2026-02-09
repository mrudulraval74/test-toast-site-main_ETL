import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, ArrowRight, RotateCcw } from 'lucide-react';

interface WorkflowStep {
    id: number;
    title: string;
    icon: string;
    description: string;
}

interface WorkflowStepperProps {
    currentStep: number;
    onStepChange: (step: number) => void;
    canAccessStep: (step: number) => boolean;
    onRestart?: () => void;
    children: React.ReactNode;
}

const STEPS: WorkflowStep[] = [
    { id: 1, title: 'Connections', icon: '🔗', description: 'Create and manage database connections' },
    { id: 2, title: 'Upload & Validate', icon: '📤', description: 'Upload mapping file and validate structure' },
    { id: 3, title: 'Test Comparison', icon: '🧪', description: 'Run and manage test cases' },
    { id: 4, title: 'Save Results', icon: '💾', description: 'Review and save test results' }
];

export function WorkflowStepper({ currentStep, onStepChange, canAccessStep, onRestart, children }: WorkflowStepperProps) {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stepper Progress Bar */}
            <div className="relative">
                {/* Connecting Line Background */}
                <div className="absolute top-8 left-0 w-full h-1 bg-gradient-to-r from-muted to-muted rounded-full -z-10" />

                {/* Active Progress Line */}
                <div
                    className="absolute top-8 left-0 h-1 bg-gradient-to-r from-primary to-accent rounded-full -z-10 transition-all duration-700 ease-in-out"
                    style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                />

                <div className="flex justify-between relative z-10">
                    {STEPS.map((step) => {
                        const isActive = currentStep === step.id;
                        const isCompleted = currentStep > step.id;
                        const isAccessible = canAccessStep(step.id);

                        return (
                            <div key={step.id} className="flex flex-col items-center group">
                                <button
                                    onClick={() => isAccessible && onStepChange(step.id)}
                                    disabled={!isAccessible}
                                    className={`
                                        relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 transition-all duration-300
                                        ${isCompleted
                                            ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg scale-100'
                                            : isActive
                                                ? 'bg-gradient-to-br from-primary to-accent text-white shadow-elegant scale-110 ring-4 ring-primary/20'
                                                : isAccessible
                                                    ? 'bg-card border-2 border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:-translate-y-1 cursor-pointer'
                                                    : 'bg-muted border-2 border-transparent text-muted-foreground/30 cursor-not-allowed grayscale'
                                        }
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle className="w-8 h-8 animate-in zoom-in spin-in-12 duration-300" />
                                    ) : (
                                        <span className={`transform transition-transform duration-300 ${isActive ? 'scale-110' : ''}`}>
                                            {step.icon}
                                        </span>
                                    )}

                                    {isActive && (
                                        <span className="absolute -bottom-2 w-12 h-1 bg-primary/50 blur-md rounded-full" />
                                    )}
                                </button>

                                <div className={`text-center transition-all duration-300 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-70 group-hover:opacity-100'}`}>
                                    <div className={`text-sm font-bold tracking-tight ${isActive ? 'text-primary' : 'text-foreground/80'}`}>
                                        {step.title}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1 max-w-[120px] leading-tight hidden md:block">
                                        {step.description}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[500px] mt-8 bg-card/50 backdrop-blur-sm rounded-xl p-1 transition-all duration-500">
                {children}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-border/50">
                <Button
                    onClick={() => onStepChange(currentStep - 1)}
                    disabled={currentStep === 1}
                    variant="ghost"
                    className="gap-2 hover:bg-primary/5 pl-2"
                >
                    <ArrowRight className="h-4 w-4 rotate-180" /> Previous Step
                </Button>

                {currentStep < STEPS.length ? (
                    <Button
                        onClick={() => onStepChange(currentStep + 1)}
                        disabled={!canAccessStep(currentStep + 1)}
                        className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all px-6"
                    >
                        Next: {STEPS[currentStep]?.title} <ArrowRight className="h-4 w-4" />
                    </Button>
                ) : (
                    <Button
                        onClick={() => onRestart ? onRestart() : onStepChange(1)}
                        variant="outline"
                        className="gap-2 border-dashed text-primary hover:bg-primary/5"
                    >
                        <RotateCcw className="h-4 w-4" /> Start New Workflow
                    </Button>
                )}
            </div>
        </div>
    );
}
