import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Combobox } from './ui/combobox';

const BACKEND_URL = 'http://localhost:8000';

function Home() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUserSelect = async (username: string) => {
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/exists?handle=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error('Failed to verify profile');
      const data = await res.json();
      if (data?.exists) {
        navigate(`/chat/${username}`);
      } else {
        navigate(`/clone/${username}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to verify profile';
      setError(message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-grok-bg text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-40 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 right-[-200px] -translate-y-1/2 h-[820px] w-[620px] light-beam" />
      </div>

      <main className="relative z-20 mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col items-center justify-center px-4 pb-14 text-center">
        <div className="relative w-full select-none text-center">
          <h1 className="font-sans font-extrabold text-[18vw] leading-none tracking-tight grok-text-gradient opacity-90 mix-blend-overlay md:text-[200px]">
            PersonifX
          </h1>
          <h1 className="pointer-events-none absolute inset-0 font-sans font-extrabold text-[18vw] leading-none tracking-tight text-white blur-3xl opacity-10 md:text-[200px]">
            PersonifX
          </h1>
        </div>
        <p className="mt-[-6px] max-w-2xl text-sm text-gray-300 md:text-base">
          Search for an X username to generate and explore their PersonifX profile.
        </p>

        <div className="relative mt-8 w-full max-w-xl">
          <div className="relative overflow-hidden rounded-[20px] border border-grok-border/60 bg-grok-panel/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-3">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400">
                X Username Required
              </p>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-2 shadow-inner backdrop-blur">
                <Combobox onSelect={handleUserSelect} />
              </div>
              {checking ? (
                <p className="text-xs text-gray-400">Checking profile...</p>
              ) : null}
              {error ? (
                <p className="text-xs text-red-300">{error}</p>
              ) : null}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
