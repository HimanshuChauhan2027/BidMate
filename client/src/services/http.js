import axios from "axios";

// One place to deal with an expired or invalid login: every request that
// carried a token and got a 401 clears the session and sends the user to
// the login page.
axios.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const url = error.config?.url || "";
        const hadSession = Boolean(localStorage.getItem("token"));

        const isAuthCall =
            url.includes("/auth/login") || url.includes("/auth/register");

        if (status === 401 && hadSession && !isAuthCall) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            sessionStorage.setItem("sessionExpired", "1");

            if (window.location.pathname !== "/login") {
                window.location.href = "/login";
            }
        }

        return Promise.reject(error);
    }
);
