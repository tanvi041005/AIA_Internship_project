(function () {
  // Set this to your API Gateway invoke URL when using AWS RDS through Lambda.
  // Example: "https://abc123.execute-api.ap-southeast-1.amazonaws.com/prod"
  const awsApiBaseUrl = "https://afhnacykc0.execute-api.ap-southeast-1.amazonaws.com";

  const isLocalHost = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";
  const liveServerApiBaseUrl = isLocalHost && window.location.port === "5500"
    ? "http://127.0.0.1:8080"
    : "";

  window.API_BASE_URL = window.API_BASE_URL || awsApiBaseUrl || liveServerApiBaseUrl || "";
})();
