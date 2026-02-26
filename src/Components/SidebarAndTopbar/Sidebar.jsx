import { NavLink } from "react-router-dom";
import { File, Settings, DollarSign } from "lucide-react";
import { MdDashboard } from "react-icons/md";
import { FiUsers } from "react-icons/fi";
import { User2Icon } from "lucide-react";
import logo from '../../assets/logo.png';

const Sidebar = ({ isOpen, onClose }) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <MdDashboard />, path: "/dashboard" },
    { id: "projects", label: "Projects", icon: <File size={18}/>, path: "/projects" },
    { id: "team", label: "Team Members", icon: <FiUsers size={18} />, path: "/team" },
    { id: "clients", label: "Clients", icon: <User2Icon size={18} />, path: "/clients" },
    { id: "payout", label: "Payout", icon: <DollarSign size={18}/>, path: "/payout" },
    { id: "settings", label: "Settings", icon: <Settings size={18}/>, path: "/settings" },
  ];

  return (
    <>
      {/* Backdrop overlay – only visible on small screens when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar – fixed on all screens, now above top bar (z-[60]) */}
      <aside
        className={`
          fixed left-0 top-0 w-[280px] h-screen bg-[#141937] border-r border-[#1e293b]
          overflow-y-auto z-[60] transition-transform duration-300 ease-in-out transform
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Logo – original, no invert */}
        <div className="py-2 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <div className="w-full h-auto rounded-lg bg-transparent flex items-center justify-center font-extrabold text-xl text-white">
              <img src={logo} alt="Logo" className="w-[70%] object-cover" />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-6">
          <ul className="space-y-2">
            {menuItems.map((item) => (
              <li key={item.id}>
                <NavLink
                  to={item.path}
                  end={item.path === "/"}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3.5 px-4 py-3 rounded-lg transition-all duration-300 text-sm font-medium ${
                      isActive
                        ? "text-white bg-[#31BBD0]"
                        : "text-[#94a3b8] hover:bg-[rgba(0,212,255,0.1)] hover:text-white hover:translate-x-1"
                    }`
                  }
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;