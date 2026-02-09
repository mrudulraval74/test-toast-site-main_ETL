import { Outlet } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Sidebar } from '@/components/Sidebar';
import { AlertCircle, Monitor } from 'lucide-react';

const ETLPage = () => {

    return (
        <div className="min-h-screen flex flex-col">
            <Navigation />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-auto bg-background/50 relative">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default ETLPage;
