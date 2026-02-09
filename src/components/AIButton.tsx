import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface AIButtonProps {
    onClick: (e?: React.MouseEvent) => void;
    label?: string;
    isLoading?: boolean;
    tooltip?: string;
    disabled?: boolean;
    variant?: 'default' | 'outline' | 'ghost' | 'secondary';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    className?: string;
}

export function AIButton({
    onClick,
    label,
    isLoading,
    tooltip,
    disabled,
    variant = 'outline',
    size = 'sm',
    className
}: AIButtonProps) {
    const button = (
        <Button
            variant={variant}
            size={size}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={`gap-2 ${className}`}
        >
            {isLoading ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
                <Sparkles className="h-4 w-4" />
            )}
            {label && <span>{label}</span>}
        </Button>
    );

    if (tooltip) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {button}
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return button;
}
