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
 * Only a plain host name (optionally with a port) and a plain path segment are accepted, and
 * everything is written as text, never as HTML.
 */
(function () {
  'use strict';

  var PLACEHOLDER = 'app.example.com';
  var DEFAULT_CORE = 'os';
  var STORE = 'workspaceGuide.platform';

  function validDomain(value) {
    return typeof value === 'string'
      && value.length > 0 && value.length <= 253
      && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(:\d{1,5})?$/i.test(value)
      && value.toLowerCase().indexOf(PLACEHOLDER) === -1;
  }

  function validCore(value) {
    return typeof value === 'string' && /^[a-z0-9_-]{1,40}$/i.test(value);
  }

  function readPlatform() {
    var params = new URLSearchParams(window.location.search);
    var domain = (params.get('domain') || '').trim().toLowerCase();
    var core = (params.get('core') || '').trim();

    if (validDomain(domain)) {
      var platform = { domain: domain, core: validCore(core) ? core : DEFAULT_CORE };
      try { window.localStorage.setItem(STORE, JSON.stringify(platform)); } catch (e) { /* private mode */ }
      return platform;
    }

    try {
      var saved = JSON.parse(window.localStorage.getItem(STORE) || 'null');
      if (saved && validDomain(saved.domain)) {
        return { domain: saved.domain, core: validCore(saved.core) ? saved.core : DEFAULT_CORE };
      }
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
    if (typeof text !== 'string') return text;
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
    return typeof text === 'string' && (text.indexOf(PLACEHOLDER) !== -1 || text.indexOf(SERVER_VARIABLE) !== -1);
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, NOSCRIPT: 1 };

  function swapIn(root) {
    if (!root) return;
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
    swapIn(document.body);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
