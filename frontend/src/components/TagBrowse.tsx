import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Users, ArrowLeft, MessageSquare, Heart } from 'lucide-react';

const BACKEND_URL = 'http://localhost:8000';

// Types based on your UserX Pydantic schema
interface PublicMetrics {
  followers_count: number;
  following_count: number;
  tweet_count: number;
  like_count: number;
}

interface UserX {
  _id: string;
  username: string;
  name: string;
  description?: string;
  profile_image_url?: string;
  profile_banner_url?: string;
  public_metrics: PublicMetrics;
  tags: string[];
  voice_id?: string;
}

export default function TagBrowse() {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<UserX[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsersByTag = async () => {
      if (!tag) return;
      
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/profiles?tag=${encodeURIComponent(tag)}`);
        
        if (!res.ok) throw new Error('Failed to fetch users');
        
        const data = await res.json();
        // Assuming API returns a list of UserX objects directly or inside a wrapper
        setUsers(Array.isArray(data) ? data : data.users || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUsersByTag();
  }, [tag]);

  const handleCardClick = (user_id: string) => {
    navigate(`/chat/${user_id}`);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(num);
  };

  return (
    <div className="relative min-h-screen bg-grok-bg text-white selection:bg-blue-500/30">
      {/* Background Effects (Matching Home.tsx) */}
      <div className="pointer-events-none absolute inset-0 fixed">
        <div className="absolute -left-1/4 -top-1/3 h-[60vw] w-[60vw] bg-glow-conic opacity-30 blur-3xl" />
        <div className="absolute top-1/2 right-[-12%] -translate-y-1/2 h-[80vw] w-[80vw] nebula-glow rounded-full mix-blend-screen opacity-50" />
      </div>

      <main className="relative z-20 mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')}
              className="group rounded-full bg-white/5 p-2 transition-colors hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5 text-gray-400 transition-colors group-hover:text-white" />
            </button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">#</span>
                {tag}
              </h1>
              <p className="text-sm text-gray-400">Personas tagged with "{tag}"</p>
            </div>
          </div>
          
          {/* Tag Stats (Optional decorative element) */}
          {!loading && !error && (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-md">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-gray-200">{users.length} Profiles</span>
            </div>
          )}
        </div>

        {/* Content State */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 animate-pulse rounded-[20px] border border-white/5 bg-white/5" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[20px] border border-red-500/20 bg-red-500/5 text-center">
            <p className="text-red-300">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Try Again
            </button>
          </div>
        ) : users.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-[20px] border border-dashed border-white/10 bg-white/5 text-center">
            <p className="text-gray-400">No profiles found with this tag.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <div
                key={user._id}
                onClick={() => handleCardClick(user._id)}
                className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-grok-border/60 bg-grok-panel/60 p-5 shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-500/30 hover:shadow-blue-500/10"
              >
                {/* Banner Gradient fallback or Image */}
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/5 to-transparent opacity-50" />
                {user.profile_banner_url && (
                   <img 
                    src={user.profile_banner_url} 
                    alt="banner"
                    className="absolute inset-x-0 top-0 h-24 w-full object-cover opacity-40 mix-blend-overlay transition-opacity group-hover:opacity-60" 
                   />
                )}

                <div className="relative z-10 flex flex-col h-full">
                  {/* Header: Avatar + ID */}
                  <div className="flex items-start justify-between">
                    <div className="relative">
                      <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white/10 bg-black shadow-xl">
                        {user.profile_image_url ? (
                          <img 
                            src={user.profile_image_url} 
                            alt={user.username} 
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700 text-xl font-bold">
                            {user.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      {/* Online/Verified Badge could go here */}
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCardClick(user.username);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-blue-400 opacity-0 transition-all hover:bg-blue-500 hover:text-white group-hover:opacity-100"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="mt-3">
                    <h3 className="truncate text-lg font-bold text-white group-hover:text-blue-300 transition-colors">
                      {user.name}
                    </h3>
                    <p className="truncate text-sm font-medium text-gray-500">@{user.username}</p>
                  </div>

                  {/* Bio */}
                  <div className="mt-3 flex-grow">
                    <p className="line-clamp-3 text-sm leading-relaxed text-gray-300/90">
                      {user.description || "No description provided."}
                    </p>
                  </div>

                  {/* Metrics Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-gray-400">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5" title="Followers">
                        <Users className="h-3.5 w-3.5" />
                        <span>{formatNumber(user.public_metrics.followers_count)}</span>
                      </div>
                      <div className="flex items-center gap-1.5" title="Likes">
                        <Heart className="h-3.5 w-3.5" />
                        <span>{formatNumber(user.public_metrics.like_count)}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tags (Mini) */}
                  {user.tags && user.tags.length > 0 && (
                     <div className="mt-3 flex flex-wrap gap-1">
                        {user.tags.slice(0, 3).map(t => (
                            <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-400 border border-white/5">
                                #{t}
                            </span>
                        ))}
                        {user.tags.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-gray-500">+{user.tags.length - 3}</span>
                        )}
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}