import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { getAuctionById, updateAuction } from "../services/auctionService";

const CATEGORIES = [
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

// <input type="datetime-local"> wants local time without a zone.
const toLocalInput = (value) => {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10";

function EditAuction() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAuctionById(id);
        const auction = data.auction;

        const user = JSON.parse(localStorage.getItem("user") || "null");

        if (!user || auction.seller?._id !== user.id) {
          toast.error("Only the seller can edit this auction.");
          navigate(`/auction/${id}`, { replace: true });
          return;
        }

        if (auction.status !== "UPCOMING") {
          toast.error("Only upcoming auctions can be edited.");
          navigate(`/auction/${id}`, { replace: true });
          return;
        }

        setFormData({
          title: auction.title,
          description: auction.description,
          category: auction.category,
          minIncrement: String(auction.minIncrement ?? 1),
          startTime: toLocalInput(auction.startTime),
          endTime: toLocalInput(auction.endTime),
        });
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Could not load this auction."
        );
        navigate("/", { replace: true });
      }
    };

    load();
  }, [id, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const loading = toast.loading("Saving changes...");

    try {
      setSaving(true);

      await updateAuction(id, {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        minIncrement: Number(formData.minIncrement),
        startTime: new Date(formData.startTime).toISOString(),
        endTime: new Date(formData.endTime).toISOString(),
      });

      toast.dismiss(loading);
      toast.success("Auction updated.");

      navigate(`/auction/${id}`);
    } catch (error) {
      toast.dismiss(loading);

      toast.error(
        error.response?.data?.message || "Failed to update auction."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!formData) {
    return (
      <div className="flex justify-center items-center h-screen text-2xl font-semibold">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-[#f5f7fb] px-4 py-10">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-10">
        <h1 className="text-4xl font-bold text-gray-800">✏️ Edit Auction</h1>

        <p className="text-gray-500 mt-2 mb-8">
          You can change an auction until it starts. The starting price and
          photos can't be changed.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-2 font-semibold text-gray-700">
              Auction Title
            </label>

            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="block mb-2 font-semibold text-gray-700">
              Description
            </label>

            <textarea
              name="description"
              rows="5"
              value={formData.description}
              onChange={handleChange}
              required
              className={inputClass}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Category
              </label>

              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className={inputClass}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Minimum Bid Increment (₹)
              </label>

              <input
                type="number"
                name="minIncrement"
                min="1"
                value={formData.minIncrement}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                Start Time
              </label>

              <input
                type="datetime-local"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-700">
                End Time
              </label>

              <input
                type="datetime-local"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                required
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Link
              to={`/auction/${id}`}
              className="flex-1 text-center border border-gray-300 py-3 rounded-xl font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-slate-950 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:bg-gray-400"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAuction;
