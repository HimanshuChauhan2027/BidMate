import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_SOCKET_URL, {
    auth: (cb) => cb({ token: localStorage.getItem("token") }),
});

export const refreshSocketAuth = () => {
    socket.disconnect();
    socket.connect();
};

export default socket;
