import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex flex-col items-center justify-center">
          <div className="max-w-md w-full bg-slate-900 border border-rose-800 rounded-2xl p-6 text-center shadow-xl">
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-bold text-rose-400 mb-2">Something went wrong</h1>
            <p className="text-sm text-slate-300 mb-4">
              {this.state.error?.message || "An unexpected error occurred while loading the scanner."}
            </p>
            <div className="bg-slate-950 p-3 rounded-xl text-left font-mono text-xs text-rose-300 overflow-x-auto mb-5 max-h-32 border border-slate-800">
              {this.state.error?.stack || String(this.state.error)}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
