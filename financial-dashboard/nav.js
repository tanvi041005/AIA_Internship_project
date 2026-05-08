(function () {
  var NAV_HTML = [
    '<div class="nav-strip">',
    '  <nav class="nav-inner" aria-label="Primary">',
    '    <a href="index.html">Overview</a>',
    '    <a href="leads.html">Leads</a>',
    '    <a href="calendar.html">Calendar</a>',
    '    <a href="sales-tracker.html">Sales Tracker</a>',
    '    <a href="training.html">Training</a>',
    '    <a href="cpf-calculator.html">CPF Calculator</a>',
    '    <a href="announcements.html">Announcements</a>',
    '    <a href="resources.html">Resources</a>',
    '  </nav>',
    '</div>'
  ].join('\n');

  function injectNav() {
    var placeholder = document.getElementById('site-nav');
    if (!placeholder) return;
    placeholder.insertAdjacentHTML('beforebegin', NAV_HTML);
    placeholder.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }
})();
