import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useLocalization } from "@app/providers/LocalizationProvider";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface LocalizedProps extends Props {
  pageCrashLabel: string;
  unexpectedLabel: string;
  retryLabel: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<LocalizedProps, State> {
  constructor(props: LocalizedProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-1">{this.props.pageCrashLabel}</h3>
          <p className="text-xs text-muted-foreground mb-3 max-w-xs">
            {this.state.error?.message || this.props.unexpectedLabel}
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {this.props.retryLabel}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary(props: Props) {
  const { t } = useLocalization();

  return (
    <ErrorBoundaryInner
      {...props}
      pageCrashLabel={t("boundary.pageCrash", { namespace: "errors" })}
      unexpectedLabel={t("boundary.unexpected", { namespace: "errors" })}
      retryLabel={t("actions.retry")}
    />
  );
}
