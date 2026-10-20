import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <main className="empty">
        <h1>Не удалось открыть приложение</h1>
        <p>{this.state.error}</p>
        <p>Проверьте, разрешено ли браузеру хранить локальные данные.</p>
        <button className="button" onClick={() => location.reload()}>
          Попробовать снова
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
