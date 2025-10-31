import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { HiExclamationTriangle } from 'react-icons/hi2';
import { motion } from 'framer-motion';
import { logError, getUserFriendlyErrorMessage } from '../../utils/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, this.props.context || 'ErrorBoundary');
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  handleRetry = () => {
    const { retryCount } = this.state;
    const maxRetries = 3;
    
    if (retryCount >= maxRetries) {
      // Reset after max retries
      this.handleReset();
      return;
    }

    // Exponential backoff: 1s, 2s, 4s
    const delay = Math.pow(2, retryCount) * 1000;
    
    this.retryTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1,
      });
      this.retryTimeoutId = null;
    }, delay);
  };

  componentWillUnmount() {
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-2xl w-full bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg p-8"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <HiExclamationTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
                <p className="text-[#9ca3af] text-sm mt-1">
                  An unexpected error occurred. Please try refreshing the page.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="bg-[#1a1a1a] rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm mb-2">
                  {getUserFriendlyErrorMessage(this.state.error)}
                </p>
                {import.meta.env.DEV && (
                  <p className="text-red-400/60 font-mono text-xs mt-2">
                    {this.state.error.message}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-[#b85a3a] hover:bg-[#a04a2a] text-white rounded-lg transition-colors"
              >
                Try Again
                {this.state.retryCount > 0 && (
                  <span className="ml-2 text-xs opacity-75">
                    ({this.state.retryCount}/3)
                  </span>
                )}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#3a3a3a] hover:bg-[#4a4a4a] text-white rounded-lg transition-colors"
              >
                Reload Page
              </button>
            </div>

            {import.meta.env.DEV && this.state.errorInfo && (
              <details className="mt-6">
                <summary className="text-[#9ca3af] cursor-pointer mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="bg-[#1a1a1a] rounded-lg p-4 overflow-auto text-xs text-[#9ca3af] font-mono">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

