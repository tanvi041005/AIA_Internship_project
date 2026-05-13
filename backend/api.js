(function () {
  const configuredBase =
    window.API_BASE_URL ||
    localStorage.getItem("apiBaseUrl") ||
    "";

  function buildUrl(path) {
    const normalizedPath = String(path || "");
    if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath;
    const base = String(configuredBase || "").replace(/\/+$/, "");
    const suffix = normalizedPath.startsWith("/") ? normalizedPath : "/" + normalizedPath;
    return base + suffix;
  }

  async function apiRequest(path, options) {
    const url = buildUrl(path);
    const headers = { ...(options && options.headers ? options.headers : {}) };
    const token = sessionStorage.getItem("authToken");
    if (token && !headers.Authorization) headers.Authorization = "Bearer " + token;

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (err) {
      err.apiUrl = url;
      err.isNetworkError = true;
      throw err;
    }

    let payload = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();
      payload = text ? { message: text } : null;
    }

    if (!response.ok) {
      const message = payload && (payload.error || payload.message)
        ? payload.error || payload.message
        : "API request failed";
      const err = new Error(message);
      err.status = response.status;
      err.payload = payload;
      err.apiUrl = url;
      throw err;
    }

    return payload;
  }

  window.apiBuildUrl = buildUrl;

  window.apiGet = function apiGet(path) {
    return apiRequest(path, { method: "GET" });
  };

  window.apiPost = function apiPost(path, body) {
    return apiRequest(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  };

  window.apiPut = function apiPut(path, body) {
    return apiRequest(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  };

  window.apiDelete = function apiDelete(path) {
    return apiRequest(path, { method: "DELETE" });
  };
})();
