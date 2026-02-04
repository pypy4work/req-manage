import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-red-100 dark:border-red-900/30 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              The application encountered an unexpected error.
            </p>
            
            <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg text-left mb-6 overflow-auto max-h-32">
                <code className="text-xs text-red-600 dark:text-red-400 font-mono break-all">
                    {this.state.error?.message || 'Unknown Error'}
                </code>
            </div>

            <div className="flex gap-3 justify-center">
                <button 
                  onClick={() => window.location.reload()} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md active:scale-95"
                >
                  <RefreshCw className="w-4 h-4" /> Reload App
                </button>
                <button 
                  onClick={() => { window.location.hash = '#/'; window.location.reload(); }} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl font-bold transition-all hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <Home className="w-4 h-4" /> Go Home
                </button>
            </div>
          </div>
        </div>
      );
    }

    // Cast 'this' to any to avoid "Property 'props' does not exist" error in some TS configurations
    return (this as any).props.children;
  }
}