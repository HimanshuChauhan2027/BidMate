import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import {
    getAuctionById,
    deleteAuction,
} from "../services/auctionService";

import {
    placeBid,
    setAutoBid,
    getMyAutoBid,
    getBidHistory,
} from "../services/bidService";

import socket from "../services/socket";

function AuctionDetails() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [auction, setAuction] = useState(null);
    const [bidAmount, setBidAmount] = useState("");
    const [loading, setLoading] = useState(false);
    const [bids, setBids] = useState([]);
    const serverOffset = useRef(0);

    const [myAutoMax, setMyAutoMax] = useState(null);
    const [autoInput, setAutoInput] = useState("");
    const [autoLoading, setAutoLoading] = useState(false);

    const [selectedImage, setSelectedImage] = useState("");

    const [countdown, setCountdown] = useState({
        label: "",
        value: "",
        phase: "",
    });

    const currentUser = JSON.parse(
        localStorage.getItem("user") || "null"
    );

    const fetchAuction = async () => {
        try {
            const data = await getAuctionById(id);

            if (data.serverTime) {
                serverOffset.current = data.serverTime - Date.now();
            }

            const images = Array.isArray(data.auction?.images)
                ? data.auction.images.filter((image) => image && image.url)
                : [];

            setAuction({ ...data.auction, images });

            if (images.length > 0) {
                setSelectedImage((prev) => prev || images[0].url);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const fetchBidHistory = async () => {
        try {
            const data = await getBidHistory(id);

            setBids(data.bids);
        } catch (error) {
            console.log(error);
        }
    };

    const fetchMyAutoBid = async () => {
        if (!currentUser) return;

        try {
            const data = await getMyAutoBid(id);

            setMyAutoMax(data.autoBid ? data.autoBid.maxAmount : null);
        } catch (error) {
            console.log(error);
        }
    };

    const applyBidUpdate = (update) => {
        if (update.serverTime) {
            serverOffset.current = update.serverTime - Date.now();
        }

        setAuction((prev) => {
            if (!prev || update.totalBids <= (prev.totalBids ?? 0)) {
                return prev;
            }

            return {
                ...prev,
                currentPrice: update.currentPrice,
                totalBids: update.totalBids,
                endTime: update.endTime,
                highestBidder: update.highestBidder,
            };
        });

        if (update.bids?.length) {
            setBids((prev) => {
                const fresh = [...update.bids]
                    .reverse()
                    .filter((b) => !prev.some((p) => p._id === b._id));

                return [...fresh, ...prev];
            });
        }
    };

    const calculateTimeLeft = () => {
        if (!auction) return;

        const now = new Date(Date.now() + serverOffset.current);

        const start = new Date(auction.startTime);
        const end = new Date(auction.endTime);

        let difference;
        let label;
        let phase;

        if (now < start) {
            difference = start - now;
            label = "Starts In";
            phase = "UPCOMING";
        } else if (now < end) {
            difference = end - now;
            label = "Ends In";
            phase = "ACTIVE";
        } else {
            setCountdown({
                label: "Auction",
                value: "Ended",
                phase: "ENDED",
            });

            return;
        }

        const days = Math.floor(
            difference / (1000 * 60 * 60 * 24)
        );

        const hours = Math.floor(
            (difference / (1000 * 60 * 60)) % 24
        );

        const minutes = Math.floor(
            (difference / (1000 * 60)) % 60
        );

        const seconds = Math.floor(
            (difference / 1000) % 60
        );

        setCountdown({
            label,
            value: `${days}d ${hours}h ${minutes}m ${seconds}s`,
            phase,
        });
    };

    const getStatusBadge = () => {
        switch (countdown.phase) {
            case "UPCOMING":
                return (
                    <span className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm font-semibold">
                        🟡 Upcoming
                    </span>
                );

            case "ACTIVE":
                return (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                        🟢 Active
                    </span>
                );

            case "ENDED":
                return (
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
                        🔴 Ended
                    </span>
                );

            default:
                return null;
        }
    };

    const handleBid = async () => {
        if (!bidAmount || Number(bidAmount) <= 0) {
           toast.error("Please enter a valid bid amount.");
            return;
        }

        const amount = Number(bidAmount);
        const currentPrice = Number(auction?.currentPrice ?? 0);

        if (
            currentPrice > 0 &&
            amount >= currentPrice * 2 &&
            !window.confirm(
                `You are about to bid ₹${amount.toLocaleString("en-IN")}, which is at least twice the current price of ₹${currentPrice.toLocaleString("en-IN")}. Do you want to continue?`
            )
        ) {
            return;
        }

      const loading = toast.loading("Placing your bid...");
        try {
            setLoading(true);

            const result = await placeBid(id, amount);

            if (result.update) {
                applyBidUpdate(result.update);
            } else {
                await fetchAuction();
                await fetchBidHistory();
            }

            setBidAmount("");
             toast.dismiss(loading);

            if (result.outbidYou) {
                toast.error("You have been outbid!", { id: `outbid-${id}` });
            } else {
                toast.success("🎉 Bid placed successfully!");
            }
        } catch (error) {
            toast.dismiss(loading);

            toast.error(
    error.response?.data?.message ||
    "Failed to place bid."
);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoBid = async () => {
        if (!autoInput || Number(autoInput) <= 0) {
            toast.error("Please enter a valid maximum.");
            return;
        }

        const maximum = Number(autoInput);
        const currentPrice = Number(auction?.currentPrice ?? 0);

        if (
            currentPrice > 0 &&
            maximum >= currentPrice * 2 &&
            !window.confirm(
                `You are setting an auto-bid maximum of ₹${maximum.toLocaleString("en-IN")}, which is at least twice the current price of ₹${currentPrice.toLocaleString("en-IN")}. Do you want to continue?`
            )
        ) {
            return;
        }

        try {
            setAutoLoading(true);

            const result = await setAutoBid(id, Number(autoInput));

            if (result.update) {
                applyBidUpdate(result.update);
            }

            setMyAutoMax(result.autoBid.maxAmount);
            setAutoInput("");

            toast.success("🤖 Auto-bid saved.");
        } catch (error) {
            toast.error(
                error.response?.data?.message || "Failed to save auto-bid."
            );
        } finally {
            setAutoLoading(false);
        }
    };

    const handleDelete = async () => {
        const confirmDelete = window.confirm(
            "Are you sure you want to delete this auction?"
        );

        if (!confirmDelete) return;
        const loading = toast.loading("Deleting auction...");

        try {
            await deleteAuction(id);
             toast.dismiss(loading);

            toast.success("Auction deleted successfully.");

            navigate("/");
        } catch (error) {
             toast.dismiss(loading);
            toast.error(
                error.response?.data?.message ||
                    "Failed to delete auction."
            );
        }
    };

    useEffect(() => {
        fetchAuction();
        fetchBidHistory();
        fetchMyAutoBid();

        const join = () => socket.emit("join-auction", id);

        const onConnect = () => {
            join();
            fetchAuction();
            fetchBidHistory();
        };

        const onNewBid = (update) => {
            if (update.auctionId !== id) return;

            applyBidUpdate(update);

            if (update.extended) {
                toast("⏱ A late bid extended the auction.");
            }
        };

        const onEnded = (payload) => {
            if (payload.auctionId === id) fetchAuction();
        };

        const onOutbid = (payload) => {
            if (payload.auctionId === id) {
                toast.error("You have been outbid!", { id: `outbid-${id}` });
            }
        };

        const onWon = (payload) => {
            if (payload.auctionId === id) {
                toast.success("🎉 You won this auction!");
            }
        };

        if (socket.connected) join();

        socket.on("connect", onConnect);
        socket.on("new-bid", onNewBid);
        socket.on("auction-ended", onEnded);
        socket.on("outbid", onOutbid);
        socket.on("auction-won", onWon);

        return () => {
            socket.emit("leave-auction", id);
            socket.off("connect", onConnect);
            socket.off("new-bid", onNewBid);
            socket.off("auction-ended", onEnded);
            socket.off("outbid", onOutbid);
            socket.off("auction-won", onWon);
        };
    }, [id]);

    useEffect(() => {
        if (!auction) return;

        calculateTimeLeft();

        const interval = setInterval(() => {
            calculateTimeLeft();
        }, 1000);

        return () => clearInterval(interval);
    }, [auction]);

    if (!auction) {
        return (
            <div className="flex justify-center items-center h-screen text-2xl font-semibold">
                Loading...
            </div>
        );
    }

    const safeImages = Array.isArray(auction.images)
        ? auction.images.filter((image) => image && image.url)
        : [];

    const isSeller =
        currentUser &&
        auction.seller &&
        currentUser.id === auction.seller._id;

    const priceBasedIncrement = Math.max(
        10,
        Math.ceil(
            (Number(auction.startingPrice ?? auction.currentPrice) * 0.05) / 10
        ) * 10
    );
    const increment = Math.max(auction.minIncrement ?? 0, priceBasedIncrement);
    const minBid =
        auction.totalBids > 0
            ? auction.currentPrice + increment
            : auction.currentPrice;

    const isHighest =
        currentUser && auction.highestBidder?._id === currentUser.id;

    return (
    <div className="min-h-screen bg-[#f5f7fb]">

<div className="max-w-7xl mx-auto px-6 py-10">

    <div className="grid lg:grid-cols-2 gap-12">

        {/* LEFT COLUMN */}

        <div>

            {safeImages.length > 0 ? (
                <>
                    <div className="rounded-2xl overflow-hidden shadow-lg">
                        <img
                            src={selectedImage || safeImages[0].url}
                            alt={auction.title}
                            className="w-full h-[500px] object-cover transition-transform
duration-500
hover:scale-105"
                        />
                    </div>

                    {safeImages.length > 1 && (
                        <div className="flex gap-3 mt-5 flex-wrap">
                            {safeImages.map((image, index) => (
                                <img
                                    key={image.public_id || `${image.url}-${index}`}
                                    src={image.url}
                                    alt="Auction"
                                    onClick={() =>
                                        setSelectedImage(image.url)
                                    }
                                    className={`w-20 h-20 rounded-xl object-cover cursor-pointer border-2 transition-all ${
                                        (selectedImage || safeImages[0].url) === image.url
                                            ? "border-teal-500"
                                            : "border-gray-300"
                                    }`}
                                />
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="h-[500px] rounded-2xl bg-slate-100 flex items-center justify-center text-7xl">
                    📦
                </div>
            )}

        </div>

        {/* RIGHT COLUMN */}

        <div className="sticky top-24 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 lg:p-8">

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
                {auction.title}
            </h1>

            <p className="mt-4 leading-7 text-slate-500">
                {auction.description}
            </p>
            <div className="mt-6">

    {countdown.phase === "ACTIVE" && (
        <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-700 font-semibold">
            🔥 Live Auction
        </span>
    )}

    {countdown.phase === "UPCOMING" && (
        <span className="inline-flex items-center px-4 py-2 rounded-full bg-yellow-100 text-yellow-700 font-semibold">
            ⏳ Starting Soon
        </span>
    )}

    {countdown.phase === "ENDED" && (
        <span className="inline-flex items-center px-4 py-2 rounded-full bg-red-100 text-red-700 font-semibold">
            🏁 Auction Ended
        </span>
    )}

</div>

           <div className="mt-8">

   <div className="mt-8">

    <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
        Current Price
    </p>

    

</div>

    <h3 className="text-5xl font-extrabold text-teal-700">
        ₹ {auction.currentPrice?.toLocaleString("en-IN")}
    </h3>

</div>

           <div className="mt-8 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 px-4">

    <div className="flex items-center justify-between py-4">
        <span className="text-sm font-semibold text-slate-500">
            Seller
        </span>

        <span className="font-bold text-slate-800">{auction.seller.name}</span>
    </div>

    <div className="flex items-center justify-between py-4">
        <span className="text-sm font-semibold text-slate-500">
            Highest bidder
        </span>

        <span className="font-bold text-slate-800">
            {auction.highestBidder?.name || "No bids yet"}
        </span>
    </div>

    <div className="flex items-center justify-between py-4">
        <span className="text-sm font-semibold text-slate-500">
            Status
        </span>

        {getStatusBadge()}
    </div>

    <div className="flex items-center justify-between py-4">
        <span className="text-sm font-semibold text-slate-500">
            {countdown.label}
        </span>

        <span className="font-bold text-slate-800">{countdown.value}</span>
    </div>

</div>

            {isSeller &&
                countdown.phase === "UPCOMING" && (
                    <div className="mt-8 flex gap-4">
                        <Link
                            to={`/auction/${id}/edit`}
                            className="flex-1 rounded-lg bg-slate-950 py-3 text-center text-white transition hover:bg-teal-700"
                        >
                            Edit Auction
                        </Link>

                        <button
                            onClick={handleDelete}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl transition"
                        >
                            Delete Auction
                        </button>
                    </div>
                )}

           {countdown.phase === "ENDED" && (
    <div className="mt-8 rounded-xl bg-green-50 border border-green-300 p-5">

        <h3 className="text-xl font-bold text-green-700">
            🏆 Auction Result
        </h3>

        {auction.highestBidder ? (
            auction.highestBidder._id === currentUser?.id ? (
                <p className="mt-3 text-green-700 font-semibold text-lg">
                    🎉 Congratulations! You won this auction.
                </p>
            ) : (
                <p className="mt-3">
                    Winner:{" "}
                    <span className="font-semibold">
                        {auction.highestBidder.name}
                    </span>
                </p>
            )
        ) : (
            <p className="mt-3">
                No bids were placed on this auction.
            </p>
        )}

        <p className="mt-2">
            Winning Bid: ₹ {auction.currentPrice}
        </p>

    </div>
)}

            {isSeller ? (
                <div className="mt-8 rounded-xl bg-gray-100 p-5 text-gray-600">
                    This is your auction, so you can't bid on it.
                </div>
            ) : !currentUser ? (
                    <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50 p-5 text-center">
                    <p className="text-gray-700">
                        Log in to place a bid on this auction.
                    </p>

                    <Link
                        to="/login"
                        className="mt-4 inline-block rounded-lg bg-slate-950 px-8 py-3 font-semibold text-white transition hover:bg-teal-700"
                    >
                        Log in
                    </Link>
                </div>
            ) : (
            <div className="mt-8">

                <input
                    type="number"
                    placeholder={`Minimum ₹ ${minBid}`}
                    value={bidAmount}
                    onChange={(e) =>
                        setBidAmount(e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                />

                {countdown.phase === "ACTIVE" && (
                    <p className="mt-2 text-sm text-gray-500">
                        Minimum bid: ₹ {minBid}
                        {isHighest ? " · You are the highest bidder" : ""}
                    </p>
                )}

                <button
                    onClick={handleBid}
                    disabled={
                        loading ||
                        countdown.phase !== "ACTIVE"
                    }
                        className="mt-4 w-full rounded-lg bg-slate-950 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:bg-gray-400"
                >
                    {loading
                        ? "Placing Bid..."
                        : countdown.phase ===
                          "UPCOMING"
                        ? "Auction Not Started"
                        : countdown.phase ===
                          "ENDED"
                        ? "Auction Ended"
                        : "Place Bid"}
                </button>

            </div>
            )}

            {currentUser && !isSeller && countdown.phase === "ACTIVE" && (
                <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50 p-5">

                    <h3 className="font-bold text-teal-800">
                        🤖 Auto-Bid
                    </h3>

                    <p className="mt-1 text-sm text-gray-600">
                        Set a maximum. We bid for you, one increment at a
                        time, and never go above it. Nobody else sees it.
                    </p>

                    {myAutoMax && (
                        <p className="mt-3 text-sm font-semibold text-teal-700">
                            Your maximum: ₹ {myAutoMax}
                        </p>
                    )}

                    <input
                        type="number"
                        placeholder={
                            myAutoMax
                                ? `Raise above ₹ ${myAutoMax}`
                                : `Minimum ₹ ${minBid}`
                        }
                        value={autoInput}
                        onChange={(e) => setAutoInput(e.target.value)}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                    />

                    <button
                        onClick={handleAutoBid}
                        disabled={autoLoading}
                        className="mt-3 w-full rounded-lg bg-teal-600 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:bg-gray-400"
                    >
                        {autoLoading
                            ? "Saving..."
                            : myAutoMax
                            ? "Raise Auto-Bid"
                            : "Set Auto-Bid"}
                    </button>

                </div>
            )}

        </div>

    </div>

    {/* BID HISTORY */}

    <div className="mt-16">

        <h2 className="text-3xl font-bold mb-8">
            📜 Bid History
        </h2>

        {bids.length > 0 && auction.totalBids > bids.length && (
            <p className="mb-4 text-sm text-gray-500">
                Showing the latest {bids.length} of {auction.totalBids} bids.
            </p>
        )}

        {bids.length === 0 ? (
            <div className="bg-white rounded-xl shadow p-6">
                No bids yet.
            </div>
        ) : (
            <div className="space-y-4">

                {bids.map((bid) => (

                    <div
                        key={bid._id}
                        className="bg-white rounded-xl shadow p-5 flex justify-between items-center"
                    >

                        <div>

                            <h3 className="font-bold">
                                👤 {bid.bidder?.name ?? "Unknown bidder"}
                                {bid.isAuto && (
                                    <span className="ml-2 rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
                                        🤖 Auto
                                    </span>
                                )}
                            </h3>

                            <p className="text-sm text-gray-500">
                                🕒 {new Date(
                                    bid.createdAt
                                ).toLocaleString()}
                            </p>

                        </div>

                        <div className="text-2xl font-bold text-teal-700">
                            ₹ {bid.amount}
                        </div>

                    </div>

                ))}

            </div>
        )}

    </div>

</div>
</div>

);
}

export default AuctionDetails;