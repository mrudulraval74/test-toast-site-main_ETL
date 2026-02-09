import { useState, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api';

const getAuthHeaders = () => {
    // Using the standard anon key for authentication
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmamVpY3J2ZWxnbXl5ZWN2bHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NjgwNDcsImV4cCI6MjA3OTU0NDA0N30.HntMCQgGp7PmfryCvilswUNOvyTHuRPYdTgZGvY6z7k";
    return {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`
    };
};

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface AIResponse {
    response: string;
    suggestions: string[];
    tokensUsed?: number;
    actions?: any[];
}

interface UseAIChatReturn {
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    sendMessage: (message: string, contextData?: any) => Promise<{ success: boolean } & AIResponse>;
    clearMessages: () => void;
    suggestions: string[];
    actions: any[]; // AI-generated actions
}

/**
 * Custom hook for AI chat functionality
 * @param context - Page context (connections, query-builder, compare, reports)
 */
export function useAIChat(context: string): UseAIChatReturn {
    const [messages, setMessages] = useState<Message[]>(() => {
        // Load messages from session storage
        const stored = sessionStorage.getItem(`ai-chat-${context}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return parsed.map((msg: any) => ({
                    ...msg,
                    timestamp: new Date(msg.timestamp)
                }));
            } catch {
                return [];
            }
        }
        return [];
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [actions, setActions] = useState<any[]>([]);

    // Save messages to session storage
    const saveMessages = useCallback((msgs: Message[]) => {
        sessionStorage.setItem(`ai-chat-${context}`, JSON.stringify(msgs));
    }, [context]);

    // Load initial suggestions
    useState(() => {
        fetch(`${API_BASE_URL}/ai/suggestions?context=${context}`, {
            headers: getAuthHeaders()
        })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setSuggestions(data.suggestions);
                }
            })
            .catch(err => {
                console.error('Failed to load suggestions:', err);
            });
    });

    const sendMessage = useCallback(async (message: string, contextData?: any) => {
        if (!message.trim()) return;

        setIsLoading(true);
        setError(null);

        // Add user message
        const userMessage: Message = {
            role: 'user',
            content: message.trim(),
            timestamp: new Date()
        };

        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        saveMessages(updatedMessages);

        try {
            // Prepare history for API (only role and content)
            const history = messages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            const response = await fetch(`${API_BASE_URL}/ai/chat`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    message: message.trim(),
                    context,
                    history,
                    contextData // Pass additional context data
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            const data: { success: boolean } & AIResponse = await response.json();

            if (!data.success) {
                throw new Error('Failed to get response');
            }

            // Add assistant message
            const assistantMessage: Message = {
                role: 'assistant',
                content: data.response,
                timestamp: new Date()
            };

            const finalMessages = [...updatedMessages, assistantMessage];
            setMessages(finalMessages);
            saveMessages(finalMessages);

            // Update suggestions
            if (data.suggestions) {
                setSuggestions(data.suggestions);
            }

            // Store actions
            if (data.actions && Array.isArray(data.actions)) {
                setActions(data.actions);
            }

            return data;

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
            setError(errorMessage);
            console.error('AI chat error:', err);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [messages, context, saveMessages]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        sessionStorage.removeItem(`ai-chat-${context}`);
        setError(null);
    }, [context]);

    return {
        messages,
        isLoading,
        error,
        sendMessage,
        clearMessages,
        suggestions,
        actions
    };
}
