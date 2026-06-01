import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { AuthorPage } from "./pages/AuthorPage";
import { CanvasPage } from "./pages/CanvasPage";
import { CollectionDetailPage } from "./pages/CollectionDetailPage";
import { CollectionsPage } from "./pages/CollectionsPage";
import { ProtocolPage } from "./pages/ProtocolPage";
import { SampleDetailPage } from "./pages/SampleDetailPage";
import { SamplesPage } from "./pages/SamplesPage";
import { ShotReviewPage } from "./pages/ShotReviewPage";
import { TeardownPage } from "./pages/TeardownPage";
import { TemplatesPage } from "./pages/TemplatesPage";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="teardowns/:id/shots" element={<ShotReviewPage />} />
          <Route element={<AppShell />}>
            <Route index element={<SamplesPage />} />
            <Route path="samples/:id" element={<SampleDetailPage />} />
            <Route path="collections" element={<CollectionsPage />} />
            <Route path="collections/:id" element={<CollectionDetailPage />} />
            <Route path="teardowns/:id" element={<TeardownPage />} />
            <Route path="teardowns/:id/canvas" element={<CanvasPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="authors/:handle" element={<AuthorPage />} />
            <Route path="protocol" element={<ProtocolPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
