import { useNavigate, Routes, Route } from "react-router-dom";

import PMLayout from "./Layouts/PMLayout";
import Main from './Components/ProjectManager/Dashboard/Main'; // dashboard page
import Projects from "./Components/ProjectManager/Projects/Projects";
import TeamMembers from "./Components/ProjectManager/TeamMembers/TeamMembers";
import Clients from "./Components/ProjectManager/Clients/clients";
import Payout from "./Components/ProjectManager/Payout/Payout";
import Settings from "./Components/ProjectManager/Settings/settings";
import Communication from "./Components/ProjectManager/Communication/communication";
import Analytics from "./Components/ProjectManager/Analytics/Analytics";
import ForgotPassword from "./Components/Pages/Forgotpassword";
import LoginPage from "./Components/Pages/LoginPage";
import { ToastContainer } from "react-toastify";
import Dashboard from "./Components/ProjectManager/Dashboard/Dashboard";

function App() {
  return (
   <>
   <ToastContainer/>
      <Routes>
          <Route path="/" element={<LoginPage/>} /> 
          <Route path="/forgotpassword" element={<ForgotPassword/>} /> 
        <Route element={<PMLayout />}>
          {/* <Route path="/dashboard" element={<Main/>} />Dashboard */}
          <Route path="/dashboard" element={<Dashboard/>}/>
          <Route path="/projects" element={<Projects />}/>
          <Route path="/team" element={<TeamMembers/>}/>
          <Route path="/clients" element={<Clients/>}/>
          <Route path="/payout" element={<Payout/>}/>
          <Route path="/communication" element={<Communication/>}/>
          <Route path="/analytics" element={<Analytics/>} />
          <Route path="/settings" element={<Settings/>} />
          
       
        </Route>
      </Routes>
      </>
  );
}

export default App;
