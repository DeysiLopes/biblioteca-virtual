import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/common/Header';
import { Tabs } from './components/common/Tabs';
import { AuthBanner } from './components/common/AuthBanner';
import { MagicBackdrop } from './components/common/MagicBackdrop';
import { SyncPrompt } from './components/common/SyncPrompt';
import { DashboardPage } from './pages/DashboardPage';
import { ShelfPage } from './pages/ShelfPage';
import { AddBookPage } from './pages/AddBookPage';
import { DiaryPage } from './pages/DiaryPage';
import { QuotesPage } from './pages/QuotesPage';
import { ReviewPage } from './pages/ReviewPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <div className="app-container">
      <MagicBackdrop />
      <SyncPrompt />
      <Header />
      <AuthBanner />
      <Tabs />

      <main>
        <Routes>
          <Route path="/" element={<ShelfPage />} />
          <Route path="/estante" element={<ShelfPage />} />
          <Route path="/diario" element={<DiaryPage />} />
          <Route path="/dashboard" element={<Navigate to="/diario" replace />} />
          <Route path="/books" element={<AddBookPage />} />
          <Route path="/citacoes" element={<QuotesPage />} />
          <Route path="/fichario" element={<Navigate to="/citacoes" replace />} />
          <Route path="/caderno/:livroId" element={<ReviewPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
};
