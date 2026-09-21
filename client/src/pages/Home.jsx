import { useEffect, useRef, useState } from "react";

import { getAllAuctions } from "../services/auctionService";

import AuctionCard from "../components/AuctionCard";

const PAGE_SIZE = 12;

const CATEGORIES = [
  "All",
  "Electronics",
  "Fashion",
  "Home & Furniture",
  "Books",
  "Sports",
  "Vehicles",
  "Collectibles",
  "Art",
  "Jewellery",
  "Others",
];

const STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "ACTIVE", label: "Live now" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "ENDED", label: "Ended" },
  { value: "ALL", label: "All" },
];

function Home() {
  const [auctions, setAuctions] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("OPEN");
  const [sortBy, setSortBy] = useState("newest");

  const latestRequest = useRef(0);

  // Wait until the user stops typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchPage = async (pageToLoad, append) => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;

    try {
      setFailed(false);

      if (append) setLoadingMore(true);
      else setLoading(true);

      const data = await getAllAuctions({
        page: pageToLoad,
        limit: PAGE_SIZE,
        search: search || undefined,
        category: category === "All" ? undefined : category,
        status,
        sort: sortBy,
      });

      // A newer request has started; ignore this answer.
      if (requestId !== latestRequest.current) return;

      setAuctions((prev) => {
        if (!append) return data.auctions;

        const seen = new Set(prev.map((item) => item._id));

        return [
          ...prev,
          ...data.auctions.filter((item) => !seen.has(item._id)),
        ];
      });
      setPage(data.page);
      setPages(data.pages);
      setTotal(data.total);
    } catch (error) {
      if (requestId !== latestRequest.current) return;

      console.log(error);
      setFailed(true);
    } finally {
      if (requestId === latestRequest.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, status, sortBy]);

  const chipClass = (active) =>
    `px-5 py-2 rounded-full transition-all duration-300 shadow ${
      active
        ? "bg-teal-500 text-slate-950"
        : "bg-white hover:bg-teal-500 hover:text-slate-950"
    }`;

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Hero Section */}
      <section className="relative flex min-h-[560px] items-center justify-center overflow-hidden rounded-2xl bg-slate-950 px-6 py-16 text-white shadow-xl sm:px-10 lg:min-h-[600px] lg:py-20">
        <div className="relative z-10 mx-auto w-full max-w-3xl text-center">
        <p className="mb-5 text-sm font-bold uppercase tracking-[0.24em] text-teal-300">
          Real-time marketplace
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl">
          Find your next
          <span className="block text-teal-300">good buy.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
          Discover interesting items, make confident bids, and watch every auction move in real time.
        </p>

        <button
          onClick={() =>
            document
              .getElementById("live-auctions")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          className="mt-9 rounded-lg bg-teal-400 px-6 py-3.5 font-bold text-slate-950 shadow-lg shadow-teal-950/30 transition hover:bg-teal-300"
        >
          Browse Auctions →
        </button>
        </div>
      </section>

      {/* Auctions */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mt-16 mb-8">
          <div id="live-auctions" className="mt-20 scroll-mt-24">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Explore auctions</h2>

            <p className="text-gray-500 mt-2">
              {loading
                ? "Loading..."
                : `${total} auction${total === 1 ? "" : "s"} found`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="🔍 Search auctions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 sm:w-72"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
            >
              <option value="newest">Newest</option>
              <option value="priceLow">Price: Low → High</option>
              <option value="priceHigh">Price: High → Low</option>
              <option value="endingSoon">Ending Soon</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4">
          {STATUSES.map((item) => (
            <button
              key={item.value}
              onClick={() => setStatus(item.value)}
              className={chipClass(status === item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-10">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={chipClass(category === item)}
            >
              {item}
            </button>
          ))}
        </div>

        {failed ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold text-gray-700">
              Could not load auctions
            </h3>

            <button
              onClick={() => fetchPage(1, false)}
              className="mt-6 rounded-lg bg-slate-950 px-6 py-3 font-semibold text-white transition hover:bg-teal-700"
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="text-center py-20 text-gray-500">Loading...</div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold text-gray-700">
              No auctions found
            </h3>

            <p className="text-gray-500 mt-3">
              Try another search, category or status.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {auctions.map((auction) => (
                <AuctionCard key={auction._id} auction={auction} />
              ))}
            </div>

            {page < pages && (
              <div className="text-center mt-12">
                <button
                  onClick={() => fetchPage(page + 1, true)}
                  disabled={loadingMore}
                  className="rounded-lg border border-slate-200 bg-white px-8 py-3 font-semibold transition hover:bg-teal-500 hover:text-slate-950 disabled:opacity-60"
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default Home;
