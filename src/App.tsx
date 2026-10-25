import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Loading } from "./components/UI";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useParams,
  useLocation,
} from "react-router-dom";
import { observeAuth, useAccount } from "./cloud/auth";
import { localWorkspaceEnabled } from "./cloud/localWorkspace";
const AppLayout = lazy(() =>
  import("./layouts/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);
const CloudRoot = lazy(() =>
  import("./cloud/CloudRoot").then((module) => ({ default: module.CloudRoot })),
);
const VocabularyPage = lazy(() =>
  import("./pages/Vocabulary").then((module) => ({
    default: module.VocabularyPage,
  })),
);
const LearnPage = lazy(() =>
  import("./pages/Learn").then((module) => ({ default: module.LearnPage })),
);
const ReaderLibrary = lazy(() =>
  import("./pages/Reader").then((module) => ({
    default: module.ReaderLibrary,
  })),
);
const ReaderPage = lazy(() =>
  import("./pages/Reader").then((module) => ({ default: module.ReaderPage })),
);
const VideosLibrary = lazy(() =>
  import("./pages/Videos").then((module) => ({
    default: module.VideosLibrary,
  })),
);
const VideoPage = lazy(() =>
  import("./pages/Videos").then((module) => ({ default: module.VideoPage })),
);
const ProgressPage = lazy(() =>
  import("./pages/Progress").then((module) => ({
    default: module.ProgressPage,
  })),
);
const SearchPage = lazy(() =>
  import("./pages/Search").then((module) => ({ default: module.SearchPage })),
);
const LibraryPage = lazy(() =>
  import("./pages/Library").then((module) => ({ default: module.LibraryPage })),
);
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((module) => ({
    default: module.SettingsPage,
  })),
);
const SetEditorPage = lazy(() =>
  import("./pages/SetEditor").then((module) => ({
    default: module.SetEditorPage,
  })),
);
const SetPage = lazy(() =>
  import("./pages/Set").then((module) => ({ default: module.SetPage })),
);
const CollectionsPage = lazy(() =>
  import("./pages/Collections").then((module) => ({
    default: module.CollectionsPage,
  })),
);
const SolutionsPage = lazy(() =>
  import("./pages/Solutions").then((module) => ({
    default: module.SolutionsPage,
  })),
);
const TestResultPage = lazy(() =>
  import("./pages/TestResult").then((module) => ({
    default: module.TestResultPage,
  })),
);
const GamesPage = lazy(() =>
  import("./pages/Games").then((module) => ({ default: module.GamesPage })),
);
import { Empty } from "./components/UI";
const AuthPage = lazy(() =>
  import("./features/auth/AuthPage").then((module) => ({
    default: module.AuthPage,
  })),
);
export function App() {
  useEffect(observeAuth, []);
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="login" element={<AuthPage key="login" mode="login" />} />
          <Route
            path="register"
            element={<AuthPage key="register" mode="register" />}
          />
          <Route
            path="forgot-password"
            element={<AuthPage key="forgot" mode="forgot-password" />}
          />
          <Route
            path="reset-password"
            element={<AuthPage key="reset" mode="reset-password" />}
          />
          <Route
            path="auth/callback"
            element={<AuthPage key="callback" mode="callback" />}
          />
          <Route
            element={
              <RequireAccount>
                <CloudRoot>
                  <AppLayout />
                </CloudRoot>
              </RequireAccount>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="latest" element={<Dashboard />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="user/:username/sets" element={<LibraryPage />} />
            <Route path="create-set" element={<SetEditorPage />} />
            <Route path=":id/autosaved" element={<SetEditorPage />} />
            <Route path="sets/:id" element={<SetPage />} />
            <Route
              path="folders/:id"
              element={<CollectionsPage kind="folder" />}
            />
            <Route
              path="courses/:id"
              element={<CollectionsPage kind="course" />}
            />
            <Route
              path="modules/:id"
              element={<CollectionsPage kind="course" />}
            />
            <Route path="solutions" element={<SolutionsPage />} />
            <Route path="solutions/:id" element={<SolutionsPage />} />
            <Route path="results/:id" element={<TestResultPage />} />
            <Route path="games" element={<GamesPage />} />
            <Route path="vocabulary" element={<VocabularyPage />} />
            <Route path="decks" element={<Navigate to="/library" replace />} />
            <Route path="decks/:id" element={<DeckRedirect />} />
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
      </Suspense>
    </BrowserRouter>
  );
}

function DeckRedirect() {
  const { id } = useParams();
  return <Navigate to={`/sets/${id}`} replace />;
}

function RequireAccount({ children }: { children: ReactNode }) {
  const { user, ready } = useAccount();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user && !localWorkspaceEnabled)
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  return children;
}
