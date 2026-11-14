import React, { useEffect, useRef, useState } from 'react';
import type { StepId } from '../data/missionData';
import type { EngineeringMetrics } from '../engine/physics';
import { soundEngine } from '../audio/soundEngine';
import { Bot, RotateCcw, Send, Sparkles, X } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface MissionChatbotProps {
  metrics: EngineeringMetrics;
  screen: 'TITLE' | 'PLAYING';
  step: StepId;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'Orbit online. Ask about delta-v, power, sensors, or your current craft.',
};

const QUICK_PROMPTS = [
  'Check my craft',
  'Explain Delta-v',
  'Fix issues',
  'Best Europa build',
];

export const MissionChatbot: React.FC<MissionChatbotProps> = ({
  metrics,
  screen,
  step,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const buildContextPayload = () => {
    const { parts, cost, checks } = metrics;
    return {
      screen,
      step,
      difficulty: parts.difficulty.name,
      missionName: parts.mission.name,
      deltaVReq: parts.mission.deltaVReq,
      achievedDeltaV: Math.round(metrics.achievedDeltaV),
      deltaVMargin: Math.round(metrics.deltaVMargin),
      wetMassKg: Math.round(metrics.wetMassKg),
      rocketName: parts.rocket.name,
      rocketCapacityKg: parts.rocket.capacityKg,
      availablePowerW: Math.round(metrics.availablePowerW),
      requiredPowerW: Math.round(Math.max(metrics.averageDrawW, metrics.ionPowerRequiredW)),
      dataReturnedPct: Math.round(metrics.dataReturnedFraction * 100),
      totalCostM: Number(cost.total.toFixed(1)),
      budgetCapM: metrics.effectiveBudgetCap,
      propulsion: parts.propulsion.name,
      shielding: parts.shielding.name,
      redundancy: parts.redundancy.name,
      instruments: parts.instruments.map((i) => i.name),
      failedChecks: checks.filter((c) => !c.passed).map((c) => `${c.label}: ${c.summary}`),
    };
  };

  const sendMessage = async (rawText: string) => {
    const trimmed = rawText.trim();
    if (!trimmed || loading) return;

    soundEngine.playTick();
    setError(null);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          context: buildContextPayload(),
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok || !data.reply) {
        throw new Error(data.error ?? 'Failed to reach AI copilot.');
      }

      soundEngine.playSelect();
      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply!,
        },
      ]);
    } catch (err: unknown) {
      soundEngine.playAlert();
      const msg = err instanceof Error ? err.message : 'Unable to reach AI copilot.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    soundEngine.playTick();
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        window.setTimeout(() => inputRef.current?.focus(), 60);
      }
      return next;
    });
  };

  const handleReset = () => {
    soundEngine.playTick();
    setMessages([INITIAL_MESSAGE]);
    setError(null);
  };

  return (
    <div className="chatbot-root">
      {open && (
        <section
          className="chatbot-drawer"
          role="dialog"
          aria-label="Orbit AI Copilot"
        >
          <header className="chatbot-header">
            <div className="chatbot-title-wrap">
              <span className="chatbot-avatar" aria-hidden="true">
                <Bot size={16} />
              </span>
              <div>
                <h3 className="chatbot-title">Orbit AI</h3>
                <span className="chatbot-sub font-mono">
                  {metrics.parts.mission.name}
                </span>
              </div>
            </div>

            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-icon-btn btn-pill"
                onClick={handleReset}
                aria-label="Reset chat"
                title="Reset"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                className="chatbot-icon-btn btn-pill"
                onClick={() => setOpen(false)}
                aria-label="Close AI Copilot"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          <div ref={listRef} className="chatbot-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`chat-bubble chat-bubble--${msg.role}`}
              >
                {msg.text}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble chat-bubble--model chat-bubble--loading font-mono">
                Thinking...
              </div>
            )}
            {error && (
              <div className="chat-error" role="alert">
                {error}
              </div>
            )}
          </div>

          <div className="chatbot-quick-chips">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                className="chat-chip btn-pill"
                disabled={loading}
                onClick={() => void sendMessage(q)}
              >
                <Sparkles size={11} aria-hidden="true" />
                <span>{q}</span>
              </button>
            ))}
          </div>

          <form
            className="chatbot-form"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Orbit..."
              className="chatbot-input"
              maxLength={320}
              disabled={loading}
            />
            <button
              type="submit"
              className="chatbot-send-btn btn-pill"
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        className={`chatbot-fab btn-pill ${open ? 'chatbot-fab--open' : ''}`}
        onClick={handleToggle}
        aria-expanded={open}
      >
        {open ? <X size={17} /> : <Bot size={17} />}
        <span>{open ? 'Close' : 'AI Copilot'}</span>
      </button>
    </div>
  );
};
