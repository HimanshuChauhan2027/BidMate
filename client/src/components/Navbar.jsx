import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Plus, UserRound } from "lucide-react";
import { refreshSocketAuth } from "../services/socket";

function Navbar() {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const token = localStorage.getItem("token");
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem("user") || "null")
  );

  useEffect(() => {
    const syncUser = () => {
      setUser(JSON.parse(localStorage.getItem("user") || "null"));
    };

    window.addEventListener("auth-changed", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("auth-changed", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 min-h-[88px] border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[88px] max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center text-3xl font-extrabold leading-none tracking-[-0.04em] sm:text-4xl">
          <span className="text-teal-600">Bid</span>
          <span className="font-black text-slate-950">Mate</span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-10">
          <Link
            to="/"
            className="hidden text-lg font-bold text-slate-700 transition hover:text-teal-600 sm:block"
          >
            Home
          </Link>

          <Link
            to="/create-auction"
            className="text-lg font-bold text-slate-700 transition hover:text-teal-600"
          >
            Sell
          </Link>

          {token ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu((visible) => !visible)}
                className="flex max-w-[180px] items-center gap-2 rounded-lg px-2 py-2 text-lg font-bold text-slate-800 transition hover:bg-slate-100 hover:text-teal-700"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-extrabold text-teal-300">
                  {user?.name?.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">Hi, {user?.name}</span>
                <ChevronDown size={19} strokeWidth={2.75} />
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-3 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
                  <button
                    onClick={() => {
                      navigate("/profile");
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <UserRound size={18} />
                    <span>Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      navigate("/create-auction");
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Plus size={18} />
                    <span>Sell an Item</span>
                  </button>

                  <button
                    onClick={() => {
                      localStorage.clear();
                      refreshSocketAuth();
                      navigate("/login");
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={18} />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className="text-lg font-bold text-slate-700 transition hover:text-teal-600"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
