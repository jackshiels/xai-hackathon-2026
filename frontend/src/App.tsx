import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './components/Home';
import Chat from './components/Chat';
import CloneSetup from './components/CloneSetup';
import TaggedUsers from './components/TaggedUsers';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/clone/:username" element={<CloneSetup />} />
        <Route path="/chat/:username" element={<Chat />} />
        <Route path="/users/:tag" element={<TaggedUsers />} />
      </Routes>
    </Router>
  );
}

export default App;
