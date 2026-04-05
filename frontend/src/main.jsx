import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("FATAL REACT CAUGHT:", error, info); fetch('http://localhost:5173/__error', { method: 'POST', body: error.stack }); }
  render() {
    if (this.state.hasError) return <div style={{ background: 'black', color: 'red', padding: '20px', fontFamily: 'monospace', position: 'fixed', inset: 0, zIndex: 9999 }}><h1>FATAL ERROR</h1><p>{this.state.error.message}</p><pre>{this.state.error.stack}</pre></div>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
