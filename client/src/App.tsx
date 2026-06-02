import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import AiAnalyzePage from "./pages/AiAnalyzePage/AiAnalyzePage";
import CalculatorPage from "./pages/CalculatorPage/CalculatorPage";
import KlinePage from "./pages/KlinePage";
import RecordsPage from "./pages/RecordsPage/RecordsPage";

function App() {
  return (
    <main className="app-shell">
      <nav className="top-nav">
        <NavLink to="/calculator" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          仓位计算器
        </NavLink>
        <NavLink to="/records" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          仓位记录
        </NavLink>
        <NavLink to="/kline" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          K 线查询
        </NavLink>
        <NavLink to="/ai" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
          AI 分析
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/calculator" replace />} />
        <Route path="/calculator" element={<CalculatorPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/kline" element={<KlinePage />} />
        <Route path="/ai" element={<AiAnalyzePage />} />
      </Routes>
    </main>
  );
}

export default App;
