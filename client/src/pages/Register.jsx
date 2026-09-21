import { useState,useEffect } from "react";
import { registerUser } from "../services/authService";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

function Register() {
    const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loading = toast.loading("Creating your account...");

    try {
      await registerUser(formData);
       toast.dismiss(loading);

     toast.success("Account created successfully! 🎉");
     setTimeout(() => {
    window.location.href = "/login";
}, 1000);

      
    } catch (error) {
       toast.dismiss(loading);
      toast.error(
    error.response?.data?.message || "Registration failed"
);
    }
  };
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (token) {
        navigate("/");
    }
}, [navigate]);

 return (
  <div className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-2">

    {/* Left Section */}
    <div className="hidden flex-col justify-center bg-slate-950 px-20 text-white lg:flex">

      <h1 className="text-6xl font-extrabold">
        Bid<span className="text-teal-300">Mate</span>
      </h1>

      <p className="mt-5 text-2xl font-semibold">
        Join the Marketplace
      </p>

      <p className="mt-4 text-lg leading-8 text-slate-300">
        Create your account and start buying or selling items through
        secure real-time auctions.
      </p>

      <div className="mt-12 space-y-6">

        <div className="flex items-center gap-4">
          <span className="text-3xl">⚡</span>
          <span className="text-xl">Live Auctions</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-3xl">🔒</span>
          <span className="text-xl">Secure Authentication</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-3xl">🏆</span>
          <span className="text-xl">Trusted Marketplace</span>
        </div>

      </div>

    </div>

    {/* Right Section */}

    <div className="flex justify-center items-center px-6 py-10">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-10">

        <h2 className="text-4xl font-bold text-gray-800">
          Create Account 🚀
        </h2>

        <p className="text-gray-500 mt-2">
          Join BidMate and start bidding today.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >

          <input
            type="text"
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
          />

          <div className="relative">

  <input
    type={showPassword ? "text" : "password"}
    name="password"
    placeholder="Password"
    value={formData.password}
    onChange={handleChange}
    required
    className="w-full rounded-lg border border-slate-200 px-4 py-3 pr-12 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
  />

  <button
    type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-teal-600"
  >
    {showPassword ? "🙈" : "👁️"}
  </button>

</div>

          <button
            type="submit"
            className="w-full rounded-lg bg-slate-950 py-3 font-semibold text-white transition hover:bg-teal-700"
          >
            Create Account
          </button>

        </form>

        <p className="mt-8 text-center text-gray-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="font-semibold text-teal-700 hover:underline"
          >
            Login
          </button>
        </p>

      </div>

    </div>

  </div>
);
}

export default Register;