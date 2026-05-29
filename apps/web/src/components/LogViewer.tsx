import React, { useEffect, useRef } from 'react';

interface Log {
  sequence: number;
  stage: string;
  message: string;
  timestamp?: string;
  createdAt?: string;
}

const formatTimestamp = (log: Log) => {
  const raw = log.timestamp ?? log.createdAt;
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export function LogViewer({ logs }: { logs: Log[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="log-box">
      {logs.length === 0 ? (
        <div className="log-line dim">Waiting for logs...</div>
      ) : (
        logs.map(log => (
          <div key={log.sequence} className="log-line">
            <span className="log-stage">[{log.stage}]</span>
            <span className="log-time">[{formatTimestamp(log)}]</span>
            <span className="log-msg">{log.message}</span>
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
