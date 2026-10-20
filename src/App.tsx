import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { VocabularyPage } from "./pages/Vocabulary";
import { DecksPage, DeckPage } from "./pages/Decks";
import { LearnPage } from "./pages/Learn";
import { ReaderLibrary, ReaderPage } from "./pages/Reader";
import { VideosLibrary, VideoPage } from "./pages/Videos";
import { ProgressPage } from "./pages/Progress";
import { SearchPage } from "./pages/Search";
import { Dashboard } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { Empty } from "./components/UI";
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="vocabulary" element={<VocabularyPage />} />
          <Route path="decks" element={<DecksPage />} />
          <Route path="decks/:id" element={<DeckPage />} />
          <Route path="learn" element={<LearnPage />} />
          <Route path="reader" element={<ReaderLibrary />} />
          <Route path="reader/:id" element={<ReaderPage />} />
          <Route path="videos" element={<VideosLibrary />} />
          <Route path="videos/:id" element={<VideoPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route
            path="*"
            element={
              <Empty
                title="Страница не найдена"
                description="Вернитесь в своё пространство."
                action={
                  <Link className="button" to="/">
                    На главную
                  </Link>
                }
              />
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
