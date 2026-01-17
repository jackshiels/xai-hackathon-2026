import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Combobox } from './ui/combobox';

const BACKEND_URL = 'http://localhost:8000';

interface PublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  listed_count?: number;
}

interface UserX {
  _id?: string;
  id?: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  public_metrics: PublicMetrics;
  tags?: string[];
  voice_id?: string;
}

function Home() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserX[]>([]);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const particles = useMemo(
    () =>
      Array.from({ length: 32 }).map(() => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 2 + Math.random() * 4,
        delay: Math.random() * 6,
        duration: 18 + Math.random() * 12,
        glow: 6 + Math.random() * 12,
        driftX: 10 + Math.random() * 24,
        driftY: 12 + Math.random() * 26,
      })),
    [],
  );

  const handleUserSelect = async (username: string) => {
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/profile/exists?handle=${encodeURIComponent(username)}`);
      if (!res.ok) throw new Error('Failed to verify profile');
      const data = await res.json();
      if (data?.exists && data?.profile_id) {
        navigate(`/chat/${data.profile_id}`);
      } else if (data?.exists) {
        throw new Error('Profile found but missing profile_id');
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

  useEffect(() => {
    const fetchProfiles = async () => {
      setLoadingProfiles(true);
      setProfilesError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/profiles`);
        if (!res.ok) throw new Error('Failed to load profiles');
        const data = await res.json();
        if (Array.isArray(data)) {
          setProfiles(data);
        } else {
          setProfiles([]);
        }
      } catch (err) {
        setProfilesError(err instanceof Error ? err.message : 'Failed to load profiles');
      } finally {
        setLoadingProfiles(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleProfileClick = (profile: UserX) => {
    const id = profile._id || profile.id || profile.username;
    navigate(`/chat/${id}`, { state: { voice: profile.voice_id } });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-grok-bg text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-40 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen" />
        <div className="absolute top-1/2 right-[-200px] -translate-y-1/2 h-[820px] w-[620px] light-beam" />
        <div className="particle-field absolute inset-0">
          {particles.map((p, idx) => (
            <span
              key={idx}
              className="particle"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                animationDelay: `${p.delay}s, ${p.delay}s`,
                animationDuration: `${p.duration}s, ${p.duration * 0.7}s`,
                // @ts-expect-error CSS custom props
                '--dx': `${p.driftX}px`,
                '--dy': `${p.driftY}px`,
                filter: `drop-shadow(0 0 ${p.glow}px rgba(140, 200, 255, 0.7))`,
              }}
            />
          ))}
        </div>
      </div>

      <main className="relative z-20 mx-auto flex min-h-[70vh] w-full max-w-5xl flex-col items-center justify-center px-4 py-12 pb-14 text-center">
        <div className="relative w-full select-none text-center">
          <h1 className="font-sans font-extrabold text-[18vw] leading-none tracking-tight grok-text-gradient opacity-90 mix-blend-overlay md:text-[200px]">
            PersonifX
          </h1>
          <h1 className="pointer-events-none absolute inset-0 font-sans font-extrabold text-[18vw] leading-none tracking-tight text-white blur-3xl opacity-10 md:text-[200px]">
            PersonifX
          </h1>
        </div>
        
        <p className="mt-[-6px] max-w-2xl text-sm text-gray-300 md:text-base">
          Clone your Profile in Seconds and Create a Second{' '}
          <span className="you-glow">You</span>
        </p>
        <p className="mt-6 text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
          What do you want to talk about?
        </p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
          {['workout', 'growth', 'tech', 'x-enthusiast', 'finance', 'ai', 'startup', 'crypto'].map((tag, idx) => (
            <button
              key={tag}
              onClick={() => navigate(`/users/${tag}`)}
              className="group relative overflow-hidden rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-gray-200 transition hover:border-white/40 hover:bg-white/10 hover:text-white hover:-translate-y-0.5"
              style={{
                animation: `float ${3 + idx * 0.3}s ease-in-out infinite`,
                animationDelay: `${idx * 0.2}s`
              }}
            >
              <span className="relative z-10">#{tag}</span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>

        <div className="relative mt-8 w-full max-w-xl">
          <div className="relative overflow-hidden rounded-[20px] border-grok-border/60 bg-grok-panel/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute left-10 bottom-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
            </div>
            <div className="relative flex flex-col gap-3">
              <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400">
                X Username Required
              </p>
                 <Combobox onSelect={handleUserSelect} />
              {checking ? (
                <p className="text-xs text-gray-400">Checking profile...</p>
              ) : null}
              {error ? (
                <p className="text-xs text-red-300">{error}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative mt-8 w-full max-w-xl"></div>

        <div className="relative mt-12 w-full max-w-5xl">
          <div className="rounded-[20px] bg-grok-panel/80 p-5 shadow-[0_30px_90px_-60px_rgba(0,0,0,0.8)] backdrop-blur-2xl ring-1 ring-white/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] text-left font-mono uppercase tracking-[0.2em] text-gray-400">Existing Profiles</p>
                <h2 className="text-lg font-semibold text-white">Pick a persona to start chatting</h2>
              </div>
              {loadingProfiles ? <span className="text-xs text-gray-400">Loading...</span> : null}
            </div>
            {profilesError ? (
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 shadow-inner">
                {profilesError}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {!loadingProfiles && profiles.length === 0 && !profilesError ? (
                <div className="col-span-full rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-400">
                  No profiles yet. Search or clone to get started.
                </div>
              ) : null}
              {profiles.map((profile) => (
                <button
                  key={profile._id || profile.id || profile.username}
                  onClick={() => handleProfileClick(profile)}
                  className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left transition hover:-translate-y-[1px] hover:border-white/30 hover:bg-white/10"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-black/40">
                    {profile.profile_image_url ? (
                      <img src={profile.profile_image_url} alt={profile.username} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold text-white">{profile.username?.[0]?.toUpperCase() ?? '?'}</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white group-hover:text-blue-200 transition-colors">
                      {profile.name} <span className="text-xs text-gray-400">@{profile.username}</span>
                    </span>
                    {profile.tags && profile.tags.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {profile.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="rounded-full bg-white/10 px-2 py-[2px] text-[11px] text-gray-300">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">No tags</span>
                    )}
                  </div>
                  <div className="ml-auto text-[11px] uppercase tracking-[0.16em] text-gray-400">
                    {profile.public_metrics ? `${profile.public_metrics.followers_count.toLocaleString()} followers` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
