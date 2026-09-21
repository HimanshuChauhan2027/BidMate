import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { refreshSocketAuth } from "../services/socket";
import { User, PlusCircle, Home } from "lucide-react";

import { getMyAuctions,getWonAuctions, } from "../services/auctionService";
import { getMyBids } from "../services/bidService";
import AuctionCard from "../components/AuctionCard";

function Profile() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [myAuctions, setMyAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [wonAuctions, setWonAuctions] = useState([]);
  const [bidAuctions, setBidAuctions] = useState([]);

  useEffect(() => {
    fetchProfileData();
  }, []);

const fetchProfileData = async () => {
    try {
        const [created, won, bidHistory] = await Promise.all([
            getMyAuctions(),
            getWonAuctions(),
          getMyBids(),
        ]);

        setMyAuctions(created.auctions);
        setWonAuctions(won.auctions);

        const uniqueBidAuctions = new Map();
        bidHistory.bids.forEach((bid) => {
          if (bid.auction?._id) {
            uniqueBidAuctions.set(bid.auction._id, bid.auction);
          }
        });
        setBidAuctions([...uniqueBidAuctions.values()]);
    } catch (error) {
        toast.error(
            error.response?.data?.message ||
            "Failed to fetch profile."
        );
    } finally {
        setLoading(false);
    }
};

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    refreshSocketAuth();

    toast.success("Logged out successfully");

    navigate("/login");
  };

  const initials = user?.name
    ?.split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  const activeAuctions = myAuctions.filter(
    (auction) => auction.status === "ACTIVE"
  ).length;

  const activeBidAuctions = bidAuctions.filter(
    (auction) => auction.status === "ACTIVE"
  );

  const filteredAuctions = useMemo(() => {
    if (filter === "ACTIVE")
      return myAuctions.filter((auction) => auction.status === "ACTIVE");

    if (filter === "ENDED")
      return myAuctions.filter((auction) => auction.status === "ENDED");

    return myAuctions;
  }, [filter, myAuctions]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">

      {/* Profile Card */}

      <div className="bg-white rounded-3xl shadow-lg p-8">

        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">

          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-950 text-4xl font-bold text-teal-300">
            {initials}
          </div>

          <div className="flex-1">

            <h1 className="text-3xl font-bold">
              {user?.name}
            </h1>

            <p className="text-gray-500 mt-2">
              {user?.email}
            </p>

          </div>

        </div>

      </div>

      {/* Stats */}

      <div className="grid md:grid-cols-4 gap-6 mt-8">

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-3xl font-bold">
            {myAuctions.length}
          </p>
          <p className="text-gray-500 mt-2">
            Auctions Created
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-green-600">
            {activeAuctions}
          </p>
          <p className="text-gray-500 mt-2">
            Active Selling
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <p className="text-3xl font-bold text-teal-700">
            {activeBidAuctions.length}
          </p>
          <p className="text-gray-500 mt-2">
            Active Buying
          </p>
        </div>

       <div className="bg-white rounded-xl p-6 shadow">
    <p className="text-3xl font-bold text-yellow-600">
        {wonAuctions.length}
    </p>

    <p className="text-gray-500 mt-2">
        Won Auctions
    </p>
</div>

      </div>

      {/* Quick Actions */}

      <div className="flex flex-wrap gap-4 mt-8">

        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-xl"
        >
          <Home size={18} />
          Home
        </button>

        <button
          onClick={() => navigate("/create-auction")}
          className="flex items-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-white transition hover:bg-teal-700"
        >
          <PlusCircle size={18} />
          Create Auction
        </button>

        <button
          onClick={handleLogout}
          className="bg-red-600 text-white px-5 py-3 rounded-xl"
        >
          Logout
        </button>

      </div>

      {/* Buying */}

      <div className="mt-12">
        <h2 className="text-3xl font-bold mb-6">
          Auctions I'm Bidding On
        </h2>

        {loading ? (
          <p>Loading...</p>
        ) : activeBidAuctions.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center">
            <User className="mx-auto mb-4" size={40} />
            <h3 className="text-xl font-semibold">
              No Active Bids
            </h3>
            <p className="text-gray-500 mt-2">
              Auctions you bid on will appear here while they are active.
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">
            {activeBidAuctions.map((auction) => (
              <AuctionCard
                key={auction._id}
                auction={auction}
                isOwner={false}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selling */}

      <div className="mt-12">

        <div className="flex justify-between items-center mb-6">

          <h2 className="text-3xl font-bold">
            Auctions I Created
          </h2>

          <div className="flex gap-3">

            {["ALL", "ACTIVE", "ENDED"].map((type) => (

              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-4 py-2 rounded-full transition ${
                  filter === type
                    ? "bg-teal-500 text-slate-950"
                    : "bg-gray-200"
                }`}
              >
                {type}
              </button>

            ))}

          </div>

        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filteredAuctions.length === 0 ? (

          <div className="bg-white rounded-2xl shadow p-10 text-center">

            <User className="mx-auto mb-4" size={40} />

            <h3 className="text-xl font-semibold">
              No Auctions Found
            </h3>

            <p className="text-gray-500 mt-2">
              Start by creating your first auction.
            </p>

          </div>

        ) : (

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

            {filteredAuctions.map((auction) => (

              <AuctionCard
                key={auction._id}
                auction={auction}
                isOwner={true}
              />

            ))}

          </div>
          

        )}
          {/* ===================== WON AUCTIONS ===================== */}

        <div className="mt-16">

          <h2 className="text-3xl font-bold mb-6">
            🏆 Auctions I've Won
          </h2>

          {wonAuctions.length === 0 ? (

            <div className="bg-white rounded-2xl shadow p-10 text-center">

              <User className="mx-auto mb-4" size={40} />

              <h3 className="text-xl font-semibold">
                No Auctions Won Yet
              </h3>

              <p className="text-gray-500 mt-2">
                Start bidding to win your first auction.
              </p>

            </div>

          ) : (

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-8">

              {wonAuctions.map((auction) => (

                <AuctionCard
                  key={auction._id}
                  auction={auction}
                  isOwner={false}
                />

              ))}

            </div>

          )}

        </div>

      </div>

      </div>

    
  );
}

export default Profile;