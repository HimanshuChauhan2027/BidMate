import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";

function Layout({ children }) {
  const location = useLocation();

  const hideNavbar =
    location.pathname === "/login" ||
    location.pathname === "/register";

  return (
    <div className="min-h-screen bg-slate-50">

      {!hideNavbar && <Navbar />}

      <main
        className={
          hideNavbar
            ? ""
            : "max-w-7xl mx-auto px-6 py-8"
        }
      >
        {children}
      </main>

    </div>
  );
}

export default Layout;