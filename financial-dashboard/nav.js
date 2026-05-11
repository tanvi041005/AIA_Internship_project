(function () {
  var NAV_HTML = [
    '<div class="nav-strip">',
    '  <nav class="nav-inner" aria-label="Primary">',
    '    <a href="index.html">Overview</a>',
    '    <a href="leads.html">Leads</a>',
    '    <div class="calendar-nav-menu">',
    '      <a href="calendar.html">Calendar</a>',
    '      <div class="calendar-section-menu">',
    '        <a href="calendar.html">Calendar</a>',
    '        <a href="room-booking.html">Room Booking</a>',
    '        <a href="attendance.html">Attendance</a>',
    '      </div>',
    '    </div>',
    '    <div class="tools-nav-menu">',
    '      <a id="tools-nav-trigger" aria-haspopup="true" aria-expanded="false"><span>Tools</span><span class="overview-caret" aria-hidden="true">&#9662;</span></a>',
    '      <div class="tools-section-menu" id="tools-section-menu" role="menu" aria-label="Tools">',
    '        <a href="sales-tracker.html" role="menuitem">Sales Tracker</a>',
    '        <a href="cpf-calculator.html" role="menuitem">CPF Calculator</a>',
    '      </div>',
    '    </div>',
    '    <a href="training.html">Training</a>',
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

  if (document.getElementById('site-nav')) {
    injectNav();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }
})();
