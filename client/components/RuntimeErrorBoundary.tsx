import type { ReactNode } from "react";
import { Component } from "react";

type RuntimeErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class RuntimeErrorBoundary extends Component<{ children: ReactNode }, RuntimeErrorBoundaryState> {
  state: RuntimeErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): RuntimeErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
    };
  }

  componentDidCatch(error: Error) {
    console.error("RuntimeErrorBoundary caught an error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-soft-gradient px-4">
          <div className="max-w-2xl rounded-[2rem] border border-red-200 bg-white p-8 shadow-luxury">
            <div className="text-xs font-semibold uppercase tracking-[0.35em] text-red-500">Runtime error</div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">The app hit a client-side crash.</h1>
            <p className="mt-4 text-slate-600">
              A fallback screen is shown instead of a blank page so the error is visible while we debug it.
            </p>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">{this.state.message}</div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
