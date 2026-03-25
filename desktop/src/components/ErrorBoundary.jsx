import React from 'react';

export default function ErrorBoundary({ children }) {
    const [hasError, setHasError] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => {
        const errorHandler = (event) => {
            setHasError(true);
            setError(event.error);
            console.error('Error caught by boundary:', event.error);
        };

        window.addEventListener('error', errorHandler);
        return () => window.removeEventListener('error', errorHandler);
    }, []);

    if (hasError) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-red-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <span className="text-red-600 text-xl">⚠️</span>
                        </div>
                        <h2 className="text-lg font-semibold text-slate-800">Something went wrong</h2>
                    </div>

                    <p className="text-sm text-slate-600 mb-4">
                        The extension encountered an unexpected error. Try refreshing the panel.
                    </p>

                    {error && (
                        <details className="mb-4">
                            <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
                                Error details
                            </summary>
                            <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto max-h-32">
                                {error.toString()}
                            </pre>
                        </details>
                    )}

                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Reload Extension
                    </button>
                </div>
            </div>
        );
    }

    return children;
}
