import React, { Component, ErrorInfo, ReactNode } from 'react';
import '../../styles/resort-app.css';

interface Props {
  children: ReactNode;
  sectionName: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ResortSectionBoundary - Modular error isolation boundary for resort sections.
 * Guarantees that if any individual component (images, calendar, reviews, specs) fails,
 * other resort sections and the reservation engine remain 100% operational.
 */
export default class ResortSectionBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn(`[ResortSectionBoundary] Error caught in section "${this.props.sectionName}":`, error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="resort-section-wrapper has-error" style={{ padding: '24px 0' }}>
          <div className="resort-boundary-card">
            <div className="resort-boundary-icon">
              <i className="fas fa-arrows-rotate" />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', color: '#FFFFFF', margin: 0, fontWeight: 600 }}>
                {this.props.sectionName} is Temporarily Refreshing
              </h4>
              <p style={{ fontSize: '.78rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: 4, marginBottom: 12 }}>
                {this.props.fallbackMessage || 'This section encountered a minor display issue. All other resort reservations and booking features remain fully active.'}
              </p>
            </div>
            <button
              type="button"
              onClick={this.handleRetry}
              style={{
                fontSize: '.75rem',
                fontWeight: 600,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38BDF8',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s ease',
              }}
            >
              <i className="fas fa-rotate-right" />
              <span>Retry Section</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
