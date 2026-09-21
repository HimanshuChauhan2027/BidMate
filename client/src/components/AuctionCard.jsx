import { Link } from "react-router-dom";

function AuctionCard({ auction, isOwner = false }) {
    const statusColors = {
        UPCOMING: "bg-yellow-100 text-yellow-700",
        ACTIVE: "bg-green-100 text-green-700",
        ENDED: "bg-red-100 text-red-700",
    };

    return (
        <Link to={`/auction/${auction._id}`} className="block">
            <div
                className="
                    group
                    bg-white
                    rounded-xl
                    border border-slate-200/80
                    shadow-sm
                    overflow-hidden
                    transition-all
                    duration-500
                    hover:-translate-y-1
                    hover:shadow-xl
                "
            >
                {/* Image */}
                {auction.images?.length > 0 ? (
                    <div className="relative overflow-hidden">
                        <img
                            src={auction.images[0].url}
                            alt={auction.title}
                            className="
                                w-full
                                h-52
                                object-cover
                                transition-transform
                                duration-500
                                group-hover:scale-110
                            "
                        />

                        {/* Status Badge */}
                        <span
                            className={`
                                absolute
                                top-4
                                right-4
                                px-3
                                py-1
                                rounded-full
                                text-xs
                                font-bold
                                shadow-md
                                ${statusColors[auction.status]}
                            `}
                        >
                            {auction.status}
                        </span>
                    </div>
                ) : (
                    <div
                        className="
                            h-52
                            flex
                            items-center
                            justify-center
                            bg-slate-100
                            text-6xl
                        "
                    >
                        📦
                    </div>
                )}

                {/* Card Content */}
                <div className="p-5">

                    {/* Title */}
                    <h2 className="line-clamp-1 text-xl font-extrabold text-slate-900">
                        {auction.title}
                    </h2>

                    {/* Description */}
                    <p className="mt-2 line-clamp-2 min-h-[42px] text-sm leading-6 text-slate-500">
                        {auction.description}
                    </p>

                    {/* Price */}
                    <h3 className="mt-5 text-2xl font-extrabold tracking-tight text-teal-700">
                        ₹ {auction.currentPrice?.toLocaleString("en-IN")}
                    </h3>

                    {/* Category */}
                    <div className="mt-5">
                        <span
                            className="
                                inline-flex
                                items-center
                                gap-2
                                bg-slate-100
                                px-4
                                py-2
                                rounded-full
                                text-xs
                                font-medium
                                text-slate-700
                            "
                        >
                            🏷 {auction.category}
                        </span>
                    </div>

                    {/* Seller */}
                   <div className="mt-6">
    <span className="text-sm font-semibold text-slate-500">
        {isOwner ? "👤 Your Auction" : `👤 ${auction.seller?.name ?? "Unknown seller"}`}
    </span>
</div>

                    {/* Button */}
                    <div className="mt-6">
                        <button
    className="
        w-full
        bg-slate-900
        hover:bg-teal-700
        text-white
        font-semibold
        py-3
        rounded-xl
        transition-all
        duration-300
        hover:shadow-lg
    "
>
    {isOwner ? "Manage Auction →" : "View Auction →"}
</button>
                    </div>

                </div>
            </div>
        </Link>
    );
}

export default AuctionCard;