import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInputProps {
    onGenerate: (prompt: string) => Promise<void>;
    placeholder?: string;
    className?: string;
    isLoading?: boolean;
    suggestions?: string[];
}

export function AIInput({ onGenerate, placeholder = "Describe what you want...", className, isLoading = false, suggestions = [] }: AIInputProps) {
    const [prompt, setPrompt] = useState('');

    const handleGenerate = async () => {
        if (!prompt.trim() || isLoading) {
            return;
        }

        await onGenerate(prompt);
        setPrompt('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    return (
        <div className={className}>
            <div className="relative flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    </div>
                    <Input
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="pl-9 pr-12 bg-background/50 border-primary/20 focus-visible:ring-primary/30 transition-all"
                        disabled={isLoading}
                    />
                    <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                        <Button
                            onClick={handleGenerate}
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs hover:bg-primary/10 hover:text-primary"
                            disabled={!prompt.trim() || isLoading}
                        >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Generate'}
                        </Button>
                    </div>
                </div>
            </div>
            {suggestions && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1">
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            onClick={() => setPrompt(suggestion)}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors bg-muted/30 px-2 py-1 rounded-full border border-transparent hover:border-primary/20"
                            type="button"
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
