import { Info } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpTooltipProps {
    content: string | React.ReactNode;
    title?: string;
    maxWidth?: string;
    side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Reusable help tooltip component with info icon
 * Provides consistent styling and behavior for contextual help
 */
export function HelpTooltip({
    content,
    title,
    maxWidth = 'max-w-xs',
    side = 'top'
}: HelpTooltipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    onClick={(e) => e.preventDefault()}
                >
                    <Info className="h-4 w-4" />
                </button>
            </TooltipTrigger>
            <TooltipContent side={side} className={maxWidth}>
                {title && <p className="font-semibold mb-1">{title}</p>}
                {typeof content === 'string' ? <p>{content}</p> : content}
            </TooltipContent>
        </Tooltip>
    );
}
