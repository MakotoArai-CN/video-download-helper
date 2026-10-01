/** 兼容不修改 DOM 的 pushState、浏览器前进后退和 YouTube 的 SPA 事件。 */
export function watchNavigation(onChange: () => void): () => void {
  let lastUrl = location.href;
  const check = () => {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    onChange();
  };
  const events = ['yt-navigate-finish', 'yt-page-data-updated', 'spfdone'];
  events.forEach(name => document.addEventListener(name, check));
  window.addEventListener('popstate', check);
  window.addEventListener('hashchange', check);
  const timer = window.setInterval(check, 800);
  return () => {
    window.clearInterval(timer);
    events.forEach(name => document.removeEventListener(name, check));
    window.removeEventListener('popstate', check);
    window.removeEventListener('hashchange', check);
  };
}
