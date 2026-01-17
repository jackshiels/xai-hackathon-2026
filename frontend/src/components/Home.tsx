import { useNavigate } from 'react-router-dom';
import { Combobox } from './ui/combobox';

function Home() {
  const navigate = useNavigate();

  const handleUserSelect = (username: string) => {
    navigate(`/chat/${username}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-8 text-ink">X.com Username Search</h1>
      <Combobox onSelect={handleUserSelect} />
    </div>
  );
}

export default Home;