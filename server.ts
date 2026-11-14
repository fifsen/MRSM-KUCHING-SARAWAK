import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

interface MissionChatContext {
  screen?: string;
  step?: number;
  difficulty?: string;
  missionName?: string;
  deltaVReq?: number;
  achievedDeltaV?: number;
  deltaVMargin?: number;
  wetMassKg?: number;
  rocketName?: string;
  rocketCapacityKg?: number;
  availablePowerW?: number;
  requiredPowerW?: number;
  dataReturnedPct?: number;
  totalCostM?: number;
  budgetCapM?: number;
  propulsion?: string;
  shielding?: string;
  redundancy?: string;
  instruments?: string[];
  failedChecks?: string[];
}

function buildSystemInstruction(ctx?: MissionChatContext): string {
  const baseRules = `You are "Orbit", the friendly Mission Control AI Copilot inside the space engineering game Mission Architect.
Help students design, launch, and fly robotic space missions. Keep replies crisp, encouraging, and practical (under 90 words unless asked to explain deeply), using short bullet points when recommending changes.

Game Engineering Rules:
- Targets: Lunar Orbiter (4100 m/s dv, 0.0026 AU, 1x rad, 100% sun, $420M, 18 mo window), Mars Orbiter (5000 m/s, 1.5 AU, 1.2x rad, 43% sun, $560M, 36 mo), Asteroid Sampler (5600 m/s, 1.3 AU, 1.5x rad, 55% sun, $600M, 48 mo, needs Sampler or science is cut to 40%), Europa Explorer (5200 m/s, 5.2 AU, 6x rad, 3.7% sun, $1500M, 108 mo -> needs RTG power + Vault shielding + Backups + Large Dish).
- Review needs >= 150 m/s spare delta-v, enough power (Ion Drive needs 700 W + bus power), mass within rocket capacity (Light 600kg, Medium 3000kg, Heavy 9000kg, Super-heavy 22000kg), payload within bus room (Small 50kg, Medium 110kg, Large 220kg), at least 1 instrument, and total cost within budget.`;

  if (!ctx) return baseRules;

  const summary = [
    `Screen: ${ctx.screen ?? 'PLAYING'} (Step ${ctx.step ?? 1}/6)`,
    ctx.missionName ? `Target: ${ctx.missionName} (${ctx.difficulty ?? 'Standard'} mode)` : null,
    typeof ctx.achievedDeltaV === 'number' && typeof ctx.deltaVReq === 'number'
      ? `Delta-v: ${Math.round(ctx.achievedDeltaV)} / ${ctx.deltaVReq} m/s (spare: ${Math.round(ctx.deltaVMargin ?? 0)} m/s)`
      : null,
    typeof ctx.wetMassKg === 'number' && typeof ctx.rocketCapacityKg === 'number'
      ? `Mass: ${Math.round(ctx.wetMassKg)} / ${ctx.rocketCapacityKg} kg (${ctx.rocketName ?? 'Rocket'})`
      : null,
    typeof ctx.availablePowerW === 'number' && typeof ctx.requiredPowerW === 'number'
      ? `Power: ${Math.round(ctx.availablePowerW)} / ${Math.round(ctx.requiredPowerW)} W`
      : null,
    typeof ctx.dataReturnedPct === 'number' ? `Data Sent: ${ctx.dataReturnedPct}%` : null,
    typeof ctx.totalCostM === 'number' && typeof ctx.budgetCapM === 'number'
      ? `Cost: $${ctx.totalCostM}M / $${ctx.budgetCapM}M`
      : null,
    ctx.propulsion ? `Engine: ${ctx.propulsion}, Shield: ${ctx.shielding ?? 'none'}, Backups: ${ctx.redundancy ?? 'single'}` : null,
    ctx.instruments?.length ? `Sensors: ${ctx.instruments.join(', ')}` : 'Sensors: none',
    ctx.failedChecks?.length ? `Failing Checks: ${ctx.failedChecks.join(', ')}` : 'All Review Checks: Passing',
  ]
    .filter(Boolean)
    .join('\n');

  return `${baseRules}\n\nCurrent Spacecraft Telemetry:\n${summary}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/chat', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        messages?: ChatTurn[];
        context?: MissionChatContext;
      };

      const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
      const cleanMessages = rawMessages
        .filter(
          (m): m is ChatTurn =>
            Boolean(m) &&
            (m.role === 'user' || m.role === 'model') &&
            typeof m.text === 'string' &&
            m.text.trim().length > 0,
        )
        .slice(-12);

      if (cleanMessages.length === 0) {
        res.status(400).json({ error: 'Please enter a message.' });
        return;
      }

      const lastMsg = cleanMessages[cleanMessages.length - 1];
      if (lastMsg.role !== 'user') {
        res.status(400).json({ error: 'Last message must come from user.' });
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: 'API key not configured. Add GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      const history = cleanMessages.slice(0, -1).map((m) => ({
        role: m.role,
        parts: [{ text: m.text }],
      }));

      const chat = ai.chats.create({
        model: 'gemini-4-hydrogen',
        history,
        config: {
          systemInstruction: buildSystemInstruction(body?.context),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const response = await chat.sendMessage({ message: lastMsg.text });
      const reply = (response.text ?? '').trim();

      if (!reply) {
        res.status(502).json({ error: 'Empty response from AI copilot.' });
        return;
      }

      res.json({ reply });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to reach AI copilot.';
      console.error('Gemini /api/chat error:', err);
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mission Architect server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
