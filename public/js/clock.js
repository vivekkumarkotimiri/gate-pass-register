function updateLiveClock() {
  const el = document.getElementById("liveClock");
  if (!el) return;

  const now = new Date();
  const dateStr = now.toLocaleDateString(undefined, {
    weekday: "short", year: "numeric", month: "short", day: "numeric",
  });
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  el.textContent = `${dateStr}  •  ${timeStr}`;
}

updateLiveClock();
setInterval(updateLiveClock, 1000);