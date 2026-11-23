/*
 * Show each reader their own platform's addresses.
 *
 * The docs are shared by every white-label platform, so the examples use the placeholder
 * `app.example.com` (and the default dashboard path `/os/` for the Publishing API). The
 * platform links here from its API pages as
 *
 *   https://workspace.guide/?domain=app.theirbrand.com&core=os
 *
 * This script (Mintlify loads every .js file in the docs on every page) remembers that domain
 * for the visit and swaps it into the page: text, code samples, links, and what the copy
 * buttons put on the clipboard, and the API reference's https://{domain}/... examples. Without a
 * domain, nothing changes.
 *
 * The platform's name comes the same way (&name=Their%20Brand). The app guide writes the
 * product's name with <AppName /> (snippets/app-name.jsx), which renders "the app" in a
 * .wg-app-name span; this script puts the platform's name in those spans, and after the site
 * title in the header, in brackets: "Help & Docs (Their Brand)".
 *
 * A link that carries a domain or a name replaces whatever was remembered, so one platform's
 * name never sticks to another's domain.
 *
 * Only a plain host name (optionally with a port), a plain path segment and a short plain name
 * are accepted, and everything is written as text, never as HTML.
 */
(function () {
  'use strict';

  var PLACEHOLDER = 'app.example.com';
  var DEFAULT_CORE = 'os';
  var STORE = 'workspaceGuide.platform';
  var NAME_CLASS = 'wg-app-name';

  function validName(value) {
    return typeof value === 'string'
      && /^[\p{L}\p{N}][\p{L}\p{N} &'.,!+_-]{0,59}$/u.test(value);
  }

  function validDomain(value) {
    return typeof value === 'string'
      && value.length > 0 && value.length <= 253
      && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/i.test(value)
      && value.toLowerCase().indexOf(PLACEHOLDER) === -1;
  }

  function validCore(value) {
    return typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value);
  }

  function clean(saved) {
    if (!saved || typeof saved !== 'object') return null;
    var platform = {
      domain: validDomain(saved.domain) ? saved.domain : null,
      core: validCore(saved.core) ? saved.core : DEFAULT_CORE,
      name: validName(saved.name) ? saved.name : null
    };
    return platform.domain || platform.name ? platform : null;
  }

  function readPlatform() {
    var params = new URLSearchParams(window.location.search);
    var fromLink = clean({
      domain: (params.get('domain') || '').trim().toLowerCase(),
      core: (params.get('core') || '').trim(),
      name: (params.get('name') || '').trim().replace(/\s+/g, ' ')
    });

    if (fromLink) {
      try { window.localStorage.setItem(STORE, JSON.stringify(fromLink)); } catch (e) { /* private mode */ }
      return fromLink;
    }

    try {
      return clean(JSON.parse(window.localStorage.getItem(STORE) || 'null'));
    } catch (e) { /* unreadable: ignore */ }

    return null;
  }

  var platform = readPlatform();
  if (!platform) return;

  // "/os/" only follows the placeholder in the Publishing API examples; anything else keeps it.
  // The API reference examples are built from the OpenAPI server URL, so they read
  // https://{domain}/...; only that form is swapped (Link in Bio paths use {domain} as a parameter).
  var SERVER_VARIABLE = 'https://{domain}';

  function swap(text) {
    if (typeof text !== 'string' || !platform.domain) return text;
    if (text.indexOf(SERVER_VARIABLE) !== -1) {
      text = text
        .split(SERVER_VARIABLE + '/' + DEFAULT_CORE + '/').join('https://' + platform.domain + '/' + platform.core + '/')
        .split(SERVER_VARIABLE).join('https://' + platform.domain);
    }
    if (text.indexOf(PLACEHOLDER) === -1) return text;
    return text
      .split(PLACEHOLDER + '/' + DEFAULT_CORE + '/').join(platform.domain + '/' + platform.core + '/')
      .split(PLACEHOLDER).join(platform.domain);
  }

  function hasPlaceholder(text) {
    return !!platform.domain && typeof text === 'string'
      && (text.indexOf(PLACEHOLDER) !== -1 || text.indexOf(SERVER_VARIABLE) !== -1);
  }

  // <AppName /> spans: change their existing text node rather than replacing it, so the page's
  // own rendering keeps the node it created.
  function nameIn(root) {
    if (!platform.name || !root.querySelectorAll) return;
    var spans = root.querySelectorAll('.' + NAME_CLASS);
    Array.prototype.forEach.call(spans, function (span) {
      var node = span.firstChild;
      if (node && node.nodeType === 3 && !node.nextSibling) {
        if (node.nodeValue !== platform.name) node.nodeValue = platform.name;
      } else if (span.textContent !== platform.name) {
        span.textContent = platform.name;
      }
    });
  }

  // The site title in the header ("Help & Docs") gets the platform's name in brackets. It is
  // drawn by CSS after the title, so the header's own rendering is never touched. The name is
  // already limited to letters, digits, spaces and & ' . , ! + _ -; JSON.stringify makes it a
  // valid CSS string.
  function nameInHeader() {
    if (!platform.name || document.getElementById('wg-header-name')) return;
    var style = document.createElement('style');
    style.id = 'wg-header-name';
    // A long name is cut with an ellipsis but keeps its closing bracket: "(Acme Soci…)".
    style.textContent = '.nav-logo{display:inline-flex;align-items:baseline;white-space:nowrap}'
      + '.nav-logo::before,.nav-logo::after{font-weight:500;opacity:.6}'
      + '.nav-logo::before{order:1;content:' + JSON.stringify('(' + platform.name) + ';margin-left:.3em;'
      + 'max-width:16ch;overflow:hidden;text-overflow:ellipsis}'
      + '.nav-logo::after{order:2;content:")"}'
      + '@media (max-width:1024px){.nav-logo::before{max-width:10ch}}';
    document.head.appendChild(style);
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };

  function swapIn(root) {
    if (!root) return;
    nameIn(root);
    if (!platform.domain) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var parent = node.parentNode;
        if (!parent || SKIP[parent.nodeName] || parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        return hasPlaceholder(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) { node.nodeValue = swap(node.nodeValue); });

    var links = root.querySelectorAll ? root.querySelectorAll('a[href*="' + PLACEHOLDER + '"]') : [];
    Array.prototype.forEach.call(links, function (link) {
      link.setAttribute('href', swap(link.getAttribute('href')));
    });
  }

  // Copy buttons read their source text, not the page: give the clipboard the swapped version.
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    var writeText = navigator.clipboard.writeText.bind(navigator.clipboard);
    try {
      navigator.clipboard.writeText = function (text) { return writeText(swap(text)); };
    } catch (e) { /* read-only in some browsers: the page text is still swapped */ }
  }
  document.addEventListener('copy', function (event) {
    var selection = window.getSelection ? String(window.getSelection()) : '';
    if (!hasPlaceholder(selection) || !event.clipboardData) return;
    event.clipboardData.setData('text/plain', swap(selection));
    event.preventDefault();
  });

  // The site is a single-page app: swap again whenever it draws new content.
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      swapIn(document.body);
    });
  }

  function start() {
    nameInHeader();
    swapIn(document.body);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
