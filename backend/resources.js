(async function () {
  function esc(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  const list = document.getElementById("resource-list");
  const quick = document.getElementById("resource-quick-link");
  if (!list) return;
  list.innerHTML = '<li><div class="activity-body"><p class="activity-desc">Loading resources from database...</p></div></li>';
  try {
    const resources = await apiGet("/resources");
    list.innerHTML = Array.isArray(resources) && resources.length
      ? resources.map(function (item) {
          return '<li><span class="dot ' + esc(item.dot || "blue") + '" aria-hidden="true"></span><div class="activity-body"><div class="activity-row"><span class="activity-name">' + esc(item.title) + '</span><a class="activity-time" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer">Open</a></div><p class="activity-desc">' + esc(item.description) + '</p></div></li>';
        }).join("")
      : '<li><div class="activity-body"><p class="activity-desc">No resources found in the database.</p></div></li>';
    if (quick && resources && resources[0]) quick.href = resources[0].url;
  } catch (err) {
    console.error("Failed to load resources", err);
    list.innerHTML = '<li><div class="activity-body"><p class="activity-desc">Could not load resources from database.</p></div></li>';
  }
})();
