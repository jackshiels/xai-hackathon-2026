import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const VALID_VOICE_IDS = ['Ara', 'Rex', 'Sal', 'Eve', 'Leo'];
const BACKEND_URL = 'http://localhost:8000';

function parseGoals(input: string) {
  return input
    .split(/\n|,/)
    .map((g) => g.trim())
    .filter(Boolean);
}

export default function CloneSetup() {
  const navigate = useNavigate();
  const { username } = useParams<{ username: string }>();

  const [voice, setVoice] = useState<string>(VALID_VOICE_IDS[0]);
  const [goalsInput, setGoalsInput] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const goalsPreview = useMemo(() => parseGoals(goalsInput), [goalsInput]);

  const handleClone = async () => {
    if (!username) return;
    setIsCloning(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: username,
          voice,
          goals: goalsPreview,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to clone profile');
      }

      const data = await response.json();
      setSuccess('Clone created successfully. Ready to chat!');

      const profileId = data?._id || data?.id || username;
      navigate(`/chat/${profileId}`, { state: { voice } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone profile';
      setError(message);
    } finally {
      setIsCloning(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-grok-bg text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-40 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 right-[-200px] -translate-y-1/2 h-[820px] w-[620px] light-beam" />
      </div>

      <main className="relative z-20 mx-auto flex min-h-[75vh] w-full max-w-5xl flex-col items-center px-4 pb-14 text-center">
        <div className="relative w-full select-none text-center">
          <h1 className="font-sans font-extrabold text-[18vw] leading-none tracking-tight grok-text-gradient opacity-90 mix-blend-overlay md:text-[200px]">
            PersonifX
          </h1>
          <h1 className="pointer-events-none absolute inset-0 font-sans font-extrabold text-[18vw] leading-none tracking-tight text-white blur-3xl opacity-10 md:text-[200px]">
            PersonifX
          </h1>
        </div>

        <div className="mt-2 text-sm text-gray-300 md:text-base">
          <span className="font-semibold text-white">@{username}</span> selected. Choose a voice & goals before cloning.
        </div>

        <div className="relative mt-8 w-full max-w-3xl text-left">
          <div className="relative overflow-hidden rounded-[24px] border border-grok-border/60 bg-grok-panel/85 p-6 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute left-10 bottom-0 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />
            </div>

            <div className="relative flex flex-col gap-8">
              <section>
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400">Voice</p>
                <div className="mt-3">
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="h-12 rounded-2xl border border-white/15 bg-black/30 px-4 text-left text-sm font-semibold text-white shadow-inner focus:border-white/40 focus:bg-black/40">
                      <SelectValue placeholder="Choose a voice" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_VOICE_IDS.map((voiceId) => (
                        <SelectItem key={voiceId} value={voiceId}>
                          {voiceId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </section>

              <section>
                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400">Goals</p>
                <div className="mt-3">
                  <textarea
                    value={goalsInput}
                    onChange={(e) => setGoalsInput(e.target.value)}
                    placeholder="Add one goal per line (e.g., 'Sell me a pen')"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white shadow-inner outline-none ring-0 transition placeholder:text-gray-500 focus:border-white/40 focus:bg-black/30"
                    rows={4}
                  />
                  {goalsPreview.length ? (
                    <p className="mt-2 text-xs text-gray-300">
                      Goals to send: <span className="font-semibold text-white">{goalsPreview.length}</span>
                    </p>
                  ) : null}
                </div>
              </section>

              {error ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 shadow-inner">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-inner">
                  {success}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleClone}
                  disabled={isCloning}
                  className="group relative overflow-hidden rounded-full border border-white/30 bg-white px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-black shadow-xl transition-all duration-300 hover:-translate-y-[1px] hover:shadow-white/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="relative z-10">{isCloning ? 'Cloning...' : 'Clone & Start Chat'}</span>
                  <span className="absolute inset-0 bg-gradient-to-r from-white via-white to-gray-200 opacity-0 transition group-hover:opacity-20" />
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="rounded-full border border-white/20 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-gray-200 transition duration-300 hover:-translate-y-[1px] hover:border-white/40 hover:bg-white/10"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
