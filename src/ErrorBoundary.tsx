import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught runtime error in React component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    try {
      localStorage.removeItem('cp_view_mode');
      localStorage.removeItem('cp_current_project_id');
      localStorage.removeItem('cp_main_menu');
      localStorage.removeItem('cp_tab_mode');
      localStorage.removeItem('cp_document_tab');
      localStorage.removeItem('cp_ai_diagnosis_tab');
    } catch (e) {
      console.error(e);
    }
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">화면 로딩 중 오류가 발생했습니다</h2>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              화면을 렌더링하는 중 일시적인 데이터 상태 또는 브라우저 캐시 불일치로 오류가 발생했습니다. 아래 버튼으로 새로고침하거나 상태를 초기화할 수 있습니다.
            </p>

            {this.state.error && (
              <div className="bg-slate-100 p-3 rounded-xl text-left mb-6 text-xs text-red-700 font-mono overflow-auto max-h-32 border border-slate-200">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>새로고침</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all border border-slate-300 active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>상태 초기화 후 재시작</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
