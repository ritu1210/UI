import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './context/ToastContext'
import Allocation from './pages/Allocation'
import DataEntry from './pages/DataEntry'
import KpiDashboard from './pages/KpiDashboard'
import ResourceDashboards from './pages/ResourceDashboards'
import ManageProjects from './pages/ManageProjects'
import ManagePeople from './pages/ManagePeople'
import Login from './pages/Login'
import Welcome from './pages/Welcome'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Welcome />} />
            <Route path="/allocation" element={<Allocation />} />
            <Route path="/data-entry" element={<DataEntry />} />
            <Route path="/manage-projects" element={<ManageProjects />} />
            <Route path="/manage-people" element={<ManagePeople />} />
            <Route path="/kpi" element={<KpiDashboard />} />
            <Route path="/dashboards" element={<ResourceDashboards />} />
            <Route path="/dashboard/user" element={<Navigate to="/dashboards" replace />} />
            <Route path="/dashboard/people-leader" element={<Navigate to="/dashboards" replace />} />
            <Route path="/dashboard/business-unit" element={<Navigate to="/dashboards" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
