import { useState, useEffect } from 'react';
import { connectionsApi } from '@/lib/api';
import { Connection } from '@/types/ai-comparison';

export function useConnections() {
    const [savedConnections, setSavedConnections] = useState<Connection[]>([]);
    const [sourceConnection, setSourceConnection] = useState<Connection | null>(null);
    const [targetConnection, setTargetConnection] = useState<Connection | null>(null);
    const [isLoadingConnections, setIsLoadingConnections] = useState(true);

    useEffect(() => {
        loadConnections();
    }, []);

    const loadConnections = async () => {
        try {
            const { data } = await connectionsApi.list();
            if (data && Array.isArray(data)) {
                setSavedConnections(data);
            }
        } catch (error) {
            console.error('Failed to load connections:', error);
        } finally {
            setIsLoadingConnections(false);
        }
    };

    return {
        savedConnections,
        sourceConnection,
        targetConnection,
        setSourceConnection,
        setTargetConnection,
        isLoadingConnections,
        loadConnections
    };
}
