import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { ToastProvider } from './context/ToastContext'
import Allocation from './pages/Allocation'
import DashboardBusinessUnit from './pages/DashboardBusinessUnit'
import DashboardLeader from './pages/DashboardLeader'
import DashboardUser from './pages/DashboardUser'
import DataEntry from './pages/DataEntry'
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
            <Route path="/dashboard/user" element={<DashboardUser />} />
            <Route path="/dashboard/people-leader" element={<DashboardLeader />} />
            <Route path="/dashboard/business-unit" element={<DashboardBusinessUnit />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
