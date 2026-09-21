import axios from "axios";

const API_URL = `${import.meta.env.VITE_API_URL}/bids`;

export const placeBid = async (auctionId, amount) => {

    const token = localStorage.getItem("token");

    const response = await axios.post(
        `${API_URL}/${auctionId}`,
        { amount },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    return response.data;
};
export const getBidHistory = async (auctionId) => {

    const response = await axios.get(
        `${API_URL}/${auctionId}`
    );

    return response.data;
};

export const getMyBids = async () => {
    const token = localStorage.getItem("token");

    const response = await axios.get(`${API_URL}/my-bids`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    return response.data;
};
export const setAutoBid = async (auctionId, maxAmount) => {

    const token = localStorage.getItem("token");

    const response = await axios.post(
        `${API_URL}/${auctionId}/auto`,
        { maxAmount },
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    return response.data;
};

export const getMyAutoBid = async (auctionId) => {

    const token = localStorage.getItem("token");

    const response = await axios.get(
        `${API_URL}/${auctionId}/auto`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    return response.data;
};
