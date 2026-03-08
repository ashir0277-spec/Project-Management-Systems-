
import { BrowserRouter, Routes, Route } from "react-router-dom";

import PMLayout from "./Layouts/PMLayout";
import Main from './Components/ProjectManager/Dashboard/MainLayout';
import Projects from "./Components/ProjectManager/Projects/Projects";
import TeamMembers from "./Components/ProjectManager/TeamMembers/TeamMembers";
import Clients from "./Components/ProjectManager/Clients/clients";
import Payout from "./Components/ProjectManager/Payout/Payout";
import Settings from "./Components/ProjectManager/Settings/settings";
import ForgotPassword from "./Components/Pages/Forgotpassword";
import LoginPage from "./Components/Pages/LoginPage";
import { ToastContainer } from "react-toastify";
import Dashboard from "./Components/ProjectManager/Dashboard/Dashboard";
import UsersRecord from "./Components/ProjectManager/UsersRecord";
import UserDetails from "./Components/ProjectManager/UserDetails";
import { InvitePage } from './Components/ProjectManager/TeamMembers/TeamMembers';
import AddMemberPage from "./Components/ProjectManager/TeamMembers/AddMemberPage";

function App() {
  return (
    <>
      <ToastContainer />
      <BrowserRouter>
        <Routes>
          <Route path="/"               element={<LoginPage />} />
          <Route path="/forgotpassword" element={<ForgotPassword />} />
           <Route path="/invite/:token" element={<InvitePage />} />
          <Route element={<PMLayout />}>
            <Route path="/dashboard"           element={<Dashboard />} />
            <Route path="/projects"            element={<Projects />} />
            <Route path="/team"                element={<TeamMembers />} />
            <Route path="/team/add" element={<AddMemberPage />} />
            <Route path="/clients"             element={<Clients />} />
            <Route path="/payout"              element={<Payout />} />
            <Route path="/userrecord"          element={<UsersRecord />} />
            <Route path="/userrecord/:id"  element={<UserDetails />} />
            <Route path="/userdetails/:id"     element={<UserDetails />} /> 
            <Route path="/settings"            element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;