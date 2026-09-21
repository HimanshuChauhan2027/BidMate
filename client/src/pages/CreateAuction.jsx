import { useState } from "react";
import { createAuction } from "../services/auctionService";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10";

const labelClass = "mb-2 block text-sm font-bold text-slate-700";

function CreateAuction() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    startingPrice: "",
    minIncrement: "1",
    startTime: "",
    endTime: "",
  });
  const [images, setImages] = useState([]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };
const handleImageChange = (e) => {
  const picked = Array.from(e.target.files).filter((file) => {
    if (!file.type.startsWith("image/")) {
      toast.error(`${file.name} is not an image.`);
      return false;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(`${file.name} is larger than 5 MB.`);
      return false;
    }

    return true;
  });

  // Remove duplicate images (same name + size)
  const merged = [...images, ...picked].filter(
    (file, index, self) =>
      index ===
      self.findIndex((f) => f.name === file.name && f.size === file.size)
  );

  if (merged.length > 5) {
    toast.error("You can upload at most 5 images.");
  }

  setImages(merged.slice(0, 5));

  // Reset the input so selecting the same file again triggers onChange
  e.target.value = "";
};
  const handleSubmit = async (e) => {
    e.preventDefault();
    const loading = toast.loading("Creating auction...");

    try {
      const auctionFormData = new FormData();

auctionFormData.append("title", formData.title);
auctionFormData.append("description", formData.description);
auctionFormData.append("category", formData.category);
auctionFormData.append("startingPrice", formData.startingPrice);
auctionFormData.append("minIncrement", formData.minIncrement);
auctionFormData.append(
    "startTime",
    new Date(formData.startTime).toISOString()
);
auctionFormData.append(
    "endTime",
    new Date(formData.endTime).toISOString()
);

images.forEach((image) => {
    auctionFormData.append("images", image);
});

const data = await createAuction(auctionFormData);

       toast.dismiss(loading);

    toast.success("🚀 Auction Created!");
    setTimeout(() => {
    navigate(`/auction/${data.auction._id}`);
}, 700);

      

    } catch (error) {
      toast.dismiss(loading);

    toast.error(
        error.response?.data?.message ||
        "Failed to create auction."
    );

    }
  };

 return (
  <div className="flex min-h-screen justify-center bg-[#f5f7fb] px-4 py-10">

    <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-10">

      <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
        Create a new auction
      </h1>

      <p className="mb-8 mt-2 text-slate-500">
        List your item and start receiving bids from buyers.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="border-b border-slate-100 pb-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">
            Item details
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Give buyers the information they need to bid with confidence.
          </p>
        </div>

        {/* Title */}

        <div>
          <label className={labelClass}>
            Auction Title
          </label>

          <input
            type="text"
            name="title"
            placeholder="MacBook Pro M2..."
            value={formData.title}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        {/* Description */}

        <div>
          <label className={labelClass}>
            Description
          </label>

          <textarea
            name="description"
            rows="5"
            placeholder="Describe your item..."
            value={formData.description}
            onChange={handleChange}
            required
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Category & Price */}

        <div className="grid md:grid-cols-2 gap-6">

          <div>
            <label className={labelClass}>
              Category
            </label>

            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className={inputClass}
            >
              <option value="">Select Category</option>
              <option value="Electronics">Electronics</option>
              <option value="Fashion">Fashion</option>
              <option value="Home & Furniture">Home & Furniture</option>
              <option value="Books">Books</option>
              <option value="Sports">Sports</option>
              <option value="Vehicles">Vehicles</option>
              <option value="Collectibles">Collectibles</option>
              <option value="Art">Art</option>
              <option value="Jewellery">Jewellery</option>
              <option value="Others">Others</option>
            </select>

          </div>

          <div>

            <label className={labelClass}>
              Starting Price (₹)
            </label>

            <input
              type="number"
              name="startingPrice"
              placeholder="1000"
              value={formData.startingPrice}
              onChange={handleChange}
              required
              className={inputClass}
            />

          </div>

        </div>

        {/* Minimum increment */}

        <div>
          <label className={labelClass}>
            Minimum Bid Increment (₹)
          </label>

          <p className="mb-2 text-xs text-slate-500">
            BidMate calculates a price-based minimum. Set a higher custom increment if needed.
          </p>

          <input
            type="number"
            name="minIncrement"
            min="1"
            placeholder="1"
            value={formData.minIncrement}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>

        {/* Date & Time */}

        <div className="grid md:grid-cols-2 gap-6">

          <div>

            <label className={labelClass}>
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

            <label className={labelClass}>
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

        {/* Images */}

        <div>

          <label className={labelClass}>
            Upload Auction Images
          </label>

          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="w-full rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500 file:mr-4 file:rounded-md file:border-0 file:bg-teal-500 file:px-4 file:py-2 file:font-bold file:text-slate-950 file:cursor-pointer"
          />
          {images.length > 0 && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
    {images.map((image, index) => (
      <div
        key={index}
        className="relative rounded-xl overflow-hidden shadow-lg group"
      >
        <img
          src={URL.createObjectURL(image)}
          alt={`Preview ${index + 1}`}
          className="w-full h-36 object-cover"
        />

        <button
          type="button"
          onClick={() =>
            setImages((prev) => prev.filter((_, i) => i !== index))
          }
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
        >
          ✕
        </button>
      </div>
    ))}
  </div>
)}

        </div>

        {/* Submit */}

        <button
          type="submit"
            className="w-full rounded-lg bg-slate-950 py-4 text-lg font-semibold text-white transition hover:bg-teal-700"
        >
          🚀 Create Auction
        </button>

      </form>

    </div>

  </div>
);
}

export default CreateAuction;