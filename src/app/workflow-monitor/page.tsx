'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const MONITOR_URL = 'http://localhost:5173'; // situation-monitor dev server

export default function WorkflowMonitorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll workflow state from our API and push to iframe
  const pushWorkflowToIframe = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow-status');
      const data = await res.json();
      if (data.workflow && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'workflow-update', payload: data.workflow },
          '*'
        );
        setConnected(true);
        setError(null);
      }
    } catch {
      setError('Failed to fetch workflow state');
    }
  }, []);

  useEffect(() => {
    const handleLoad = () => {
      setTimeout(pushWorkflowToIframe, 500);
    };

    const iframe = iframeRef.current;
    iframe?.addEventListener('load', handleLoad);

    // Poll every 2 seconds for updates
    const interval = setInterval(pushWorkflowToIframe, 2000);

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'workflow-loaded') {
        setConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      iframe?.removeEventListener('load', handleLoad);
      clearInterval(interval);
      window.removeEventListener('message', handleMessage);
    };
  }, [pushWorkflowToIframe]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0a0a0a',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          borderBottom: '1px solid #2a2a2a',
          background: '#141414',
          flexShrink: 0,
        }}
      >
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#e8e8e8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Workflow Monitor
          </span>
          <span
            style={{
              fontSize: '0.6rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              background: connected
                ? 'rgba(68, 255, 136, 0.15)'
                : 'rgba(255, 170, 0, 0.15)',
              color: connected ? '#44ff88' : '#ffaa00',
              fontWeight: 600,
            }}
          >
            {connected ? 'CONNECTED' : 'CONNECTING...'}
          </span>
        </div>
        {error && (
          <span style={{ fontSize: '0.6rem', color: '#ff4444' }}>
            {error}
          </span>
        )}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={pushWorkflowToIframe}
            style={{
              fontSize: '0.6rem',
              padding: '0.2rem 0.5rem',
              border: '1px solid #2a2a2a',
              borderRadius: '3px',
              background: 'transparent',
              color: '#888',
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
          <a
            href={MONITOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '0.6rem',
              padding: '0.2rem 0.5rem',
              border: '1px solid #2a2a2a',
              borderRadius: '3px',
              background: 'transparent',
              color: '#888',
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Open in New Tab ↗
          </a>
        </div>
      </div>

      {/* Iframe */}
      <iframe
        ref={iframeRef}
        src={MONITOR_URL}
        style={{
          flex: 1,
          width: '100%',
          border: 'none',
          background: '#0a0a0a',
        }}
        title="Workflow Monitor"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
