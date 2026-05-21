(function () {
  var NAV_HTML = [
    '<div class="nav-strip">',
    '  <nav class="nav-inner" aria-label="Primary navigation">',
    '    <button class="nav-hamburger" id="nav-hamburger-btn" aria-label="Open menu" aria-expanded="false">',
    '      <span></span><span></span><span></span>',
    '    </button>',
    '    <a href="index.html">Overview</a>',
    '    <a href="leads.html">Leads</a>',
    '    <div class="calendar-nav-menu">',
    '      <a href="calendar.html" id="calendar-nav-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="calendar-section-menu"><span>Calendar</span><span class="overview-caret" aria-hidden="true">&#9662;</span></a>',
    '      <div class="calendar-section-menu" id="calendar-section-menu" role="menu" aria-label="Calendar sections">',
    '        <a href="calendar.html" role="menuitem">Calendar</a>',
    '        <a href="room-booking.html" role="menuitem">Room Booking</a>',
    '        <a href="attendance.html" role="menuitem">Attendance</a>',
    '      </div>',
    '    </div>',
    '    <div class="tools-nav-menu">',
    '      <button type="button" id="tools-nav-trigger" class="nav-link" aria-haspopup="menu" aria-expanded="false" aria-controls="tools-section-menu"><span>Tools</span><span class="overview-caret" aria-hidden="true">&#9662;</span></button>',
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

    var hamburger = document.getElementById('nav-hamburger-btn');
    var navStrip = document.querySelector('.nav-strip');
    if (!hamburger || !navStrip) return;

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = navStrip.classList.toggle('nav-open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
    });

    document.addEventListener('click', function (e) {
      if (navStrip.classList.contains('nav-open') && !navStrip.contains(e.target)) {
        navStrip.classList.remove('nav-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navStrip.classList.contains('nav-open')) {
        navStrip.classList.remove('nav-open');
        hamburger.setAttribute('aria-expanded', 'false');
        hamburger.setAttribute('aria-label', 'Open menu');
        hamburger.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNav);
  } else {
    injectNav();
  }
})();
